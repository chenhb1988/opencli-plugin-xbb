import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const DEPARTMENT_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/department/list';
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

function parseDepartmentIdIn(raw) {
  if (Array.isArray(raw)) {
    const cleaned = raw.map((item) => String(item || '').trim()).filter(Boolean);
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
    const cleaned = parsed.map((item) => String(item || '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  } catch {
    const fromCsv = text.split(',').map((item) => item.trim()).filter(Boolean);
    return fromCsv.length ? fromCsv : undefined;
  }
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (kwargs.nameLike) {
    payload.nameLike = String(kwargs.nameLike);
  }

  const departmentIdIn = parseDepartmentIdIn(kwargs.departmentIdIn);
  if (departmentIdIn) {
    payload.departmentIdIn = departmentIdIn;
  }

  return { payload, departmentIdIn };
}

function getValidationError(payload, token, departmentIdIn) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }
  if (departmentIdIn === undefined) {
    return { code: 'INVALID_DEPARTMENT_ID_IN', msg: '--departmentIdIn 必须是 JSON 数组或逗号分隔字符串' };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    id: '',
    name: '',
    parentId: '',
    depIdRouter: '',
    sort: '',
    code,
    msg,
  }];
}

function makeSuccessRows(depList) {
  return depList.map((item, index) => ({
    rank: index + 1,
    id: item.id || '',
    name: item.name || '',
    parentId: item.parentId || '',
    depIdRouter: item.depIdRouter || '',
    sort: item.sort || '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'department-list',
  description: '部门列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'departmentIdIn', type: 'str', default: '', help: '部门id列表（可选），支持 JSON 数组或逗号分隔字符串' },
    { name: 'nameLike', type: 'str', default: '', help: '部门名模糊查询（可选）' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'id', 'name', 'parentId', 'depIdRouter', 'sort', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const { payload, departmentIdIn } = buildPayload(kwargs, corpid);
    const body = JSON.stringify(payload);

    const validationError = getValidationError(payload, token, departmentIdIn);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg);
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const headers = Object.assign({
      'Content-Type': 'application/json;charset=UTF-8',
      sign,
    }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${buildApiUrl(baseUrl, DEPARTMENT_LIST_API_URL)}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
    }
    const resp = await fetch(buildApiUrl(baseUrl, DEPARTMENT_LIST_API_URL), {
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

    const depList = Array.isArray(data.result?.depList) ? data.result.depList : [];
    if (!depList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 depList 为空');
    }

    return makeSuccessRows(depList);
  },
});
