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

function resolveBaseUrl(corpid) {
  if (corpid.startsWith('ding') || corpid.includes('$$ding')) {
    return 'https://proapi.xbongbong.com';
  }
  return 'https://appapi.xbongbong.com';
}

function getRuntimeConfig(kwargs) {
  const suppliedCorpid = String(kwargs.corpid ?? '').trim();
  const suppliedToken = String(kwargs.token ?? '').trim();
  if (suppliedCorpid && suppliedToken) {
    return {
      corpid: suppliedCorpid,
      token: suppliedToken,
      baseUrl: resolveBaseUrl(suppliedCorpid),
      userId: '',
    };
  }

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

function makeErrorRow(code, msg, baseUrl = '', corpid = '') {
  return [{ corpid, token: '', checkUserId: '', resetToken: '', baseUrl, code, msg }];
}

cli({
  site: 'xbb',
  name: 'token-generate',
  description: '生成/获取个人token接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', default: '', help: '企业 ID；需与 --token 同时提供，提供后不读取本地配置' },
    { name: 'token', type: 'str', default: '', help: 'API token；需与 --corpid 同时提供，提供后不读取本地配置' },
    { name: 'checkUserId', type: 'str', default: '', help: '生成/获取个人token对应的人员id（必填）' },
    { name: 'resetToken', type: 'str', default: '0', help: '是否重置token：0不刷新（默认），1刷新token' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['corpid', 'token', 'checkUserId', 'resetToken', 'baseUrl', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig(kwargs);
    const checkUserId = (kwargs.checkUserId ? String(kwargs.checkUserId) : userId).trim();
    const resetTokenValue = String(kwargs.resetToken ?? '').trim();
    const resetToken = resetTokenValue !== '' ? Number(resetTokenValue) : 0;
    if (resetToken !== 0 && resetToken !== 1) {
      return makeErrorRow('INVALID_RESETTOKEN', '--resetToken 仅支持 0（获取）或 1（重置）', baseUrl, corpid);
    }
    const payload = { corpid, resetToken, checkUserId };
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', baseUrl, payload.corpid);
    if (!payload.checkUserId) return makeErrorRow('NO_CHECKUSERID', '缺少 --checkUserId；未填则使用配置中的userId', baseUrl, payload.corpid);
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, baseUrl, payload.corpid);
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${buildApiUrl(baseUrl, API_URL)}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${requestBody}\n`);
    }
    try {
      const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers, body: requestBody });
      if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, baseUrl, payload.corpid);
      const data = await resp.json();
      const responseBody = JSON.stringify(data);
      if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
      if (kwargs.raw) return [{ raw: responseBody }];
      if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', baseUrl, payload.corpid);
      const result = data.result;
      const tokenValue = typeof result === 'string' ? result : (result && typeof result === 'object' ? (result.personalToken ?? result.token ?? JSON.stringify(result)) : '');
      return [{ corpid: payload.corpid, token: tokenValue || '', checkUserId: payload.checkUserId, resetToken: String(resetToken), baseUrl: debug ? baseUrl : '', code: data.code ?? '', msg: data.msg || '' }];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return makeErrorRow('REQUEST_FAILED', message || '请求失败', baseUrl, payload.corpid);
    }
  },
});
