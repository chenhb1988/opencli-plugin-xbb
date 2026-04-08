import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { cli, Strategy } from './opencli-registry.js';

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

function makeErrorRow(code, msg, debug, body = '', responseBody = '') {
  return [{
    dataId: '',
    resultCode: '',
    resultMsg: '',
    code,
    msg,
    requestBody: debug ? body : '',
    responseBody: debug ? responseBody : '',
  }];
}

function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

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

cli({
  site: 'xbb',
  name: 'customeradd',
  description: '新建客户接口（纯 HTTP 版）',
  strategy: Strategy.PUBLIC,
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'dataList', type: 'str', help: '表单数据JSON字符串（必填）' },
    { name: 'token', type: 'str', default: '', help: 'API token（可选；默认从本地配置读取）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg', 'requestBody', 'responseBody'],
  func: async (_page, kwargs) => {
    const debug = Boolean(kwargs.debug);
    const token = getToken(kwargs);

    const payload = {
      corpid: String(kwargs.corpid || ''),
      formId: Number(kwargs.formId || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    const parsedDataList = parseDataList(kwargs.dataList);
    if (parsedDataList) {
      payload.dataList = parsedDataList;
    }

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
    if (parsedDataList === null) {
      return makeErrorRow('NO_DATALIST', '缺少 --dataList', debug, body, '');
    }
    if (parsedDataList === undefined) {
      return makeErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串', debug, body, '');
    }

    const sign = crypto.createHash('sha256').update(body + token).digest('hex');
    const resp = await fetch('https://proapi.xbongbong.com/pro/v2/api/customer/add', {
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

    const result = data.result || {};
    return [{
      dataId: result.dataId || '',
      resultCode: result.code ?? '',
      resultMsg: result.msg || '',
      code: data.code ?? '',
      msg: data.msg || '',
      requestBody: debug ? body : '',
      responseBody: debug ? responseBody : '',
    }];
  },
});
