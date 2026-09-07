#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getRegistry } from '../opencli-registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

async function loadCommands() {
  const files = fs.readdirSync(root)
    .filter((name) => name.endsWith('.js') && name !== 'opencli-registry.js')
    .sort();
  for (const file of files) {
    await import(`${pathToFileURL(path.join(root, file)).href}?xbbCli`);
  }
}

function printHelp() {
  const commands = [...getRegistry().values()].sort((a, b) => a.name.localeCompare(b.name));
  process.stdout.write('Usage: xbbcli <command> [options]\n\nCommands:\n');
  for (const command of commands) {
    process.stdout.write(`  ${command.name.padEnd(34)} ${command.description || ''}\n`);
  }
}

function printCommandHelp(command) {
  process.stdout.write(`Usage: xbbcli ${command.name} [options]\n\n${command.description || ''}\n\nOptions:\n`);
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
}

await loadCommands();
const [commandName, ...argv] = process.argv.slice(2);
if (!commandName || commandName === '--help' || commandName === '-h') {
  printHelp();
  process.exitCode = 0;
} else {
  const command = getRegistry().get(`xbb/${commandName}`);
  if (!command) {
    process.stderr.write(`未知命令：${commandName}\n\n`);
    printHelp();
    process.exitCode = 2;
  } else {
    try {
      const parsed = parseArgs(command, argv);
      if (parsed.help) printCommandHelp(command);
      else {
        const rows = await command.func(parsed.kwargs);
        outputRows(rows, command, parsed.format);
      }
    } catch (error) {
      process.stderr.write(`${error.message || error}\n`);
      process.exitCode = 1;
    }
  }
}
