import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const WORK_ORDER_DETAIL_API_PATH = '/pro/v2/api/workOrderV2/detail';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function parseOptionalInteger(value, code, msg) {
  if (String(value ?? '') === '') {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${code}:${msg}`);
  }

  return parsed;
}

function buildPayload(kwargs, corpid) {
  const payload = {
    dataId: Number(kwargs.dataId || 0),
    corpid,
  };

  const userId = String(kwargs.userId || '');
  if (userId) {
    payload.userId = userId;
  }

  const queryFlag = parseOptionalInteger(kwargs.queryFlag, 'INVALID_QUERY_FLAG', 'queryFlag 必须是数字');
  if (queryFlag !== null) {
    payload.queryFlag = queryFlag;
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.dataId) {
    return { code: 'NO_DATAID', msg: '缺少 --dataId' };
  }
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    dataId: '',
    formId: '',
    serialNo: '',
    creatorId: '',
    ownerId: '',
    coUserId: '',
    addTime: '',
    updateTime: '',
    data: '',
    code,
    msg,
  }];
}

function stringifyValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return value ?? '';
}

function makeSuccessRow(data) {
  const result = data.result || {};
  return [{
    dataId: result.dataId || '',
    formId: result.formId || '',
    serialNo: result.data?.serialNo || '',
    creatorId: stringifyValue(result.data?.creatorId),
    ownerId: stringifyValue(result.data?.ownerId),
    coUserId: stringifyValue(result.data?.coUserId),
    addTime: result.addTime || '',
    updateTime: result.updateTime || '',
    data: JSON.stringify(result.data || {}),
    code: data.code ?? '',
    msg: data.msg || '',
  }];
}

cli({
  site: 'xbb',
  name: 'work-order-detail',
  description: '工单详情接口（businessType: 20300）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '数据id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'queryFlag', type: 'str', default: '', help: '是否查询审批数据：0非审批数据，1审批数据，2全部' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'formId', 'serialNo', 'creatorId', 'ownerId', 'coUserId', 'addTime', 'updateTime', 'data', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    let payload;
    try {
      payload = buildPayload(kwargs, corpid);
    } catch (error) {
      const message = String(error?.message || error);
      const separatorIndex = message.indexOf(':');
      const code = separatorIndex > 0 ? message.slice(0, separatorIndex) : 'INVALID_PAYLOAD';
      const detail = separatorIndex > 0 ? message.slice(separatorIndex + 1) : message;
      return makeErrorRow(code, detail);
    }


    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg);
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: WORK_ORDER_DETAIL_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    return makeSuccessRow(gateway.data);
  },
});
