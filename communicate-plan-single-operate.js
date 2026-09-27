import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/communicatePlan/singleOperate';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ code, msg }];
}

cli({
  site: 'xbb',
  name: 'communicate-plan-single-operate',
  description: '访客计划延期接口（businessType: 601）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '访客计划id（必填）' },
    { name: 'delayCause', type: 'str', help: '延期原因（必填）' },
    { name: 'delayTime', type: 'int', help: '延期时间时间戳（必填）' },
    { name: 'delayMemo', type: 'str', default: '', help: '延期备注（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = {
      corpid,
      dataId: Number(kwargs.dataId || 0),
      delayCause: String(kwargs.delayCause || ''),
      delayTime: Number(kwargs.delayTime || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.delayMemo ?? '') !== '') payload.delayMemo = String(kwargs.delayMemo);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!payload.delayCause) return makeErrorRow('NO_DELAYCAUSE', '缺少 --delayCause');
    if (!payload.delayTime) return makeErrorRow('NO_DELAYTIME', '缺少 --delayTime');
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
