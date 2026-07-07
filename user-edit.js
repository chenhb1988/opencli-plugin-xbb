import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/user/edit';
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

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{ code, msg, requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
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
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig();
    const roleIds = parseJsonArray(kwargs.roleIds);
    const userDepInfoList = parseJsonArray(kwargs.userDepInfoList);
    const payload = { id: Number(kwargs.id || 0), name: String(kwargs.name || ''), corpid: String(kwargs.corpid || '') };
    if (Array.isArray(roleIds)) payload.roleIds = roleIds;
    if (Array.isArray(userDepInfoList)) payload.userDepInfoList = userDepInfoList;
    if (String(kwargs.avatar || '').trim()) payload.avatar = String(kwargs.avatar);
    if (String(kwargs.position || '').trim()) payload.position = String(kwargs.position);
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    const requestBody = JSON.stringify(payload);
    if (!payload.id) return makeErrorRow('NO_ID', '缺少 --id', debug, requestBody, '');
    if (!payload.name) return makeErrorRow('NO_NAME', '缺少 --name', debug, requestBody, '');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, requestBody, '');
    if (!Array.isArray(roleIds) || !roleIds.length) return makeErrorRow(roleIds === undefined ? 'INVALID_ROLEIDS' : 'NO_ROLEIDS', roleIds === undefined ? '--roleIds 必须是 JSON 数组字符串' : '缺少 --roleIds', debug, requestBody, '');
    if (!Array.isArray(userDepInfoList) || !userDepInfoList.length) return makeErrorRow(userDepInfoList === undefined ? 'INVALID_USERDEPINFOLIST' : 'NO_USERDEPINFOLIST', userDepInfoList === undefined ? '--userDepInfoList 必须是 JSON 数组字符串' : '缺少 --userDepInfoList', debug, requestBody, '');
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
