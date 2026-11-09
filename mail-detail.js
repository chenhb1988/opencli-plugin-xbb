import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import { formatMailParties, resolveMailUserId, stringifyMailValue } from './xbb-mail.js';

const MAIL_DETAIL_API_PATH = '/pro/v2/api/mail/data/detail';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{
    id: '',
    folderId: '',
    sender: '',
    toRecipient: '',
    ccRecipient: '',
    subject: '',
    summary: '',
    attachment: '',
    data: '',
    isRead: '',
    sendStatus: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'mail-detail',
  group: 'mail',
  description: '邮件或草稿详情（查看未读邮件会标记为已读；草稿详情传 --folderId 3）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'id', type: 'int', help: '邮件 ID（必填）；草稿详情传草稿 ID' },
    { name: 'folderId', type: 'int', help: '文件夹 ID（必填）：普通邮件传所在文件夹 ID，草稿详情传 3' },
    { name: 'userId', type: 'str', default: '', help: '操作员工 userId（可选，默认取配置）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['id', 'folderId', 'sender', 'toRecipient', 'ccRecipient', 'subject', 'summary', 'attachment', 'data', 'isRead', 'sendStatus', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const operatorUserId = resolveMailUserId(kwargs, userId);
    const payload = {
      corpid,
      id: Number(kwargs.id || 0),
      folderId: Number(kwargs.folderId || 0),
    };
    if (operatorUserId) payload.userId = operatorUserId;

    if (!payload.corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    if (!payload.id) {
      return makeErrorRow('NO_ID', '缺少 --id');
    }
    if (!payload.folderId) {
      return makeErrorRow('NO_FOLDER_ID', '缺少 --folderId');
    }

    const gateway = await requestGateway({
      baseUrl,
      apiPath: MAIL_DETAIL_API_PATH,
      payload,
      token,
      userId: operatorUserId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    const result = gateway.data.result || {};
    return [{
      id: result.id ?? '',
      folderId: result.folderId ?? '',
      sender: formatMailParties(result.sender),
      toRecipient: formatMailParties(result.toRecipient),
      ccRecipient: formatMailParties(result.ccRecipient),
      subject: result.subject ?? '',
      summary: result.summary ?? '',
      attachment: stringifyMailValue(result.attachment),
      data: result.data ?? '',
      isRead: result.isRead ?? '',
      sendStatus: result.sendStatus ?? '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});