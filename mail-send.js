import { cli, Strategy } from './xbb-registry.js';
import { getRuntimeConfig, requestGateway } from './xbb-http.js';
import { parseMailArray, resolveMailUserId, stringifyMailValue } from './xbb-mail.js';

const MAIL_SEND_API_PATH = '/pro/v2/api/mail/data/send';
const MISSING_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

function makeErrorRow(code, msg) {
  return [{
    result: '',
    code,
    msg,
  }];
}

cli({
  site: 'xbb',
  name: 'mail-send',
  group: 'mail',
  description: '发送邮件（可用 draftId 发送草稿；单封最多 20 个附件）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'to', type: 'str', help: '收件人 JSON 数组（必填），元素如 {"name":"张三","mailAddress":"a@b.com"}' },
    { name: 'subject', type: 'str', help: '邮件主题（必填）' },
    { name: 'data', type: 'str', default: '', help: 'HTML 正文（可选，不传由邮件服务填入默认正文）' },
    { name: 'cc', type: 'str', default: '', help: '抄送人 JSON 数组（可选）' },
    { name: 'attachment', type: 'str', default: '', help: '附件 JSON 数组（可选），元素含 fileName/attachIndex/ext/size' },
    { name: 'draftId', type: 'str', default: '', help: '要发送的草稿 ID（可选）' },
    { name: 'userId', type: 'str', default: '', help: '发件员工 userId（可选，默认取配置）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: ['result', 'code', 'msg'],
  func: async (kwargs) => {
    const debug = Boolean(kwargs.debug);
    const { corpid, token, baseUrl, userId } = getRuntimeConfig();
    const operatorUserId = resolveMailUserId(kwargs, userId);
    const to = parseMailArray(kwargs.to, { code: 'INVALID_TO', label: '--to' });
    const cc = parseMailArray(kwargs.cc, { code: 'INVALID_CC', label: '--cc' });
    const attachment = parseMailArray(kwargs.attachment, { code: 'INVALID_ATTACHMENT', label: '--attachment' });
    const subject = String(kwargs.subject ?? '');
    const data = String(kwargs.data ?? '');
    const draftId = String(kwargs.draftId ?? '');

    if (!corpid) {
      return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    if (!token) {
      return makeErrorRow('NO_TOKEN', MISSING_TOKEN_MESSAGE);
    }
    if (to.error) {
      return makeErrorRow(to.error.code, to.error.msg);
    }
    if (!to.value?.length) {
      return makeErrorRow('NO_TO', '缺少 --to，或 --to 是空数组');
    }
    if (!subject.trim()) {
      return makeErrorRow('NO_SUBJECT', '缺少 --subject');
    }
    if (cc.error) {
      return makeErrorRow(cc.error.code, cc.error.msg);
    }
    if (attachment.error) {
      return makeErrorRow(attachment.error.code, attachment.error.msg);
    }
    if (draftId !== '' && !Number.isFinite(Number(draftId))) {
      return makeErrorRow('INVALID_DRAFT_ID', '--draftId 必须是数字');
    }

    const payload = { corpid };
    if (operatorUserId) payload.userId = operatorUserId;
    payload.toRecipient = to.value;
    payload.subject = subject;
    if (data !== '') payload.data = data;
    if (cc.value) payload.ccRecipient = cc.value;
    if (attachment.value) payload.attachment = attachment.value;
    if (draftId !== '') payload.draftId = Number(draftId);

    const gateway = await requestGateway({
      baseUrl,
      apiPath: MAIL_SEND_API_PATH,
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
      result: stringifyMailValue(gateway.data.result),
      code: gateway.data.code ?? '',
      msg: gateway.data.msg || '',
    }];
  },
});