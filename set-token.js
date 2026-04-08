import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function resolveBaseUrl(corpid) {
  if (corpid.startsWith('ding') || corpid.includes('$$ding')) {
    return 'https://proapi.xbongbong.com';
  }
  return 'https://appapi.xbongbong.com';
}

function normalizeArg(value) {
  return String(value || '').trim();
}

function createResult(status, message, corpid, baseurl) {
  return [{
    status,
    message,
    configFile: CONFIG_FILE,
    corpid,
    baseurl,
  }];
}

async function setToken(_page, kwargs) {
  const corpid = normalizeArg(kwargs.corpid);
  const token = normalizeArg(kwargs.token);

  if (!corpid) {
    return createResult('error', '缺少 --corpid', '', '');
  }

  if (!token) {
    return createResult('error', '缺少 --token', corpid, '');
  }

  const baseurl = resolveBaseUrl(corpid);
  const config = { corpid, token, baseurl };

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');

  return createResult('ok', '已保存 corpid、token、baseurl 到本地配置文件', corpid, baseurl);
}

cli({
  site: 'xbb',
  name: 'set-token',
  description: '保存 xbb API token 到本地配置文件',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', help: '要保存的 API token' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'baseurl'],
  func: setToken,
});
