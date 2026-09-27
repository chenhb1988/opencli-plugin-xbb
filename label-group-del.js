import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/label/group/del';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ groupId: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'label-group-del',
  description: '删除标签分组接口（businessType: -1；label 模块）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'groupId', type: 'int', help: '分组id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['groupId', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const payload = { corpid };
    payload.groupId = Number(kwargs.groupId || 0);
    if (runtimeUserId) payload.userId = runtimeUserId;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.groupId) return makeErrorRow('NO_GROUPID', '缺少 --groupId');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    const gateway = await requestGateway({
      baseUrl,
      apiPath: API_PATH,
      payload,
      token,
      userId: runtimeUserId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }
    const result = gateway.data.result || {};
    return [{ groupId: result.groupId || result.id || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
