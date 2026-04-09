import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const FORM_DATA_DELETE_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/paas/del';
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

function buildApiUrl(baseUrl, apiUrl) {
  const apiPath = new URL(apiUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function buildPayload(kwargs) {
  const payload = {
    dataId: Number(kwargs.dataId || 0),
    corpid: String(kwargs.corpid || ''),
  };

  const userId = String(kwargs.userId || '');
  if (userId) {
    payload.userId = userId;
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.dataId) {
    return { code: 'NO_DATAID', msg: '缺少 --dataId' };
  }
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少 --corpid' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{
    dataId: '',
    code,
    msg,
    errorDataMemo: '',
    requestBody: debug ? requestBody : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRow(data, debug, requestBody, responseBody) {
  return [{
    dataId: '',
    code: data.code ?? '',
    msg: data.msg || '',
    errorDataMemo: data.result?.errorDataMemo || '',
    requestBody: debug ? requestBody : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'formdatadel',
  description: '删除自定义表单数据接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg', 'errorDataMemo', 'requestBody', 'responseBody'],
  func: async function (_page, kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl } = getRuntimeConfig(kwargs);
    const payload = buildPayload(kwargs);
    const requestBody = JSON.stringify(payload);

    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg, debug, requestBody, '');
    }

    if (configCorpid && payload.corpid !== configCorpid) {
      return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, requestBody, '');
    }

    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, FORM_DATA_DELETE_API_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        sign,
      },
      body: requestBody,
    });

    if (!resp.ok) {
      const responseText = await resp.text();
      return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, responseText);
    }

    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) {
      return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody);
    }

    return makeSuccessRow(data, debug, requestBody, responseBody);
  },
});
