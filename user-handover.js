import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/user/handover';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ code, msg }];
}

cli({
  site: 'xbb',
  name: 'user-handover',
  description: '用户交接接口（businessType: -1）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'fromUserId', type: 'str', help: '需要交接工作的员工userId（必填）' },
    { name: 'toUserId', type: 'str', help: '交接目标员工userId（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { fromUserId: String(kwargs.fromUserId || ''), toUserId: String(kwargs.toUserId || ''), corpid };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (!payload.fromUserId) return makeErrorRow('NO_FROMUSERID', '缺少 --fromUserId');
    if (!payload.toUserId) return makeErrorRow('NO_TOUSERID', '缺少 --toUserId');
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
    return [{ code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
