import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/quotation/addMainUser';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function parseJsonArray(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function makeErrorRow(code, msg) {
  return [{ resultCode: '', resultMsg: '', messageList: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'quotation-add-mainuser',
  description: '报价单添加负责人接口（businessType: 4700）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '报价单id（必填）' },
    { name: 'businessUserIdList', type: 'str', help: '需添加的负责人id列表，JSON数组字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultCode', 'resultMsg', 'messageList', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const payload = { corpid };
    payload.dataId = Number(kwargs.dataId || 0);
    const parsedBusinessUserIdList = parseJsonArray(kwargs.businessUserIdList);
    if (Array.isArray(parsedBusinessUserIdList)) payload.businessUserIdList = parsedBusinessUserIdList;
    if (runtimeUserId) payload.userId = runtimeUserId;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (parsedBusinessUserIdList === null) return makeErrorRow('NO_BUSINESSUSERIDLIST', '缺少 --businessUserIdList');
    if (parsedBusinessUserIdList === undefined) return makeErrorRow('INVALID_BUSINESSUSERIDLIST', '--businessUserIdList 必须是 JSON 数组字符串');
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
    return [{ resultCode: gateway.data.code ?? '', resultMsg: gateway.data.msg || '', messageList: JSON.stringify(result.messageList || []), code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
