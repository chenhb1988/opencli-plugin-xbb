import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const BUSINESS_INFO_GET_API_PATH = '/pro/v2/api/businessInfo/getInfo';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

// 回显固定为 key/value 两列，逐字段列出工商登记信息；kind 决定取值与格式化方式
const FIELDS = [
  ['enterpriseName', 'text'],
  ['pid', 'pid'],
  ['operatingState', 'text'],
  ['legalRepresentative', 'text'],
  ['registeredCapital', 'text'],
  ['unifySocialCreditCode', 'text'],
  ['registrationNumber', 'text'],
  ['organizationCode', 'text'],
  ['enterpriseType', 'text'],
  ['companySize', 'text'],
  ['securitySize', 'text'],
  ['dateOfEstablishment', 'date'],
  ['approvalDate', 'date'],
  ['operatingPeriod', 'text'],
  ['cancellationDate', 'date'],
  ['registrationAuthority', 'text'],
  ['provinceCity', 'text'],
  ['registeredAddress', 'json'],
  ['mailingAddress', 'text'],
  ['business', 'text'],
  ['scopeOfBusiness', 'text'],
  ['annualTurnover', 'text'],
  ['shareholder', 'json'],
  ['historyName', 'text'],
];

function buildPayload(kwargs, corpid) {
  return {
    pid: String(kwargs.pid || '').trim(),
    corpid,
  };
}

function getValidationError(payload, token) {
  if (!payload.pid) {
    return { code: 'NO_PID', msg: '缺少 --pid' };
  }

  if (!payload.corpid) {
    return { code: 'NO_CORPID', msg: '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>' };
  }

  if (!token) {
    return { code: 'NO_TOKEN', msg: MISSING_TOKEN_MESSAGE };
  }

  return null;
}

// 接口按 UTC+8 零点存储秒级时间戳（如 1426435200 → 2015-03-16），0/空表示无值
function fmtDate(value) {
  const seconds = Number(value || 0);
  if (!seconds) return '';
  return new Date((seconds + 8 * 3600) * 1000).toISOString().slice(0, 10);
}

function fieldValue(data, field, kind) {
  if (kind === 'pid') {
    return data.id == null ? '' : String(data.id);
  }
  const value = data[field];
  if (kind === 'date') return fmtDate(value);
  if (kind === 'json') return value == null ? '' : JSON.stringify(value);
  return value == null ? '' : String(value);
}

function makeErrorRow(code, msg) {
  return [{ key: code, value: msg }];
}

function makeSuccessRows(data) {
  return FIELDS.map(([field, kind]) => ({ key: field, value: fieldValue(data, field, kind) }));
}

cli({
  site: 'xbb',
  name: 'business-info-detail',
  description: '按 pid 查询企业工商登记信息（需购买工商查询服务方可调用）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'pid', type: 'str', help: '企业 pid（必填，由 business-info-search 获取）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['key', 'value'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);

    const validationError = getValidationError(payload, token);
    if (validationError) {
      return makeErrorRow(validationError.code, validationError.msg);
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: BUSINESS_INFO_GET_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    const result = gateway.data.result?.data;
    if (!result || typeof result !== 'object') {
      return makeErrorRow('NO_DATA', '接口成功，但工商信息为空');
    }

    return makeSuccessRows(result);
  },
});
