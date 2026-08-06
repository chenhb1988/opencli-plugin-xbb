import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/customer/invoice/info';
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

function buildApiUrl(baseUrl, apiUrl) {
  const apiPath = new URL(apiUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function makeErrorRow(code, msg) {
  return [{ dataId: '', type: '', title: '', taxpayerNo: '', registeredPhone: '', invoiceAddress: '', bank: '', account: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'customer-invoice-info',
  description: '客户开票信息接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'customerId', type: 'int', help: '客户id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'type', 'title', 'taxpayerNo', 'registeredPhone', 'invoiceAddress', 'bank', 'account', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, customerId: Number(kwargs.customerId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.customerId) return makeErrorRow('NO_CUSTOMERID', '缺少 --customerId');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${buildApiUrl(baseUrl, API_URL)}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${requestBody}\n`);
    }
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers, body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) return [{ dataId: '', type: '', title: '', taxpayerNo: '', registeredPhone: '', invoiceAddress: '', bank: '', account: '', code: data.code ?? '', msg: data.msg || '' }];
    return list.map((item) => ({
      dataId: item.dataId || '',
      type: item.type || '',
      title: item.title || '',
      taxpayerNo: item.taxpayerNo || '',
      registeredPhone: item.registeredPhone || '',
      invoiceAddress: item.invoiceAddress || '',
      bank: item.bank || '',
      account: item.account || '',
      code: data.code ?? '',
      msg: data.msg || '',
    }));
  },
});
