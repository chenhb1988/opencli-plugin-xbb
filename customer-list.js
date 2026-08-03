import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const CUSTOMER_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/customer/list';
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

function buildConditions(kwargs) {
  const conditions = kwargs.conditions;
  if (typeof conditions === 'string' && conditions.trim()) {
    const parsed = JSON.parse(conditions);
    if (!Array.isArray(parsed)) {
      throw new Error('INVALID_CONDITIONS:conditions 必须是 JSON 数组');
    }
    return parsed;
  }

  if (!(kwargs.attr && kwargs.value)) {
    return [];
  }

  return [{
    attr: String(kwargs.attr),
    value: [String(kwargs.value)],
    symbol: String(kwargs.symbol || 'equal'),
  }];
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    formId: Number(kwargs.formId || 0),
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };
  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (String(kwargs.isPublic ?? '') !== '') payload.isPublic = Number(kwargs.isPublic);
  if (Number(kwargs.del || 0)) payload.del = Number(kwargs.del);
  if (String(kwargs.viewApproval || '') !== '') payload.viewApproval = String(kwargs.viewApproval);
  const conditions = buildConditions(kwargs);
  if (conditions.length) payload.conditions = conditions;
  return payload;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    rank: '',
    dataId: '',
    formId: '',
    name: '',
    ownerId: '',
    mobile: '',
    addTime: '',
    updateTime: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'customer-list',
  description: '客户列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'isPublic', type: 'int', default: '', help: '是否公海客户：0非公海，1公海，不传表示全部' },
    { name: 'del', type: 'int', default: 0, help: '0客户列表，1回收站数据' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'conditions', type: 'str', default: '', help: '条件集合 JSON 字符串' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 text_1(客户名称)' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'dataId', 'formId', 'name', 'ownerId', 'mobile', 'addTime', 'updateTime', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    let payload;
    try {
      payload = buildPayload(kwargs, corpid);
    } catch (error) {
      const message = String(error?.message || error);
      const separatorIndex = message.indexOf(':');
      const code = separatorIndex > 0 ? message.slice(0, separatorIndex) : 'INVALID_PAYLOAD';
      const detail = separatorIndex > 0 ? message.slice(separatorIndex + 1) : message;
      return makeErrorRow(code, detail, debug, '', detail);
    }
    const body = JSON.stringify(payload);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', debug, body, '');
    }
    if (!payload.formId) {
      return makeErrorRow('NO_FORMID', '缺少 --formId', debug, body, '');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, CUSTOMER_LIST_API_URL), {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json;charset=UTF-8',
        sign,
      }, userId ? { userId } : {}),
      body,
    });

    if (!resp.ok) {
      const responseText = await resp.text();
      return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, body, responseText);
    }

    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (kwargs.raw) return [{ raw: responseBody }];
    if (data.code !== 1) {
      return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, body, responseBody);
    }

    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 list 为空', debug, body, responseBody);
    }

    return list.map((item, index) => ({
      rank: index + 1,
      dataId: item.dataId || '',
      formId: item.formId || '',
      name: item.data?.text_1 || '',
      ownerId: item.data?.text_16 || '',
      mobile: item.data?.text_2 || '',
      addTime: item.addTime || '',
      updateTime: item.updateTime || '',
      code: '',
      msg: '',
      requestBody: debug ? body : '',
      responseBody: '',
    }));
  },
});
