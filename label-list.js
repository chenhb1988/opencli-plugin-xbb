import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/label/list';
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
  return [{ rank: '', dataId: '', name: '', color: '', groupId: '', formId: '', sort: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'label-list',
  description: '标签列表接口（businessType: -1；label 模块）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'businessType', type: 'int', help: '业务类型（必填）' },
    { name: 'groupId', type: 'int', help: '分组id（必填）' },
    { name: 'enable', type: 'str', default: '', help: '是否在回收站中，0-未移入回收站，1-已移入回收站（必填，可传0）' },
    { name: 'isReLabel', type: 'str', default: '', help: '是否展示回收站的标签，需要时传1（可选）' },
    { name: 'nameLike', type: 'str', default: '', help: '模糊查询标签名称（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'dataId', 'name', 'color', 'groupId', 'formId', 'sort', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const payload = { corpid };
    payload.formId = Number(kwargs.formId || 0);
    payload.businessType = Number(kwargs.businessType || 0);
    payload.groupId = Number(kwargs.groupId || 0);
    if (String(kwargs.enable ?? '') !== '') payload.enable = Number(kwargs.enable);
    if (String(kwargs.isReLabel ?? '') !== '') payload.isReLabel = Number(kwargs.isReLabel);
    if (String(kwargs.nameLike || '').trim()) payload.nameLike = String(kwargs.nameLike).trim();
    if (runtimeUserId) payload.userId = runtimeUserId;
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId');
    if (!payload.businessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType');
    if (!payload.groupId) return makeErrorRow('NO_GROUPID', '缺少 --groupId');
    if (String(kwargs.enable ?? '') === '') return makeErrorRow('NO_ENABLE', '缺少 --enable');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, runtimeUserId ? { userId: runtimeUserId } : {});
    const apiUrl = buildApiUrl(baseUrl, API_URL);
    if (debug) {
      process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${requestBody}\n`);
    }
    const resp = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
    if (!resp.ok) {
      const responseText = await resp.text();
      if (debug) process.stderr.write(`[debug] ResponseBody: ${responseText}\n`);
      return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    const list = Array.isArray(data.result?.labelList) ? data.result.labelList : (Array.isArray(data.result?.labelListVO) ? data.result.labelListVO : []);
    if (!list.length) return makeErrorRow('NO_DATA', '接口成功，但标签列表为空');
    return list.map((item, index) => ({ rank: index + 1, dataId: item.dataId || '', name: item.name || '', color: item.color || '', groupId: item.groupId || '', formId: item.formId || '', sort: item.sort ?? '', code: '', msg: '' }));
  },
});
