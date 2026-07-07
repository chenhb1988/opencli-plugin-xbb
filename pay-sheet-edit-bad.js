import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/paySheet/editBad';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';

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
    configCorpid: String(config.corpid || '').trim(),
    token: String(config.token || '').trim(),
    baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(),
    userId: String(config.userId || '').trim(),
  };
}

function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{ dataId: '', resultCode: '', resultMsg: '', code, msg, requestBody: debug ? body : '', responseBody: debug ? responseBody : '' }];
}

function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

cli({
  site: 'xbb',
  name: 'pay-sheet-edit-bad',
  description: '编辑核销付款单坏账接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'dataList', type: 'str', help: '表单数据JSON字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid: String(kwargs.corpid || ''), dataId: Number(kwargs.dataId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    const parsedDataList = parseDataList(kwargs.dataList);
    if (parsedDataList) payload.dataList = parsedDataList;

    const body = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, body, '');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId', debug, body, '');
    if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 opencli xbb set-token --corpid <CORPID> --token <TOKEN> --userId <USERID>', debug, body, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, body, '');
    if (parsedDataList === null) return makeErrorRow('NO_DATALIST', '缺少 --dataList', debug, body, '');
    if (parsedDataList === undefined) return makeErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串', debug, body, '');

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}),
      body,
    });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, body, await resp.text());
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, body, responseBody);
    const result = data.result || {};
    return [{ dataId: result.dataId || '', resultCode: result.code ?? '', resultMsg: result.msg || '', code: data.code ?? '', msg: data.msg || '', requestBody: debug ? body : '', responseBody: debug ? responseBody : '' }];
  },
});
