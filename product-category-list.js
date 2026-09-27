import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const PRODUCT_CATEGORY_LIST_API_PATH = '/pro/v2/api/product/categoryList';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }

  return payload;
}

function getValidationError(payload, token) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

function flattenCategoryTree(list, rows = []) {
  for (const item of list) {
    rows.push(item);
    const childList = Array.isArray(item.childList) ? item.childList : [];
    if (childList.length) {
      flattenCategoryTree(childList, rows);
    }
  }
  return rows;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    id: '',
    name: '',
    parentId: '',
    router: '',
    sort: '',
    corpid: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  const flat = flattenCategoryTree(list);
  return flat.map((item, index) => ({
    rank: index + 1,
    id: item.id || '',
    name: item.name || '',
    parentId: item.parentId || '',
    router: item.router || '',
    sort: item.sort || '',
    corpid: item.corpid || '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'product-category-list',
  description: '产品分类列表接口（businessType: 2401）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'id', 'name', 'parentId', 'router', 'sort', 'corpid', 'code', 'msg'],
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
      apiPath: PRODUCT_CATEGORY_LIST_API_PATH,
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
