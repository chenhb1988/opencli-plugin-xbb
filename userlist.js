import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const USER_LIST_API_PATH = '/pro/v2/api/user/list';

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

function buildApiUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, '')}${USER_LIST_API_PATH}`;
}

function buildPayload(kwargs) {
  const payload = {
    corpid: String(kwargs.corpid || ''),
    page: Number(kwargs.page || 1),
    pageSize: Number(kwargs.pageSize || 20),
  };
  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (kwargs.name) payload.name = String(kwargs.name);
  if (kwargs.nameLike) payload.nameLike = String(kwargs.nameLike);
  if (Number(kwargs.departmentId || 0)) payload.departmentId = Number(kwargs.departmentId);
  if (Number(kwargs.delIgnore || 0)) payload.delIgnore = Number(kwargs.delIgnore);
  return payload;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    rank: '',
    userId: '',
    name: '',
    position: '',
    jobnumber: '',
    avatar: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'userlist',
  description: '用户列表接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'name', type: 'str', default: '', help: '员工姓名完全匹配（可选）' },
    { name: 'nameLike', type: 'str', default: '', help: '员工姓名模糊查询（可选）' },
    { name: 'departmentId', type: 'int', default: 0, help: '部门id筛选（可选）' },
    { name: 'delIgnore', type: 'int', default: 0, help: '是否查询已离职员工，0不查/1查询' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
    { name: 'pageSize', type: 'int', default: 20, help: '每页数量（最大100）' },
    { name: 'limit', type: 'int', default: 20, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'userId', 'name', 'position', 'jobnumber', 'avatar', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (_page, kwargs) => {
    const debug = Boolean(kwargs.debug);
    const payload = buildPayload(kwargs);
    const body = JSON.stringify(payload);
    const { configCorpid, token, baseUrl } = getRuntimeConfig(kwargs);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, body, '');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请传 --token，或先执行 opencli xbb set-token --corpid <CORPID> --token <TOKEN>', debug, body, '');
    }
    if (configCorpid && payload.corpid !== configCorpid) {
      return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const apiUrl = buildApiUrl(baseUrl);
    const resp = await fetch(apiUrl, {
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

    const list = Array.isArray(data.result?.userList) ? data.result.userList : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 userList 为空', debug, body, responseBody);
    }

    return list.slice(0, Number(kwargs.limit || 20)).map((item, index) => ({
      rank: index + 1,
      userId: item.userId || '',
      name: item.name || '',
      position: item.position || '',
      jobnumber: item.jobnumber || '',
      avatar: item.avatar || '',
      code: '',
      msg: '',
      requestBody: debug ? body : '',
      responseBody: '',
    }));
  },
});
