import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const FORM_LIST_API_PATH = '/pro/v2/api/form/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    saasMark: Number(kwargs.saasMark || 0),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (kwargs.name) {
    payload.name = String(kwargs.name);
  }
  if (String(kwargs.businessType ?? '') !== '') {
    payload.businessType = Number(kwargs.businessType);
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!payload.saasMark) {
    return { code: 'NO_SAASMARK', msg: '缺少 --saasMark（1系统表单，2自定义表单）' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    formId: '',
    appId: '',
    menuId: '',
    businessType: '',
    isProcessForm: '',
    name: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    formId: item.formId || '',
    appId: item.appId || '',
    menuId: item.menuId || '',
    businessType: item.businessType || '',
    isProcessForm: item.isProcessForm || '',
    name: item.name || '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'form-list',
  description: '表单模板列表接口（businessType: -1）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'saasMark', type: 'int', help: '表单类型（必填）：1系统表单，2自定义表单' },
    { name: 'businessType', type: 'str', default: '', help: '业务类型（可选）' },
    { name: 'name', type: 'str', default: '', help: '模板名称模糊查询（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'formId', 'appId', 'menuId', 'businessType', 'isProcessForm', 'name', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
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
      apiPath: FORM_LIST_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    pagination.update(gateway.data);
    if (kwargs.raw) return [{ raw: gateway.responseBody }];
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    const formList = Array.isArray(gateway.data.result?.formList) ? gateway.data.result.formList : [];
    if (!formList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 formList 为空');
    }

    return makeSuccessRows(formList);
  },
});
