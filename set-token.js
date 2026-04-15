import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli, Strategy } from './opencli-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const FORMLIST_FILE_SUFFIX = '.formlist.json';

function resolveBaseUrl(corpid) {
  if (corpid.startsWith('ding') || corpid.includes('$$ding')) {
    return 'https://proapi.xbongbong.com';
  }
  return 'https://appapi.xbongbong.com';
}

function normalizeArg(value) {
  return String(value || '').trim();
}

function getFormlistFile(corpid) {
  return path.join(CONFIG_DIR, `${corpid}${FORMLIST_FILE_SUFFIX}`);
}

function runOpenCliJson(args) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'opencli', ...args], { encoding: 'utf8' })
    : spawnSync('opencli', args, { encoding: 'utf8' });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || 'opencli 命令执行失败').trim());
  }

  const output = String(result.stdout || '').trim();
  if (!output) {
    return [];
  }

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`opencli 返回的 JSON 解析失败：${output}`);
  }
}

function getFormlistRows(corpid, saasMark) {
  const rows = runOpenCliJson([
    'xbb',
    'formlist',
    '--corpid',
    corpid,
    '--saasMark',
    String(saasMark),
    '-f',
    'json',
  ]);

  if (!Array.isArray(rows)) {
    throw new Error(`formlist 返回结果不是数组：saasMark=${saasMark}`);
  }

  const errorRow = rows.find((item) => item && item.code);
  if (errorRow) {
    throw new Error(`formlist 获取失败（saasMark=${saasMark}）：${errorRow.code} ${errorRow.msg || ''}`.trim());
  }

  return rows;
}

function writeFormlistFile(corpid) {
  const customForms = getFormlistRows(corpid, 2);
  const systemForms = getFormlistRows(corpid, 1);
  const formlistFile = getFormlistFile(corpid);
  const mergedRows = [...customForms, ...systemForms];

  fs.writeFileSync(formlistFile, JSON.stringify(mergedRows, null, 2) + '\n', 'utf8');
  return formlistFile;
}

function createResult(status, message, corpid, baseurl, formlistFile = '') {
  return [{
    status,
    message,
    configFile: CONFIG_FILE,
    corpid,
    baseurl,
    formlistFile,
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

  try {
    const formlistFile = writeFormlistFile(corpid);
    return createResult('ok', '已保存 corpid、token、baseurl，并同步表单模板缓存文件', corpid, baseurl, formlistFile);
  } catch (error) {
    return createResult(
      'partial',
      `已保存 corpid、token、baseurl，但同步表单模板缓存失败：${error.message}`,
      corpid,
      baseurl,
      getFormlistFile(corpid),
    );
  }
}

cli({
  site: 'xbb',
  name: 'set-token',
  description: '保存 xbb API token,corpid,formId清单 到本地配置文件，其他命令需要formId时，可以先查询表单模板缓存文件',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', help: '要保存的 API token' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'baseurl', 'formlistFile'],
  func: setToken,
});
