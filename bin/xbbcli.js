#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getGroups, getRegistry } from '../xbb-registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

async function loadCommands() {
  const files = fs.readdirSync(root)
    .filter((name) => name.endsWith('.js') && name !== 'xbb-registry.js')
    .sort();
  for (const file of files) {
    await import(`${pathToFileURL(path.join(root, file)).href}?xbbCli`);
  }
}

function readVersion() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return String(parsed.version || '').trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function groupSubcommandName(command, group) {
  if (command.name.startsWith(`${group}-`)) {
    return command.name.slice(group.length + 1).replaceAll('-', ' ');
  }
  return command.name;
}

function commandDisplayName(command) {
  const group = String(command.group || '');
  if (group && command.name.startsWith(`${group}-`)) {
    return `${group} ${groupSubcommandName(command, group)}`;
  }
  return command.name;
}

function getGroupCommands(group) {
  return [...getRegistry().values()].filter((command) => command.group === group);
}

// 二级命令：把 mail send / mail draft add 依次拼成 mail-send / mail-draft-add 查找
function resolveCommand(tokens) {
  for (let count = tokens.length; count > 0; count -= 1) {
    const words = tokens.slice(0, count);
    if (words.some((word) => word.startsWith('-'))) continue;
    const command = getRegistry().get(`xbb/${words.join('-')}`);
    if (command) return { command, rest: tokens.slice(count) };
  }
  return null;
}

// 顶层帮助只展示分组入口（如 mail），子命令交给 xbbcli mail --help，避免命令列表过长
function getHelpEntries() {
  const entries = new Map();
  for (const command of getRegistry().values()) {
    const group = String(command.group || '');
    if (group) {
      if (!entries.has(group)) {
        const registered = getGroups().get(`xbb/${group}`);
        entries.set(group, {
          name: group,
          group: true,
          description: registered?.description
            ? `${registered.description}（xbbcli ${group} -h 查看子命令）`
            : '',
        });
      }
      continue;
    }
    entries.set(command.name, { name: command.name, description: command.description || '' });
  }
  for (const entry of entries.values()) {
    if (entry.group && !entry.description) {
      entry.description = `子命令分组（xbbcli ${entry.name} -h 查看子命令）`;
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function printHelp() {
  const entries = getHelpEntries();
  const hasGroups = entries.some((entry) => entry.group);
  const usageLines = ['Usage: xbbcli <command> [options]'];
  if (hasGroups) usageLines.push('       xbbcli <group> <subcommand> [options]');
  usageLines.push('       xbbcli -v | --version');
  process.stdout.write(`${usageLines.join('\n')}\n\nCommands:\n`);
  for (const entry of entries) {
    process.stdout.write(`  ${entry.name.padEnd(34)} ${entry.description}\n`);
  }
  process.stdout.write(`\n  ${'-v, --version'.padEnd(34)} show version\n`);
}

function printGroupHelp(group) {
  const commands = getGroupCommands(group).sort((a, b) => commandDisplayName(a).localeCompare(commandDisplayName(b)));
  process.stdout.write(`Usage: xbbcli ${group} <subcommand> [options]\n\nSubcommands:\n`);
  const width = Math.max(...commands.map((command) => groupSubcommandName(command, group).length)) + 2;
  for (const command of commands) {
    process.stdout.write(`  ${groupSubcommandName(command, group).padEnd(width)} ${command.description || ''}\n`);
  }
  process.stdout.write(`\n运行 xbbcli ${group} <subcommand> -h 查看子命令参数。\n`);
}

function printCommandHelp(command) {
  process.stdout.write(`Usage: xbbcli ${commandDisplayName(command)} [options]\n\n${command.description || ''}\n\nOptions:\n`);
  for (const arg of command.args || []) {
    const suffix = arg.default !== undefined ? ` (default: ${arg.default})` : '';
    process.stdout.write(`  --${arg.name}${arg.type === 'bool' ? '' : ' <value>'}${suffix}\n      ${arg.help || ''}\n`);
  }
  process.stdout.write('  -f, --format <format>  output format: json, table, csv\n  --help                 show this help\n');
}

function parseArgs(command, argv) {
  const kwargs = {};
  for (const arg of command.args || []) {
    if (arg.default !== undefined) kwargs[arg.name] = arg.default;
  }
  let format = 'table';
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') return { help: true, kwargs, format };
    if (token === '-f' || token === '--format') {
      format = argv[++index] || format;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`未知参数：${token}`);
    const equalIndex = token.indexOf('=');
    const name = token.slice(2, equalIndex === -1 ? undefined : equalIndex);
    const definition = (command.args || []).find((item) => item.name === name);
    if (!definition) throw new Error(`未知参数：--${name}`);
    let value = equalIndex === -1 ? undefined : token.slice(equalIndex + 1);
    if (definition.type === 'bool') {
      kwargs[name] = value === undefined ? true : !['false', '0', 'no'].includes(value.toLowerCase());
      continue;
    }
    if (value === undefined) value = argv[++index];
    if (value === undefined) throw new Error(`参数 --${name} 缺少值`);
    if (definition.type === 'int') {
      if (value === '') value = '';
      else if (!Number.isFinite(Number(value))) throw new Error(`参数 --${name} 必须是数字`);
      else value = Number(value);
    }
    kwargs[name] = value;
  }
  return { kwargs, format };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function outputRows(rows, command, format) {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  const columns = command.columns || (rows[0] ? Object.keys(rows[0]) : []);
  if (format === 'csv') {
    process.stdout.write(`${columns.map(csvCell).join(',')}\n`);
    for (const row of rows) process.stdout.write(`${columns.map((column) => csvCell(row[column])).join(',')}\n`);
    return;
  }
  process.stdout.write(`${columns.join('\t')}\n`);
  for (const row of rows) process.stdout.write(`${columns.map((column) => String(row[column] ?? '')).join('\t')}\n`);

  const footer = typeof command.footerExtra === "function"
    ? command.footerExtra()
    : command.footerExtra;
  if (footer) process.stdout.write(`${footer}\n`);
}

await loadCommands();
const [commandName, ...argv] = process.argv.slice(2);
if (commandName === '--version' || commandName === '-v') {
  process.stdout.write(`${readVersion()}\n`);
  process.exitCode = 0;
} else if (!commandName || commandName === '--help' || commandName === '-h') {
  printHelp();
  process.exitCode = 0;
} else {
  const tokens = [commandName, ...argv];
  const resolved = resolveCommand(tokens);
  if (resolved) {
    const { command, rest } = resolved;
    try {
      const parsed = parseArgs(command, rest);
      if (parsed.help) printCommandHelp(command);
      else {
        const rows = await command.func(parsed.kwargs);
        outputRows(rows, command, parsed.format);
      }
    } catch (error) {
      process.stderr.write(`${error.message || error}\n`);
      process.exitCode = 1;
    }
  } else if (getGroupCommands(commandName).length) {
    if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
      printGroupHelp(commandName);
      process.exitCode = 0;
    } else {
      process.stderr.write(`未知命令：${tokens.filter((token) => !token.startsWith('-')).join(' ')}\n\n`);
      printGroupHelp(commandName);
      process.exitCode = 2;
    }
  } else {
    process.stderr.write(`未知命令：${commandName}\n\n`);
    printHelp();
    process.exitCode = 2;
  }
}
