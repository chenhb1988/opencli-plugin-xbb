import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/stage/get';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ stageProcessId: '', stageId: '', stageName: '', reasonText: '', reasonValue: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'stage-get',
  description: '阶段获取接口（businessType: -1；formId必填）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单Id（必填）' },
    { name: 'businessType', type: 'int', help: '业务类型（必填）' },
    { name: 'saasMark', type: 'int', help: '表单类型（必填）' },
    { name: 'dataId', type: 'int', help: '表单数据Id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['stageProcessId', 'stageId', 'stageName', 'reasonText', 'reasonValue', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = {
      corpid,
      formId: Number(kwargs.formId || 0),
      businessType: Number(kwargs.businessType || 0),
      saasMark: Number(kwargs.saasMark || 0),
      dataId: Number(kwargs.dataId || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId');
    if (!payload.businessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType');
    if (!payload.saasMark) return makeErrorRow('NO_SAASMARK', '缺少 --saasMark');
    if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
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
    const result = gateway.data.result || {};
    const stageList = Array.isArray(result.stageList) ? result.stageList : [];
    const reasonList = Array.isArray(result.reasonList) ? result.reasonList : [];
    const size = Math.max(stageList.length, reasonList.length, 1);
    return Array.from({ length: size }).map((_, index) => ({
      stageProcessId: result.stageProcessId || '',
      stageId: stageList[index]?.stageId || '',
      stageName: stageList[index]?.stageName || '',
      reasonText: reasonList[index]?.text || '',
      reasonValue: reasonList[index]?.value || '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }));
  },
});
