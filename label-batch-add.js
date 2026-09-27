import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/label/batch/add';
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
  return [{ code, msg }];
}

cli({
  site: 'xbb',
  name: 'label-batch-add',
  description: '打标签接口（businessType: -1；label 模块）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单模板id（必填）' },
    { name: 'dataIdList', type: 'str', help: '表单数据id列表，JSON数组字符串（必填）' },
    { name: 'businessType', type: 'int', help: '业务类型，如客户100、合同订单201、联系人401、产品2401、报价单4700、线索8000（必填）' },
    { name: 'attr', type: 'str', help: '标签字段（必填）' },
    { name: 'labelIds', type: 'str', help: '标签id列表，JSON数组字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const payload = { corpid };
    payload.formId = Number(kwargs.formId || 0);
    const parsedDataIdList = parseJsonArray(kwargs.dataIdList);
    if (Array.isArray(parsedDataIdList)) payload.dataIdList = parsedDataIdList;
    payload.businessType = Number(kwargs.businessType || 0);
    payload.attr = String(kwargs.attr || '').trim();
    const parsedLabelIds = parseJsonArray(kwargs.labelIds);
    if (Array.isArray(parsedLabelIds)) payload.labelIds = parsedLabelIds;
    if (runtimeUserId) payload.userId = runtimeUserId;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId');
    if (parsedDataIdList === null) return makeErrorRow('NO_DATAIDLIST', '缺少 --dataIdList');
    if (parsedDataIdList === undefined) return makeErrorRow('INVALID_DATAIDLIST', '--dataIdList 必须是 JSON 数组字符串');
    if (!payload.businessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType');
    if (!payload.attr) return makeErrorRow('NO_ATTR', '缺少 --attr');
    if (parsedLabelIds === null) return makeErrorRow('NO_LABELIDS', '缺少 --labelIds');
    if (parsedLabelIds === undefined) return makeErrorRow('INVALID_LABELIDS', '--labelIds 必须是 JSON 数组字符串');
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
    return [{ code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
