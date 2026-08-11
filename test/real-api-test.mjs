import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..');
const defaultCasesFile = path.join(testDirectory, 'real-api-cases.json');
const commandNamePattern = /(?:list|detail|get)$/;
const detailCommandsByListCommand = new Map([
  ['customer-list', ['customer-detail']],
  ['clue-list', ['clue-detail']],
  ['communicate-list', ['communicate-detail']],
  ['communicate-plan-list', ['communicate-plan-detail']],
  ['contact-list', ['contact-detail']],
  ['contract-list', ['contract-detail']],
  ['contract-outstock-list', ['contract-outstock-detail']],
  ['form-data-list', ['form-data-detail']],
  ['market-activity-list', ['market-activity-detail']],
  ['opportunity-list', ['opportunity-detail']],
  ['payment-list', ['payment-detail']],
  ['payment-sheet-list', ['payment-sheet-detail', 'payment-sheet-get-amount-detail']],
  ['pay-sheet-list', ['pay-sheet-detail', 'pay-sheet-get-amount-detail']],
  ['product-list', ['product-detail']],
  ['refund-list', ['refund-detail']],
  ['work-order-list', ['work-order-detail']],
  ['workorderlist', ['work-order-detail']],
  ['work-report-daily-list', ['work-report-daily-detail']],
  ['work-report-monthly-list', ['work-report-monthly-detail']],
  ['work-report-weekly-list', ['work-report-weekly-detail']],
  ['worktimerecordlist', ['worktimerecorddetail']],
]);

function getCasesFilePath() {
  const argumentIndex = process.argv.indexOf('--cases');
  if (argumentIndex === -1) return defaultCasesFile;

  const providedPath = process.argv[argumentIndex + 1];
  if (!providedPath) throw new Error('Missing path after --cases');
  return path.resolve(process.cwd(), providedPath);
}

function readCases(casesFile) {
  if (!fs.existsSync(casesFile)) {
    throw new Error(`Cases file not found: ${casesFile}\nCopy test/real-api-cases.example.json to test/real-api-cases.json, then fill in real IDs and parameters.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse cases file ${casesFile}: ${error.message}`);
  }

  assert.ok(Array.isArray(parsed.cases), 'Cases file must contain a cases array');
  assert.ok(parsed.cases.length > 0, 'Cases file must contain at least one case');
  return parsed.cases;
}

function validateCase(testCase, index) {
  const label = `Case ${index + 1}`;
  assert.equal(typeof testCase, 'object', `${label} must be an object`);
  assert.equal(typeof testCase.command, 'string', `${label} must provide command`);
  assert.match(testCase.command, commandNamePattern, `${label} only permits list, detail, or get commands`);
  assert.ok(testCase.args && typeof testCase.args === 'object' && !Array.isArray(testCase.args), `${label} must provide an args object`);
  if (testCase.expect !== undefined) assert.ok(typeof testCase.expect === 'object' && !Array.isArray(testCase.expect), `${label}.expect must be an object`);
}

function isErrorRow(row) {
  const code = String(row?.code ?? '').trim();
  return code !== '' && code !== '1';
}

function assertResult(testCase, rows) {
  const expect = testCase.expect || {};
  const minRows = expect.minRows ?? 1;
  assert.ok(Array.isArray(rows), `${testCase.command} must return an array`);
  assert.ok(rows.length >= minRows, `${testCase.command} returned ${rows.length} rows; expected at least ${minRows}`);
  if (expect.success !== false) {
    assert.ok(
      rows.some((row) => !isErrorRow(row)),
      `${testCase.command} only returned error rows: ${JSON.stringify(rows)}`,
    );
  }
}

async function loadCommand(commandName) {
  const filePath = path.join(repositoryRoot, `${commandName}.js`);
  assert.ok(fs.existsSync(filePath), `Command file not found: ${commandName}.js`);

  const { getRegistry } = await import(pathToFileURL(path.join(repositoryRoot, 'opencli-registry.js')).href);
  await import(`${pathToFileURL(filePath).href}?realApiTest=${Date.now()}`);
  const command = getRegistry().get(`xbb/${commandName}`);
  assert.ok(command, `Command was not registered: xbb/${commandName}`);
  assert.equal(command.access, 'read', `${commandName} is not a read-only command`);
  return command;
}

function getFirstDataId(rows) {
  const row = rows.find((item) => !isErrorRow(item) && String(item?.dataId ?? '').trim() !== '');
  return row ? Number(row.dataId) : 0;
}

async function syncDetailDataIds(cases, casesFile) {
  const casesByCommand = new Map(cases.map((testCase) => [testCase.command, testCase]));
  let updated = 0;

  for (const [listCommand, detailCommands] of detailCommandsByListCommand) {
    const listCase = casesByCommand.get(listCommand);
    if (!listCase) continue;

    process.stdout.write(`Loading dataId from xbb ${listCommand}...\n`);
    try {
      const command = await loadCommand(listCommand);
      const rows = await command.func(listCase.args);
      assertResult(listCase, rows);
      const dataId = getFirstDataId(rows);
      assert.ok(dataId, `${listCommand} did not return a usable dataId`);

      for (const detailCommand of detailCommands) {
        const detailCase = casesByCommand.get(detailCommand);
        if (!detailCase) continue;
        detailCase.args.dataId = dataId;
        updated += 1;
        process.stdout.write(`  ${detailCommand}.args.dataId = ${dataId}\n`);
      }
    } catch (error) {
      process.stderr.write(`SKIP ${listCommand}: ${error.message}\n`);
    }
  }

  fs.writeFileSync(casesFile, `${JSON.stringify({ cases }, null, 2)}\n`);
  process.stdout.write(`Updated ${updated} detail case dataId values in ${casesFile}.\n`);
}

async function main() {
  const casesFile = getCasesFilePath();
  const cases = readCases(casesFile);
  if (process.argv.includes('--sync-details')) {
    await syncDetailDataIds(cases, casesFile);
    return;
  }
  let passed = 0;
  const failures = [];

  for (const [index, testCase] of cases.entries()) {
    validateCase(testCase, index);
    if (testCase.enabled === false) {
      process.stdout.write(`SKIP ${testCase.name || testCase.command} (disabled)\n`);
      continue;
    }
    const command = await loadCommand(testCase.command);
    const label = testCase.name || testCase.command;
    process.stdout.write(`Running ${label} (xbb ${testCase.command})...\n`);

    try {
      const rows = await command.func(testCase.args);
      assertResult(testCase, rows);
      process.stdout.write(`PASS ${label}\n`);
      passed += 1;
    } catch (error) {
      failures.push({ label, command: testCase.command, message: error.message });
    }
  }

  const enabledCases = cases.filter((testCase) => testCase.enabled !== false).length;
  if (failures.length > 0) {
    process.stderr.write(`\nFailed ${failures.length}/${enabledCases} enabled real API cases:\n`);
    for (const failure of failures) {
      process.stderr.write(`- ${failure.label} (xbb ${failure.command}): ${failure.message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Passed ${passed} enabled real API cases; skipped ${cases.length - enabledCases}.\n`);
}

await main();
