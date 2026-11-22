import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import {
  DEMO_ARG,
  parseDataList,
  requestAddExample,
  resolveDemoFormat,
  resolveFormIdByBusinessType,
} from './xbb-form-example.js';

const API_PATH = '/pro/v2/api/product/add';
const PRODUCT_BUSINESS_TYPE = '2401';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

cli({
  site: 'xbb',
  name: 'product-add',
  group: 'product',
  description: '新建产品接口（businessType: 2401；--demo 可返回请求体示例）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataList', type: 'str', help: '表单数据JSON字符串（普通新建必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    DEMO_ARG,
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'resultCode', 'resultMsg', 'code', 'msg'],
  resolveFormat: resolveDemoFormat,
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const demo = Boolean(kwargs.demo);
    const fail = (code, msg) => (demo ? [{ code, msg }] : [{ dataId: '', resultCode: '', resultMsg: '', code, msg }]);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    if (!corpid) return fail('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!token) return fail('NO_TOKEN', MISSING_TOKEN_MESSAGE);

    if (demo) {
      let formId = Number(kwargs.formId || 0);
      if (formId < 0) return fail('INVALID_FORM_ID', `--formId 必须是正整数（当前：${kwargs.formId}）`);
      if (!formId) {
        const resolved = resolveFormIdByBusinessType(corpid, PRODUCT_BUSINESS_TYPE, '产品表单');
        if (resolved.code) return fail(resolved.code, resolved.msg);
        formId = resolved.formId;
        if (debug) process.stderr.write(`[debug] FormId resolved from form cache: ${formId}\n`);
      }
      return requestAddExample({
        baseUrl,
        apiPath: API_PATH,
        corpid,
        formId,
        token,
        userId: runtimeUserId,
        debug,
        // 示例里带 formId 是 param/get 的通用拼装，product/add 并不接收该字段，剔掉避免照着抄
        omitExampleKeys: ['formId'],
      });
    }

    const parsedDataList = parseDataList(kwargs.dataList);
    if (parsedDataList === null) return fail('NO_DATALIST', '缺少 --dataList');
    if (parsedDataList === undefined) return fail('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串');

    const payload = { corpid };
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
    return [{
      dataId: result.dataId || '',
      resultCode: result.code ?? '',
      resultMsg: result.msg || '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});
