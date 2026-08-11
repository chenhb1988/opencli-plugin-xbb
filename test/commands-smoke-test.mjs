import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xbb-command-test-'));
const originalUserProfile = process.env.USERPROFILE;
const originalHome = process.env.HOME;
const originalFetch = globalThis.fetch;

process.env.USERPROFILE = temporaryHome;
process.env.HOME = temporaryHome;
globalThis.fetch = async (url) => {
  throw new Error(`Unexpected network request during smoke test: ${url}`);
};

function restoreEnvironment() {
  if (originalUserProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = originalUserProfile;
  }

  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }

  globalThis.fetch = originalFetch;
  fs.rmSync(temporaryHome, { recursive: true, force: true });
}

async function main() {
  const commandFiles = fs.readdirSync(repositoryRoot)
    .filter((fileName) => fileName.endsWith('.js') && fileName !== 'opencli-registry.js')
    .sort();
  const { getRegistry } = await import(pathToFileURL(path.join(repositoryRoot, 'opencli-registry.js')).href);
  const registry = getRegistry();
  const failures = [];

  for (const fileName of commandFiles) {
    const registrySizeBeforeImport = registry.size;
    try {
      await import(`${pathToFileURL(path.join(repositoryRoot, fileName)).href}?smokeTest`);
      assert.equal(
        registry.size,
        registrySizeBeforeImport + 1,
        `${fileName} must register exactly one unique command`,
      );

      const command = [...registry.values()].at(-1);
      assert.equal(command.site, 'xbb', `${fileName} must use the xbb site`);
      assert.equal(command.browser, false, `${fileName} must be a non-browser command`);
      assert.ok(Array.isArray(command.args), `${fileName} must declare args`);
      assert.ok(Array.isArray(command.columns), `${fileName} must declare columns`);

      const rows = await command.func({});
      assert.ok(Array.isArray(rows), `${fileName} must return an array for empty input`);
    } catch (error) {
      failures.push(`${fileName}: ${error.message}`);
    }
  }

  assert.equal(registry.size, commandFiles.length, 'every command file must have a unique registration');
  assert.equal(failures.length, 0, `Command smoke-test failures:\n${failures.join('\n')}`);

  const versionCommand = registry.get('xbb/version');
  assert.ok(versionCommand, 'version command must be registered');
  assert.deepEqual(await versionCommand.func({}), [{ version: 'v1.3' }]);

  console.log(`Validated ${commandFiles.length} xbb commands without network access.`);
}

try {
  await main();
} finally {
  restoreEnvironment();
}
