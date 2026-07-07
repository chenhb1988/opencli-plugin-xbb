import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/refund/del';
const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';

function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; } }
function getRuntimeConfig(kwargs) {
  const config = readConfig();
  return { configCorpid: String(config.corpid || '').trim(), token: String(config.token || '').trim(), baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(), userId: String(config.userId || '').trim() };
}
function buildApiUrl(baseUrl, defaultUrl) {
  const apiPath = new URL(defaultUrl).pathname;
  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}
function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{ resultCode: '', resultMsg: '', errorDataMemo: '', code, msg, requestBody: debug ? body : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'refund-del',
  description: '删除退货退款单接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultCode', 'resultMsg', 'errorDataMemo', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { configCorpid, token, baseUrl, userId } = getRuntimeConfig(kwargs);
    const payload = { corpid: String(kwargs.corpid || ''), dataId: Number(kwargs.dataId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    const body = JSON.stringify(payload);

    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, body, '');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId', debug, body, '');
    if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 opencli xbb set-token --corpid <CORPID> --token <TOKEN> --userId <USERID>', debug, body, '');
    if (configCorpid && payload.corpid !== configCorpid) return makeErrorRow('CORPID_MISMATCH', 'corpid与配置中不一致', debug, body, '');

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}), body });
    if (!resp.ok) {
      const responseText = await resp.text();
      return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, body, responseText);
    }
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, body, responseBody);
    const result = data.result || {};
    return [{ resultCode: data.code ?? '', resultMsg: data.msg || '', errorDataMemo: result.errorDataMemo || '', code: data.code ?? '', msg: data.msg || '', requestBody: debug ? body : '', responseBody: debug ? responseBody : '' }];
  },
});
