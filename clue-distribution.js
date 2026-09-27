import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/clue/distribution';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ resultType: '', resultMsg: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'clue-distribution',
  description: '线索分配接口（businessType: 8000）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataIdList', type: 'str', help: '线索id列表，JSON数组字符串（必填）' },
    { name: 'businessUserId', type: 'str', help: '被分配员工id（必填）' },
    { name: 'subBusinessType', type: 'str', default: '', help: '子业务类型：8001非公海线索，8002公海线索（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultType', 'resultMsg', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.businessUserId || '').trim()) payload.businessUserId = String(kwargs.businessUserId);
    if (String(kwargs.subBusinessType ?? '') !== '') payload.subBusinessType = Number(kwargs.subBusinessType);
    let dataIdList;
    try {
      dataIdList = JSON.parse(String(kwargs.dataIdList || ''));
    } catch {
      dataIdList = null;
    }
    if (Array.isArray(dataIdList)) payload.dataIdList = dataIdList;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!Array.isArray(dataIdList) || !dataIdList.length) return makeErrorRow('NO_DATAIDLIST', '缺少 --dataIdList 或格式不正确，需为JSON数组');
    if (!payload.businessUserId) return makeErrorRow('NO_BUSINESSUSERID', '缺少 --businessUserId');
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
    return [{ resultType: gateway.data.result?.resultType || '', resultMsg: gateway.data.result?.resultMsg || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
