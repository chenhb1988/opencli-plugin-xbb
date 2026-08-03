import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const CLUE_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/clue/list';
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
    del: Number(kwargs.del || 0),
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };

  const userId = String(kwargs.userId || '');
  if (userId) {
    payload.userId = userId;
  }

  const isPublic = String(kwargs.isPublic ?? '');
  if (isPublic !== '') {
    payload.isPublic = Number(kwargs.isPublic);
  }

  const viewApproval = String(kwargs.viewApproval ?? '');
  if (viewApproval !== '') {
    payload.viewApproval = viewApproval;
  }

  const conditions = buildConditions(kwargs);
  if (conditions.length > 0) {
    payload.conditions = conditions;
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }

  if (!payload.formId) {
    return { code: 'NO_FORMID', msg: '缺少 --formId' };
  }

  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    rank: '',
    dataId: '',
    formId: '',
    name: '',
    contact: '',
    mobile: '',
    customerName: '',
    creatorId: '',
    addTime: '',
    updateTime: '',
    data: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRows(list, debug, body) {
  return list.map((item, index) => ({
    rank: index + 1,
    dataId: item.dataId || '',
    formId: item.formId || '',
    name: item.data?.text_1 || '',
    contact: item.data?.text_2 || '',
    mobile: item.data?.text_3 || '',
    customerName: item.data?.text_10 || '',
    creatorId: item.data?.creatorId || '',
    addTime: item.addTime || '',
    updateTime: item.updateTime || '',
    data: JSON.stringify(item.data || {}),
    code: '',
    msg: '',
    requestBody: debug ? body : '',
    responseBody: '',
  }));
}

cli({
  site: 'xbb',
  name: 'clue-list',
  description: '线索列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'del', type: 'int', default: 0, help: '0线索列表，1回收站数据' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'isPublic', type: 'int', default: '', help: '是否公海线索：0非公海，1公海，不传表示全部' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 text_1' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'dataId', 'formId', 'name', 'contact', 'mobile', 'customerName', 'creatorId', 'addTime', 'updateTime', 'data', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);
    const body = JSON.stringify(payload);

    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg, debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, CLUE_LIST_API_URL), {
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

    return makeSuccessRows(list, debug, body);
  },
});
