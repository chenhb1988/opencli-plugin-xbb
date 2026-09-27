import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/customer/handover';

function makeErrorRow(code, msg) {
  return [{
    resultType: '',
    resultMsg: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'customer-handover',
  description: '客户移交接口（businessType: 100）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataIdList', type: 'str', help: '客户id列表，JSON数组字符串，最多200条（必填）' },
    { name: 'businessUserId', type: 'str', help: '移交目标人员id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'originUserId', type: 'str', default: '', help: '被移交用户，隔离模式的移交客户必填（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultType', 'resultMsg', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();

    const payload = {
      corpid,
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (kwargs.businessUserId) payload.businessUserId = String(kwargs.businessUserId);
    if (kwargs.originUserId) payload.originUserId = String(kwargs.originUserId);

    let dataIdList;
    try {
      dataIdList = JSON.parse(String(kwargs.dataIdList || ''));
    } catch {
      dataIdList = null;
    }
    if (Array.isArray(dataIdList)) {
      payload.dataIdList = dataIdList;
    }


    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!Array.isArray(dataIdList) || !dataIdList.length) {
      return makeErrorRow('NO_DATAIDLIST', '缺少 --dataIdList 或格式不正确，需为JSON数组');
    }
    if (!payload.businessUserId) {
      return makeErrorRow('NO_BUSINESSUSERID', '缺少 --businessUserId');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }

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

    const result = gateway.data.result || {};
    return [{
      resultType: result.resultType || '',
      resultMsg: result.resultMsg || '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});
