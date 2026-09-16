import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';
import { clearEnvVars, getEnvVarNames, hasEnvConfig, isEnvOnly, readEnvConfig } from './xbb-config.js';

const CONFIG_DIR = path.join(os.homedir(), '.xbbcli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const BACKUP_FILE = path.join(CONFIG_DIR, 'config.env.bak');

function trim(value) {
  return String(value ?? '').trim();
}

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

function writeCompanies(companies) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(companies, null, 2) + '\n', 'utf8');
}

function createRow(fields) {
  return [{
    status: '',
    message: '',
    configFile: CONFIG_FILE,
    backupFile: '',
    corpid: '',
    corpName: '',
    userId: '',
    companyCount: '',
    hasActive: '',
    envStored: '',
    envFile: '',
    code: '',
    msg: '',
    ...fields,
  }];
}

function previewCorpids(companies) {
  const names = companies.slice(0, 3).map((item) => trim(item.corpid)).filter(Boolean);
  return names.join(', ') + (companies.length > 3 ? ' …' : '');
}

async function authLogout(kwargs) {
  const alsoEnv = !kwargs.noEnv && kwargs.env !== false;
  const companies = readCompanies();
  const index = companies.findIndex((item) => item && item.enable === true);
  const envPresent = hasEnvConfig();
  const envBefore = envPresent ? trim(readEnvConfig().corpid) : '';

  if (kwargs.debug) {
    process.stderr.write(`[debug] ConfigFile: ${CONFIG_FILE}\n[debug] BackupFile: ${BACKUP_FILE}\n[debug] Companies: ${companies.length}\n[debug] EnabledIndex: ${index}\n[debug] ClearEnv: ${alsoEnv}\n[debug] EnvCorpid: ${envBefore || 'none'}\n[debug] EnvVarsSet: ${getEnvVarNames().filter((name) => trim(process.env[name])).join(', ') || 'none'}\n`);
  }

  if (index === -1 && (!alsoEnv || !envPresent)) {
    const scope = companies.length
      ? `本地共 ${companies.length} 家公司（${previewCorpids(companies)}）且均未启用；要登出某家请先用 xbbcli token-use --corpid <CORPID> 启用，或改用 xbbcli token-del --corpid <CORPID> 直接删除`
      : '本地没有任何公司配置';
    const envNote = envPresent
      ? '环境变量 XBB_* 仍存在，本次未清除（去掉 --noEnv / --env=false 即可一并清除）'
      : '环境变量 XBB_* 也不存在，本次无可清除内容';
    const hint = `${scope}；${envNote}`;
    return createRow({
      status: 'error',
      message: `config.env 中没有处于激活状态（enable=true）的配置；${hint}`,
      companyCount: String(companies.length),
      hasActive: 'false',
      envStored: 'skipped',
      code: 'NO_ACTIVE_CONFIG',
      msg: isEnvOnly() ? `${hint}（当前 XBB_ENV_ONLY=1，config.env 被忽略）` : hint,
    });
  }

  const target = index === -1 ? null : companies[index];
  const remaining = target ? companies.filter((item, itemIndex) => itemIndex !== index) : companies;
  let backupFile = '';

  if (target) {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        fs.copyFileSync(CONFIG_FILE, BACKUP_FILE);
        backupFile = BACKUP_FILE;
      }
      writeCompanies(remaining);
    } catch (error) {
      const detail = String(error.message || error);
      return createRow({
        status: 'error',
        message: `删除激活配置失败：${detail}；config.env 未被改动`,
        corpid: trim(target.corpid),
        companyCount: String(companies.length),
        envStored: 'skipped',
        code: 'WRITE_FAILED',
        msg: detail,
      });
    }
  }

  let envStored = 'skipped';
  let envFile = '';
  const parts = [];
  parts.push(target
    ? `已登出 corpid=${trim(target.corpid)}（config.env 中该条配置已删除，剩余 ${remaining.length} 家${remaining.length ? '，均未启用' : '，本地已无配置'}）`
    : 'config.env 中没有激活配置，未改动');
  if (backupFile) {
    parts.push(`原配置已备份到 ${backupFile}`);
  }

  if (alsoEnv) {
    try {
      const result = clearEnvVars();
      envStored = result.stored;
      envFile = result.file;
      const suffix = process.platform === 'win32' ? '；已打开的终端需重开才会消失' : '';
      parts.push(`环境变量 ${getEnvVarNames().join('、')} 已清除（${envStored}）${suffix}`);
    } catch (error) {
      envStored = 'failed';
      envFile = String(error.message || error);
      parts.push(`清除环境变量失败：${envFile}`);
    }
  } else if (envBefore) {
    const forced = isEnvOnly() ? '且 XBB_ENV_ONLY=1 已强制只用环境变量' : '业务命令会回落到它';
    parts.push(`注意：环境变量 XBB_*（corpid=${envBefore}）仍然有效，${forced}，本次不算彻底登出；如需一并清除请去掉 --noEnv（auth-logout 默认会清除环境变量）`);
  }

  const remainingCompanies = target ? remaining : readCompanies();
  return createRow({
    status: envStored === 'failed' ? 'partial' : 'ok',
    message: parts.join('；'),
    backupFile,
    corpid: target ? trim(target.corpid) : '',
    corpName: target ? trim(target.corpName) : '',
    userId: target ? trim(target.userId) : '',
    companyCount: String(remainingCompanies.length),
    hasActive: remainingCompanies.some((item) => item && item.enable === true) ? 'true' : 'false',
    envStored,
    envFile,
  });
}

cli({
  site: 'xbb',
  name: 'auth-logout',
  description: '登出',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'env', type: 'bool', default: true, help: '同时清除 XBB_* 环境变量（默认开启；--env=false 跳过）。Windows 删除用户级变量，其他平台清理 ~/.xbbcli/env.sh' },
    { name: 'noEnv', type: 'bool', default: false, help: '不清除环境变量，仅删除 config.env 中的激活配置（与 token-set 的 --noEnv 一致）' },
    { name: 'debug', type: 'bool', default: false, help: '输出配置文件、备份路径与生效的环境变量名（不打印 token）' },
  ],
  columns: ['status', 'message', 'configFile', 'backupFile', 'corpid', 'corpName', 'userId', 'companyCount', 'hasActive', 'envStored', 'envFile', 'code', 'msg'],
  func: authLogout,
});