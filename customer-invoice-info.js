import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/customer/invoice/info';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ dataId: '', type: '', title: '', taxpayerNo: '', registeredPhone: '', invoiceAddress: '', bank: '', account: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'customer-invoice-info',
  description: '客户开票信息接口（businessType: 100）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'customerId', type: 'int', help: '客户id（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['dataId', 'type', 'title', 'taxpayerNo', 'registeredPhone', 'invoiceAddress', 'bank', 'account', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, customerId: Number(kwargs.customerId || 0) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.customerId) return makeErrorRow('NO_CUSTOMERID', '缺少 --customerId');
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
    const list = Array.isArray(gateway.data.result?.list) ? gateway.data.result.list : [];
    if (!list.length) return [{ dataId: '', type: '', title: '', taxpayerNo: '', registeredPhone: '', invoiceAddress: '', bank: '', account: '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
    return list.map((item) => ({
      dataId: item.dataId || '',
      type: item.type || '',
      title: item.title || '',
      taxpayerNo: item.taxpayerNo || '',
      registeredPhone: item.registeredPhone || '',
      invoiceAddress: item.invoiceAddress || '',
      bank: item.bank || '',
      account: item.account || '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }));
  },
});
