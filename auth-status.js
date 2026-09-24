import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy, getRegistry } from './xbb-registry.js';
import { readActiveConfig, getEnvVarNames } from './xbb-config.js';

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

const VERIFY_VALID = '有效';
const VERIFY_INVALID = '无效-请重新配置token';

// 用一次轻量调用（等价于 user-list --pageSize 1）验证当前 token 是否有效
// 判定：业务错误码（code 非空且非 NO_DATA）或请求异常 → 无效；成功（含 NO_DATA 空清单）→ 有效
async function verifyToken() {
  const command = getRegistry().get('xbb/user-list');
  if (!command || typeof command.func !== 'function') {
    return { valid: false, detail: '找不到 user-list 命令，无法验证' };
  }
  try {
    const rows = await command.func({ page: '1', pageSize: '1' });
    const list = Array.isArray(rows) ? rows : [];
    const errorRow = list.find((item) => item && String(item.code ?? '') !== '');
    if (!errorRow) return { valid: true, detail: 'user-list 调用成功' };
    // NO_DATA 表示接口成功但清单为空，token 仍然有效
    if (String(errorRow.code) === 'NO_DATA') return { valid: true, detail: 'user-list 调用成功（无数据）' };
    return { valid: false, detail: `user-list 返回 ${errorRow.code} ${errorRow.msg || ''}`.trim() };
  } catch (error) {
    return { valid: false, detail: `user-list 调用异常：${String(error.message || error)}` };
  }
}

function withVerify(rows, verify) {
  return [...rows, { key: 'token验证', value: verify.valid ? VERIFY_VALID : VERIFY_INVALID }];
}

async function authStatus(kwargs) {
  const showToken = Boolean(kwargs.showToken);
  const active = readActiveConfig();
  const companies = readCompanies();
  const hasActive = Boolean(trim(active.corpid) || trim(active.token));
  const source = hasActive ? 'config' : 'none';
  const envNames = getEnvVarNames().filter((name) => trim(process.env[name]));

  if (kwargs.debug) {
    process.stderr.write(`[debug] ConfigFile: ${CONFIG_FILE}\n[debug] Companies: ${companies.length}\n[debug] EnvVarsSet: ${envNames.join(', ') || 'none'}\n`);
  }

  const token = trim(active.token);
  const rows = toRows({ ...active, token: showToken ? token : maskToken(token) });

  // 没有生效配置或缺少 token 时无需发起调用，直接判定为无效
  let verify;
  if (source === 'none' || !token) {
    verify = { valid: false, detail: source === 'none' ? '没有生效配置，无法验证' : '生效配置缺少 token，无法验证' };
  } else {
    verify = await verifyToken();
  }
  if (kwargs.debug) {
    process.stderr.write(`[debug] Verify: ${verify.valid ? 'valid' : 'invalid'}（${verify.detail}）\n`);
  }
  const verifiedRows = withVerify(rows, verify);

  if (source === 'none') {
    // 没有生效配置时不把残留的环境变量值当真值回显；检测到 XBB_* 时提示本版本不再读取
    const notes = ['没有处于激活状态的配置：config.env 中不存在 enable=true 的公司；请先执行 xbbcli auth-login 或 xbbcli token-set'];
    if (envNames.length) {
      notes.push('检测到 XBB_* 环境变量，但本版本不再读取环境变量');
    }
    return withNotes(verifiedRows, notes);
  }

  const notes = [];
  const enabledCount = companies.filter((item) => item.enable === true).length;
  if (enabledCount > 1) notes.push(`config.env 中存在 ${enabledCount} 个 enable=true，仅第一条生效，请用 xbbcli token-use 修正`);
  return withNotes(verifiedRows, notes);
}

cli({
  site: 'xbb',
  name: 'auth-status',
  description: '回显当前激活的配置，并验证 token 是否有效',
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