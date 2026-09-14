import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from './xbb-registry.js';

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
  return [{ enable: '', corpid: '', userId: '', baseurl: '', token: '', code, msg }];
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
  columns: ['enable', 'corpid', 'userId', 'baseurl', 'token', 'code', 'msg'],
  func: async (kwargs) => {
    const companies = readCompanies();
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
      code: '',
      msg: '',
    }));
    if (enabledCount !== 1) {
      rows.push({
        enable: '',
        corpid: '',
        userId: '',
        baseurl: '',
        token: '',
        code: 'INVALID_ENABLE',
        msg: `配置中启用（enable=true）的公司数量为 ${enabledCount}，请用 xbbcli token-use --corpid <CORPID> 修正`,
      });
    }
    return rows;
  },
});