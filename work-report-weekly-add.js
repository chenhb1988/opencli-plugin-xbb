import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/workReportWeekly/add';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function makeErrorRow(code, msg) {
  return [{ dataId: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'work-report-weekly-add',
  description: '新建周报接口（businessType: 2103）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataList', type: 'str', help: '周报数据JSON字符串（必填）' },
    { name: 'userId', type: 'str', help: '工作报告提交人userId（必填）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const parsedDataList = parseDataList(kwargs.dataList);
    const payload = { corpid, userId: String(kwargs.userId || userId || '').trim() };
    if (parsedDataList) payload.dataList = parsedDataList;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.userId) return makeErrorRow('NO_USERID', '缺少 --userId');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    if (parsedDataList === null) return makeErrorRow('NO_DATALIST', '缺少 --dataList');
    if (parsedDataList === undefined) return makeErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串');
    const gateway = await requestGateway({
      baseUrl,
      apiPath: API_PATH,
      payload,
      token,
      userId: payload.userId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }
    return [{ dataId: gateway.data.result?.dataId || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
