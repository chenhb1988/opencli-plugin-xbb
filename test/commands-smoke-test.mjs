import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 共享模块不注册命令，扫描命令文件时必须排除；新增共享模块时同步加入此列表
const AUXILIARY_FILES = new Set(['xbb-registry.js', 'xbb-config.js', 'xbb-browser.js', 'xbb-token-store.js', 'xbb-http.js']);
// 空参调用会产生真实副作用的命令：只验证注册与元数据，不调用 func({})。
// auth-login：会拉起真实浏览器并默认轮询等待 300s；
// auth-logout：当 XBB_* 环境变量存在时会对真实用户级环境变量执行清除（reg delete）。
const SKIP_EMPTY_INVOKE = new Set(['auth-login', 'auth-logout']);
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
    .filter((fileName) => fileName.endsWith('.js') && !AUXILIARY_FILES.has(fileName))
    .sort();
  const { getRegistry } = await import(pathToFileURL(path.join(repositoryRoot, 'xbb-registry.js')).href);
  const registry = getRegistry();
  const failures = [];
  let skipped = 0;

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

      const argNames = new Set(command.args.map((arg) => arg.name));

      // 规范：可选数值参数必须声明为 type:'str', default:''——
      // type:'int' 配空串默认值会被框架把「未提供」强转为 0 写入请求体
      for (const arg of command.args) {
        assert.ok(
          !(arg.type === 'int' && arg.default === ''),
          `${fileName}: optional numeric arg --${arg.name} must use type:'str', default:''`,
        );
      }

      // 规范：所有 list 命令必须提供 --raw 与 --debug
      if (command.name.endsWith('list')) {
        assert.ok(argNames.has('raw'), `${fileName}: list command must provide --raw`);
        assert.ok(argNames.has('debug'), `${fileName}: list command must provide --debug`);
      }

      if (SKIP_EMPTY_INVOKE.has(command.name)) {
        skipped += 1;
      } else {
        // 规范：无凭证空参调用必须返回非空数组（合成错误行），不抛异常、不发网络请求
        const rows = await command.func({});
        assert.ok(Array.isArray(rows), `${fileName} must return an array for empty input`);
        assert.ok(rows.length > 0, `${fileName} must return at least one row for empty input`);

        // 规范：输出行字段必须与 columns 完全一致（防止 makeErrorRow 与 columns 漂移）
        const columnKeys = new Set(command.columns);
        for (const row of rows) {
          const rowKeys = new Set(Object.keys(row));
          const missing = [...columnKeys].filter((key) => !rowKeys.has(key));
          const extra = [...rowKeys].filter((key) => !columnKeys.has(key));
          assert.ok(
            missing.length === 0 && extra.length === 0,
            `${fileName}: row keys must match columns (missing=[${missing.join(',')}] extra=[${extra.join(',')}])`,
          );
        }
      }
    } catch (error) {
      failures.push(`${fileName}: ${error.message}`);
    }
  }

  assert.equal(registry.size, commandFiles.length, 'every command file must have a unique registration');
  assert.equal(failures.length, 0, `Command smoke-test failures:\n${failures.join('\n')}`);

  console.log(`Validated ${commandFiles.length} xbb commands without network access (skipped empty invoke for ${skipped} side-effect commands). Standards enforced: list --raw/--debug, optional numeric args, empty-invoke rows match columns.`);
}

try {
  await main();
} finally {
  restoreEnvironment();
}
