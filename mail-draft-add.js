import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import { parseMailArray, resolveMailUserId } from './xbb-mail.js';

const MAIL_DRAFT_ADD_API_PATH = '/pro/v2/api/mail/draft/add';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{
    id: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'mail-draft-add',
  group: 'mail',
  description: '新建邮件草稿（允许内容未填写完整）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'to', type: 'str', default: '', help: '收件人 JSON 数组（可选），元素如 {"name":"张三","mailAddress":"a@b.com"}' },
    { name: 'cc', type: 'str', default: '', help: '抄送人 JSON 数组（可选）' },
    { name: 'subject', type: 'str', default: '', help: '邮件主题（可选）' },
    { name: 'data', type: 'str', default: '', help: 'HTML 正文（可选）' },
    { name: 'attachment', type: 'str', default: '', help: '附件 JSON 数组（可选），元素含 fileName/attachIndex/ext/size' },
    { name: 'userId', type: 'str', default: '', help: '草稿所属员工 userId（可选，默认取配置）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['id', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const operatorUserId = resolveMailUserId(kwargs, userId);
    const to = parseMailArray(kwargs.to, { code: 'INVALID_TO', label: '--to' });
    const cc = parseMailArray(kwargs.cc, { code: 'INVALID_CC', label: '--cc' });
    const attachment = parseMailArray(kwargs.attachment, { code: 'INVALID_ATTACHMENT', label: '--attachment' });
    const subject = String(kwargs.subject ?? '');
    const data = String(kwargs.data ?? '');

    if (!corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    if (to.error) {
      return makeErrorRow(to.error.code, to.error.msg);
    }
    if (cc.error) {
      return makeErrorRow(cc.error.code, cc.error.msg);
    }
    if (attachment.error) {
      return makeErrorRow(attachment.error.code, attachment.error.msg);
    }

    const payload = { corpid };
    if (operatorUserId) payload.userId = operatorUserId;
    if (to.value) payload.toRecipient = to.value;
    if (cc.value) payload.ccRecipient = cc.value;
    if (subject !== '') payload.subject = subject;
    if (data !== '') payload.data = data;
    if (attachment.value) payload.attachment = attachment.value;

    const gateway = await requestGateway({
      baseUrl,
      apiPath: MAIL_DRAFT_ADD_API_PATH,
      payload,
      token,
      userId: operatorUserId,
      debug,
    });
    if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
    if (gateway.data.code !== 1) {
      return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
    }

    return [{
      id: gateway.data.result?.id ?? '',
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});