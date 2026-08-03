import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/user/generateToken';
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

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '', baseUrl = '', corpid = '') {
  return [{ corpid, token: '', checkUserId: '', resetToken: '', baseUrl: debug ? baseUrl : '', code, msg, requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'token-generate',
  description: '生成/获取个人token接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'checkUserId', type: 'str', default: '', help: '生成/获取个人token对应的人员id（必填）' },
    { name: 'resetToken', type: 'str', default: '0', help: '是否重置token：0不刷新（默认），1刷新token' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['corpid', 'token', 'checkUserId', 'resetToken', 'baseUrl', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const checkUserId = (kwargs.checkUserId ? String(kwargs.checkUserId) : userId).trim();
    const resetToken = String(kwargs.resetToken ?? '') !== '' ? Number(kwargs.resetToken) : 0;
    const payload = { corpid, resetToken, checkUserId };
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', debug, requestBody, '', baseUrl, payload.corpid);
    if (!payload.checkUserId) return makeErrorRow('NO_CHECKUSERID', '缺少 --checkUserId；未填则使用配置中的userId', debug, requestBody, '', baseUrl, payload.corpid);
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, debug, requestBody, '', baseUrl, payload.corpid);
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}), body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, await resp.text(), baseUrl, payload.corpid);
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (kwargs.raw) return [{ raw: responseBody }];
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody, baseUrl, payload.corpid);
    const result = data.result;
    const tokenValue = typeof result === 'string' ? result : (result && typeof result === 'object' ? (result.personalToken ?? result.token ?? JSON.stringify(result)) : '');
    return [{ corpid: payload.corpid, token: tokenValue || '', checkUserId: payload.checkUserId, resetToken: String(resetToken), baseUrl: debug ? baseUrl : '', code: data.code ?? '', msg: data.msg || '', requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
  },
});
