import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const DEPARTMENT_LIST_API_PATH = '/pro/v2/api/department/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination();

function parseDepartmentIdIn(raw) {
  if (Array.isArray(raw)) {
    const cleaned = raw.map((item) => String(item || '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }

  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    const cleaned = parsed.map((item) => String(item || '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  } catch {
    const fromCsv = text.split(',').map((item) => item.trim()).filter(Boolean);
    return fromCsv.length ? fromCsv : undefined;
  }
}

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };

  if (kwargs.userId) {
    payload.userId = String(kwargs.userId);
  }
  if (kwargs.nameLike) {
    payload.nameLike = String(kwargs.nameLike);
  }

  const departmentIdIn = parseDepartmentIdIn(kwargs.departmentIdIn);
  if (departmentIdIn) {
    payload.departmentIdIn = departmentIdIn;
  }

  return { payload, departmentIdIn };
}

function getValidationError(payload, token, departmentIdIn) {
  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }
  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }
  if (departmentIdIn === undefined) {
    return { code: 'INVALID_DEPARTMENT_ID_IN', msg: '--departmentIdIn 必须是 JSON 数组或逗号分隔字符串' };
  }

  return null;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    id: '',
    name: '',
    parentId: '',
    depIdRouter: '',
    sort: '',
    code,
    msg,
  }];
}

function makeSuccessRows(depList) {
  return depList.map((item, index) => ({
    rank: index + 1,
    id: item.id || '',
    name: item.name || '',
    parentId: item.parentId || '',
    depIdRouter: item.depIdRouter || '',
    sort: item.sort || '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'department-list',
  description: '部门列表接口（businessType: -1）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'departmentIdIn', type: 'str', default: '', help: '部门id列表（可选），支持 JSON 数组或逗号分隔字符串' },
    { name: 'nameLike', type: 'str', default: '', help: '部门名模糊查询（可选）' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'id', 'name', 'parentId', 'depIdRouter', 'sort', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const { payload, departmentIdIn } = buildPayload(kwargs, corpid);

    const validationError = getValidationError(payload, token, departmentIdIn);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg);
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: DEPARTMENT_LIST_API_PATH,
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

    const depList = Array.isArray(gateway.data.result?.depList) ? gateway.data.result.depList : [];
    if (!depList.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 depList 为空');
    }

    return makeSuccessRows(depList);
  },
});
