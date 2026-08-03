import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/stage/jump';
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

function makeErrorRow(code, msg, debug, requestBody = '', responseBody = '') {
  return [{ dataId: '', resultCode: '', resultMsg: '', code, msg, requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
}

cli({
  site: 'xbb',
  name: 'stage-jump',
  description: '阶段跳转接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单模板id（必填）' },
    { name: 'businessType', type: 'int', help: '业务类型（必填）' },
    { name: 'saasMark', type: 'int', help: '表单类型（必填）' },
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'toStageId', type: 'int', help: '目标阶段id（必填）' },
    { name: 'stageProcessId', type: 'int', help: '阶段流程id（必填）' },
    { name: 'reasonId', type: 'int', default: '', help: '原因id（可选）' },
    { name: 'memo', type: 'str', default: '', help: '备注（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = {
      corpid,
      formId: Number(kwargs.formId || 0),
      businessType: Number(kwargs.businessType || 0),
      saasMark: Number(kwargs.saasMark || 0),
      dataId: Number(kwargs.dataId || 0),
      toStageId: Number(kwargs.toStageId || 0),
      stageProcessId: Number(kwargs.stageProcessId || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.reasonId ?? '') !== '') payload.reasonId = Number(kwargs.reasonId);
    if (String(kwargs.memo ?? '') !== '') payload.memo = String(kwargs.memo);
    const requestBody = JSON.stringify(payload);

    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', debug, requestBody, '');
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId', debug, requestBody, '');
    if (!payload.businessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType', debug, requestBody, '');
    if (!payload.saasMark) return makeErrorRow('NO_SAASMARK', '缺少 --saasMark', debug, requestBody, '');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId', debug, requestBody, '');
    if (!payload.toStageId) return makeErrorRow('NO_TOSTAGEID', '缺少 --toStageId', debug, requestBody, '');
    if (!payload.stageProcessId) return makeErrorRow('NO_STAGEPROCESSID', '缺少 --stageProcessId', debug, requestBody, '');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE, debug, requestBody, '');

    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const resp = await fetch(buildApiUrl(baseUrl, API_URL), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {}),
      body: requestBody,
    });

    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`, debug, requestBody, await resp.text());
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误', debug, requestBody, responseBody);
    const result = data.result || {};
    return [{ dataId: result.dataId || payload.dataId || '', resultCode: result.code ?? '', resultMsg: result.msg || '', code: data.code ?? '', msg: data.msg || '', requestBody: debug ? requestBody : '', responseBody: debug ? responseBody : '' }];
  },
});
