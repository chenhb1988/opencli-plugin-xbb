import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';

const ORIGINAL_TEXT_LIST_API_PATH = '/pro/v2/api/aiAgent/getAiOriginalText';
const pagination = createPagination({ countOnly: true });

function buildPayload(kwargs, corpid) {
  const payload = {
    corpid,
    ...(String(kwargs.userId ?? '') !== '' ? { userId: String(kwargs.userId) } : {}),
    ...(String(kwargs.page ?? '') !== '' ? { page: Number(kwargs.page) } : {}),
    ...(String(kwargs.pageSize ?? '') !== '' ? { pageSize: Number(kwargs.pageSize) } : {}),
    ...(String(kwargs.startTime ?? '') !== '' ? { startTime: Number(kwargs.startTime) } : {}),
    ...(String(kwargs.endTime ?? '') !== '' ? { endTime: Number(kwargs.endTime) } : {}),
  };
  return payload;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    originalUrl: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'orginal-text-list',
  description: '员工AI转录原文数据列表',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '员工userId' },
    { name: 'page', type: 'str', default: '', help: '页码（可选）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页数量（可选）' },
    { name: 'startTime', type: 'str', default: '', help: '开始时间戳，单位秒（可选）' },
    { name: 'endTime', type: 'str', default: '', help: '结束时间戳，单位秒（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'originalUrl', 'code', 'msg'],
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

    return list.map((item, index) => ({
      rank: index + 1,
      originalUrl: item.originalUrl || '',
      code: '',
      msg: '',
    }));
  },
});
