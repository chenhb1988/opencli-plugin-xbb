import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import { DETAIL_COLUMNS, makeDetailErrorRow, makeDetailRow } from './xbb-other-income.js';

const OTHER_INCOME_DETAIL_API_PATH = '/pro/v2/api/otherIncome/detail';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

cli({
  site: 'xbb',
  name: 'other-income-detail',
  group: 'other-income',
  description: '其他收入单详情接口',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '其他收入单id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: DETAIL_COLUMNS,
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = {
      corpid,
      dataId: Number(kwargs.dataId || 0),
    };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    if (!payload.corpid) {
      return makeDetailErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeDetailErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    if (!payload.dataId) {
      return makeDetailErrorRow('NO_DATAID', '缺少 --dataId');
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: OTHER_INCOME_DETAIL_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeDetailErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeDetailErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    return makeDetailRow(gateway.data);
  },
});