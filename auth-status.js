import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';
import { readActiveConfig, hasEnvConfig, isEnvActive, isEnvOnly, getEnvVarNames } from './xbb-config.js';

const CONFIG_DIR = path.join(os.homedir(), '.xbbcli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');

function trim(value) {
  return String(value ?? '').trim();
}

// token 只用于人眼确认是哪一枚，默认中间掩码；完整值需显式 --showToken
function maskToken(token) {
  const value = trim(token);
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

// 仅用于统计公司数量与检查重复启用，生效值一律以 readActiveConfig() 为准
function readCompanies() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object');
    }
    if (parsed && Array.isArray(parsed.companies)) {
      return parsed.companies.filter((item) => item && typeof item === 'object');
    }
    if (parsed && parsed.corpid) {
      const { corpid, token, baseurl, userId } = parsed;
      return [{ corpid, token, baseurl, userId, enable: true }];
    }
    return [];
  } catch {
    return [];
  }
}

// 回显固定为 key/value 两列，只列配置值，不输出 status/source/message 之类的元信息
const FIELDS = ['corpid', 'corpName', 'userName', 'userId', 'baseurl', 'token'];

function toRows(values) {
  return FIELDS.map((key) => ({ key, value: trim(values[key]) }));
}

function withNotes(rows, notes) {
  return [...rows, ...notes.map((value) => ({ key: 'note', value }))];
}

async function authStatus(kwargs) {
  const showToken = Boolean(kwargs.showToken);
  const envActive = hasEnvConfig();
  const envUsed = isEnvActive();
  const active = readActiveConfig();
  const companies = readCompanies();
  const hasActive = Boolean(trim(active.corpid) || trim(active.token));
  const source = hasActive ? (envUsed ? 'env' : 'config') : 'none';

  if (kwargs.debug) {
    const envNames = getEnvVarNames().filter((name) => trim(process.env[name])).join(', ');
    process.stderr.write(`[debug] ConfigFile: ${CONFIG_FILE}\n[debug] Companies: ${companies.length}\n[debug] Source: ${source}\n[debug] XBB_ENV_ONLY: ${trim(process.env.XBB_ENV_ONLY) || 'unset'}\n[debug] EnvVarsSet: ${envNames || 'none'}\n`);
  }

  const token = trim(active.token);
  const rows = toRows({ ...active, token: showToken ? token : maskToken(token) });

  if (source === 'none') {
    // 没有生效配置时不把残留的环境变量值当真值回显（XBB_BASEURL 等可能单独存在）
    return withNotes(toRows({}), [
      '没有处于激活状态的配置：config.env 中不存在 enable=true 的公司，环境变量 XBB_* 也为空；请先执行 xbbcli auth-login 或 xbbcli token-set',
    ]);
  }

  if (source === 'env') {
    const reason = isEnvOnly() ? 'XBB_ENV_ONLY=1 已强制使用环境变量' : 'config.env 中没有启用公司，回落到环境变量';
    return withNotes(rows, [
      `以上取值来自环境变量 XBB_*（${reason}）；环境变量模式不支持多公司切换，配置文件路径与公司数量见 --debug`,
    ]);
  }

  const notes = [];
  if (envActive) notes.push('环境变量 XBB_* 同时存在，但 config.env 启用项优先；如需彻底登出请执行 xbbcli auth-logout');
  const enabledCount = companies.filter((item) => item.enable === true).length;
  if (enabledCount > 1) notes.push(`config.env 中存在 ${enabledCount} 个 enable=true，仅第一条生效，请用 xbbcli token-use 修正`);
  return withNotes(rows, notes);
}

cli({
  site: 'xbb',
  name: 'auth-status',
  description: '回显当前激活的配置',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'showToken', type: 'bool', default: false, help: '显示完整 token；默认只输出中间掩码' },
    { name: 'debug', type: 'bool', default: false, help: '在 stderr 输出配置文件路径、公司数量与生效的环境变量名（不含 token 明文）' },
  ],
  columns: ['key', 'value'],
  func: authStatus,
});