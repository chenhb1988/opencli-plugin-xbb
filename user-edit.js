import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/user/edit';
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

function parseJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function makeErrorRow(code, msg) {
  return [{ code, msg }];
}

cli({
  site: 'xbb',
  name: 'user-edit',
  description: '编辑用户接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'id', type: 'int', help: '用户id（必填）' },
    { name: 'name', type: 'str', help: '用户名称（必填）' },
    { name: 'roleIds', type: 'str', help: '角色id列表，JSON数组字符串（必填）' },
    { name: 'userDepInfoList', type: 'str', help: '部门信息列表，JSON数组字符串（必填）' },
    { name: 'avatar', type: 'str', default: '', help: '头像（可选）' },
    { name: 'position', type: 'str', default: '', help: '职位（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const roleIds = parseJsonArray(kwargs.roleIds);
    const userDepInfoList = parseJsonArray(kwargs.userDepInfoList);
    const payload = { id: Number(kwargs.id || 0), name: String(kwargs.name || ''), corpid };
    if (Array.isArray(roleIds)) payload.roleIds = roleIds;
    if (Array.isArray(userDepInfoList)) payload.userDepInfoList = userDepInfoList;
    if (String(kwargs.avatar || '').trim()) payload.avatar = String(kwargs.avatar);
    if (String(kwargs.position || '').trim()) payload.position = String(kwargs.position);
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    const requestBody = JSON.stringify(payload);
    if (!payload.id) return makeErrorRow('NO_ID', '缺少 --id');
    if (!payload.name) return makeErrorRow('NO_NAME', '缺少 --name');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!Array.isArray(roleIds) || !roleIds.length) return makeErrorRow(roleIds === undefined ? 'INVALID_ROLEIDS' : 'NO_ROLEIDS', roleIds === undefined ? '--roleIds 必须是 JSON 数组字符串' : '缺少 --roleIds');
    if (!Array.isArray(userDepInfoList) || !userDepInfoList.length) return makeErrorRow(userDepInfoList === undefined ? 'INVALID_USERDEPINFOLIST' : 'NO_USERDEPINFOLIST', userDepInfoList === undefined ? '--userDepInfoList 必须是 JSON 数组字符串' : '缺少 --userDepInfoList');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
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
    return [{ code: data.code ?? '', msg: data.msg || '' }];
  },
});
