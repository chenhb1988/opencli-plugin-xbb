import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './xbb-registry.js';
import { readActiveConfig } from './xbb-config.js';

const CONFIG_DIR = path.join(os.homedir(), '.xbbcli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';
const ORIGINAL_TEXT_LIST_API_PATH = '/pro/v2/api/aiAgent/getAiOriginalText';
let lastPagination = null;

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

function buildApiUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, '')}${ORIGINAL_TEXT_LIST_API_PATH}`;
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    ...(String(kwargs.userId ?? '') !== '' ? { userId: String(kwargs.userId) } : {}),
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
    ...(String(kwargs.startTime ?? '') !== '' ? { startTime: Number(kwargs.startTime) } : {}),
    ...(String(kwargs.endTime ?? '') !== '' ? { endTime: Number(kwargs.endTime) } : {}),
  };
  return payload;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    originalUrl: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'orginal-text-list',
  description: '员工AI转录原文数据列表',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '员工userId' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'startTime', type: 'str', default: '', help: '开始时间戳，单位秒（可选）' },
    { name: 'endTime', type: 'str', default: '', help: '结束时间戳，单位秒（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'originalUrl', 'code', 'msg'],
  footerExtra: () => (lastPagination ? `totalCount ${lastPagination.totalCount}` : undefined),
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);
    const body = JSON.stringify(payload);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      sign,
    };
    if (userId) headers.userId = userId;
    const apiUrl = buildApiUrl(baseUrl);

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
    lastPagination = data?.code === 1 && data?.totalCount != null
      ? { totalCount: data.totalCount }
      : null;
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

    return list.map((item, index) => ({
      rank: index + 1,
      originalUrl: item.originalUrl || '',
      code: '',
      msg: '',
    }));
  },
});
