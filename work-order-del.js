import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const WORK_ORDER_DELETE_API_PATH = '/pro/v2/api/workOrderV2/del';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function buildPayload(kwargs, corpid) {
  const payload = {
    dataId: Number(kwargs.dataId || 0),
    corpid,
  };

  const userId = String(kwargs.userId || '');
  if (userId) {
    payload.userId = userId;
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
    code,
    msg,
    errorDataMemo: '',
  }];
}

function makeSuccessRow(data) {
  return [{
    dataId: '',
    code: data.code ?? '',
    msg: data.msg || '',
    errorDataMemo: data.result?.errorDataMemo || '',
  }];
}

cli({
  site: 'xbb',
  name: 'work-order-del',
  description: '删除工单接口（businessType: 20300）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg', 'errorDataMemo'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);

    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg);
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: WORK_ORDER_DELETE_API_PATH,
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
