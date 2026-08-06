import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/refund/detail';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';

function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; } }
function getRuntimeConfig() {
  const config = readConfig();
  return { corpid: String(config.corpid || '').trim(), token: String(config.token || '').trim(), baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(), userId: String(config.userId || '').trim() };
}
function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}
function makeErrorRow(code, msg) {
  return [{ dataId: '', formId: '', addTime: '', updateTime: '', data: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'refund-detail',
  description: '退货退款单详情接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '数据id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'queryFlag', type: 'str', default: '', help: '是否查询审批数据：0非审批，1审批中，2全部' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'formId', 'addTime', 'updateTime', 'data', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, dataId: Number(kwargs.dataId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.queryFlag ?? '') !== '') payload.queryFlag = Number(kwargs.queryFlag);
    const body = JSON.stringify(payload);

    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    const apiUrl = buildApiUrl(baseUrl, API_URL);
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
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    const result = data.result || {};
    return [{ dataId: result.dataId || '', formId: result.formId || '', addTime: result.addTime || '', updateTime: result.updateTime || '', data: JSON.stringify(result.data || {}), code: data.code ?? '', msg: data.msg || '' }];
  },
});
