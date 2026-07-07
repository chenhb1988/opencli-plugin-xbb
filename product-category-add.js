import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/product/categoryAdd';
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

function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

function buildPayload(kwargs) {
  const payload = {
    corpid: String(kwargs.corpid || ''),
    name: String(kwargs.name || '').trim(),
  };

  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (String(kwargs.parentId ?? '') !== '') payload.parentId = Number(kwargs.parentId);
  if (String(kwargs.sort ?? '') !== '') payload.sort = Number(kwargs.sort);
  if (String(kwargs.router || '').trim()) payload.router = String(kwargs.router).trim();

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.corpid) return { code: 'NO_CORPID', msg: '缺少 --corpid' };
  if (!payload.name) return { code: 'NO_NAME', msg: '缺少 --name' };
  if (!token) return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
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

function makeSuccessRow(data, debug, requestBody, responseBody) {
  const result = data.result || {};
  return [{
    dataId: result.dataId || result.id || '',
    code: data.code ?? '',
    msg: data.msg || '',
    requestBody: debug ? requestBody : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'product-category-add',
  description: '新建产品分类接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'name', type: 'str', help: '分类名称（必填）' },
    { name: 'parentId', type: 'int', default: '', help: '父分类id（可选）' },
    { name: 'router', type: 'str', default: '', help: '路由（可选）' },
    { name: 'sort', type: 'int', default: '', help: '排序（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig(kwargs);
    const payload = buildPayload(kwargs);
    const requestBody = JSON.stringify(payload);

    const validationError = getValidationError(payload, token);
    if (validationError) return makeErrorRow(validationError.code, validationError.msg, debug, requestBody, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, requestBody, '');

    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}),
      body: requestBody,
    });

    if (!resp.ok) {
      const responseText = await resp.text();
      return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, responseText);
    }

    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody);

    return makeSuccessRow(data, debug, requestBody, responseBody);
  },
});
