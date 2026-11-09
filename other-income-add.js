import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import { MUTATION_COLUMNS, makeMutationErrorRow, makeMutationRow, parseDataList } from './xbb-other-income.js';

const OTHER_INCOME_ADD_API_PATH = '/pro/v2/api/otherIncome/add';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

cli({
  site: 'xbb',
  name: 'other-income-add',
  group: 'other-income',
  description: '其他收入单新建接口',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataList', type: 'str', help: '表单数据JSON字符串（必填），字段可用 form-get 查询其他收入单表单' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: MUTATION_COLUMNS,
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    const parsedDataList = parseDataList(kwargs.dataList);
    if (parsedDataList) {
      payload.dataList = parsedDataList;
    }

    if (!payload.corpid) {
      return makeMutationErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeMutationErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    if (parsedDataList === null) {
      return makeMutationErrorRow('NO_DATALIST', '缺少 --dataList');
    }
    if (parsedDataList === undefined) {
      return makeMutationErrorRow('INVALID_DATALIST', '--dataList 必须是 JSON 对象字符串');
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: OTHER_INCOME_ADD_API_PATH,
      payload,
      token,
      userId,
      debug,
    });
    if (!gateway.ok) return makeMutationErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeMutationErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    return makeMutationRow(gateway.data);
  },
});