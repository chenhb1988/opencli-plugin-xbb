import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 验证 clue-add / customer-add / product-add 的 --demo（共享模块 xbb-form-example.js）：
// 请求体、formId 缓存解析、提示串加工、强制 JSON、错误行形态，以及三条命令的普通新建回归。
// 用本地 mock HTTP 服务器接收请求，避免对真实 API 发起写操作。
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xbb-add-demo-test-'));
const configDir = path.join(temporaryHome, '.xbbcli');
const corpid = 'xbb-add-demo-test';
const formlistFile = path.join(configDir, `${corpid}.formlist.json`);
fs.mkdirSync(configDir, { recursive: true });

const demoExample = {
  formId: 2795678,
  corpid: 'c',
  dataList: {
    text_1: '文本',
    text_2: '文本',
    text_3: 4709637,
    text_4: '名片',
    array_2: ['选项值1', '选项值2'],
    address_1: { address: '步行街', province: '河北省' },
    file_2: [{ filename: '图片.png', size: 31872 }],
    ownerId: ['xbbTest001'],
    subForm_1: [{ text_1: '工作', text_2: '18888888888' }],
  },
  userId: 'u',
};

const demoParameters = [
  { attr: 'formId', type: 'Long', required: '是', description: '表单模板id' },
  { attr: 'dataList', type: 'Object', required: '是', description: '表单数据,其中字段对应通过表单字段解释获得' },
  { attr: 'corpid', type: 'String', required: '是', description: '公司id' },
  { attr: 'userId', type: 'String', required: '否', description: '操作人id' },
  { attr: 'text_1', type: 'String', required: '是', description: '企业名称' },
  { attr: 'text_2', type: 'String', required: '否', description: '联系人' },
  { attr: 'subForm_1', type: 'Object', required: '否', description: '电话' },
  { attr: 'text_1', type: 'String', required: '是', description: '类型(subForm_1) 选项说明: ["工作","手机"]' },
  { attr: 'text_2', type: 'String', required: '是', description: '电话(subForm_1)' },
  { attr: 'address_1', type: 'Object', required: '否', description: '地址' },
  { attr: 'text_3', type: 'Long', required: '否', description: '关联市场活动' },
  { attr: 'text_4', type: 'String', required: '否', description: '线索来源 选项说明: ["名片","展会","客户介绍","官网","推广"]' },
  { attr: 'ownerId', type: 'Array', required: '否', description: '负责人' },
  { attr: 'file_2', type: 'Object', required: '否', description: '文件' },
  { attr: 'array_2', type: 'Object', required: '否', description: '下拉复选框 选项说明: ["选项值1","选项值2","选项值3"]' },
];

const demoOutput = {
  formId: 2795678,
  // 示例里的 corpid/userId 会被换成当前生效配置，避免把接口文档占位值（如 "lsj"）当成真实值
  corpid,
  dataList: {
    text_1: '字段名：企业名称|必填|字段类型：文本',
    text_2: '字段名：联系人|选填|字段类型：文本',
    text_3: '字段名：关联市场活动|选填|字段类型：数字',
    text_4: '字段名：线索来源|选填|字段类型：单选：名片/展会/客户介绍/官网/推广',
    array_2: '字段名：下拉复选框|选填|字段类型：多选：选项值1/选项值2/选项值3',
    address_1: { address: '步行街', province: '河北省' },
    file_2: [{ filename: '图片.png', size: 31872 }],
    ownerId: ['xbbTest001'],
    subForm_1: [
      {
        text_1: '字段名：类型|必填|字段类型：单选：工作/手机',
        text_2: '字段名：电话|必填|字段类型：文本',
      },
    ],
  },
  userId: 'test-user-id',
};

let demoResponse = {
  code: 1,
  msg: 'ok',
  result: { inputExample: JSON.stringify(demoExample), inputParameter: demoParameters },
};
const addResponse = { code: 1, msg: 'ok', result: { dataId: 1, code: 0, msg: 'ok' } };
const requests = [];

const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    requests.push({ url: request.url, body: JSON.parse(body) });
    const payload = request.url.endsWith('/customized/param/get') ? demoResponse : addResponse;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(payload));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

fs.writeFileSync(path.join(configDir, 'config.env'), JSON.stringify([
  { corpid, token: 'test-token', userId: 'test-user-id', baseurl: baseUrl, enable: true },
]));

function writeFormlist(forms) {
  fs.writeFileSync(formlistFile, JSON.stringify(forms, null, 2), 'utf8');
}

writeFormlist([{ formId: 2795678, name: '销售线索', businessType: 8000 }]);

const childEnvironment = { ...process.env, USERPROFILE: temporaryHome, HOME: temporaryHome };
for (const name of Object.keys(childEnvironment)) {
  if (name.startsWith('XBB_')) delete childEnvironment[name];
}

function runCommand(args) {
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

function parseRows(result) {
  assert.equal(result.status, 0, `command failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function captureRequest(label, args) {
  const before = requests.length;
  const result = await runCommand(args);
  assert.equal(requests.length, before + 1, `${label}: expected exactly one HTTP request (stderr: ${result.stderr})`);
  return { request: requests[requests.length - 1], rows: parseRows(result) };
}

async function expectNoRequest(label, args) {
  const before = requests.length;
  const result = await runCommand(args);
  assert.equal(requests.length, before, `${label}: expected no HTTP request (stderr: ${result.stderr})`);
  return parseRows(result);
}

let passed = 0;

function report(label) {
  passed += 1;
  console.log(`ok ${passed} - ${label}`);
}

try {
  const explicit = await captureRequest('clue demo with formId', ['clue-add', '--demo', '--formId', '2795678']);
  assert.ok(explicit.request.url.endsWith('/pro/v2/api/customized/param/get'), 'demo must call customized/param/get');
  assert.deepEqual(explicit.request.body, { corpid, formId: 2795678, url: '/pro/v2/api/clue/add' });
  assert.deepEqual(explicit.rows, [demoOutput]);
  assert.equal(Object.hasOwn(explicit.rows[0], 'inputParameter'), false);
  report('clue-add --demo sends exactly {corpid, formId, url} and returns hinted inputExample');

  const cached = await captureRequest('clue demo without formId', ['clue-add', '--demo']);
  assert.equal(cached.request.body.formId, 2795678, 'formId must be resolved from the form cache');
  report('clue-add --demo resolves the only businessType=8000 form from the form cache');

  const forcedCsv = await captureRequest('clue demo with -f csv', ['clue-add', '--demo', '--formId', '2795678', '-f', 'csv']);
  assert.deepEqual(forcedCsv.rows, [demoOutput]);
  report('--demo forces JSON output even with -f csv');

  demoResponse = { code: 1, msg: 'ok', result: { inputExample: JSON.stringify(demoExample) } };
  const noMetadata = await captureRequest('clue demo without inputParameter', ['clue-add', '--demo', '--formId', '2795678']);
  assert.deepEqual(noMetadata.rows, [{ ...demoExample, corpid, userId: 'test-user-id' }]);
  report('--demo leaves inputExample unchanged when inputParameter is missing');

  demoResponse = { code: 1, msg: 'ok', result: { inputExample: JSON.stringify(demoExample), inputParameter: demoParameters } };

  const ignored = await captureRequest('clue demo ignores dataList/userId', [
    'clue-add', '--demo', '--formId', '2795678', '--dataList', '{"text_1":"ignored"}', '--userId', 'other',
  ]);
  assert.deepEqual(ignored.request.body, { corpid, formId: 2795678, url: '/pro/v2/api/clue/add' });
  report('--demo ignores --dataList and --userId in the request body');

  writeFormlist([
    { formId: 2795678, name: '销售线索A', businessType: 8000 },
    { formId: 2875705, name: '销售线索B', businessType: 8000 },
  ]);
  const ambiguous = await expectNoRequest('clue demo with multiple forms', ['clue-add', '--demo']);
  assert.equal(ambiguous[0].code, 'MULTIPLE_FORM');
  assert.deepEqual(Object.keys(ambiguous[0]).sort(), ['code', 'msg'], 'demo error rows must expose only code/msg');
  assert.ok(String(ambiguous[0].msg).includes('2795678'));
  assert.ok(String(ambiguous[0].msg).includes('2875705'));
  report('demo rejects multiple cached clue forms with a code/msg only error row');

  writeFormlist([{ formId: 'abc', name: '线索X', businessType: 8000 }]);
  const invalidId = await expectNoRequest('clue demo with non-numeric cached formId', ['clue-add', '--demo']);
  assert.equal(invalidId[0].code, 'INVALID_FORM_ID');
  assert.ok(String(invalidId[0].msg).includes('abc'));
  report('demo reports INVALID_FORM_ID instead of MULTIPLE_FORM for a single bad cached formId');

  fs.rmSync(formlistFile, { force: true });
  const missingCache = await expectNoRequest('clue demo without form cache', ['clue-add', '--demo']);
  assert.equal(missingCache[0].code, 'NO_FORMID');
  report('demo returns NO_FORMID when the form cache is missing');

  writeFormlist([
    { formId: 2795678, name: '销售线索', businessType: 8000 },
    { formId: 1969375, name: '客户', businessType: 100 },
    { formId: 1970000, name: '经销商档案', businessType: '100' },
    { formId: 1969362, name: '产品管理', businessType: 2401 },
    { formId: 1969376, name: '联系人', businessType: 401 },
  ]);

  const customerDemo = await captureRequest('customer demo with formId', [
    'customer-add', '--demo', '--formId', '1969375',
  ]);
  assert.deepEqual(customerDemo.request.body, { corpid, formId: 1969375, url: '/pro/v2/api/customer/add' });
  assert.deepEqual(customerDemo.rows, [demoOutput]);
  report('customer-add --demo builds its own url and reuses the hint transform');

  const customerAmbiguous = await expectNoRequest('customer demo with multiple forms', ['customer-add', '--demo']);
  assert.equal(customerAmbiguous[0].code, 'MULTIPLE_FORM');
  assert.ok(String(customerAmbiguous[0].msg).includes('客户表单'), 'customer error message must name the form kind');
  assert.ok(String(customerAmbiguous[0].msg).includes('1969375'));
  assert.ok(String(customerAmbiguous[0].msg).includes('1970000'));
  report('customer-add --demo rejects multiple businessType=100 forms and lists candidates');

  const productDemo = await captureRequest('product demo without formId', ['product-add', '--demo']);
  assert.deepEqual(productDemo.request.body, { corpid, formId: 1969362, url: '/pro/v2/api/product/add' });
  assert.equal(Object.hasOwn(productDemo.rows[0], 'formId'), false, 'product/add does not accept formId, so the example must omit it');
  assert.deepEqual(productDemo.rows[0].dataList, demoOutput.dataList);
  report('product-add --demo resolves the businessType=2401 form and omits formId from the example');

  // 批量接入的通用路径：表单型但接口不接收 formId（contact-add）
  const contactDemo = await captureRequest('contact demo', ['contact-add', '--demo']);
  assert.deepEqual(contactDemo.request.body, { corpid, formId: 1969376, url: '/pro/v2/api/contact/add' });
  assert.equal(Object.hasOwn(contactDemo.rows[0], 'formId'), false, 'contact/add does not accept formId either');
  assert.deepEqual(contactDemo.rows[0].dataList, demoOutput.dataList);
  report('contact-add --demo resolves businessType=401 from the cache and strips formId');

  // 写请求体不接收 formId 的命令不声明 --formId，避免 AI 误以为要选表单；多表单时给 form-get 引导
  const contactRejectsFormId = await runCommand(['contact-add', '--demo', '--formId', '2007633']);
  assert.notEqual(contactRejectsFormId.status, 0, 'contact-add must not declare --formId');
  assert.ok(String(contactRejectsFormId.stderr).includes('未知参数'), `unexpected stderr: ${contactRejectsFormId.stderr}`);
  writeFormlist([
    { formId: 2795678, name: '销售线索', businessType: 8000 },
    { formId: 1969376, name: '联系人', businessType: 401 },
    { formId: 2007633, name: '经销商联系人', businessType: 401 },
    { formId: 1969362, name: '产品管理', businessType: 2401 },
  ]);
  const contactAmbiguous = await expectNoRequest('contact demo with two forms', ['contact-add', '--demo']);
  assert.equal(contactAmbiguous[0].code, 'MULTIPLE_FORM');
  assert.ok(String(contactAmbiguous[0].msg).includes('2007633'));
  assert.ok(String(contactAmbiguous[0].msg).includes('form-get'), 'multi-form hint must point at form-get');
  writeFormlist([
    { formId: 2795678, name: '销售线索', businessType: 8000 },
    { formId: 1969375, name: '客户', businessType: 100 },
    { formId: 1970000, name: '经销商档案', businessType: '100' },
    { formId: 1969362, name: '产品管理', businessType: 2401 },
    { formId: 1969376, name: '联系人', businessType: 401 },
  ]);
  report('commands without a write-path formId do not declare --formId and point multi-form users at form-get');

  // 非表单接口：formId 传 0，示例不带 dataList，corpid/userId 换成真实配置值
  demoResponse = {
    code: 1,
    msg: 'ok',
    result: {
      inputExample: JSON.stringify({ name: '部门名称', parentId: 1, corpid: 'lsj', userId: 'xbbTest001' }),
      inputParameter: [
        { attr: 'name', type: 'String', required: '是', description: '部门名称' },
        { attr: 'parentId', type: 'Long', required: '是', description: '上级部门id' },
        { attr: 'corpid', type: 'String', required: '是', description: '公司id' },
        { attr: 'userId', type: 'String', required: '是', description: '操作人id' },
      ],
    },
  };
  const deptDemo = await captureRequest('department demo', ['department-add', '--demo']);
  assert.deepEqual(deptDemo.request.body, { corpid, formId: 0, url: '/pro/v2/api/department/add' });
  assert.deepEqual(deptDemo.rows, [{ name: '部门名称', parentId: 1, corpid, userId: 'test-user-id' }]);
  report('department-add --demo sends formId 0, keeps no dataList and normalises corpid/userId');

  demoResponse = { code: 1, msg: 'ok', result: { inputExample: JSON.stringify(demoExample), inputParameter: demoParameters } };

  // form-data-add 走通用自定义表单，formId 必须由使用者指定
  const paasDemo = await captureRequest('form-data demo', ['form-data-add', '--demo', '--formId', '2795678']);
  assert.deepEqual(paasDemo.request.body, { corpid, formId: 2795678, url: '/pro/v2/api/paas/add' });
  assert.equal(paasDemo.rows[0].formId, 2795678, 'paas/add keeps formId in the example');
  report('form-data-add --demo uses the explicit --formId and keeps it in the example');

  // paas/add 面向任意自定义表单，没有 --formId 时必须直接报错，不能拿 0 去请求
  const paasMissing = await expectNoRequest('form-data demo without formId', ['form-data-add', '--demo']);
  assert.equal(paasMissing[0].code, 'NO_FORMID');
  report('form-data-add --demo requires --formId because the form cannot be resolved from cache');

  // 子表容器命名不止 subForm_N：报价单等接口用 array_N，内部字段不能串到顶层
  demoResponse = {
    code: 1,
    msg: 'ok',
    result: {
      inputExample: JSON.stringify({
        formId: 1969380,
        corpid: 'c',
        dataList: { text_1: '报价单名称', array_1: [{ text_1: '产品名称', text_8: '件', num_3: 2 }] },
        userId: 'u',
      }),
      inputParameter: [
        { attr: 'formId', type: 'Long', required: '是', description: '表单模板id' },
        { attr: 'corpid', type: 'String', required: '是', description: '公司id' },
        { attr: 'userId', type: 'String', required: '否', description: '操作人id' },
        { attr: 'text_1', type: 'String', required: '是', description: '报价单名称' },
        { attr: 'array_1', type: 'Object', required: '否', description: '报价明细' },
        { attr: 'text_1', type: 'String', required: '是', description: '产品名称(array_1)' },
        { attr: 'text_8', type: 'String', required: '否', description: '报价单位(array_1) 选项说明: ["件","千克"]' },
        { attr: 'num_3', type: 'Long', required: '否', description: '数量(array_1)' },
      ],
    },
  };
  const quotationDemo = await captureRequest('quotation demo', ['quotation-add', '--demo', '--formId', '1969380']);
  assert.deepEqual(quotationDemo.rows[0].dataList, {
    text_1: '字段名：报价单名称|必填|字段类型：文本',
    array_1: [{
      text_1: '字段名：产品名称|必填|字段类型：文本',
      text_8: '字段名：报价单位|选填|字段类型：单选：件/千克',
      num_3: '字段名：数量|选填|字段类型：数字',
    }],
  });
  report('array_N sub-forms are scoped like subForm_N and keep top-level fields clean');

  demoResponse = { code: 1, msg: 'ok', result: { inputExample: JSON.stringify(demoExample), inputParameter: demoParameters } };

  // product/add 请求体不含 formId，因此也不再声明 --formId，demo 直接按 businessType 解析
  const productRejectsFormId = await runCommand(['product-add', '--demo', '--formId', '1969362']);
  assert.notEqual(productRejectsFormId.status, 0, 'product-add must not declare --formId');
  assert.ok(String(productRejectsFormId.stderr).includes('未知参数'));
  report('product-add drops its demo-only --formId and relies on cache resolution');

  const normalWithoutFormId = await captureRequest('clue normal resolving formId from cache', [
    'clue-add', '--dataList', '{"text_1":"a"}', '-f', 'json',
  ]);
  assert.ok(normalWithoutFormId.request.url.endsWith('/pro/v2/api/clue/add'), 'normal mode must still call clue/add');
  assert.equal(normalWithoutFormId.request.body.formId, 2795678, 'normal mode must resolve formId from the cache too');
  const negative = await expectNoRequest('clue normal with negative formId', [
    'clue-add', '--formId', '-5', '--dataList', '{"text_1":"a"}', '-f', 'json',
  ]);
  assert.equal(negative[0].code, 'INVALID_FORM_ID');
  report('normal clue-add resolves formId from cache and rejects a negative --formId');

  const clueNormal = await captureRequest('clue normal add', [
    'clue-add', '--formId', '2795678', '--dataList', '{"text_1":"a"}', '-f', 'json',
  ]);
  assert.deepEqual(clueNormal.request.body, { corpid, formId: 2795678, userId: 'test-user-id', dataList: { text_1: 'a' } });
  assert.deepEqual(Object.keys(clueNormal.rows[0]).sort(), ['code', 'dataId', 'msg', 'resultCode', 'resultMsg']);
  report('normal clue-add keeps its request body and row columns');

  const customerNormal = await captureRequest('customer normal add', [
    'customer-add', '--formId', '1969375', '--dataList', '{"text_1":"a"}', '-f', 'json',
  ]);
  assert.deepEqual(customerNormal.request.body, { corpid, formId: 1969375, userId: 'test-user-id', dataList: { text_1: 'a' } });
  assert.deepEqual(Object.keys(customerNormal.rows[0]).sort(), ['code', 'dataId', 'msg', 'resultCode', 'resultMsg']);
  report('normal customer-add keeps its request body and row columns');

  const productNormal = await captureRequest('product normal add', [
    'product-add', '--dataList', '{"text_1":"a"}', '-f', 'json',
  ]);
  assert.deepEqual(productNormal.request.body, { corpid, userId: 'test-user-id', dataList: { text_1: 'a' } });
  assert.equal(Object.hasOwn(productNormal.request.body, 'formId'), false, 'product/add payload must not carry formId');
  report('normal product-add keeps its formId-free request body');

  demoResponse = { code: 2, msg: 'bad request', success: false };
  const failed = await captureRequest('demo server error', ['clue-add', '--demo', '--formId', '2795678']);
  assert.equal(failed.rows[0].code, 2);
  assert.equal(failed.rows[0].msg, 'bad request');
  report('demo returns the server error as a code/msg row');

  demoResponse = { code: 1, msg: 'ok', result: {} };
  const emptyExample = await captureRequest('demo empty example', ['customer-add', '--demo', '--formId', '1969375']);
  assert.equal(emptyExample.rows[0].code, 'DEMO_FAILED');
  report('demo returns DEMO_FAILED when inputExample is missing');

  demoResponse = { code: 1, msg: 'ok', result: { inputExample: 'not-json' } };
  const invalidExample = await captureRequest('demo invalid example', ['product-add', '--demo']);
  assert.deepEqual(invalidExample.rows, [{ demo: 'not-json' }]);
  report('demo falls back to the raw string when inputExample is not valid JSON');

  // 网络不可达时不能把 fetch 异常穿透出去，必须返回结构化错误行（exit code 仍为 0）
  fs.writeFileSync(path.join(configDir, 'config.env'), JSON.stringify([
    { corpid, token: 'test-token', userId: 'test-user-id', baseurl: 'http://127.0.0.1:1', enable: true },
  ]));
  for (const command of ['clue-add', 'customer-add', 'product-add', 'contact-add']) {
    // 只有写请求体含 formId 的命令才声明 --formId，其余靠缓存解析
    const args = command === 'product-add' || command === 'contact-add' ? [command, '--demo'] : [command, '--demo', '--formId', '2795678'];
    const offline = await runCommand(args);
    const offlineRows = parseRows(offline);
    assert.equal(offline.status, 0, `${command}: network failure must not throw`);
    assert.equal(offlineRows[0].code, 'NETWORK_ERROR');
    assert.deepEqual(Object.keys(offlineRows[0]).sort(), ['code', 'msg']);
  }
  report('demo turns a network failure into a NETWORK_ERROR row for every shape of command');

  console.log(`add demo test passed (${passed} assertions).`);
} finally {
  server.close();
  fs.rmSync(temporaryHome, { recursive: true, force: true });
}
