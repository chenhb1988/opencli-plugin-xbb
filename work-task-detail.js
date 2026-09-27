import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/workTask/detail';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ dataId: '', taskName: '', taskStartTime: '', taskEndTime: '', remark: '', code, msg }];
}

function formatTimestampSeconds(value) {
  const timestamp = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timestamp * 1000)).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

cli({
  site: 'xbb',
  name: 'work-task-detail',
  description: '工作任务详情接口（businessType: 21500）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '任务id（必填）' },
    { name: 'queryFlag', type: 'int', default: 0, help: '查询标记（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'taskName', 'taskStartTime', 'taskEndTime', 'remark', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, dataId: Number(kwargs.dataId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (String(kwargs.queryFlag ?? '') !== '') payload.queryFlag = Number(kwargs.queryFlag);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
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
    return [{ dataId: result.dataId || '', taskName: result.data?.text_1 || '', taskStartTime: formatTimestampSeconds(result.data?.date_1), taskEndTime: formatTimestampSeconds(result.data?.date_2), remark: result.data?.text_3?.taskMemoText || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
