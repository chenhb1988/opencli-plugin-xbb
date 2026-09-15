import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';
import { readEnvConfig, hasEnvConfig, isEnvOnly } from './xbb-config.js';

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
function makeErrorRow(code, msg) {
  return [{ enable: '', corpid: '', corpName: '', userName: '', userId: '', baseurl: '', token: '', code, msg, source: '' }];
}

cli({
  site: 'xbb',
  name: 'token-list',
  description: '列出本地保存的多家公司配置，并标记唯一启用的公司（enable=true）',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'showToken', type: 'bool', default: false, help: '显示完整 token；默认只显示脱敏预览' },
  ],
  columns: ['enable', 'corpid', 'userId', 'baseurl', 'token', 'corpName', 'userName', 'code', 'msg', 'source'],
  func: async (kwargs) => {
    const companies = readCompanies();
    const envConfig = readEnvConfig();
    if (isEnvOnly() || (!companies.some((item) => item && item.enable === true) && hasEnvConfig(envConfig))) {
      return [{
        enable: 'true',
        corpid: String(envConfig.corpid || ''),
        userId: String(envConfig.userId || ''),
        baseurl: String(envConfig.baseurl || ''),
        token: Boolean(kwargs.showToken) ? String(envConfig.token || '') : maskToken(envConfig.token),
        corpName: String(envConfig.corpName || ''),
        userName: String(envConfig.userName || ''),
        code: '',
        msg: '来源为环境变量 XBB_*（环境变量模式不支持多公司切换）',
        source: 'env',
      }];
    }
    if (!companies.length) {
      return makeErrorRow('NO_CONFIG', '缺少本地配置；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
    }
    const showToken = Boolean(kwargs.showToken);
    const enabledCount = companies.filter((item) => item.enable === true).length;
    const rows = companies.map((item) => ({
      enable: item.enable === true ? 'true' : 'false',
      corpid: String(item.corpid || ''),
      userId: String(item.userId || ''),
      baseurl: String(item.baseurl || ''),
      token: showToken ? String(item.token || '') : maskToken(item.token),
      corpName: String(item.corpName || ''),
      userName: String(item.userName || ''),
      code: '',
      msg: '',
      source: 'config',
    }));
    if (enabledCount !== 1) {
      rows.push({
        enable: '',
        corpid: '',
        userId: '',
        baseurl: '',
        token: '',
        corpName: '',
        userName: '',
        source: 'config',
        code: 'INVALID_ENABLE',
        msg: `配置中启用（enable=true）的公司数量为 ${enabledCount}，请用 xbbcli token-use --corpid <CORPID> 修正`,
      });
    }
    return rows;
  },
});