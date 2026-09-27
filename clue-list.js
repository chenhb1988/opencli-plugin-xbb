import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const CLUE_LIST_API_PATH = '/pro/v2/api/clue/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

function buildConditions(kwargs) {
  const conditions = kwargs.conditions;
  if (typeof conditions === 'string' && conditions.trim()) {
    const parsed = JSON.parse(conditions);
    if (!Array.isArray(parsed)) {
      throw new Error('INVALID_CONDITIONS:conditions 必须是 JSON 数组');
    }
    return parsed;
  }

  if (!(kwargs.attr && kwargs.value)) {
    return [];
  }

  return [{
    attr: String(kwargs.attr),
    value: [String(kwargs.value)],
    symbol: String(kwargs.symbol || 'equal'),
  }];
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    formId: Number(kwargs.formId || 0),
    del: Number(kwargs.del || 0),
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };

  const userId = String(kwargs.userId || '');
  if (userId) {
    payload.userId = userId;
  }

  const isPublic = String(kwargs.isPublic ?? '');
  if (isPublic !== '') {
    payload.isPublic = Number(kwargs.isPublic);
  }

  const viewApproval = String(kwargs.viewApproval ?? '');
  if (viewApproval !== '') {
    payload.viewApproval = viewApproval;
  }

  const conditions = buildConditions(kwargs);
  if (conditions.length > 0) {
    payload.conditions = conditions;
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }

  if (!payload.formId) {
    return { code: 'NO_FORMID', msg: '缺少 --formId' };
  }

  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    dataId: '',
    formId: '',
    name: '',
    contact: '',
    mobile: '',
    customerName: '',
    creatorId: '',
    addTime: '',
    updateTime: '',
    data: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    dataId: item.dataId || '',
    formId: item.formId || '',
    name: item.data?.text_1 || '',
    contact: item.data?.text_2 || '',
    mobile: item.data?.text_3 || '',
    customerName: item.data?.text_10 || '',
    creatorId: item.data?.creatorId || '',
    addTime: item.addTime || '',
    updateTime: item.updateTime || '',
    data: JSON.stringify(item.data || {}),
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'clue-list',
  description: '线索列表接口（businessType: 8000；formId必填）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'del', type: 'int', default: 0, help: '0线索列表，1回收站数据' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'isPublic', type: 'str', default: '', help: '是否公海线索：0非公海，1公海，不传表示全部' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'conditions', type: 'str', default: '', help: '条件集合 JSON 字符串，例如 [{"attr":"subForm_1","subAttr":"text_2","value":["133***"],"symbol":"equal"}]' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 text_1' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'dataId', 'formId', 'name', 'contact', 'mobile', 'customerName', 'creatorId', 'addTime', 'updateTime', 'data', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
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
      apiPath: CLUE_LIST_API_PATH,
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

    const list = Array.isArray(gateway.data.result?.list) ? gateway.data.result.list : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 list 为空');
    }

    return makeSuccessRows(list);
  },
});
