import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.json');
const DEPARTMENT_LIST_API_URL = 'https://proapi.xbongbong.com/pro/v2/api/department/list';
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

function buildPayload(kwargs) {
  const payload = {
    corpid: String(kwargs.corpid || ''),
    page: Number(kwargs.page || 1),
    pageSize: Number(kwargs.pageSize || 20),
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
    return { code: 'NO_CORPID', msg: '缺少 --corpid' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }
  if (departmentIdIn === undefined) {
    return { code: 'INVALID_DEPARTMENT_ID_IN', msg: '--departmentIdIn 必须是 JSON 数组或逗号分隔字符串' };
  }

  return null;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    rank: '',
    id: '',
    name: '',
    parentId: '',
    depIdRouter: '',
    sort: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

function makeSuccessRows(depList, debug, body, kwargs) {
  const limit = Number(kwargs.limit || 20);
  return depList.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    id: item.id || '',
    name: item.name || '',
    parentId: item.parentId || '',
    depIdRouter: item.depIdRouter || '',
    sort: item.sort || '',
    code: '',
    msg: '',
    requestBody: debug ? body : '',
    responseBody: '',
  }));
}

cli({
  site: 'xbb',
  name: 'departmentlist',
  description: '部门列表接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'departmentIdIn', type: 'str', default: '', help: '部门id列表（可选），支持 JSON 数组或逗号分隔字符串' },
    { name: 'nameLike', type: 'str', default: '', help: '部门名模糊查询（可选）' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
    { name: 'pageSize', type: 'int', default: 20, help: '每页数量（最大100）' },
    { name: 'limit', type: 'int', default: 20, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'id', 'name', 'parentId', 'depIdRouter', 'sort', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async function (_page, kwargs) {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl } = getRuntimeConfig(kwargs);
    const { payload, departmentIdIn } = buildPayload(kwargs);
    const body = JSON.stringify(payload);

    const validationError = getValidationError(payload, token, departmentIdIn);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg, debug, body, '');
    }

    if (configCorpid && payload.corpid !== configCorpid) {
      return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, DEPARTMENT_LIST_API_URL), {
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

    const depList = Array.isArray(data.result?.depList) ? data.result.depList : [];
    if (!depList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 depList 为空', debug, body, responseBody);
    }

    return makeSuccessRows(depList, debug, body, kwargs);
  },
});
