import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const FORM_GET_API_PATH = '/pro/v2/api/form/get';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function buildPayload(kwargs, corpid) {
  const payload = {
    formId: Number(kwargs.formId || 0),
    corpid,
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (String(kwargs.subBusinessType ?? '') !== '') {
    payload.subBusinessType = Number(kwargs.subBusinessType);
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.formId) {
    return { code: 'NO_FORMID', msg: '缺少 --formId' };
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
    rank: '',
    attr: '',
    attrName: '',
    fieldType: '',
    required: '',
    noRepeat: '',
    showType: '',
    dateType: '',
    items: '',
    code,
    msg,
  }];
}

function makeSuccessRows(explainList) {
  return explainList.map((item, index) => ({
    rank: index + 1,
    attr: item.attr || '',
    attrName: item.attrName || '',
    fieldType: item.fieldType ?? '',
    required: item.required ?? '',
    noRepeat: item.noRepeat ?? '',
    showType: item.showType ?? '',
    dateType: item.dateType || '',
    items: JSON.stringify(item.items || []),
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'form-get',
  description: '表单模板字段解释接口（businessType: -1；formId必填）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'subBusinessType', type: 'str', default: '', help: '表单业务子类型（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'attr', 'attrName', 'fieldType', 'required', 'noRepeat', 'showType', 'dateType', 'items', 'code', 'msg'],
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
      apiPath: FORM_GET_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    const explainList = Array.isArray(gateway.data.result?.explainList) ? gateway.data.result.explainList : [];
    if (!explainList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 explainList 为空');
    }

    return makeSuccessRows(explainList);
  },
});
