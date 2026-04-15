import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const FORM_GET_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/form/get';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const MISSING_TOKEN_MESSAGE = '缺少 token；请传 --token，或先执行 opencli xbb set-token --corpid <CORPID> --token <TOKEN>';

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
    token: String(kwargs.token || config.token || '').trim(),
    baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(),
  };
}

function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function buildPayload(kwargs) {
  const payload = {
    formId: Number(kwargs.formId || 0),
    corpid: String(kwargs.corpid || ''),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (String(kwargs.subBusinessType ?? '') !== '') {
    payload.subBusinessType = Number(kwargs.subBusinessType);
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.formId) {
    return { code: 'NO_FORMID', msg: '缺少 --formId' };
  }
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少 --corpid' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
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
    showType: '',
    dateType: '',
    items: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRows(explainList, debug, body, kwargs) {
  const limit = Number(kwargs.limit || 50);
  return explainList.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    attr: item.attr || '',
    attrName: item.attrName || '',
    fieldType: item.fieldType ?? '',
    required: item.required ?? '',
    noRepeat: item.noRepeat ?? '',
    showType: item.showType ?? '',
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
  name: 'formget',
  description: '表单模板字段解释接口',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'subBusinessType', type: 'int', default: '', help: '表单业务子类型（可选）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'limit', type: 'int', default: 50, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'attr', 'attrName', 'fieldType', 'required', 'noRepeat', 'showType', 'dateType', 'items', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (_page, kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl } = getRuntimeConfig(kwargs);
    const payload = buildPayload(kwargs);
    const body = JSON.stringify(payload);

    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg, debug, body, '');
    }

    if (configCorpid && payload.corpid !== configCorpid) {
      return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, FORM_GET_API_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        sign,
      },
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
