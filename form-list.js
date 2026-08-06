import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const FORM_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/form/list';
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

function hasCliArg(name) {
  const flag = `--${name}`;
  return process.argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    saasMark: Number(kwargs.saasMark || 0),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (kwargs.name) {
    payload.name = String(kwargs.name);
  }
  if (hasCliArg('businessType')) {
    payload.businessType = Number(kwargs.businessType);
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!payload.saasMark) {
    return { code: 'NO_SAASMARK', msg: '缺少 --saasMark（1系统表单，2自定义表单）' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    formId: '',
    appId: '',
    menuId: '',
    businessType: '',
    isProcessForm: '',
    name: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    formId: item.formId || '',
    appId: item.appId || '',
    menuId: item.menuId || '',
    businessType: item.businessType || '',
    isProcessForm: item.isProcessForm || '',
    name: item.name || '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'form-list',
  description: '表单模板列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'saasMark', type: 'int', help: '表单类型（必填）：1系统表单，2自定义表单' },
    { name: 'businessType', type: 'int', default: '', help: '业务类型（可选）' },
    { name: 'name', type: 'str', default: '', help: '模板名称模糊查询（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'formId', 'appId', 'menuId', 'businessType', 'isProcessForm', 'name', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);
    const body = JSON.stringify(payload);

    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg);
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const headers = Object.assign({
      'Content-Type': 'application/json;charset=UTF-8',
      sign,
    }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${buildApiUrl(baseUrl, FORM_LIST_API_URL)}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
    }
    const resp = await fetch(buildApiUrl(baseUrl, FORM_LIST_API_URL), {
      method: 'POST',
      headers,
      body,
    });

    if (!resp.ok) {
      const responseText = await resp.text();
      if (debug) process.stderr.write(`[debug] ResponseBody: ${responseText}\n`);
      return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
    if (kwargs.raw) return [{ raw: responseBody }];
    if (data.code !== 1) {
      return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    }

    const formList = Array.isArray(data.result?.formList) ? data.result.formList : [];
    if (!formList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 formList 为空');
    }

    return makeSuccessRows(formList);
  },
});
