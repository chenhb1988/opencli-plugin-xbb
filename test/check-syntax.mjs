import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 离线语法检查：对顶层命令文件、bin 与 test 脚本逐个执行 node --check。
// 与 commands-smoke-test.mjs 互补：本脚本只解析不执行，可覆盖 bin/ 与 test/ 脚本。
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectFiles(directory, extension) {
  return fs.readdirSync(directory)
    .filter((fileName) => fileName.endsWith(extension))
    .map((fileName) => path.join(directory, fileName));
}

const targets = [
  ...collectFiles(repositoryRoot, '.js'),
  ...collectFiles(path.join(repositoryRoot, 'bin'), '.js'),
  ...collectFiles(path.join(repositoryRoot, 'test'), '.mjs'),
].sort();

const failures = [];
for (const target of targets) {
  const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    failures.push(`${path.relative(repositoryRoot, target)}\n${String(result.stderr || '').trim()}`);
  }
}

if (failures.length) {
  console.error(`Syntax check failed for ${failures.length}/${targets.length} files:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Syntax check passed for ${targets.length} files (node --check).`);
