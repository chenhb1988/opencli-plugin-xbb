import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/user/permission';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{
    checkUserId: '',
    businessType: '',
    formId: '',
    permissionCount: '',
    permissions: '',
    code,
    msg,
  }];
}

function parseFormId(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    return { formId: 0 };
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) {
    return { error: { code: 'INVALID_FORMID', msg: '--formId 必须是正整数' } };
  }
  return { formId: value };
}

cli({
  site: 'xbb',
  name: 'auth-permission',
  group: 'auth',
  description: '查询员工在指定业务下的权限项集合（businessType: 0 为自定义表单，需配合 formId）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'checkUserId', type: 'str', help: '被查询员工 userId（必填，与当前登录人无关）' },
    { name: 'businessType', type: 'int', help: '业务类型（必填）：0=自定义表单，SaaS 如 100/201/301/401/8000/20300' },
    { name: 'formId', type: 'str', default: '', help: '自定义表单 id（businessType=0 时必填；SaaS 业务无需传）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['checkUserId', 'businessType', 'formId', 'permissionCount', 'permissions', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const checkUserId = String(kwargs.checkUserId ?? '').trim();
    const hasBusinessType = kwargs.businessType !== undefined && String(kwargs.businessType).trim() !== '';
    const businessType = Number(kwargs.businessType);
    const parsedForm = parseFormId(kwargs.formId);

    if (!corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    if (!checkUserId) return makeErrorRow('NO_CHECKUSERID', '缺少 --checkUserId（被查询员工 userId）');
    if (!hasBusinessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType');
    if (parsedForm.error) return makeErrorRow(parsedForm.error.code, parsedForm.error.msg);
    if (businessType === 0 && !parsedForm.formId) {
      return makeErrorRow('NO_FORMID', 'businessType=0（自定义表单）时必须传 --formId');
    }

    const payload = { corpid, checkUserId, businessType };
    if (runtimeUserId) payload.userId = runtimeUserId;
    // SaaS 业务不接收 formId（传了也会被忽略），仅在自定义表单时写入
    if (businessType === 0) payload.formId = parsedForm.formId;

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
    const permissions = Array.isArray(result.permissions) ? result.permissions.map((item) => String(item)) : [];
    return [{
      checkUserId,
      businessType,
      formId: businessType === 0 ? parsedForm.formId : '',
      permissionCount: permissions.length,
      permissions,
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});