import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';
import { readActiveConfig } from './xbb-config.js';

const CONFIG_FILE = path.join(os.homedir(), '.xbbcli', 'config.env');
const BUSINESS_INFO_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/businessInfo/getList';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function readConfig() {
  return readActiveConfig();
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
    keyword: String(kwargs.keyword || '').trim(),
    corpid,
  };
}

function getValidationError(payload, token) {
  if (!payload.keyword) {
    return { code: 'NO_KEYWORD', msg: '缺少 --keyword' };
  }

  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }

  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    pid: '',
    enterpriseName: '',
    code,
    msg,
  }];
}

function makeSuccessRows(items) {
  return items.map((item, index) => ({
    rank: index + 1,
    pid: item.pid || '',
    enterpriseName: item.enterpriseName || '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'business-info-search',
  description: '按关键词搜索企业，返回企业准确全称与 pid（需购买工商查询服务方可调用）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'keyword', type: 'str', help: '企业名称关键词（必填，支持模糊匹配）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'pid', 'enterpriseName', 'code', 'msg'],
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
    const apiUrl = buildApiUrl(baseUrl, BUSINESS_INFO_LIST_API_URL);
    const headers = Object.assign({
      'Content-Type': 'application/json;charset=UTF-8',
      sign,
    }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
    }
    const resp = await fetch(apiUrl, {
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
    if (kwargs.raw) {
      return [{ raw: responseBody }];
    }
    if (data.code !== 1) {
      return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    }

    const items = Array.isArray(data.result?.data?.items) ? data.result.data.items : [];
    if (!items.length) {
      return makeErrorRow('NO_DATA', '接口成功，但企业列表为空');
    }

    return makeSuccessRows(items);
  },
});
