import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const ORIGINAL_TEXT_LIST_API_PATH = '/pro/v2/api/aiAgent/getAiOriginalText';
const pagination = createPagination({ countOnly: true });

const NUMBER_FIELDS = [
  'customerId',
  'clueId',
  'opportunityId',
  'communicateId',
  'communicateTime',
  'communicateTimeEnd',
  'sourceType',
  'page',
  'pageSize',
];

function buildPayload(kwargs, corpid) {
  const payload = { corpid };

  for (const field of NUMBER_FIELDS) {
    if (String(kwargs[field] ?? '') !== '') {
      payload[field] = Number(kwargs[field]);
    }
  }

  const userId = String(kwargs.userId ?? '');
  if (userId !== '') {
    payload.userId = userId;
  }

  const communicateUserId = String(kwargs.communicateUserId ?? '');
  if (communicateUserId !== '') {
    payload.communicateUserId = communicateUserId;
  }

  const communicateTimeOperator = String(kwargs.communicateTimeOperator ?? '');
  if (communicateTimeOperator !== '') {
    payload.communicateTimeOperator = communicateTimeOperator;
  }

  // 接口在未传 page 时会忽略 pageSize 并返回默认 100 条，按文档约定补默认第 1 页
  if (payload.pageSize != null && payload.page == null) {
    payload.page = 1;
  }

  return payload;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    behavingId: '',
    customerId: '',
    clueId: '',
    opportunityId: '',
    communicateId: '',
    businessType: '',
    qualityAnalyze: '',
    originalUrl: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    behavingId: item.behavingId ?? '',
    customerId: item.customerId ?? '',
    clueId: item.clueId ?? '',
    opportunityId: item.opportunityId ?? '',
    communicateId: item.communicateId ?? '',
    businessType: item.businessType ?? '',
    qualityAnalyze: item.qualityAnalyze ?? '',
    originalUrl: item.originalUrl ?? '',
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'original-text-list',
  description: 'AI转录原文数据列表，对话/录音/通话原文',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作员工userId（可选）' },
    { name: 'customerId', type: 'str', default: '', help: '客户ID（与 clueId 互斥）' },
    { name: 'clueId', type: 'str', default: '', help: '线索ID（与 customerId 互斥）' },
    { name: 'opportunityId', type: 'str', default: '', help: '销售机会ID（可选）' },
    { name: 'communicateId', type: 'str', default: '', help: '跟进记录ID（可选）' },
    { name: 'communicateUserId', type: 'str', default: '', help: '跟进人ID（可选）' },
    { name: 'communicateTime', type: 'str', default: '', help: '跟进时间，秒级时间戳（可选）' },
    { name: 'communicateTimeOperator', type: 'str', default: '', help: '跟进时间比较方式：eq/gt/lt/between（传 communicateTime 时必填）' },
    { name: 'communicateTimeEnd', type: 'str', default: '', help: '跟进时间区间终点，秒级时间戳（仅 between 使用）' },
    { name: 'sourceType', type: 'str', default: '', help: '来源渠道（可选）' },
    { name: 'page', type: 'str', default: '', help: '页码，1-100（可选，默认 1）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量，1-100（可选，默认 100）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'behavingId', 'customerId', 'clueId', 'opportunityId', 'communicateId', 'businessType', 'qualityAnalyze', 'originalUrl', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = buildPayload(kwargs, corpid);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: ORIGINAL_TEXT_LIST_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    pagination.update(gateway.data);
    if (kwargs.raw) return [{ raw: gateway.responseBody }];
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    const list = Array.isArray(gateway.data.result?.list) ? gateway.data.result.list : [];
    if (!list.length) {
      return makeErrorRow('NO_DATA', '接口成功，但 list 为空');
    }

    return makeSuccessRows(list);
  },
});