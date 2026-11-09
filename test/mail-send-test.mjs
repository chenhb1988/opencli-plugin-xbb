import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// mail send 真实接口测试用例：默认只打印将发送的邮件内容，不触达网络。
// 确认收件人无误后加 --execute 才会真正发信（耗时可能超过 1 分钟）。
// 环境变量：
//   XBB_TEST_MAIL_TO（必填）：JSON 数组，或单个/逗号分隔的邮箱地址
//   XBB_TEST_MAIL_CC（可选）：JSON 数组，或逗号分隔的邮箱地址
//   XBB_TEST_MAIL_ATTACHMENT（可选）：附件 JSON 数组
//   XBB_TEST_MAIL_SUBJECT（可选）：主题，默认带时间戳避免重复提交返回 100003
//   XBB_TEST_MAIL_DATA（可选）：HTML 正文，默认带时间戳
//   XBB_TEST_MAIL_DEBUG=1（可选）：输出请求体与原始响应
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execute = process.argv.includes('--execute');
const timestamp = Date.now();

function parseParties(raw, code) {
  const text = String(raw ?? '').trim();
  if (!text) return undefined;

  if (text.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${code}: 必须是 JSON 数组或邮箱地址列表`);
    }
    assert.ok(Array.isArray(parsed), `${code}: 必须是 JSON 数组或邮箱地址列表`);
    return parsed;
  }

  return text
    .split(/[;,]/)
    .map((address) => address.trim())
    .filter((address) => address !== '')
    .map((address) => ({ name: '', mailAddress: address }));
}

function parseAttachment(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('XBB_TEST_MAIL_ATTACHMENT: 必须是 JSON 数组');
  }
  assert.ok(Array.isArray(parsed), 'XBB_TEST_MAIL_ATTACHMENT: 必须是 JSON 数组');
  return parsed;
}

function buildArgs() {
  const to = parseParties(process.env.XBB_TEST_MAIL_TO, 'XBB_TEST_MAIL_TO');
  assert.ok(to?.length, '缺少 XBB_TEST_MAIL_TO；示例：XBB_TEST_MAIL_TO="me@example.com"');

  const args = {
    to: JSON.stringify(to),
    subject: process.env.XBB_TEST_MAIL_SUBJECT || `xbbcli mail send 测试-${timestamp}`,
    data: process.env.XBB_TEST_MAIL_DATA || `<p>xbbcli mail send 自动化测试 ${timestamp}</p>`,
  };

  const cc = parseParties(process.env.XBB_TEST_MAIL_CC, 'XBB_TEST_MAIL_CC');
  if (cc?.length) args.cc = JSON.stringify(cc);

  const attachment = parseAttachment(process.env.XBB_TEST_MAIL_ATTACHMENT);
  if (attachment) args.attachment = JSON.stringify(attachment);

  if (process.env.XBB_TEST_MAIL_DEBUG === '1') args.debug = true;

  return args;
}

function formatCommand(args) {
  const parts = ['xbbcli', 'mail', 'send'];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === false || value === '') continue;
    parts.push(`--${key}`, JSON.stringify(String(value)));
  }
  return parts.join(' ');
}

async function loadCommand() {
  const { getRegistry } = await import(pathToFileURL(path.join(repositoryRoot, 'xbb-registry.js')).href);
  await import(`${pathToFileURL(path.join(repositoryRoot, 'mail-send.js')).href}?mailSendTest=${timestamp}`);
  const command = getRegistry().get('xbb/mail-send');
  assert.ok(command, 'mail-send command was not registered');
  return command;
}

let args;
try {
  args = buildArgs();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}

console.log('mail send 测试用例');
console.log(`收件人：${args.to}`);
console.log(`主题：${args.subject}`);
if (args.cc) console.log(`抄送：${args.cc}`);
if (args.attachment) console.log(`附件：${args.attachment}`);
console.log(`命令：${formatCommand(args)}`);

if (!execute) {
  console.log('\n当前为 dry-run，未发送任何邮件。确认收件人无误后执行：');
  console.log('node test/mail-send-test.mjs --execute');
  process.exit(0);
}

const command = await loadCommand();
const rows = await command.func(args);
console.log(`\n返回：${JSON.stringify(rows)}`);

const row = rows[0] || {};
assert.equal(Number(row.code), 1, `mail send 失败：${JSON.stringify(rows)}`);
console.log(`PASS mail send 成功（code=${row.code}）`);