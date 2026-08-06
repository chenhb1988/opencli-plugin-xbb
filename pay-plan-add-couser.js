import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/payPlan/addCoUser';
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
    corpid: String(config.corpid || '').trim(),
    token: String(config.token || '').trim(),
    baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(),
    userId: String(config.userId || '').trim(),
  };
}

function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function makeErrorRow(code, msg) {
  return [{ resultCode: '', resultMsg: '', messageList: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'pay-plan-add-couser',
  description: '付款计划添加协同人接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '付款计划id（必填）' },
    { name: 'businessUserIdList', type: 'str', help: '需添加的协同人id列表，JSON数组字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultCode', 'resultMsg', 'messageList', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { dataId: Number(kwargs.dataId || 0), corpid };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    let businessUserIdList;
    try {
      businessUserIdList = JSON.parse(String(kwargs.businessUserIdList || ''));
    } catch {
      businessUserIdList = null;
    }
    if (Array.isArray(businessUserIdList)) payload.businessUserIdList = businessUserIdList;

    const requestBody = JSON.stringify(payload);
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!Array.isArray(businessUserIdList) || !businessUserIdList.length) return makeErrorRow('NO_USERIDLIST', '缺少 --businessUserIdList 或格式不正确，需为JSON数组');
    if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');

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
    return [{ resultCode: data.code ?? '', resultMsg: data.msg || '', messageList: JSON.stringify(data.result?.messageList || []), code: data.code ?? '', msg: data.msg || '' }];
  },
});
