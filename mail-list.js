import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';
import { formatMailParties, resolveMailUserId } from './xbb-mail.js';

const MAIL_LIST_API_PATH = '/pro/v2/api/mail/data/list';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const pagination = createPagination({ pick: (data) => data?.result?.pageHelper });

function buildPayload(kwargs, corpid, operatorUserId) {
  const payload = {
    corpid,
    folderId: Number(kwargs.folderId || 0),
  };
  if (operatorUserId) payload.userId = operatorUserId;

  for (const field of ['page', 'pageSize', 'filterType']) {
    if (String(kwargs[field] ?? '') !== '') {
      payload[field] = Number(kwargs[field]);
    }
  }

  return payload;
}

function makeErrorRow(code, msg) {
  return [{
    rank: '',
    id: '',
    folderId: '',
    subject: '',
    sender: '',
    toRecipient: '',
    summary: '',
    isRead: '',
    sendStatus: '',
    data: '',
    code,
    msg,
  }];
}

function makeSuccessRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    id: item.id ?? item.mailId ?? '',
    folderId: item.folderId ?? '',
    subject: item.subject ?? '',
    sender: formatMailParties(item.sender),
    toRecipient: formatMailParties(item.toRecipient),
    summary: item.summary ?? '',
    isRead: item.isRead ?? '',
    sendStatus: item.sendStatus ?? '',
    data: JSON.stringify(item ?? {}),
    code: '',
    msg: '',
  }));
}

cli({
  site: 'xbb',
  name: 'mail-list',
  group: 'mail',
  description: '邮件列表（按文件夹分页，1 收件箱 / 2 已发送 / 3 草稿箱 / 4 已删除 / 5 垃圾邮件 / 6 未读）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'folderId', type: 'int', help: '文件夹 ID（必填）：1 收件箱、2 已发送、3 草稿箱、4 已删除、5 垃圾邮件、6 未读，自定义文件夹传实际 ID' },
    { name: 'page', type: 'str', default: '', help: '页码，从 1 开始（可选，默认 1）' },
    { name: 'pageSize', type: 'str', default: '', help: '每页条数（可选，默认 20）' },
    { name: 'filterType', type: 'str', default: '', help: '筛选类型（可选）：-1 其他、0 全部、1 客户、2 联系人、3 线索、4 未读' },
    { name: 'userId', type: 'str', default: '', help: '操作员工 userId（可选，默认取配置）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
    { name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' },
  ],
  columns: ['rank', 'id', 'folderId', 'subject', 'sender', 'toRecipient', 'summary', 'isRead', 'sendStatus', 'data', 'code', 'msg'],
  footerExtra: pagination.footerExtra,
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const operatorUserId = resolveMailUserId(kwargs, userId);
    const payload = buildPayload(kwargs, corpid, operatorUserId);

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    if (!payload.folderId) {
      return makeErrorRow('NO_FOLDER_ID', '缺少 --folderId');
    }
    for (const field of ['page', 'pageSize', 'filterType']) {
      if (String(kwargs[field] ?? '') !== '' && !Number.isFinite(Number(kwargs[field]))) {
        return makeErrorRow('INVALID_PAYLOAD', `--${field} 必须是数字`);
      }
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: MAIL_LIST_API_PATH,
      payload,
      token,
      userId: operatorUserId,
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