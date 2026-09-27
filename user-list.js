import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const USER_LIST_API_PATH = '/pro/v2/api/user/list';
const pagination = createPagination();

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
  };
  if (kwargs.userId) payload.userId = String(kwargs.userId);
  if (kwargs.name) payload.name = String(kwargs.name);
  if (kwargs.nameLike) payload.nameLike = String(kwargs.nameLike);
  if (Number(kwargs.departmentId || 0)) payload.departmentId = Number(kwargs.departmentId);
  if (Number(kwargs.delIgnore || 0)) payload.delIgnore = Number(kwargs.delIgnore);
  return payload;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    userId: '',
    name: '',
    position: '',
    jobnumber: '',
    departmentList: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'user-list',
  description: '用户列表接口（businessType: -1）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'name', type: 'str', default: '', help: '员工姓名完全匹配（可选）' },
    { name: 'nameLike', type: 'str', default: '', help: '员工姓名模糊查询（可选）' },
    { name: 'departmentId', type: 'int', default: 0, help: '部门id筛选（可选）' },
    { name: 'delIgnore', type: 'int', default: 0, help: '是否查询已离职员工，0不查/1查询' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'userId', 'name', 'position', 'jobnumber', 'departmentList', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: USER_LIST_API_PATH,
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

    const list = Array.isArray(gateway.data.result?.userList) ? gateway.data.result.userList : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 userList 为空');
    }

    return list.map((item, index) => ({
      rank: index + 1,
      userId: item.userId || '',
      name: item.name || '',
      position: item.position || '',
      jobnumber: item.jobnumber || '',
      departmentList: Array.isArray(item.departmentList) ? JSON.stringify(item.departmentList) : (item.departmentList || ''),
      code: '',
      msg: '',
    }));
  },
});
