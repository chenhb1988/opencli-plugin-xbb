import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/product/online';

function makeErrorRow(code, msg) {
  return [{ resultCode: '', resultMsg: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'product-online',
  description: '产品上下架接口（businessType: 2401）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataIdList', type: 'str', help: '产品dataId列表，JSON数组字符串（必填）' },
    { name: 'online', type: 'int', help: '0为下架，1为上架（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['resultCode', 'resultMsg', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const payload = { corpid, online: Number(kwargs.online) };
    if (kwargs.userId) payload.userId = String(kwargs.userId);

    let dataIdList;
    try {
      dataIdList = JSON.parse(String(kwargs.dataIdList || ''));
    } catch {
      dataIdList = null;
    }
    if (Array.isArray(dataIdList)) payload.dataIdList = dataIdList;

    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!Array.isArray(dataIdList) || !dataIdList.length) return makeErrorRow('NO_DATAIDLIST', '缺少 --dataIdList 或格式不正确，需为JSON数组');
    if (!(payload.online === 0 || payload.online === 1)) return makeErrorRow('NO_ONLINE', '缺少 --online 或值必须为 0/1');
    if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');

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
    return [{ resultCode: gateway.data.code ?? '', resultMsg: gateway.data.msg || '', code: gateway.data.code ?? '', msg: gateway.data.msg || '' }];
  },
});
