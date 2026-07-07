import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/communicatePlan/singleOperate';
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

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{ code, msg, requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'communicate-plan-single-operate',
  description: '访客计划延期接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'dataId', type: 'int', help: '访客计划id（必填）' },
    { name: 'delayCause', type: 'str', help: '延期原因（必填）' },
    { name: 'delayTime', type: 'int', help: '延期时间时间戳（必填）' },
    { name: 'delayMemo', type: 'str', default: '', help: '延期备注（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = {
      corpid: String(kwargs.corpid || ''),
      dataId: Number(kwargs.dataId || 0),
      delayCause: String(kwargs.delayCause || ''),
      delayTime: Number(kwargs.delayTime || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.delayMemo ?? '') !== '') payload.delayMemo = String(kwargs.delayMemo);
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, requestBody, '');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId', debug, requestBody, '');
    if (!payload.delayCause) return makeErrorRow('NO_DELAYCAUSE', '缺少 --delayCause', debug, requestBody, '');
    if (!payload.delayTime) return makeErrorRow('NO_DELAYTIME', '缺少 --delayTime', debug, requestBody, '');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, debug, requestBody, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, requestBody, '');
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}), body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, await resp.text());
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody);
    return [{ code: data.code ?? '', msg: data.msg || '', requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
  },
});
