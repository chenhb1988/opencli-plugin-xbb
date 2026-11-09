import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';
import { LIST_COLUMNS, buildListPayload, makeListErrorRow, makeListRows, splitCodedError } from './xbb-production.js';

const PRODUCTION_ORDER_LIST_API_PATH = '/pro/v2/api/productionOrder/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

cli({
  site: 'xbb',
  name: 'production-order-list',
  group: 'production',
  description: '生产单列表接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'conditions', type: 'str', default: '', help: '筛选条件 JSON 数组字符串，优先级高于 --attr/--value' },
    { name: 'attr', type: 'str', default: '', help: '筛选字段 attr，例如 serialNo 单据编号' },
    { name: 'value', type: 'str', default: '', help: '筛选值，和 --attr 配合使用' },
    { name: 'symbol', type: 'str', default: 'equal', help: '筛选操作符，默认 equal' },
    { name: 'viewApproval', type: 'str', default: '', help: '是否查询审批中数据，1:是，0:否' },
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
      payload = buildListPayload(kwargs, corpid);
    } catch (error) {
      const { code, detail } = splitCodedError(error, 'INVALID_PAYLOAD');
      return makeListErrorRow(code, detail);
    }

    if (!payload.corpid) {
      return makeListErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeListErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: PRODUCTION_ORDER_LIST_API_PATH,
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