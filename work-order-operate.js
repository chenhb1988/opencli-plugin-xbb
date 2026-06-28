import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const WORK_ORDER_OPERATE_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/workOrderV2/operate';
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

function buildApiUrl(baseUrl, apiUrl) {
  const apiPath = new URL(apiUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function parseData(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function buildPayload(kwargs, parsedData) {
  const payload = {
    corpid: String(kwargs.corpid || ''),
    dataId: Number(kwargs.dataId || 0),
    operateType: Number(kwargs.operateType || 0),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (parsedData) {
    payload.data = parsedData;
  }

  return payload;
}

function getValidationError(payload, token, parsedData) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少 --corpid' };
  }
  if (!payload.dataId) {
    return { code: 'NO_DATAID', msg: '缺少 --dataId' };
  }
  if (!payload.operateType) {
    return { code: 'NO_OPERATETYPE', msg: '缺少 --operateType' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }
  if (parsedData === undefined) {
    return { code: 'INVALID_DATA', msg: '--data 必须是 JSON 对象字符串' };
  }

  return null;
}

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{
    dataId: '',
    code,
    msg,
    requestBody: debug ? requestBody : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRow(kwargs, data, debug, requestBody, responseBody) {
  return [{
    dataId: kwargs.dataId || '',
    code: data.code ?? '',
    msg: data.msg || '',
    requestBody: debug ? requestBody : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'work-order-operate',
  description: '工单流转接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'dataId', type: 'int', help: '工单数据id（必填）' },
    { name: 'operateType', type: 'int', help: '操作类型（必填）：1取消 2重启 3移交 4分配 5变更工单池 6抢单 7回退至工单池 8接受 9拒绝 10开始 11签到 12完成 13签退 15回退 16结算 17回访 18指派 19自由节点完成 20编辑回执单' },
    { name: 'data', type: 'str', default: '', help: '操作参数JSON字符串（可选；按operateType提供，如{"cancelReason":"xxx"}）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig(kwargs);
    const parsedData = parseData(kwargs.data);
    const payload = buildPayload(kwargs, parsedData);
    const requestBody = JSON.stringify(payload);

    const validationError = getValidationError(payload, token, parsedData);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg, debug, requestBody, '');
    }

    if (configCorpid && payload.corpid !== configCorpid) {
      return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, requestBody, '');
    }

    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, WORK_ORDER_OPERATE_API_URL), {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json;charset=UTF-8',
        sign,
      }, userId ? { userId } : {}),
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

    return makeSuccessRow(kwargs, data, debug, requestBody, responseBody);
  },
});
