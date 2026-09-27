import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/department/add';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ id: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'department-add',
  description: '新建部门接口（businessType: -1）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'name', type: 'str', help: '部门名称（必填）' },
    { name: 'parentId', type: 'int', help: '上级部门编号（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['id', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { name: String(kwargs.name || ''), parentId: Number(kwargs.parentId || 0), corpid };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (!payload.name) return makeErrorRow('NO_NAME', '缺少 --name');
    if (!payload.parentId) return makeErrorRow('NO_PARENTID', '缺少 --parentId');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    const gateway = await requestGateway({
      baseUrl,
      apiPath: API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }
    return [{ id: gateway.data.result?.id || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
