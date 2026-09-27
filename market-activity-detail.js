import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/marketActivity/detail';

function makeErrorRow(code, msg) {
  return [{ dataId: '', formId: '', addTime: '', updateTime: '', data: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'market-activity-detail',
  description: '市场活动详情接口（businessType: 8100）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '数据id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'queryFlag', type: 'str', default: '', help: '是否查询审批数据：0非审批数据，1审批数据，2不论是否审批中都查询，默认0（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'formId', 'addTime', 'updateTime', 'data', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, dataId: Number(kwargs.dataId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.queryFlag ?? '') !== '') payload.queryFlag = Number(kwargs.queryFlag);

    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');

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
    return [{ dataId: result.dataId || '', formId: result.formId || '', addTime: result.addTime || '', updateTime: result.updateTime || '', data: JSON.stringify(result.data || {}), code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
