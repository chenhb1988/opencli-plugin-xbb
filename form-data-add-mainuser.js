import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/paas/addMainUser';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ resultCode: '', resultMsg: '', messageList: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'form-data-add-mainuser',
  description: '自定义表单添加负责人接口（businessType: 0）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '表单id（必填）' },
    { name: 'businessUserIdList', type: 'str', help: '需添加的负责人id列表，JSON数组字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultCode', 'resultMsg', 'messageList', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { dataId: Number(kwargs.dataId || 0), corpid };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    let businessUserIdList;
    try {
      businessUserIdList = JSON.parse(String(kwargs.businessUserIdList || ''));
    } catch {
      businessUserIdList = null;
    }
    if (Array.isArray(businessUserIdList)) payload.businessUserIdList = businessUserIdList;
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!Array.isArray(businessUserIdList) || !businessUserIdList.length) return makeErrorRow('NO_USERIDLIST', '缺少 --businessUserIdList 或格式不正确，需为JSON数组');
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
    return [{ resultCode: gateway.data.code ?? '', resultMsg: gateway.data.msg || '', messageList: JSON.stringify(gateway.data.result?.messageList || []), code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
