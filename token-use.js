import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';
import { hasEnvConfig, persistEnvVars } from './xbb-config.js';
import { resolveBaseUrl } from './xbb-token-store.js';

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
function createResult(status, message, corpid, enable, companyCount) {
  return [{
    status,
    message,
    configFile: CONFIG_FILE,
    corpid,
    enable,
    companyCount,
  }];
}

async function useCompany(kwargs) {
  const corpid = String(kwargs.corpid || '').trim();
  if (!corpid) {
    return createResult('error', '缺少 --corpid', '', '', '');
  }

  const envPresent = hasEnvConfig();

  const companies = readCompanies();
  if (!companies.length) {
    return createResult('error', '缺少本地配置；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>', corpid, '', 0);
  }

  const index = companies.findIndex((item) => String(item.corpid || '').trim() === corpid);
  if (index === -1) {
    return createResult('error', `未找到 corpid=${corpid} 的本地配置`, corpid, '', companies.length);
  }

  const target = companies[index];
  // XBB_* 有值时会同步覆盖环境变量，需要完整凭证：缺 token 时直接拒绝，避免残留上一家公司的 XBB_TOKEN
  if (envPresent && !String(target.token || '').trim()) {
    return createResult('error', `corpid=${corpid} 的本地配置缺少 token，无法同步到 XBB_* 环境变量；请先执行 xbbcli token-set --corpid ${corpid} --token <TOKEN> --userId <USERID>`, corpid, '', companies.length);
  }

  const next = enableOnly(companies, index);
  writeCompanies(next);

  const parts = [`已启用 corpid=${corpid}，其余公司已标记为 enable=false`];

  // 环境变量中有值时把启用公司凭证同步写回 XBB_*（供外部系统消费，本 CLI 不再读取）
  if (envPresent) {
    try {
      persistEnvVars({
        corpid: target.corpid,
        token: target.token,
        // 条目缺少 baseurl 时按 corpid 规则推导，避免残留上一家公司的 XBB_BASEURL
        baseurl: target.baseurl || resolveBaseUrl(target.corpid),
        userId: target.userId,
        corpName: target.corpName,
        userName: target.userName,
      });
      const suffix = process.platform === 'win32'
        ? '（Windows 需重开终端后才生效）'
        : '（重新 source ~/.xbbcli/env.sh 后才生效）';
      parts.push(`检测到环境变量 XBB_* 有值，已同步更新为该公司凭证（供外部系统使用，本 CLI 不读取）${suffix}`);
    } catch (error) {
      return createResult('partial', `已启用 corpid=${corpid}，但同步更新环境变量失败：${String(error.message || error)}`, corpid, 'true', next.length);
    }
  }

  return createResult('ok', parts.join('；'), corpid, 'true', next.length);
}

cli({
  site: 'xbb',
  name: 'token-use',
  description: '切换当前启用的公司（enable），保证仅且只有一个公司被启用；XBB_* 环境变量有值时同步更新为该公司凭证（供外部系统使用，本 CLI 不读取）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'corpid', type: 'str', help: '要启用的公司 id，必须是已保存的 corpid（必填）' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'enable', 'companyCount'],
  func: useCompany,
});