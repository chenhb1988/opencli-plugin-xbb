import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_FILE = path.join(os.homedir(), '.opencli', 'xbb', 'config.env');
const API_URL = 'https://proapi.xbongbong.com/pro/v2/api/stage/get';
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
  return [{ stageProcessId: '', stageId: '', stageName: '', reasonText: '', reasonValue: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'stage-get',
  description: '阶段获取接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单Id（必填）' },
    { name: 'businessType', type: 'int', help: '业务类型（必填）' },
    { name: 'saasMark', type: 'int', help: '表单类型（必填）' },
    { name: 'dataId', type: 'int', help: '表单数据Id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['stageProcessId', 'stageId', 'stageName', 'reasonText', 'reasonValue', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = {
      corpid,
      formId: Number(kwargs.formId || 0),
      businessType: Number(kwargs.businessType || 0),
      saasMark: Number(kwargs.saasMark || 0),
      dataId: Number(kwargs.dataId || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    const requestBody = JSON.stringify(payload);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId');
    if (!payload.businessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType');
    if (!payload.saasMark) return makeErrorRow('NO_SAASMARK', '缺少 --saasMark');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    const sign = crypto.createHash('sha256').update(requestBody + token).digest('hex');
    const headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', sign }, userId ? { userId } : {});
    const apiUrl = buildApiUrl(baseUrl, API_URL);
    if (debug) {
      process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${requestBody}\n`);
    }
    const resp = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
    if (!resp.ok) return makeErrorRow(resp.status, `HTTP ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const responseBody = JSON.stringify(data);
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
    if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');
    const result = data.result || {};
    const stageList = Array.isArray(result.stageList) ? result.stageList : [];
    const reasonList = Array.isArray(result.reasonList) ? result.reasonList : [];
    const size = Math.max(stageList.length, reasonList.length, 1);
    return Array.from({ length: size }).map((_, index) => ({
      stageProcessId: result.stageProcessId || '',
      stageId: stageList[index]?.stageId || '',
      stageName: stageList[index]?.stageName || '',
      reasonText: reasonList[index]?.text || '',
      reasonValue: reasonList[index]?.value || '',
      code: data.code ?? '',
      msg: data.msg || '',
    }));
  },
});
