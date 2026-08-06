import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/communicatePlan/list';
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

function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function buildConditions(kwargs) {
  if (String(kwargs.conditions ?? '').trim()) {
    const parsed = JSON.parse(String(kwargs.conditions));
    if (!Array.isArray(parsed)) {
      throw new Error('INVALID_CONDITIONS:conditions 必须是 JSON 数组');
    }
    return parsed;
  }
  if (!(kwargs.attr && kwargs.value)) {
    return [];
  }
  return [{ attr: String(kwargs.attr), value: [String(kwargs.value)], symbol: String(kwargs.symbol || 'equal') }];
}

function makeErrorRow(code, msg) {
  return [{ rank: '', dataId: '', formId: '', name: '', customer: '', remindType: '', visitType: '', visitTime: '', addTime: '', updateTime: '', data: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'communicate-plan-list',
  description: '访客计划列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'conditions', type: 'str', default: '', help: '筛选条件 JSON 数组字符串，优先级高于 --attr/--value' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 date_1' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'dataId', 'formId', 'name', 'customer', 'remindType', 'visitType', 'visitTime', 'addTime', 'updateTime', 'data', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    let conditions;
    try {
      conditions = buildConditions(kwargs);
    } catch (error) {
      const message = String(error?.message || error);
      const separatorIndex = message.indexOf(':');
      const code = separatorIndex > 0 ? message.slice(0, separatorIndex) : 'INVALID_CONDITIONS';
      const detail = separatorIndex > 0 ? message.slice(separatorIndex + 1) : message;
      return makeErrorRow(code, detail);
    }
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { formId: Number(kwargs.formId || 0), corpid };
    if (String(kwargs.page ?? '') !== '') payload.page = Number(kwargs.page);
    if (String(kwargs.pageSize ?? '') !== '') payload.pageSize = Number(kwargs.pageSize);
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (conditions.length) payload.conditions = conditions;
    const body = JSON.stringify(payload);
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    if (!conditions.length) return makeErrorRow('NO_CONDITIONS', '缺少筛选条件，请传 --conditions 或 --attr/--value');
    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const apiUrl = buildApiUrl(baseUrl, API_URL);
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
    }
    const resp = await fetch(apiUrl, { method: 'POST', headers, body });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
    if (kwargs.raw) return [{ raw: responseBody }];
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) return makeErrorRow('NO_DATA', '接口成功，但 list 为空');
    return list.map((item, index) => ({ rank: index + 1, dataId: item.dataId || '', formId: item.formId || '', name: item.data?.text_1 || '', customer: item.data?.text_2 || '', remindType: item.data?.text_5 || '', visitType: item.data?.text_4 || '', visitTime: item.data?.date_1 || '', addTime: item.addTime || '', updateTime: item.updateTime || '', data: JSON.stringify(item.data || {}), code: '', msg: '' }));
  },
});
