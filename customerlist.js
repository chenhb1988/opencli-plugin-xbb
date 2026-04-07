import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from 'file:///C:/Users/chb/AppData/Roaming/npm/node_modules/@jackwener/opencli/dist/registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function getToken(kwargs) {
  return String(kwargs.token || readConfig().token || '');
}

function buildConditions(kwargs) {
  const conditions = [];
  if (kwargs.attr && kwargs.value) {
    conditions.push({
      attr: String(kwargs.attr),
      value: [String(kwargs.value)],
      symbol: String(kwargs.symbol || 'equal'),
    });
  }
  return conditions;
}

function buildPayload(kwargs) {
  const payload = {
    corpid: String(kwargs.corpid || ''),
    formId: Number(kwargs.formId || 0),
    page: Number(kwargs.page || 1),
    pageSize: Number(kwargs.pageSize || 20),
  };
  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (String(kwargs.isPublic ?? '') !== '') payload.isPublic = Number(kwargs.isPublic);
  if (Number(kwargs.del || 0)) payload.del = Number(kwargs.del);
  if (String(kwargs.viewApproval || '') !== '') payload.viewApproval = String(kwargs.viewApproval);
  const conditions = buildConditions(kwargs);
  if (conditions.length) payload.conditions = conditions;
  return payload;
}

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    rank: '',
    dataId: '',
    formId: '',
    name: '',
    ownerId: '',
    mobile: '',
    addTime: '',
    updateTime: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

cli({
  site: 'xbb',
  name: 'customerlist',
  description: '客户列表接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'isPublic', type: 'int', default: '', help: '是否公海客户：0非公海，1公海，不传表示全部' },
    { name: 'del', type: 'int', default: 0, help: '0客户列表，1回收站数据' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 text_1' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
    { name: 'pageSize', type: 'int', default: 20, help: '每页数量（最大100）' },
    { name: 'limit', type: 'int', default: 20, help: '最终返回条数限制' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'dataId', 'formId', 'name', 'ownerId', 'mobile', 'addTime', 'updateTime', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (_page, kwargs) => {
    const debug = Boolean(kwargs.debug);
    const token = getToken(kwargs);
    const payload = buildPayload(kwargs);
    const body = JSON.stringify(payload);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少 --corpid', debug, body, '');
    }
    if (!payload.formId) {
      return makeErrorRow('NO_FORMID', '缺少 --formId', debug, body, '');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请传 --token，或先执行 opencli xbb set-token --token <TOKEN>', debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch('https://proapi.xbongbong.com/pro/v2/api/customer/list', {
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

    const list = Array.isArray(data.result?.list) ? data.result.list : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 list 为空', debug, body, responseBody);
    }

    return list.slice(0, Number(kwargs.limit || 20)).map((item, index) => ({
      rank: index + 1,
      dataId: item.dataId || '',
      formId: item.formId || '',
      name: item.data?.text_1 || '',
      ownerId: item.data?.text_16 || '',
      mobile: item.data?.text_2 || '',
      addTime: item.addTime || '',
      updateTime: item.updateTime || '',
      code: '',
      msg: '',
      requestBody: debug ? body : '',
      responseBody: '',
    }));
  },
});
