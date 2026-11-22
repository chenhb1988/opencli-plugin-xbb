import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import {
  DEMO_ARG,
  parseDataList,
  requestAddExample,
  resolveDemoFormat,
  resolveFormIdByBusinessType,
} from './xbb-form-example.js';

const API_PATH = '/pro/v2/api/clue/add';
const CLUE_BUSINESS_TYPE = '8000';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

cli({
  site: 'xbb',
  name: 'clue-add',
  description: '新建线索接口（businessType: 8000；不传 formId 时按表单缓存自动解析）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单模板id（不传时从表单缓存按 businessType 8000 自动解析）' },
    { name: 'dataList', type: 'str', help: '线索数据JSON字符串（普通新建必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    DEMO_ARG,
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg'],
  resolveFormat: resolveDemoFormat,
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const demo = Boolean(kwargs.demo);
    // --demo 的整份输出都是「请求体示例」，错误行统一成 code/msg 两列，避免混入 dataId/resultCode 空列
    const fail = (code, msg) => (demo ? [{ code, msg }] : [{ dataId: '', resultCode: '', resultMsg: '', code, msg }]);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    if (!corpid) return fail('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!token) return fail('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    let formId = Number(kwargs.formId || 0);
    if (formId < 0) return fail('INVALID_FORM_ID', `--formId 必须是正整数（当前：${kwargs.formId}）`);
    // demo 与正式新建走同一套解析：未传 formId 时都从表单缓存按 businessType 找线索表单
    if (!formId) {
      const resolved = resolveFormIdByBusinessType(corpid, CLUE_BUSINESS_TYPE, '线索表单');
      if (resolved.code) return fail(resolved.code, resolved.msg);
      formId = resolved.formId;
      if (debug) process.stderr.write(`[debug] FormId resolved from form cache: ${formId}\n`);
    }
    if (demo) {
      return requestAddExample({ baseUrl, apiPath: API_PATH, corpid, formId, token, userId: runtimeUserId, debug });
    }
    const parsedDataList = parseDataList(kwargs.dataList);
    if (parsedDataList === null) return fail('NO_DATALIST', '缺少 --dataList');
    if (parsedDataList === undefined) return fail('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串');
    const payload = { corpid, formId };
    if (runtimeUserId) payload.userId = runtimeUserId;
    payload.dataList = parsedDataList;
    const gateway = await requestGateway({
      baseUrl,
      apiPath: API_PATH,
      payload,
      token,
      userId: runtimeUserId,
      debug,
    });
    if (!gateway.ok) return fail(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return fail(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }
    const result = gateway.data.result || {};
    return [{ dataId: result.dataId || '', resultCode: result.code ?? '', resultMsg: result.msg || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
