import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/workReportDaily/add';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb set-token --corpid <CORPID> --token <TOKEN> --userId <USERID>';

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

function buildApiUrl(baseUrl, apiUrl) {
  const apiPath = new URL(apiUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }
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

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{ dataId: '', code, msg, requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'work-report-daily-add',
  description: '新建日报接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'dataList', type: 'str', help: '日报数据JSON字符串（必填）' },
    { name: 'userId', type: 'str', help: '工作报告提交人userId（必填）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl } = getRuntimeConfig();
    const parsedDataList = parseDataList(kwargs.dataList);
    const payload = { corpid: String(kwargs.corpid || ''), userId: String(kwargs.userId || '') };
    if (parsedDataList) payload.dataList = parsedDataList;
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, requestBody, '');
    if (!payload.userId) return makeErrorRow('NO_USERID', '缺少 --userId', debug, requestBody, '');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, debug, requestBody, '');
    if (parsedDataList === null) return makeErrorRow('NO_DATALIST', '缺少 --dataList', debug, requestBody, '');
    if (parsedDataList === undefined) return makeErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串', debug, requestBody, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, requestBody, '');
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8', sign, userId: payload.userId }, body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, await resp.text());
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody);
    return [{ dataId: data.result?.dataId || '', code: data.code ?? '', msg: data.msg || '', requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
  },
});
