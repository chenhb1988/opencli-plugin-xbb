import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';
import { LIST_COLUMNS, makeListErrorRow, makeListRows } from './xbb-receipt-order.js';

const RECEIPT_ORDER_LIST_API_PATH = '/pro/v2/api/receiptOrder/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

function buildConditions(kwargs) {
  if (String(kwargs.conditions ?? '').trim()) {
    let parsed;
    try {
      parsed = JSON.parse(String(kwargs.conditions));
    } catch {
      throw new Error('INVALID_CONDITIONS:conditions 必须是 JSON 数组');
    }
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
  };

  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (String(kwargs.page ?? '') !== '') payload.page = Number(kwargs.page);
  if (String(kwargs.pageSize ?? '') !== '') payload.pageSize = Number(kwargs.pageSize);

  const viewApproval = String(kwargs.viewApproval ?? '');
  if (viewApproval !== '') payload.viewApproval = viewApproval;

  const conditions = buildConditions(kwargs);
  if (conditions.length) payload.conditions = conditions;

  return payload;
}

cli({
  site: 'xbb',
  name: 'receipt-order-list',
  group: 'receipt-order',
  description: '回执单列表接口（businessType: 20340）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1是，0否' },
    { name: 'conditions', type: 'str', default: '', help: '筛选条件 JSON 数组字符串，优先级高于 --attr/--value' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 serialNo 单据编号' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'page', type: 'str', default: '', help: '页码（可选，默认 1）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选，默认 20，最大 100）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: LIST_COLUMNS,
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
      return makeListErrorRow(code, detail);
    }

    if (!payload.corpid) {
      return makeListErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!payload.formId) {
      return makeListErrorRow('NO_FORMID', '缺少 --formId');
    }
    if (!token) {
      return makeListErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    for (const field of ['page', 'pageSize']) {
      if (String(kwargs[field] ?? '') !== '' && !Number.isFinite(Number(kwargs[field]))) {
        return makeListErrorRow('INVALID_PAYLOAD', `--${field} 必须是数字`);
      }
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: RECEIPT_ORDER_LIST_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeListErrorRow(gateway.code, gateway.msg);
    pagination.update(gateway.data);
    if (kwargs.raw) return [{ raw: gateway.responseBody }];
    if (gateway.data.code !== 1) {
      return makeListErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    const list = Array.isArray(gateway.data.result?.list) ? gateway.data.result.list : [];
    if (!list.length) {
      return makeListErrorRow('NO_DATA', '接口成功，但 list 为空');
    }

    return makeListRows(list);
  },
});