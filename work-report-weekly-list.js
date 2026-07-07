import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/workReportWeekly/list';
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

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{ rank: '', dataId: '', formId: '', addTime: '', updateTime: '', data: '', code, msg, requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'work-report-weekly-list',
  description: '周报列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'conditions', type: 'str', default: '', help: '筛选条件 JSON 数组字符串，优先级高于 --attr/--value' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
    { name: 'pageSize', type: 'int', default: 20, help: '每页数量（最大100）' },
    { name: 'limit', type: 'int', default: 20, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'dataId', 'formId', 'addTime', 'updateTime', 'data', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    let conditions;
    try {
      conditions = buildConditions(kwargs);
    } catch (error) {
      const message = String(error?.message || error);
      const separatorIndex = message.indexOf(':');
      const code = separatorIndex > 0 ? message.slice(0, separatorIndex) : 'INVALID_CONDITIONS';
      const detail = separatorIndex > 0 ? message.slice(separatorIndex + 1) : message;
      return makeErrorRow(code, detail, debug, '', detail);
    }
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { page: Number(kwargs.page || 1), pageSize: Number(kwargs.pageSize || 20), corpid: String(kwargs.corpid || '') };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (conditions.length) payload.conditions = conditions;
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, requestBody, '');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, debug, requestBody, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, requestBody, '');
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}), body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, await resp.text());
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody);
    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) return makeErrorRow('NO_DATA', '接口成功，但 list 为空', debug, requestBody, responseBody);
    return list.slice(0, Number(kwargs.limit || 20)).map((item, index) => ({ rank: index + 1, dataId: item.dataId || '', formId: item.formId || '', addTime: item.addTime || '', updateTime: item.updateTime || '', data: JSON.stringify(item.data || {}), code: '', msg: '', requestBody: debug ? requestBody : '', responseBody: '' }));
  },
});
