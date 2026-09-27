import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/workOrderV2/asset/edit';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function parseJsonObject(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function makeErrorRow(code, msg) {
  return [{ dataId: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'work-order-asset-edit',
  description: '资产编辑接口（businessType: -1；workOrderV2 资产）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '表单数据id（必填）' },
    { name: 'dataList', type: 'str', default: '', help: '表单数据JSON对象字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const payload = { corpid };
    payload.dataId = Number(kwargs.dataId || 0);
    const parsedDataList = parseJsonObject(kwargs.dataList);
    if (parsedDataList) payload.dataList = parsedDataList;
    if (runtimeUserId) payload.userId = runtimeUserId;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
    if (parsedDataList === null) return makeErrorRow('NO_DATALIST', '缺少 --dataList');
    if (parsedDataList === undefined) return makeErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串');
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
    return [{ dataId: result.dataId || '', resultCode: result.code ?? '', resultMsg: result.msg || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
