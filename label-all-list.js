import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';

const API_PATH = '/pro/v2/api/label/allList';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{ rank: '', groupId: '', groupName: '', dataId: '', name: '', color: '', sort: '', code, msg }];
}

cli({
  site: 'xbb',
  name: 'label-all-list',
  description: '表单标签列表接口（businessType: -1；label 模块）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'formId', type: 'int', help: '表单id（必填）' },
    { name: 'businessType', type: 'int', help: '业务类型（必填）' },
    { name: 'enable', type: 'str', default: '', help: '是否在回收站中（必填，可传0）' },
    { name: 'isReLabel', type: 'str', default: '', help: '是否展示回收站的标签，需要时传1（可选）' },
    { name: 'nameLike', type: 'str', default: '', help: '模糊查询标签名称（可选）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'groupId', 'groupName', 'dataId', 'name', 'color', 'sort', 'code', 'msg'],
  func: async function (kwargs) {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const runtimeUserId = String(kwargs.userId || userId || '').trim();
    const payload = { corpid };
    payload.formId = Number(kwargs.formId || 0);
    payload.businessType = Number(kwargs.businessType || 0);
    if (String(kwargs.enable ?? '') !== '') payload.enable = Number(kwargs.enable);
    if (String(kwargs.isReLabel ?? '') !== '') payload.isReLabel = Number(kwargs.isReLabel);
    if (String(kwargs.nameLike || '').trim()) payload.nameLike = String(kwargs.nameLike).trim();
    if (runtimeUserId) payload.userId = runtimeUserId;
    if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    if (!payload.formId) return makeErrorRow('NO_FORMID', '缺少 --formId');
    if (!payload.businessType) return makeErrorRow('NO_BUSINESSTYPE', '缺少 --businessType');
    if (String(kwargs.enable ?? '') === '') return makeErrorRow('NO_ENABLE', '缺少 --enable');
    if (!token) return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    const gateway = await requestGateway({
      baseUrl,
      apiPath: API_PATH,
      payload,
      token,
      userId: runtimeUserId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (kwargs.raw) return [{ raw: gateway.responseBody }];
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }
    const tree = Array.isArray(gateway.data.result?.labelTree) ? gateway.data.result.labelTree : [];
    if (!tree.length) return makeErrorRow('NO_DATA', '接口成功，但 labelTree 为空');
    const rows = [];
    for (const group of tree) {
      rows.push({ rank: rows.length + 1, groupId: group.id || '', groupName: group.labelGroupName || '', dataId: '', name: '', color: '', sort: '', code: '', msg: '' });
      const labels = Array.isArray(group.labelEntities) ? group.labelEntities : [];
      for (const label of labels) {
        rows.push({ rank: rows.length + 1, groupId: label.groupId || group.id || '', groupName: group.labelGroupName || '', dataId: label.id || '', name: label.name || '', color: label.color || '', sort: label.sort ?? '', code: '', msg: '' });
      }
    }
    return rows;
  },
});
