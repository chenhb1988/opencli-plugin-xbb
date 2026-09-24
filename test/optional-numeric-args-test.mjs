import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 验证可选数值参数声明为 type:'str', default:'' 后的端到端序列化行为：
// 未传参时不写入请求体；显式传 0 时按数字 0 写入。
// 用本地 mock HTTP 服务器接收请求体，避免对真实 API 发起写操作。
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xbb-optional-numeric-test-'));
fs.mkdirSync(path.join(temporaryHome, '.xbbcli'), { recursive: true });

const receivedBodies = [];
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    receivedBodies.push(JSON.parse(body));
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ code: 1, msg: 'ok', result: { dataId: 1 } }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

fs.writeFileSync(path.join(temporaryHome, '.xbbcli', 'config.env'), JSON.stringify([
  {
    corpid: 'xbb-optional-numeric-test',
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

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repositoryRoot, 'bin', 'xbbcli.js'), ...args, '-f', 'json'], {
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

async function captureBody(label, args) {
  const before = receivedBodies.length;
  const result = await runCommand(args);
  assert.equal(receivedBodies.length, before + 1, `${label}: 应恰好发起一次 HTTP 请求（stderr: ${result.stderr}）`);
  return receivedBodies[receivedBodies.length - 1];
}

let passed = 0;

function report(label) {
  passed += 1;
  console.log(`ok ${passed} - ${label}`);
}

try {
  // communicate-plan-add：formId 可选
  const planDefault = await captureBody('communicate-plan-add 默认', [
    'communicate-plan-add', '--dataList', '{"text_1":"test"}',
  ]);
  assert.equal(Object.hasOwn(planDefault, 'formId'), false, '未传 --formId 时请求体不应包含 formId');
  report('communicate-plan-add 未传 --formId 时请求体不含 formId');
  assert.equal(planDefault.corpid, 'xbb-optional-numeric-test');
  assert.deepEqual(planDefault.dataList, { text_1: 'test' });

  const planZero = await captureBody('communicate-plan-add formId=0', [
    'communicate-plan-add', '--dataList', '{"text_1":"test"}', '--formId', '0',
  ]);
  assert.equal(planZero.formId, 0, '--formId 0 时应以数字 0 写入请求体');
  report('communicate-plan-add 显式 --formId 0 时请求体包含 formId: 0');

  // stage-jump：reasonId 可选
  const stageArgs = ['--formId', '4885596', '--businessType', '301', '--saasMark', '1', '--dataId', '1', '--toStageId', '2', '--stageProcessId', '3'];
  const stageDefault = await captureBody('stage-jump 默认', ['stage-jump', ...stageArgs]);
  assert.equal(Object.hasOwn(stageDefault, 'reasonId'), false, '未传 --reasonId 时请求体不应包含 reasonId');
  report('stage-jump 未传 --reasonId 时请求体不含 reasonId');
  assert.equal(stageDefault.toStageId, 2);

  const stageZero = await captureBody('stage-jump reasonId=0', ['stage-jump', ...stageArgs, '--reasonId', '0']);
  assert.equal(stageZero.reasonId, 0, '--reasonId 0 时应以数字 0 写入请求体');
  report('stage-jump 显式 --reasonId 0 时请求体包含 reasonId: 0');

  // workorder-handover：retainMainUser 可选
  const handoverArgs = ['--formId', '4885594', '--dataIdList', '[1]', '--businessUserId', 'test-user'];
  const handoverDefault = await captureBody('workorder-handover 默认', ['workorder-handover', ...handoverArgs]);
  assert.equal(Object.hasOwn(handoverDefault, 'retainMainUser'), false, '未传 --retainMainUser 时请求体不应包含 retainMainUser');
  report('workorder-handover 未传 --retainMainUser 时请求体不含 retainMainUser');
  assert.deepEqual(handoverDefault.dataIdList, [1]);

  const handoverZero = await captureBody('workorder-handover retainMainUser=0', ['workorder-handover', ...handoverArgs, '--retainMainUser', '0']);
  assert.equal(handoverZero.retainMainUser, 0, '--retainMainUser 0 时应以数字 0 写入请求体');
  report('workorder-handover 显式 --retainMainUser 0 时请求体包含 retainMainUser: 0');

  // clue-list：isPublic 可选
  const clueDefault = await captureBody('clue-list 默认', ['clue-list', '--formId', '4885596']);
  assert.equal(Object.hasOwn(clueDefault, 'isPublic'), false, '未传 --isPublic 时请求体不应包含 isPublic');
  report('clue-list 未传 --isPublic 时请求体不含 isPublic');
  assert.equal(clueDefault.formId, 4885596);

  const clueZero = await captureBody('clue-list isPublic=0', ['clue-list', '--formId', '4885596', '--isPublic', '0']);
  assert.equal(clueZero.isPublic, 0, '--isPublic 0 时应以数字 0 写入请求体');
  report('clue-list 显式 --isPublic 0 时请求体包含 isPublic: 0');

  console.log(`optional numeric args test passed (${passed} assertions).`);
} finally {
  server.close();
  fs.rmSync(temporaryHome, { recursive: true, force: true });
}
