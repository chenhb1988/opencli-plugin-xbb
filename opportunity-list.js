import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const OPPORTUNITY_LIST_API_PATH = '/pro/v2/api/opportunity/list';
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

  const result = [];
  if (kwargs.attr && kwargs.value) {
    result.push({
      attr: String(kwargs.attr),
      value: [String(kwargs.value)],
      symbol: String(kwargs.symbol || 'equal'),
    });
  }
  return result;
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    formId: Number(kwargs.formId || 0),
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };
  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (String(kwargs.viewApproval || '') !== '') payload.viewApproval = String(kwargs.viewApproval);
  const conditions = buildConditions(kwargs);
  if (conditions.length) payload.conditions = conditions;
  return payload;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    dataId: '',
    formId: '',
    name: '',
    serialNo: '',
    customerId: '',
    opportunityAmount: '',
    ownerId: '',
    addTime: '',
    updateTime: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'opportunity-list',
  description: '销售机会列表接口（businessType: 301；formId必填）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'conditions', type: 'str', default: '', help: '条件集合 JSON 数组字符串，优先级高于 --attr/--value' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 serialNo' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'dataId', 'formId', 'name', 'serialNo', 'customerId', 'opportunityAmount', 'ownerId', 'addTime', 'updateTime', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
  func: async (kwargs) => {
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

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!payload.formId) {
      return makeErrorRow('NO_FORMID', '缺少 --formId');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: OPPORTUNITY_LIST_API_PATH,
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

    return list.map((item, index) => ({
      rank: index + 1,
      dataId: item.dataId || '',
      formId: item.formId || '',
      name: item.data?.text_1 || '',
      serialNo: item.data?.serialNo || '',
      customerId: item.data?.text_3 || '',
      opportunityAmount: item.data?.num_1 || '',
      ownerId: item.data?.creatorId || '',
      addTime: item.addTime || '',
      updateTime: item.updateTime || '',
      code: '',
      msg: '',
    }));
  },
});
