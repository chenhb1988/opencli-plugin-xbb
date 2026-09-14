import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy, getRegistry } from './xbb-registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.xbbcli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');
const FORMLIST_FILE_SUFFIX = '.formlist.json';
const COMMAND_MAP_FILE_SUFFIX = '.command-map.md';
const DEPARTMENT_USER_FILE_SUFFIX = '.department-user.json';
const READ_ALL_PAGE_SIZE = 200;
const READ_ALL_MAX_PAGES = 1000;

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

function getCommandMapFile(corpid) {
  return path.join(CONFIG_DIR, `${corpid}${COMMAND_MAP_FILE_SUFFIX}`);
}

async function runCommandJson(name, kwargs) {
  const command = getRegistry().get(`xbb/${name}`);
  if (!command) throw new Error(`找不到命令：${name}`);
  const rows = await command.func(kwargs);
  if (!Array.isArray(rows)) throw new Error(`${name} 返回结果不是数组`);
  return rows;
}

async function getFormlistRows(corpid, saasMark) {
  const rows = await runCommandJson('form-list', { saasMark: String(saasMark) });

  if (!Array.isArray(rows)) {
    throw new Error(`form-list 返回结果不是数组：saasMark=${saasMark}`);
  }

  const errorRow = rows.find((item) => item && item.code);
  if (errorRow) {
    throw new Error(`form-list 获取失败（saasMark=${saasMark}）：${errorRow.code} ${errorRow.msg || ''}`.trim());
  }

  return rows;
}

async function requestPersonalToken(corpid, token, userId, resetToken) {
  const rows = await runCommandJson('token-generate', {
    checkUserId: userId,
    resetToken: String(resetToken),
    token,
    corpid,
  });

  if (!Array.isArray(rows)) {
    throw new Error('token-generate 返回结果不是数组');
  }

  const errorRow = rows.find((item) => item && String(item.code ?? '') !== '' && Number(item.code) !== 1);
  if (errorRow) {
    throw new Error(`token-generate 获取个人 token 失败：${errorRow.code} ${errorRow.msg || ''}`.trim());
  }

  return String(rows[0]?.token || '').trim();
}

async function getPersonalToken(corpid, token, userId) {
  const existingToken = await requestPersonalToken(corpid, token, userId, 0);

  if (existingToken) {
    if (!existingToken.startsWith('user_')) {
      throw new Error('token-generate 未返回有效的个人 token');
    }
    return existingToken;
  }

  const personalToken = await requestPersonalToken(corpid, token, userId, 1);
  if (!personalToken.startsWith('user_')) {
    throw new Error('token-generate 未返回有效的个人 token');
  }

  return personalToken;
}

async function writeFormlistFile(corpid) {
  const customForms = await getFormlistRows(corpid, 2);
  const systemForms = await getFormlistRows(corpid, 1);
  const formlistFile = getFormlistFile(corpid);
  const mergedRows = [...customForms, ...systemForms];

  fs.writeFileSync(formlistFile, JSON.stringify(mergedRows, null, 2) + '\n', 'utf8');
  return formlistFile;
}

function getDepartmentUserFile(corpid) {
  return path.join(CONFIG_DIR, `${corpid}${DEPARTMENT_USER_FILE_SUFFIX}`);
}

async function fetchAllRows(name, pageSize) {
  const rows = [];
  for (let page = 1; page <= READ_ALL_MAX_PAGES; page += 1) {
    const pageRows = await runCommandJson(name, { page: String(page), pageSize: String(pageSize) });
    const errorRow = pageRows.find((item) => item && String(item.code ?? '') !== '');
    if (errorRow) {
      if (String(errorRow.code) === 'NO_DATA') {
        return rows;
      }
      throw new Error(`${name} 获取失败（page=${page}）：${errorRow.code} ${errorRow.msg || ''}`.trim());
    }
    rows.push(...pageRows);
  }
  throw new Error(`${name} 分页超过 ${READ_ALL_MAX_PAGES} 页，未获取到完整数据`);
}

function parseDepartmentListField(value) {
  if (Array.isArray(value)) {
    return value;
  }
  const text = String(value ?? '').trim();
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : text;
  } catch {
    return text;
  }
}

function toDepartmentEntry(row) {
  return {
    id: row.id ?? '',
    name: row.name ?? '',
    parentId: row.parentId ?? '',
    depIdRouter: row.depIdRouter ?? '',
  };
}

function toUserEntry(row) {
  return {
    userId: row.userId ?? '',
    name: row.name ?? '',
    position: row.position ?? '',
    jobnumber: row.jobnumber ?? '',
    departmentList: parseDepartmentListField(row.departmentList),
  };
}

async function writeDepartmentUserFile(corpid) {
  const departmentRows = await fetchAllRows('department-list', READ_ALL_PAGE_SIZE);
  const userRows = await fetchAllRows('user-list', READ_ALL_PAGE_SIZE);
  const payload = {
    corpid,
    updatedAt: new Date().toISOString(),
    pageSize: READ_ALL_PAGE_SIZE,
    departmentCount: departmentRows.length,
    userCount: userRows.length,
    departments: departmentRows.map(toDepartmentEntry),
    users: userRows.map(toUserEntry),
  };
  const file = getDepartmentUserFile(corpid);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return file;
}

function normalizeBusinessType(value) {
  return String(value).trim().replace(/[)）\]】,，;；:：。!?！？]+$/g, '');
}

function getCommandBusinessType(command) {
  if (command.businessType !== undefined && command.businessType !== null) {
    return normalizeBusinessType(command.businessType);
  }
  const description = String(command.description || '');
  const match = description.match(/businessType\s*:\s*(\d+)/i);
  return match ? normalizeBusinessType(match[1]) : '';
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function optionDescription(option) {
  return `--${option.name}: ${option.help || ''}`;
}

function writeCommandMap(corpid) {
  const formFile = getFormlistFile(corpid);
  if (!fs.existsSync(formFile)) {
    throw new Error(`Form cache not found: ${formFile}`);
  }
  const raw = fs.readFileSync(formFile, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  const forms = Array.isArray(data) ? data : data.data || [];

  const commands = [...getRegistry().values()]
    .filter((command) => command.site === 'xbb')
    .map((command) => ({
      ...command,
      command_options: command.args || [],
    }));

  const lines = [
    '# XBB 命令映射',
    '',
    `来源：xbb --help；表单缓存：${path.basename(formFile)}`,
    '',
    '| 命令 | 命令名称 | formId | businessType | 字段说明 |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const command of commands) {
    const commandBusinessType = getCommandBusinessType(command);
    const matchedForms = forms.filter((form) => String(form.businessType ?? '').trim() === commandBusinessType);
    const formIds = [...new Set(matchedForms.map((form) => form.formId).filter(Boolean))];
    const businessTypes = [...new Set(matchedForms.map((form) => form.businessType).filter(Boolean))];
    const options = (command.command_options || []).map(optionDescription).join('<br>');
    lines.push(
      `| ${escapeCell(command.name)} | ${escapeCell(command.description)} | ${escapeCell(formIds.join(', '))} | ${escapeCell(businessTypes.join(', ') || commandBusinessType)} | ${escapeCell(options)} |`,
    );
  }

  const commandMapFile = getCommandMapFile(corpid);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(commandMapFile, `${lines.join('\n')}\n`, 'utf8');
  return commandMapFile;
}

function createResult(status, message, corpid, baseurl, userId, formlistFile = '', commandMapFile = '', enable = '', companyCount = '', departmentUserFile = '') {
  return [{
    status,
    message,
    configFile: CONFIG_FILE,
    corpid,
    baseurl,
    userId,
    enable,
    companyCount,
    formlistFile,
    commandMapFile,
    departmentUserFile,
  }];
}

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

function upsertCompany(companies, entry) {
  const index = companies.findIndex((item) => String(item.corpid || '').trim() === entry.corpid);
  const next = companies.map((item) => ({ ...item, enable: false }));
  if (index === -1) {
    next.push({ ...entry, enable: true });
  } else {
    next[index] = { ...next[index], ...entry, enable: true };
  }
  return next;
}

async function setToken(kwargs) {
  const corpid = normalizeArg(kwargs.corpid);
  const token = normalizeArg(kwargs.token);
  const userId = normalizeArg(kwargs.userId);

  if (!corpid) {
    return createResult('error', '缺少 --corpid', '', '', '');
  }

  if (!token) {
    return createResult('error', '缺少 --token', corpid, '', '');
  }

  if (!userId) {
    return createResult('error', '缺少 --userId', corpid, '', '');
  }

  let personalToken = token;
  if (!token.startsWith('user_')) {
    try {
      personalToken = await getPersonalToken(corpid, token, userId);
    } catch (error) {
      return createResult('error', `生成个人 token 失败：${error.message}`, corpid, '', userId);
    }
  }

  const baseurl = resolveBaseUrl(corpid);
  const companies = upsertCompany(readCompanies(), { corpid, token: personalToken, baseurl, userId });

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(companies, null, 2) + '\n', 'utf8');

  try {
    const formlistFile = await writeFormlistFile(corpid);
    const commandMapFile = writeCommandMap(corpid);
    const departmentUserFile = await writeDepartmentUserFile(corpid);
    return createResult('ok', '已保存 corpid、token、baseurl、userId，并同步表单模板缓存、命令映射文件与部门/员工缓存', corpid, baseurl, userId, formlistFile, commandMapFile, true, companies.length, departmentUserFile);
  } catch (error) {
    return createResult(
      'partial',
      `已保存 corpid、token、baseurl、userId，但同步缓存失败：${error.message}`,
      corpid,
      baseurl,
      userId,
      getFormlistFile(corpid),
      '',
      true,
      companies.length,
      '',
    );
  }
}

cli({
  site: 'xbb',
  name: 'token-set',
  description: '保存 xbb API token,corpid,formId清单 到本地配置文件，并缓存部门与员工清单(<corpid>.department-user.json)；其他命令需要意图识别或找formId时，优先查命令映射文件(<corpid>.command-map.md)',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', help: '要保存的 API token' },
    { name: 'userId', type: 'str', help: '操作人id（必填）' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'baseurl', 'userId', 'enable', 'companyCount', 'formlistFile', 'commandMapFile', 'departmentUserFile'],
  func: setToken,
});
