import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/workTask/add';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function getRuntimeConfig() {
  const config = readConfig();
  return {
    corpid: String(config.corpid || '').trim(),
    token: String(config.token || '').trim(),
    baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(),
    userId: String(config.userId || '').trim(),
  };
}

function buildApiUrl(baseUrl, apiUrl) {
  const apiPath = new URL(apiUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function parseJsonLikeObject(text) {
  let index = 0;

  function skipWhitespace() {
    while (index < text.length && /\s/.test(text[index])) index += 1;
  }

  function consume(char) {
    skipWhitespace();
    if (text[index] !== char) throw new Error('Invalid input');
    index += 1;
  }

  function parseQuotedString(quote) {
    let value = '';
    index += 1;
    while (index < text.length) {
      const char = text[index];
      if (char === '\\') {
        const next = text[index + 1];
        if (next === undefined) throw new Error('Invalid input');
        value += next === quote || next === '\\' ? next : char + next;
        index += 2;
        continue;
      }
      if (char === quote) {
        index += 1;
        return value;
      }
      value += char;
      index += 1;
    }
    throw new Error('Invalid input');
  }

  function parseBareValue(stopChars) {
    const start = index;
    while (index < text.length && !stopChars.includes(text[index])) index += 1;
    const raw = text.slice(start, index).trim();
    if (!raw) throw new Error('Invalid input');
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (/^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return Number(raw);
    return raw;
  }

  function parseValue(stopChars) {
    skipWhitespace();
    const char = text[index];
    if (char === '{') return parseObject();
    if (char === '[') return parseArray();
    if (char === '"' || char === "'") return parseQuotedString(char);
    return parseBareValue(stopChars);
  }

  function parseObject() {
    const value = {};
    consume('{');
    skipWhitespace();
    if (text[index] === '}') {
      index += 1;
      return value;
    }
    while (index < text.length) {
      skipWhitespace();
      let key;
      if (text[index] === '"' || text[index] === "'") {
        key = parseQuotedString(text[index]);
      } else {
        const keyStart = index;
        while (index < text.length && ![':', ',', '}'].includes(text[index])) index += 1;
        key = text.slice(keyStart, index).trim();
      }
      if (!key) throw new Error('Invalid input');
      consume(':');
      value[key] = parseValue(',}');
      skipWhitespace();
      if (text[index] === ',') {
        index += 1;
        continue;
      }
      consume('}');
      return value;
    }
    throw new Error('Invalid input');
  }

  function parseArray() {
    const value = [];
    consume('[');
    skipWhitespace();
    if (text[index] === ']') {
      index += 1;
      return value;
    }
    while (index < text.length) {
      value.push(parseValue(',]'));
      skipWhitespace();
      if (text[index] === ',') {
        index += 1;
        continue;
      }
      consume(']');
      return value;
    }
    throw new Error('Invalid input');
  }

  const parsed = parseValue('');
  skipWhitespace();
  if (index !== text.length) throw new Error('Invalid input');
  return parsed;
}

function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

  const candidates = [text];
  if (text.includes('\\"')) candidates.push(text.replaceAll('\\"', '"'));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Try the repaired JSON and JSON-like fallbacks below.
    }
  }

  try {
    const parsed = parseJsonLikeObject(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function buildPayload(kwargs, parsedDataList, corpid, defaultUserId) {
  const payload = { corpid };
  const userId = String(kwargs.userId || defaultUserId || '').trim();
  if (userId) payload.userId = userId;
  if (parsedDataList) payload.dataList = parsedDataList;
  return payload;
}

function getValidationError(payload, token, parsedDataList) {
  if (!payload.corpid) return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  if (!token) return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  if (parsedDataList === null) return { code: 'NO_DATALIST', msg: '缺少 --dataList' };
  if (parsedDataList === undefined) return { code: 'INVALID_DATALIST', msg: '--dataList 解析失败；需传 JSON 对象字符串。PowerShell 示例：opencli.cmd --% xbb work-task-add --dataList "{\\"text_1\\":\\"name1\\"}"' };
  return null;
}

function makeErrorRow(code, msg) {
  return [{ dataId: '', resultCode: '', resultMsg: '', code, msg }];
}

function makeSuccessRow(data) {
  const result = data.result || {};
  return [{ dataId: result.dataId || '', resultCode: result.code ?? '', resultMsg: result.msg || '', code: data.code ?? '', msg: data.msg || '' }];
}

cli({
  site: 'xbb',
  name: 'work-task-add',
  description: '新增任务接口（businessType: 21500）,{ "text_1": "{任务名称}", "ownerId": [ "{执行人userId}"  ],"date_1":1788969600 ,"date_2":1789833600 ,"text_3":"{任务描述}"}',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataList', type: 'str', help: '任务数据JSON字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const parsedDataList = parseDataList(kwargs.dataList);
    const payload = buildPayload(kwargs, parsedDataList, corpid, userId);
    const requestBody = JSON.stringify(payload);
    const validationError = getValidationError(payload, token, parsedDataList);
    if (validationError) return makeErrorRow(validationError.code, validationError.msg);
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    const apiUrl = buildApiUrl(baseUrl, API_URL);
    if (debug) {
      process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${requestBody}\n`);
    }
    const resp = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    return makeSuccessRow(data);
  },
});
