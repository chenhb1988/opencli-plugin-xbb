import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/workOrder/templateDetail';
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

function buildPayload(kwargs, corpid) {
  const payload = {
    formId: Number(kwargs.formId || 0),
    corpid,
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (String(kwargs.queryFlag ?? '') !== '') {
    payload.queryFlag = Number(kwargs.queryFlag);
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.formId) {
    return { code: 'NO_FORMID', msg: '缺少 --formId' };
  }
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }

  return null;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    rank: '',
    attr: '',
    attrName: '',
    fieldType: '',
    required: '',
    noRepeat: '',
    multiple: '',
    dateType: '',
    items: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRows(explainList, debug, body, kwargs) {
  return explainList.map((item, index) => ({
    rank: index + 1,
    attr: item.attr || '',
    attrName: item.attrName || '',
    fieldType: item.fieldType ?? '',
    required: item.required ?? '',
    noRepeat: item.noRepeat ?? '',
    multiple: item.multiple ?? '',
    dateType: item.dateType || '',
    items: JSON.stringify(item.items || []),
    code: '',
    msg: '',
    requestBody: debug ? body : '',
    responseBody: '',
  }));
}

cli({
  site: 'xbb',
  name: 'work-order-template-detail',
  description: '工单模板详情接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '模板id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'queryFlag', type: 'str', default: '', help: '是否查询审批数据：0非审批数据，1审批数据，2全部' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'attr', 'attrName', 'fieldType', 'required', 'noRepeat', 'multiple', 'dateType', 'items', 'code', 'msg', 'requestBody', 'responseBody'],
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
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), {
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
    if (data.code !== 1) {
      return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, body, responseBody);
    }

    const explainList = Array.isArray(data.result?.explainList) ? data.result.explainList : [];
    if (!explainList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 explainList 为空', debug, body, responseBody);
    }

    return makeSuccessRows(explainList, debug, body, kwargs);
  },
});
