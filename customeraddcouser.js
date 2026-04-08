import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const ADD_COUSER_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/customer/addCoUser';
const MISSING_TOKEN_MESSAGE = '缺少 token；请传 --token，或先执行 opencli xbb set-token --token <TOKEN>';

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function getToken(kwargs) {
  return String(kwargs.token || readConfig().token || '');
}

function parseBusinessUserIdList(raw) {
  if (Array.isArray(raw)) {
    const cleaned = raw.map(function (item) {
      return String(item || '').trim();
    }).filter(Boolean);

    return cleaned.length ? cleaned : null;
  }

  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const cleaned = parsed.map(function (item) {
      return String(item || '').trim();
    }).filter(Boolean);

    return cleaned.length ? cleaned : undefined;
  } catch {
    const fromCsv = text.split(',').map(function (item) {
      return item.trim();
    }).filter(Boolean);

    return fromCsv.length ? fromCsv : undefined;
  }
}

function buildPayload(kwargs) {
  const payload = {
    dataId: Number(kwargs.dataId || 0),
    corpid: String(kwargs.corpid || ''),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }

  if (kwargs.mainUserId) {
    payload.mainUserId = String(kwargs.mainUserId);
  }

  const businessUserIdList = parseBusinessUserIdList(kwargs.businessUserIdList);
  if (businessUserIdList) {
    payload.businessUserIdList = businessUserIdList;
  }

  return { payload, businessUserIdList };
}

function getValidationError(payload, token, businessUserIdList) {
  if (!payload.dataId) {
    return { code: 'NO_DATAID', msg: '缺少 --dataId' };
  }
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少 --corpid' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }
  if (businessUserIdList === null) {
    return { code: 'NO_BUSINESS_USER_LIST', msg: '缺少 --businessUserIdList' };
  }
  if (businessUserIdList === undefined) {
    return { code: 'INVALID_BUSINESS_USER_LIST', msg: '--businessUserIdList 必须是 JSON 数组或逗号分隔字符串' };
  }

  return null;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    messageList: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRow(data, debug, body, responseBody) {
  const messageList = Array.isArray(data.result?.messageList) ? data.result.messageList : [];

  return [{
    messageList: messageList.join(', '),
    code: data.code ?? '',
    msg: data.msg || '',
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'customeraddcouser',
  description: '客户添加协同人接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '客户id（必填）' },
    { name: 'businessUserIdList', type: 'str', help: '协同人id列表（必填），支持 JSON 数组或逗号分隔字符串' },
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'mainUserId', type: 'str', default: '', help: '团队负责人id（团队隔离模式可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['messageList', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (_page, kwargs) {
    const debug = Boolean(kwargs.debug);
    const token = getToken(kwargs);
    const { payload, businessUserIdList } = buildPayload(kwargs);
    const body = JSON.stringify(payload);

    const validationError = getValidationError(payload, token, businessUserIdList);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg, debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(ADD_COUSER_API_URL, {
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

    return makeSuccessRow(data, debug, body, responseBody);
  },
});
