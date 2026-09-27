import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/workOrderV2/handover';

function makeErrorRow(code, msg) {
  return [{
    resultCode: '',
    resultMsg: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'workorder-handover',
  description: '移交工单负责人（businessType: 2301；formId必填）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'dataIdList', type: 'str', help: '需移交的工单id列表，JSON数组字符串（必填）' },
    { name: 'businessUserId', type: 'str', help: '移交人id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'retainMainUser', type: 'str', default: '', help: '保留原负责人为协同人：1保留，0不保留（可选）' },
    { name: 'transfer', type: 'str', default: '', help: '移交原因（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultCode', 'resultMsg', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();

    const payload = {
      corpid,
      formId: Number(kwargs.formId || 0),
      businessUserId: String(kwargs.businessUserId || ''),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.retainMainUser ?? '') !== '') payload.retainMainUser = Number(kwargs.retainMainUser);
    if (kwargs.transfer) payload.transfer = String(kwargs.transfer);

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
    if (!payload.formId) {
      return makeErrorRow('NO_FORMID', '缺少 --formId');
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

    return [{
      resultCode: gateway.data.code ?? '',
      resultMsg: gateway.data.msg || '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});
