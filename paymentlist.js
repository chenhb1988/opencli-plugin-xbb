import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const PAYMENT_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/payment/list';
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

function buildPayload(kwargs) {
  const payload = {
    corpid: String(kwargs.corpid || ''),
    page: Number(kwargs.page || 1),
    pageSize: Number(kwargs.pageSize || 20),
  };

  const userId = String(kwargs.userId || '');
  if (userId) {
    payload.userId = userId;
  }

  const viewApproval = String(kwargs.viewApproval ?? '');
  if (viewApproval !== '') {
    payload.viewApproval = viewApproval;
  }

  const conditions = buildConditions(kwargs);
  if (conditions.length) {
    payload.conditions = conditions;
  }

  return payload;
}

function getValidationError(payload, token) {
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
    dataId: '',
    formId: '',
    serialNo: '',
    customerId: '',
    contractId: '',
    receivableAmount: '',
    receivedAmount: '',
    unreceivedAmount: '',
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

function makeSuccessRows(list, debug, body, kwargs) {
  const limit = Number(kwargs.limit || 20);
  return list.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    dataId: item.dataId || '',
    formId: item.formId || '',
    serialNo: item.data?.serialNo || '',
    customerId: item.data?.text_4 || '',
    contractId: item.data?.text_5 || '',
    receivableAmount: item.data?.num_1 || '',
    receivedAmount: item.data?.num_2 || '',
    unreceivedAmount: item.data?.num_3 || '',
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
  name: 'paymentlist',
  description: '应收款列表接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 serialNo' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
    { name: 'pageSize', type: 'int', default: 20, help: '每页数量（最大100）' },
    { name: 'limit', type: 'int', default: 20, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'dataId', 'formId', 'serialNo', 'customerId', 'contractId', 'receivableAmount', 'receivedAmount', 'unreceivedAmount', 'creatorId', 'addTime', 'updateTime', 'data', 'code', 'msg', 'requestBody', 'responseBody'],
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
    const resp = await fetch(buildApiUrl(baseUrl, PAYMENT_LIST_API_URL), {
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

    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 list 为空', debug, body, responseBody);
    }

    return makeSuccessRows(list, debug, body, kwargs);
  },
});
