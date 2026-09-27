import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const WORK_ORDER_DYNAMIC_LIST_API_PATH = '/pro/v2/api/workOrderV2/dynamic/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

function buildPayload(kwargs, corpid) {
  return {
    corpid,
    dataId: Number(kwargs.dataId || 0),
    page: Number(String(kwargs.page ?? '') === '' ? 1 : kwargs.page),
    pageSize: Number(String(kwargs.pageSize ?? '') === '' ? 20 : kwargs.pageSize),
  };
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!payload.dataId) {
    return { code: 'NO_DATA_ID', msg: '缺少 --dataId' };
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
    content: '',
    creatorId: '',
    createTime: '',
    data: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    dataId: item.dataId ?? item.id ?? '',
    content: item.content ?? item.remark ?? item.text ?? '',
    creatorId: item.creatorId ?? item.userId ?? '',
    createTime: item.createTime ?? item.addTime ?? item.updateTime ?? '',
    data: JSON.stringify(item),
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'work-order-dynamic-list',
  description: '工单动态列表接口（businessType: 20300）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '工单数据id（必填）' },
    { name: 'page', type: 'str', default: '1', help: '页码' },
    { name: 'pageSize', type: 'str', default: '20', help: '每页数量' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'dataId', 'content', 'creatorId', 'createTime', 'data', 'code', 'msg'],
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
      apiPath: WORK_ORDER_DYNAMIC_LIST_API_PATH,
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
