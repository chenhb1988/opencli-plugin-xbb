import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/signIn/list';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb set-token --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function getRuntimeConfig(kwargs) {
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

function parseArray(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function buildPayload(kwargs) {
  const payload = { corpid: String(kwargs.corpid || '') };
  const stringFields = ['userId', 'signInUserId', 'signInUserName', 'country', 'province', 'city', 'district', 'address', 'nameLike', 'startAddTime', 'endAddTime', 'outCountry', 'outProvince', 'outCity', 'outDistrict', 'outAddress', 'startOutTime', 'endOutTime'];
  for (const field of stringFields) {
    if (String(kwargs[field] ?? '') !== '') payload[field] = String(kwargs[field]);
  }
  const numberFields = ['signInCustomerId', 'page', 'pageSize', 'status', 'linkBusinessType'];
  for (const field of numberFields) {
    if (String(kwargs[field] ?? '') !== '') payload[field] = Number(kwargs[field]);
  }
  const signInUserIdIn = parseArray(kwargs.signInUserIdIn);
  if (Array.isArray(signInUserIdIn)) payload.signInUserIdIn = signInUserIdIn;
  const signInCustomerIdIn = parseArray(kwargs.signInCustomerIdIn);
  if (Array.isArray(signInCustomerIdIn)) payload.signInCustomerIdIn = signInCustomerIdIn;
  return payload;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{ rank: '', userId: '', userName: '', customerId: '', customerName: '', status: '', inTime: '', outTime: '', address: '', outAddress: '', data: '', code, msg, requestBody: debug ? body : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'sign-in-list',
  description: '签到列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'signInUserId', type: 'str', default: '', help: '签到人userId（可选）' },
    { name: 'signInUserName', type: 'str', default: '', help: '签到人姓名精确匹配（可选）' },
    { name: 'signInCustomerId', type: 'int', default: '', help: '签到客户id（可选）' },
    { name: 'signInUserIdIn', type: 'str', default: '', help: '签到人userId集合，JSON数组字符串（可选）' },
    { name: 'signInCustomerIdIn', type: 'str', default: '', help: '签到客户id集合，JSON数组字符串（可选）' },
    { name: 'country', type: 'str', default: '', help: '签到国家（可选）' },
    { name: 'province', type: 'str', default: '', help: '签到省份（可选）' },
    { name: 'city', type: 'str', default: '', help: '签到城市（可选）' },
    { name: 'district', type: 'str', default: '', help: '签到区县（可选）' },
    { name: 'address', type: 'str', default: '', help: '签到详情地址（可选）' },
    { name: 'nameLike', type: 'str', default: '', help: '客户名称模糊查询（可选）' },
    { name: 'page', type: 'int', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'int', default: '', help: '每页数量（可选）' },
    { name: 'startAddTime', type: 'str', default: '', help: '开始签到时间（可选）' },
    { name: 'endAddTime', type: 'str', default: '', help: '结束签到时间（可选）' },
    { name: 'outCountry', type: 'str', default: '', help: '签退国家（可选）' },
    { name: 'outProvince', type: 'str', default: '', help: '签退省份（可选）' },
    { name: 'outCity', type: 'str', default: '', help: '签退城市（可选）' },
    { name: 'outDistrict', type: 'str', default: '', help: '签退区县（可选）' },
    { name: 'outAddress', type: 'str', default: '', help: '签退详情地址（可选）' },
    { name: 'status', type: 'int', default: '', help: '签到状态（可选）' },
    { name: 'linkBusinessType', type: 'int', default: '', help: '签到对象业务类型（可选）' },
    { name: 'startOutTime', type: 'str', default: '', help: '开始签退时间（可选）' },
    { name: 'endOutTime', type: 'str', default: '', help: '结束签退时间（可选）' },
    { name: 'limit', type: 'int', default: 20, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'userId', 'userName', 'customerId', 'customerName', 'status', 'inTime', 'outTime', 'address', 'outAddress', 'data', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig(kwargs);
    const payload = buildPayload(kwargs);
    const body = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, body, '');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, debug, body, '');
    if (String(kwargs.signInUserIdIn ?? '').trim() && !Array.isArray(parseArray(kwargs.signInUserIdIn))) return makeErrorRow('INVALID_SIGNINUSERIDIN', '--signInUserIdIn 必须是 JSON 数组字符串', debug, body, '');
    if (String(kwargs.signInCustomerIdIn ?? '').trim() && !Array.isArray(parseArray(kwargs.signInCustomerIdIn))) return makeErrorRow('INVALID_SIGNINCUSTOMERIDIN', '--signInCustomerIdIn 必须是 JSON 数组字符串', debug, body, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, body, '');
    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}), body });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, body, await resp.text());
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, body, responseBody);
    const list = Array.isArray(data.result?.signInList) ? data.result.signInList : [];
    if (!list.length) return makeErrorRow('NO_DATA', '接口成功，但 signInList 为空', debug, body, responseBody);
    return list.slice(0, Number(kwargs.limit || 20)).map((item, index) => ({ rank: index + 1, userId: item.userId || '', userName: item.userName || '', customerId: item.customerId || '', customerName: item.customerName || '', status: item.status ?? '', inTime: item.inTime || '', outTime: item.outTime || '', address: item.address || '', outAddress: item.outAddress || '', data: JSON.stringify(item || {}), code: '', msg: '', requestBody: debug ? body : '', responseBody: '' }));
  },
});
