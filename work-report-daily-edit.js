import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/workReportDaily/edit';
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

function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  const text = String(raw || '').trim();
  if (!text) return null;
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

function makeErrorRow(code, msg) {
  return [{
    dataId: '',
    resultCode: '',
    resultMsg: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'work-report-daily-edit',
  description: '编辑日报接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'dataList', type: 'str', help: '表单数据JSON字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();

    const payload = {
      dataId: Number(kwargs.dataId || 0),
      corpid,
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    const parsedDataList = parseDataList(kwargs.dataList);
    if (parsedDataList) payload.dataList = parsedDataList;

    const body = JSON.stringify(payload);

    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    if (parsedDataList === null) return makeErrorRow('NO_DATALIST', '缺少 --dataList');
    if (parsedDataList === undefined) return makeErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串');

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    if (debug) {
      process.stderr.write(`[debug] URL: ${buildApiUrl(baseUrl, API_URL)}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
    }
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), {
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
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');

    const result = data.result || {};
    return [{
      dataId: result.dataId || '',
      resultCode: data.code ?? '',
      resultMsg: data.msg || '',
      code: data.code ?? '',
      msg: data.msg || '',
    }];
  },
});
