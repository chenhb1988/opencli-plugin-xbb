import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';
import { clearEnvVars, getEnvVarNames, hasEnvConfig, readEnvConfig } from './xbb-config.js';

const CONFIG_DIR = path.join(os.homedir(), '.xbbcli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');

function readCompanies() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return normalizeCompanies(parsed);
  } catch {
    return [];
  }
}

function normalizeCompanies(parsed) {
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
}

function writeCompanies(companies) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(companies, null, 2) + '\n', 'utf8');
}

function enableOnly(companies, index) {
  return companies.map((item, itemIndex) => ({ ...item, enable: itemIndex === index }));
}

function enableSingle(companies) {
  const enabledIndex = companies.findIndex((item) => item.enable === true);
  return enableOnly(companies, enabledIndex === -1 ? 0 : enabledIndex);
}

function maskToken(token) {
  const value = String(token || '').trim();
  if (!value) return '';
  if (value.length <= 12) return `${value.slice(0, 4)}****`;
  return `${value.slice(0, 8)}****${value.slice(-4)}`;
}
function createResult(status, message, corpid, enable, companyCount, envStored = 'skipped', envFile = '') {
  return [{
    status,
    message,
    configFile: CONFIG_FILE,
    corpid,
    enable,
    companyCount,
    envStored,
    envFile,
  }];
}

async function delCompany(kwargs) {
  const corpid = String(kwargs.corpid || '').trim();
  if (!corpid) {
    return createResult('error', '缺少 --corpid', '', '', '');
  }

  const alsoEnv = String(kwargs.env ?? '1').trim() !== '0';
  const envPresent = hasEnvConfig();
  const envBefore = envPresent ? String(readEnvConfig().corpid || '').trim() : '';

  const companies = readCompanies();
  if (!companies.length) {
    return createResult('error', '缺少本地配置；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', corpid, '', 0);
  }

  const remaining = companies.filter((item) => String(item.corpid || '').trim() !== corpid);
  if (remaining.length === companies.length) {
    return createResult('error', `未找到 corpid=${corpid} 的本地配置`, corpid, '', companies.length);
  }

  const next = remaining.length ? enableSingle(remaining) : [];
  writeCompanies(next);
  const enabledCorpid = next.find((item) => item.enable === true)?.corpid || '';
  const parts = [next.length
    ? `已删除 corpid=${corpid}，剩余 ${next.length} 家公司，当前启用 corpid=${enabledCorpid}`
    : `已删除 corpid=${corpid}，本地已无公司配置`];

  let envStored = 'skipped';
  let envFile = '';

  if (alsoEnv) {
    try {
      const result = clearEnvVars();
      envStored = result.stored;
      envFile = result.file;
      if (envStored === 'none') {
        parts.push('未检测到 XBB_* 环境变量，无需删除');
      } else {
        const suffix = process.platform === 'win32' ? '（已打开的终端需重开才会消失）' : '';
        parts.push(`环境变量 ${getEnvVarNames().join('、')} 已删除${suffix}`);
      }
      // 环境变量已清空，说明删除后的实际生效来源
      if (envStored !== 'none' || envBefore) {
        if (next.length) {
          parts.push(`此后业务命令使用 config.env 中启用的 corpid=${enabledCorpid}`);
        } else {
          parts.push('此后没有可用凭证，请重新执行 xbbcli token-set 或 xbbcli auth-login');
        }
      }
    } catch (error) {
      envStored = 'failed';
      envFile = String(error.message || error);
      return createResult('partial', `${parts.join('；')}；删除环境变量失败：${envFile}`, corpid, next.length ? 'true' : '', next.length, envStored, envFile);
    }
  } else if (envPresent) {
    parts.push(`注意：环境变量 XBB_*（corpid=${envBefore || '未知'}）仍然存在（供外部系统使用；业务命令不再读取）；如需一并删除请改用 --env 1（或不指定该参数）`);
  }

  return createResult('ok', parts.join('；'), corpid, next.length ? 'true' : '', next.length, envStored, envFile);
}

cli({
  site: 'xbb',
  name: 'token-del',
  description: '删除指定的已保存公司配置，并保证剩余配置中仅且只有一个被启用；默认同时删除 XBB_* 环境变量',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '要删除的公司 id，必须是已保存的 corpid（必填）' },
    { name: 'env', type: 'str', default: '1', help: '是否同时删除 XBB_* 环境变量：1 删除（默认），0 仅删除 config.env 保留环境变量。Windows 删除用户级变量，其他平台清理 ~/.xbbcli/env.sh' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'enable', 'companyCount', 'envStored', 'envFile'],
  func: delCompany,
});