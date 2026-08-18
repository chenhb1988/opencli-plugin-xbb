import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..');
const casesPath = path.join(testDirectory, 'add-api-cases.example.json');
const casesFile = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const files = new Set(fs.readdirSync(repositoryRoot));
const timestamp = Date.now();
const variables = {
  ...casesFile.variables,
  userId: process.env.XBB_TEST_USER_ID || casesFile.variables?.userId || '',
};

function interpolate(value) {
  if (value === '${timestampSeconds}') return Math.floor(timestamp / 1000);
  if (value === '${timestampSecondsPlusDay}') return Math.floor(timestamp / 1000) + 86400;
  if (typeof value === 'string') {
    if (value === '${timestamp}') return String(timestamp);
    const variableName = value.match(/^\$\{([^}]+)\}$/)?.[1];
    if (variableName && Object.hasOwn(variables, variableName)) return variables[variableName];
    return value.replaceAll('${timestamp}', String(timestamp)).replace(/\$\{([^}]+)\}/g, (placeholder, variableName) => (
      Object.hasOwn(variables, variableName) ? String(variables[variableName]) : placeholder
    ));
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item)]));
  return value;
}

assert.ok(Array.isArray(casesFile.cases) && casesFile.cases.length > 0);
const requestedCases = casesFile.cases.filter((testCase) => testCase.enable !== false);
const requestedCommands = new Set(requestedCases.map((testCase) => testCase.command));
const cases = requestedCases.filter((testCase) => !testCase.from || requestedCommands.has(testCase.from));
const cleanupCases = (casesFile.cleanupCases || []).filter((cleanupCase) => (
  cases.some((testCase) => testCase.command === cleanupCase.from)
));
const commands = new Set(cases.map((testCase) => testCase.command));
for (const testCase of cases) {
  assert.ok(files.has(`${testCase.command}.js`), `${testCase.command}.js is missing`);
  assert.match(testCase.command, /add/);
  const resolved = interpolate(testCase);
  if (resolved.from) assert.ok(commands.has(resolved.from), `${resolved.command} references unknown ${resolved.from}`);
  if (resolved.dataList) assert.equal(typeof resolved.dataList, 'object');
  if (resolved.formId) assert.equal(Number.isInteger(resolved.formId), true);
}
for (const cleanupCase of cleanupCases) {
  assert.ok(files.has(`${cleanupCase.command}.js`), `${cleanupCase.command}.js is missing`);
  assert.ok(commands.has(cleanupCase.from), `${cleanupCase.command} references unknown ${cleanupCase.from}`);
}

async function loadCommand(commandName) {
  const filePath = path.join(repositoryRoot, `${commandName}.js`);
  const { getRegistry } = await import(pathToFileURL(path.join(repositoryRoot, 'opencli-registry.js')).href);
  await import(`${pathToFileURL(filePath).href}?addApiTest=${Date.now()}-${commandName}`);
  const command = getRegistry().get(`xbb/${commandName}`);
  assert.ok(command, `Command was not registered: xbb/${commandName}`);
  return command;
}

function getResultDataId(rows) {
  const row = rows.find((item) => String(item?.dataId ?? '').trim() !== '');
  return row?.dataId || '';
}

function formatCommand(commandName, args) {
  const parts = ['opencli', 'xbb', commandName];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === false || value === '') continue;
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    parts.push(`--${key}`, JSON.stringify(text));
  }
  return parts.join(' ');
}

function getCommandArgs(testCase) {
  const args = { ...interpolate(testCase) };
  if (Object.hasOwn(args, 'testName')) delete args.testName;
  else delete args.name;
  delete args.command;
  delete args.from;
  delete args.enable;
  return args;
}

function printCommands() {
  for (const testCase of cases) {
    console.log(formatCommand(testCase.command, getCommandArgs(testCase)));
  }
  for (const cleanupCase of cleanupCases) {
    console.log(formatCommand(cleanupCase.command, { dataId: `<dataId from ${cleanupCase.from}>` }));
  }
}

async function executeCases() {
  const createdIds = new Map();
  for (const originalCase of cases) {
    const testCase = interpolate(originalCase);
    const args = { ...testCase };
    if (Object.hasOwn(args, 'testName')) delete args.testName;
    else delete args.name;
    delete args.command;
    delete args.from;
    delete args.enable;
    if (testCase.from) {
      const dataId = createdIds.get(testCase.from);
      assert.ok(dataId, `${testCase.command} requires a dataId from ${testCase.from}`);
      if (testCase.command.startsWith('customer-invoice-')) args.customerId = dataId;
      else args.dataId = dataId;
    }
    const command = await loadCommand(testCase.command);
    const rows = await command.func(args);
    const error = rows.find((row) => String(row?.code ?? '').trim() && String(row.code) !== '1');
    assert.ok(!error, `${testCase.command} failed: ${JSON.stringify(rows)}\nCommand: ${formatCommand(testCase.command, args)}`);
    const dataId = getResultDataId(rows);
    if (dataId) createdIds.set(testCase.command, dataId);
    console.log(`PASS ${testCase.command}${dataId ? ` dataId=${dataId}` : ''}`);
  }

  for (const cleanupCase of cleanupCases) {
    const dataId = createdIds.get(cleanupCase.from);
    if (!dataId) {
      console.log(`SKIP ${cleanupCase.command}: no dataId from ${cleanupCase.from}`);
      continue;
    }
    const command = await loadCommand(cleanupCase.command);
    const args = { dataId };
    const rows = await command.func(args);
    const error = rows.find((row) => String(row?.code ?? '').trim() && String(row.code) !== '1');
    assert.ok(!error, `${cleanupCase.command} failed: ${JSON.stringify(rows)}\nCommand: ${formatCommand(cleanupCase.command, args)}`);
    console.log(`PASS ${cleanupCase.command} dataId=${dataId}`);
  }
}

if (process.argv.includes('--print-commands')) printCommands();
else if (process.argv.includes('--execute')) await executeCases();
else console.log(`Validated ${cases.length} enabled add and ${cleanupCases.length} enabled cleanup API test cases (dry-run). Use --execute only after reviewing write data.`);
