import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/workReportDaily/getWorkPlan';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ rank: '', num_1: '', text_1: '', text_2: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'work-report-daily-get-work-plan',
  description: '获取工作计划接口（businessType: 2102）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'reportUserId', type: 'str', help: '提交报告员工userId（必填）' },
    { name: 'type', type: 'int', help: '工作报告类型，1日报，2周报，3月报（必填）' },
    { name: 'reportDate', type: 'int', help: '提交报告的日期时间戳（必填）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['rank', 'num_1', 'text_1', 'text_2', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, reportUserId: String(kwargs.reportUserId || ''), type: Number(kwargs.type || 0), reportDate: Number(kwargs.reportDate || 0) };
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.reportUserId) return makeErrorRow('NO_REPORTUSERID', '缺少 --reportUserId');
    if (!payload.type) return makeErrorRow('NO_TYPE', '缺少 --type');
    if (!payload.reportDate) return makeErrorRow('NO_REPORTDATE', '缺少 --reportDate');
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
    const list = Array.isArray(gateway.data.result?.workReportPlanList) ? gateway.data.result.workReportPlanList : [];
    if (!list.length) return makeErrorRow('NO_DATA', '接口成功，但 workReportPlanList 为空');
    return list.map((item, index) => ({ rank: index + 1, num_1: item.num_1 ?? '', text_1: item.text_1 || '', text_2: String(item.text_2 ?? ''), code: '', msg: '' }));
  },
});
