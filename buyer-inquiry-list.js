import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const BUYER_INQUIRY_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/buyerInquiry/list';
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

function buildPayload(kwargs, corpid) {
  return {
    corpid,
    page: Number(String(kwargs.page ?? '') === '' ? 1 : kwargs.page),
    pageSize: Number(String(kwargs.pageSize ?? '') === '' ? 20 : kwargs.pageSize),
  };
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }
  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    inquiryId: '',
    inquiryNo: '',
    buyerName: '',
    status: '',
    createTime: '',
    data: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    inquiryId: item.inquiryId ?? item.dataId ?? item.id ?? '',
    inquiryNo: item.inquiryNo ?? item.no ?? item.serialNo ?? '',
    buyerName: item.buyerName ?? item.customerName ?? item.name ?? '',
    status: item.status ?? item.state ?? '',
    createTime: item.createTime ?? item.addTime ?? item.updateTime ?? '',
    data: JSON.stringify(item),
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'buyer-inquiry-list',
  description: '采购询价列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'page', type: 'str', default: '1', help: '页码' },
    { name: 'pageSize', type: 'str', default: '20', help: '每页数量' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'inquiryId', 'inquiryNo', 'buyerName', 'status', 'createTime', 'data', 'code', 'msg'],
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
    const apiUrl = buildApiUrl(baseUrl, BUYER_INQUIRY_LIST_API_URL);
    if (debug) {
      process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
    }
    const resp = await fetch(apiUrl, { method: 'POST', headers, body });
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

    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 list 为空');
    }
    return makeSuccessRows(list);
  },
});
