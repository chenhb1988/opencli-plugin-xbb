import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xbb-communicate-add-test-'));
const originalUserProfile = process.env.USERPROFILE;
const originalHome = process.env.HOME;
const originalFetch = globalThis.fetch;

process.env.USERPROFILE = temporaryHome;
process.env.HOME = temporaryHome;
fs.mkdirSync(path.join(temporaryHome, '.opencli', 'xbb'), { recursive: true });
fs.writeFileSync(path.join(temporaryHome, '.opencli', 'xbb', 'config.env'), JSON.stringify({
  corpid: 'ding-test',
  token: 'test-token',
  userId: 'config-user-id',
  baseurl: 'https://proapi.xbongbong.com',
}));

try {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ code: 1, msg: 'ok', result: { dataId: 1 } }), { status: 200 });
  };

  const { getRegistry } = await import(pathToFileURL(path.join(repositoryRoot, 'opencli-registry.js')).href);
  await import(`${pathToFileURL(path.join(repositoryRoot, 'communicate-add.js')).href}?communicateAddUserIdTest`);
  const command = getRegistry().get('xbb/communicate-add');
  const rows = await command.func({ dataList: { text_1: '测试跟进' } });

  assert.equal(rows[0].code, 1);
  assert.equal(JSON.parse(request.options.body).userId, 'config-user-id');
  assert.equal(request.options.headers.userId, 'config-user-id');
  console.log('communicate-add uses config userId when --userId is omitted.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  fs.rmSync(temporaryHome, { recursive: true, force: true });
}
