import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 验证二级命令 mail send / mail list / mail detail / mail draft add / mail draft edit
// 能被 bin/xbbcli.js 正确解析，并检查请求体字段、可选参数省略与输出行契约。
// 用本地 mock HTTP 服务器接收请求，避免对真实邮件服务发起写操作。
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { CLIENT_SOURCE_HEADER } = await import(pathToFileURL(path.join(repositoryRoot, 'xbb-http.js')).href);
const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xbb-mail-test-'));
fs.mkdirSync(path.join(temporaryHome, '.xbbcli'), { recursive: true });

const requests = [];
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    const payload = JSON.parse(body);
    requests.push({ url: request.url, headers: request.headers, payload });
    response.setHeader('Content-Type', 'application/json');

    if (request.url.endsWith('/mail/data/list')) {
      response.end(JSON.stringify({
        code: 1,
        msg: 'ok',
        result: {
          list: [{
            id: 11,
            folderId: payload.folderId,
            subject: '测试邮件',
            sender: { name: '张三', mailAddress: 'zhangsan@example.com' },
            toRecipient: [{ name: '李四', mailAddress: 'lisi@example.com' }],
            summary: '摘要',
            isRead: false,
            sendStatus: 1,
            extra: '保持原样',
          }],
          pageHelper: { totalCount: 1, totalPage: 1 },
        },
      }));
      return;
    }

    if (request.url.endsWith('/mail/data/detail')) {
      response.end(JSON.stringify({
        code: 1,
        msg: 'ok',
        result: {
          id: payload.id,
          folderId: payload.folderId,
          sender: { name: '张三', mailAddress: 'zhangsan@example.com' },
          toRecipient: [{ name: '李四', mailAddress: 'lisi@example.com' }],
          ccRecipient: [{ name: '王五', mailAddress: 'wangwu@example.com' }],
          subject: '详情主题',
          summary: '详情摘要',
          attachment: [{ fileName: '报价单', attachIndex: 'https://files.example.com/q.pdf', ext: 'pdf', size: 1024 }],
          data: '<p>正文</p>',
          isRead: true,
          sendStatus: 1,
        },
      }));
      return;
    }

    response.end(JSON.stringify({ code: 1, msg: 'ok', result: { id: payload.id ?? 12345 } }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

fs.writeFileSync(path.join(temporaryHome, '.xbbcli', 'config.env'), JSON.stringify([
  {
    corpid: 'xbb-mail-test',
    token: 'test-token',
    userId: 'test-user-id',
    baseurl: `http://127.0.0.1:${port}`,
    enable: true,
  },
]));

const childEnvironment = { ...process.env, USERPROFILE: temporaryHome, HOME: temporaryHome };
for (const name of Object.keys(childEnvironment)) {
  if (name.startsWith('XBB_')) delete childEnvironment[name];
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repositoryRoot, 'bin', 'xbbcli.js'), ...args], {
      cwd: repositoryRoot,
      env: childEnvironment,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function runJson(args) {
  const result = await runCli([...args, '-f', 'json']);
  assert.equal(result.status, 0, `${args.join(' ')} failed: ${result.stderr}`);
  return { ...result, rows: JSON.parse(result.stdout) };
}

async function captureRequest(label, args) {
  const before = requests.length;
  const result = await runJson(args);
  assert.equal(requests.length, before + 1, `${label}: expected exactly one HTTP request (stderr: ${result.stderr})`);
  return { request: requests[requests.length - 1], result };
}

let passed = 0;

function report(label) {
  passed += 1;
  console.log(`ok ${passed} - ${label}`);
}

try {
  const recipient = '[{"name":"张三","mailAddress":"zhangsan@example.com"}]';
  const cc = '[{"name":"李四","mailAddress":"lisi@example.com"}]';

  // mail send：必填字段 + 可选字段省略
  const send = await captureRequest('mail send', [
    'mail', 'send',
    '--to', recipient,
    '--subject', '项目报价',
    '--data', '<p>您好，附件是项目报价单。</p>',
  ]);
  assert.equal(send.request.payload.corpid, 'xbb-mail-test');
  assert.equal(send.request.payload.userId, 'test-user-id');
  assert.deepEqual(send.request.payload.toRecipient, [{ name: '张三', mailAddress: 'zhangsan@example.com' }]);
  assert.equal(send.request.payload.subject, '项目报价');
  assert.equal(send.request.payload.data, '<p>您好，附件是项目报价单。</p>');
  assert.equal(Object.hasOwn(send.request.payload, 'ccRecipient'), false, 'ccRecipient must be omitted when --cc is not provided');
  assert.equal(Object.hasOwn(send.request.payload, 'attachment'), false, 'attachment must be omitted when --attachment is not provided');
  assert.equal(Object.hasOwn(send.request.payload, 'draftId'), false, 'draftId must be omitted when --draftId is not provided');
  assert.equal(send.request.headers['x-client-source'], CLIENT_SOURCE_HEADER['X-Client-Source']);
  report('mail send omits optional fields and carries X-Client-Source');

  // mail send：draftId 0 必须按数字写入
  const sendDraft = await captureRequest('mail send draftId=0', [
    'mail', 'send', '--to', recipient, '--subject', '发送草稿', '--cc', cc, '--draftId', '0',
  ]);
  assert.equal(sendDraft.request.payload.draftId, 0, '--draftId 0 must be serialized as the number 0');
  assert.deepEqual(sendDraft.request.payload.ccRecipient, [{ name: '李四', mailAddress: 'lisi@example.com' }]);
  report('mail send writes draftId: 0 as a number');

  // mail send：缺少 --to / 非法 JSON 时不发请求
  const beforeMissingTo = requests.length;
  const missingTo = await runJson(['mail', 'send', '--subject', '无收件人']);
  assert.equal(missingTo.rows[0].code, 'NO_TO');
  assert.equal(requests.length, beforeMissingTo, 'missing --to must not send a request');
  report('mail send rejects missing --to without network access');

  const invalidTo = await runJson(['mail', 'send', '--to', 'not-json', '--subject', '非法收件人']);
  assert.equal(invalidTo.rows[0].code, 'INVALID_TO');
  assert.equal(requests.length, beforeMissingTo, 'invalid --to must not send a request');
  report('mail send rejects invalid --to JSON without network access');

  // mail list：数值参数 + 分页 footer
  const list = await captureRequest('mail list', [
    'mail', 'list', '--folderId', '2', '--page', '1', '--pageSize', '10', '--filterType', '0',
  ]);
  assert.equal(list.request.payload.folderId, 2);
  assert.equal(list.request.payload.page, 1);
  assert.equal(list.request.payload.pageSize, 10);
  assert.equal(list.request.payload.filterType, 0);
  assert.equal(list.result.rows[0].id, 11);
  assert.equal(list.result.rows[0].sender, '张三 <zhangsan@example.com>');
  assert.equal(list.result.rows[0].toRecipient, '李四 <lisi@example.com>');
  assert.equal(list.result.rows[0].isRead, false);
  report('mail list serializes numeric paging args and formats recipients');

  const listTable = await runCli(['mail', 'list', '--folderId', '1']);
  assert.equal(listTable.status, 0, listTable.stderr);
  assert.ok(listTable.stdout.includes('totalCount 1 / totalPage 1'), `mail list footer missing:\n${listTable.stdout}`);
  report('mail list prints pagination footer from result.pageHelper');

  // mail detail
  const detail = await captureRequest('mail detail', ['mail', 'detail', '--id', '9', '--folderId', '1']);
  assert.equal(detail.request.payload.id, 9);
  assert.equal(detail.request.payload.folderId, 1);
  assert.equal(detail.result.rows[0].sender, '张三 <zhangsan@example.com>');
  assert.equal(detail.result.rows[0].ccRecipient, '王五 <wangwu@example.com>');
  assert.equal(detail.result.rows[0].attachment, '[{"fileName":"报价单","attachIndex":"https://files.example.com/q.pdf","ext":"pdf","size":1024}]');
  report('mail detail maps sender, recipients and attachment');

  // mail draft add（多词子命令）
  const draftAdd = await captureRequest('mail draft add', [
    'mail', 'draft', 'add', '--to', recipient, '--subject', '待确认的项目报价',
  ]);
  assert.equal(draftAdd.request.payload.subject, '待确认的项目报价');
  assert.deepEqual(draftAdd.request.payload.toRecipient, [{ name: '张三', mailAddress: 'zhangsan@example.com' }]);
  assert.equal(Object.hasOwn(draftAdd.request.payload, 'id'), false, 'draft add must not send id');
  assert.equal(draftAdd.result.rows[0].id, 12345);
  report('mail draft add resolves multi-word subcommand and omits id');

  // mail draft edit（多词子命令 + id 数字）
  const draftEdit = await captureRequest('mail draft edit', [
    'mail', 'draft', 'edit', '--id', '7', '--subject', '项目报价（修订版）',
  ]);
  assert.equal(draftEdit.request.payload.id, 7);
  assert.equal(draftEdit.request.payload.subject, '项目报价（修订版）');
  assert.equal(Object.hasOwn(draftEdit.request.payload, 'toRecipient'), false, 'draft edit must omit toRecipient when --to is not provided');
  report('mail draft edit resolves multi-word subcommand and keeps only provided fields');

  // 帮助输出
  const rootHelp = await runCli(['--help']);
  assert.equal(rootHelp.status, 0);
  assert.ok(rootHelp.stdout.includes('\n  mail '), '--help must show the mail group entry');
  assert.ok(!rootHelp.stdout.includes('mail send'), '--help must not expand mail subcommands');
  report('--help collapses mail subcommands into one group entry');

  const groupHelp = await runCli(['mail', '--help']);
  assert.equal(groupHelp.status, 0);
  for (const subcommand of ['send', 'list', 'detail', 'draft add', 'draft edit']) {
    assert.ok(groupHelp.stdout.includes(subcommand), `mail --help must list ${subcommand}`);
  }
  report('mail --help lists all mail subcommands');

  const commandHelp = await runCli(['mail', 'send', '--help']);
  assert.equal(commandHelp.status, 0);
  assert.ok(commandHelp.stdout.includes('Usage: xbbcli mail send [options]'));
  report('mail send --help prints subcommand usage');

  console.log(`mail commands test passed (${passed} assertions).`);
} finally {
  server.close();
  fs.rmSync(temporaryHome, { recursive: true, force: true });
}