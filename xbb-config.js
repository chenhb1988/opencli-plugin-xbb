import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG_DIR = path.join(os.homedir(), '.xbbcli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const ENV_FILE = path.join(CONFIG_DIR, 'env.sh');

// config.env 字段名 -> 对应环境变量名（环境变量模式只支持单公司）
export const ENV_VAR_NAMES = Object.freeze({
  corpid: 'XBB_CORPID',
  token: 'XBB_TOKEN',
  baseurl: 'XBB_BASEURL',
  userId: 'XBB_USERID',
  corpName: 'XBB_CORPNAME',
  userName: 'XBB_USERNAME',
});

function trim(value) {
  return String(value ?? '').trim();
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(trim(value).toLowerCase());
}

// 读取环境中非空的 XBB_* 变量，返回与 config.env 单条配置同构的对象
export function readEnvConfig() {
  const config = {};
  for (const [field, name] of Object.entries(ENV_VAR_NAMES)) {
    const value = trim(process.env[name]);
    if (value) config[field] = value;
  }
  return config;
}

export function hasEnvConfig(config = readEnvConfig()) {
  return Boolean(trim(config.corpid) || trim(config.token));
}

// XBB_ENV_ONLY=1 时强制只使用环境变量，忽略 config.env
export function isEnvOnly() {
  return isTruthy(process.env.XBB_ENV_ONLY);
}

// 与旧版每个命令内联的 readConfig 行为保持一致：优先返回 enable=true 的公司
function readFileConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const companies = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.companies)
        ? parsed.companies
        : null;
    if (companies) {
      return companies.find((item) => item && item.enable) || {};
    }
    return parsed || {};
  } catch {
    return {};
  }
}

// 配置文件优先：有启用公司就用配置，否则回落到环境变量
export function readActiveConfig() {
  const envConfig = readEnvConfig();
  if (isEnvOnly()) {
    return envConfig;
  }
  const fileConfig = readFileConfig();
  if (Object.keys(fileConfig).length > 0) {
    return fileConfig;
  }
  return envConfig;
}

// 当前生效来源是否为环境变量
export function isEnvActive() {
  if (isEnvOnly()) {
    return hasEnvConfig();
  }
  return Object.keys(readFileConfig()).length === 0 && hasEnvConfig();
}

export function getEnvVarNames() {
  return Object.values(ENV_VAR_NAMES);
}

// token-set 成功后把凭证写入环境变量：Windows 用 setx 写用户级变量，其他平台写 ~/.xbbcli/env.sh
export function persistEnvVars(values) {
  const entries = Object.entries(ENV_VAR_NAMES)
    .map(([field, name]) => [name, trim(values?.[field])])
    .filter(([, value]) => value !== '');
  if (!entries.length) {
    return { stored: 'none', file: '', failed: [] };
  }
  if (process.platform === 'win32') {
    const failed = [];
    for (const [name, value] of entries) {
      const result = spawnSync('setx', [name, value], { encoding: 'utf8', windowsHide: true });
      if (result.error || result.status !== 0) failed.push(name);
    }
    if (failed.length) {
      throw new Error(`写入用户环境变量失败：${failed.join(', ')}`);
    }
    return { stored: 'user', file: '', failed: [] };
  }
  const lines = entries.map(([name, value]) => `export ${name}='${value.replaceAll("'", "'\\''")}'`);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  return { stored: 'file', file: ENV_FILE, failed: [] };
}
