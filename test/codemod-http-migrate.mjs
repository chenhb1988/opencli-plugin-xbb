import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Codemod: migrate xbb command files to the shared HTTP layer (xbb-http.js).
// Kept in test/ so each migration batch can reuse it.
//
// Usage:
//   node test/codemod-http-migrate.mjs --list                       # print batch classification
//   node test/codemod-http-migrate.mjs --dry-run                    # simulate all candidates, print report
//   node test/codemod-http-migrate.mjs --dry-run --files a.js,b.js  # show diff for specific files
//   node test/codemod-http-migrate.mjs --batch 1 --apply            # apply batch 1 to disk
//   node test/codemod-http-migrate.mjs --files a.js --apply         # apply specific files
//
// Design notes:
// - Locates a stable anchor pair (the `const sign = ...` line and the `if (data.code !== 1)`
//   block) and replaces the whole skeleton block between them with a requestGateway call.
// - Every line inside the replaced block must match a known skeleton pattern; otherwise the
//   file is reported as failed and left untouched for manual handling.
// - All replacements are guarded by per-file assertions; --apply aborts if any file fails.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHARED_MODULES = new Set([
  'xbb-registry.js', 'xbb-config.js', 'xbb-browser.js', 'xbb-token-store.js', 'xbb-http.js',
]);

// Commands that must not use this codemod.
const NON_MIGRATABLE = new Set([
  'auth-login.js', 'auth-logout.js', 'auth-refresh-cache.js', 'auth-status.js',
  'token-set.js', 'token-list.js', 'token-use.js', 'token-del.js',
  // token-generate.js uses a try-block plus a 4-arg makeErrorRow; migrate manually.
  'token-generate.js',
]);

const KNOWN_BLOCK_PATTERNS = [
  /^[ \t]*const sign = crypto\.createHash\('sha256'\)\.update\((?:body|requestBody) \+ token\)\.digest\('hex'\);$/,
  /^[ \t]*const headers = Object\.assign\(\{ 'Content-Type': 'application\/json;charset=UTF-8', sign \}, (?:userId|runtimeUserId|payload\.userId) \? \{ userId(?:: (?:userId|runtimeUserId|payload\.userId))? \} : \{\}\);$/,
  /^[ \t]*const headers = \{ 'Content-Type': 'application\/json;charset=UTF-8', sign(?:, userId: (?:userId|runtimeUserId|payload\.userId))? \};?$/,
  /^[ \t]*const headers = Object\.assign\(\{$/,
  /^[ \t]*const headers = \{$/,
  /^[ \t]*'Content-Type': 'application\/json;charset=UTF-8',$/,
  /^[ \t]*sign,$/,
  /^[ \t]*userId: (?:userId|runtimeUserId|payload\.userId),$/,
  /^[ \t]*if \((?:userId|runtimeUserId)\) headers\.userId = (?:userId|runtimeUserId);$/,
  /^[ \t]*(?:\}, )?(?:userId|runtimeUserId|payload\.userId) \? \{ userId(?:: (?:userId|runtimeUserId|payload\.userId))? \} : \{\}\);?$/,
  /^[ \t]*\};$/,
  /^[ \t]*const apiUrl = buildApiUrl\(baseUrl(?:, [A-Za-z0-9_]+)?\);$/,
  /^[ \t]*if \(debug\) \{$/,
  /^[ \t]*process\.stderr\.write\(`\[debug\] URL: /,
  /^[ \t]*if \(debug\) process\.stderr\.write\(`\[debug\] URL: /,
  /^[ \t]*\}$/,
  /^[ \t]*const resp = await fetch\([^\n]+\{[^\n]*\}\);$/,
  /^[ \t]*const resp = await fetch\((?:apiUrl|buildApiUrl\(baseUrl, [A-Za-z0-9_]+\)|buildApiUrl\(baseUrl\)), \{$/,
  /^[ \t]*method: 'POST',$/,
  /^[ \t]*headers,$/,
  /^[ \t]*body:? ?(?:body|requestBody)?,?$/,
  /^[ \t]*\}\);$/,
  /^[ \t]*\);\s*$/,
  /^[ \t]*if \(!resp\.ok\) \{$/,
  /^[ \t]*if \(!resp\.ok\) return makeErrorRow\(resp\.status, `HTTP \$\{resp\.status\} \$\{resp\.statusText\}`\);$/,
  /^[ \t]*const (?:responseText|errText) = await resp\.text\(\);$/,
  /^[ \t]*if \(debug\) process\.stderr\.write\(`\[debug\] ResponseBody: \$\{(?:responseText|errText)\}/,
  /^[ \t]*return makeErrorRow\(resp\.status, `HTTP \$\{resp\.status\} \$\{resp\.statusText\}`\);$/,
  /^[ \t]*const data = await resp\.json\(\);$/,
  /^[ \t]*lastPagination = data\?\.code === 1 && /,
  /^[ \t]*\? \{ totalCount: /,
  /^[ \t]*: null;$/,
  /^[ \t]*const responseBody = JSON\.stringify\(data\);$/,
  /^[ \t]*if \(debug\) process\.stderr\.write\(`\[debug\] ResponseBody: \$\{responseBody\}/,
  /^[ \t]*if \(kwargs\.raw\) return \[\{ raw: responseBody \}\];$/,
  /^[ \t]*if \(kwargs\.raw\) \{$/,
  /^[ \t]*return \[\{ raw: responseBody \}\];$/,
  /^[ \t]*if \(data\.code !== 1\) \{$/,
  /^[ \t]*return makeErrorRow\(data\.code \?\? '', data\.msg \?\? '未知错误'\);$/,
  /^[ \t]*if \(data\.code !== 1\) return makeErrorRow\(data\.code \?\? '', data\.msg \?\? '未知错误'\);$/,
  /^[ \t]*$/,
];

const CODE_CHECK_FORMS = [
  "if (data.code !== 1) { return makeErrorRow(data.code ?? '', data.msg ?? '未知错误'); }",
  "if (data.code !== 1) return makeErrorRow(data.code ?? '', data.msg ?? '未知错误');",
];

function findFunctionRange(lines, headerRe) {
  const start = lines.findIndex((l) => headerRe.test(l));
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
    if (depth === 0) return { start, end: i };
  }
  return null;
}

function transform(src) {
  const fail = (reason) => ({ status: 'fail', reason });
  const notes = [];
  const hadCRLF = src.includes('\r\n');
  let out = src.replace(/\r\n/g, '\n');
  if (out.includes('\r')) return fail('mixed line endings');

  if (out.includes("from './xbb-http.js'")) return { status: 'skip', reason: 'already migrated' };
  if (!out.includes("createHash('sha256')")) return { status: 'skip', reason: 'no sha256 skeleton' };

  if (/(?<![.\w$])gateway\b/.test(out)) return fail('gateway identifier already used');

  const hasPagination = out.includes('let lastPagination = null;');

  // pass 1: imports
  if (!out.includes("import { readActiveConfig } from './xbb-config.js';")) {
    return fail('xbb-config import missing');
  }
  for (const mod of ['crypto', 'fs', 'os', 'path']) {
    out = out.replace(new RegExp(`^import ${mod} from 'node:${mod}';\\n`, 'm'), '');
  }
  out = out.replace(
    "import { readActiveConfig } from './xbb-config.js';",
    hasPagination
      ? "import { getRuntimeConfig, requestGateway, createPagination } from './xbb-http.js';"
      : "import { getRuntimeConfig, requestGateway } from './xbb-http.js';",
  );

  // pass 2: config constants
  for (const name of ['CONFIG_FILE', 'CONFIG_DIR', 'DEFAULT_BASE_URL']) {
    const re = new RegExp(`^const ${name} = [^\\n]*;\\n`, 'm');
    if (re.test(out)) out = out.replace(re, '');
  }

  // pass 3: remove boilerplate functions (bottom-up, eating one preceding blank line)
  // Must run before the API constant scan: function signatures such as
  // `function buildApiUrl(baseUrl, apiUrl)` would otherwise look like call sites.
  {
    const lines = out.split('\n');
    const ranges = [];
    for (const re of [/^function readConfig\(\)/, /^function getRuntimeConfig\(\)/, /^function buildApiUrl\(/]) {
      const r = findFunctionRange(lines, re);
      if (!r) return fail(`boilerplate function not found: ${String(re)}`);
      ranges.push(r);
    }
    for (const r of ranges.sort((a, b) => b.start - a.start)) {
      let start = r.start;
      if (start > 0 && lines[start - 1].trim() === '') start -= 1;
      lines.splice(start, r.end - start + 1);
    }
    out = lines.join('\n');
  }

  // pass 4: API constant -> path form
  const callNames = new Set();
  for (const m of out.matchAll(/buildApiUrl\(\s*baseUrl\s*(?:,\s*([A-Za-z0-9_]+)\s*)?\)/g)) {
    if (m[1]) callNames.add(m[1]);
  }
  let apiConstName;
  if (callNames.size > 1) return fail(`multiple api consts: ${[...callNames].join(',')}`);
  if (callNames.size === 1) {
    apiConstName = [...callNames][0];
    const defRe = new RegExp(`^const ${apiConstName} = '([^']+)';\\n`, 'm');
    const def = out.match(defRe);
    if (!def) return fail(`api const def missing: ${apiConstName}`);
    const value = def[1];
    if (!value.startsWith('https://')) return fail(`api const not a full url: ${value}`);
    let pathValue;
    try {
      pathValue = new URL(value).pathname;
    } catch {
      return fail(`invalid api url: ${value}`);
    }
    const newName = apiConstName.replace(/API_URL$/, 'API_PATH');
    if (newName === apiConstName) return fail(`unexpected api const name: ${apiConstName}`);
    if (new RegExp(`\\b${newName}\\b`).test(out)) return fail(`new name collision: ${newName}`);
    out = out.replace(defRe, `const ${newName} = '${pathValue}';\n`);
    out = out.replace(new RegExp(`\\b${apiConstName}\\b`, 'g'), newName);
    apiConstName = newName;
  } else {
    const pathDef = out.match(/^const ([A-Za-z0-9_]+_API_PATH) = '([^']+)';$/m);
    if (!pathDef) return fail('path-style api const not found');
    apiConstName = pathDef[1];
    notes.push(`reused existing const ${apiConstName}`);
  }

  // pass 5: footerExtra + pagination state
  if (hasPagination) {
    const stdFooter = 'footerExtra: () => (lastPagination ? `totalCount ${lastPagination.totalCount} / totalPage ${lastPagination.totalPage}` : undefined),';
    const cntFooter = 'footerExtra: () => (lastPagination ? `totalCount ${lastPagination.totalCount}` : undefined),';
    let init;
    if (out.includes(stdFooter)) {
      out = out.replace(stdFooter, 'footerExtra: pagination.footerExtra,');
      init = 'const pagination = createPagination();';
    } else if (out.includes(cntFooter)) {
      out = out.replace(cntFooter, 'footerExtra: pagination.footerExtra,');
      init = 'const pagination = createPagination({ countOnly: true });';
      notes.push('countOnly pagination');
    } else {
      return fail('footerExtra line not matched');
    }
    out = out.replace('let lastPagination = null;', init);
  }

  // pass 6: remove payload body declaration
  {
    const bodyCount = (out.match(/^[ \t]*const (?:body|requestBody) = JSON\.stringify\(payload\);/gm) || []).length;
    if (bodyCount !== 1) return fail(`body declaration count=${bodyCount}`);
    out = out.replace(/^[ \t]*const (?:body|requestBody) = JSON\.stringify\(payload\);\n/m, '');
  }

  // pass 7: replace skeleton block with requestGateway call
  let mapStartLine = 0;
  {
    let lines = out.split('\n');
    let iSign = lines.findIndex((l) => /^[ \t]*const sign = crypto\.createHash\('sha256'\)/.test(l));
    if (iSign < 0) return fail('sign line not found');

    // Some files declare `const apiUrl = buildApiUrl(...)` above the sign line
    // instead of inside the skeleton; the gateway call replaces it.
    for (let i = iSign - 1; i >= 0; i -= 1) {
      if (/^[ \t]*const apiUrl = buildApiUrl\(baseUrl(?:, [A-Za-z0-9_]+)?\);$/.test(lines[i])) {
        lines.splice(i, 1);
        iSign -= 1;
      }
    }

    if (!/\.update\((?:body|requestBody) \+ token\)/.test(lines[iSign])) return fail('sign line body var unexpected');

    let iCode = -1;
    for (let i = iSign + 1; i < lines.length; i += 1) {
      if (/^[ \t]*if \(data\.code !== 1\)/.test(lines[i])) {
        iCode = i;
        break;
      }
    }
    if (iCode < 0) return fail('code check not found after sign');

    let iEnd = iCode;
    if (lines[iCode].trimEnd().endsWith('{')) {
      let depth = 0;
      let closed = false;
      for (let i = iCode; i < lines.length; i += 1) {
        for (const ch of lines[i]) {
          if (ch === '{') depth += 1;
          else if (ch === '}') depth -= 1;
        }
        if (depth === 0) {
          iEnd = i;
          closed = true;
          break;
        }
      }
      if (!closed) return fail('code check block braces unbalanced');
    }

    const blockLines = lines.slice(iSign, iEnd + 1);
    const blockText = blockLines.join('\n');
    const unknown = [];
    for (const l of blockLines) {
      if (!KNOWN_BLOCK_PATTERNS.some((re) => re.test(l))) unknown.push(l.trim());
    }
    if (unknown.length) {
      return fail(`unknown lines in skeleton block: ${unknown.slice(0, 3).join(' || ')}`);
    }

    const checkText = lines.slice(iCode, iEnd + 1).join(' ').replace(/\s+/g, ' ').trim();
    if (!CODE_CHECK_FORMS.includes(checkText)) {
      return fail(`code check block shape: ${checkText.slice(0, 90)}`);
    }

    let userExpr = 'userId';
    if (/userId: payload\.userId/.test(blockText) || /headers\.userId = payload\.userId/.test(blockText)) {
      userExpr = 'payload.userId';
    } else if (/userId: runtimeUserId/.test(blockText) || /headers\.userId = runtimeUserId/.test(blockText)) {
      userExpr = 'runtimeUserId';
    }
    const blockHasRaw = /kwargs\.raw/.test(blockText);
    const blockHasPagination = /lastPagination = data/.test(blockText);
    if (blockHasPagination !== hasPagination) return fail('pagination flag mismatch');
    notes.push(`userId: ${userExpr}`);

    const indent = lines[iSign].match(/^[ \t]*/)[0];
    const inner = `${indent}  `;
    const userLine = userExpr === 'userId' ? `${inner}userId,` : `${inner}userId: ${userExpr},`;
    const newBlock = [
      `${indent}const gateway = await requestGateway({`,
      `${inner}baseUrl,`,
      `${inner}apiPath: ${apiConstName},`,
      `${inner}payload,`,
      `${inner}token,`,
      userLine,
      `${inner}debug,`,
      `${indent}});`,
      `${indent}if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);`,
    ];
    if (blockHasPagination) newBlock.push(`${indent}pagination.update(gateway.data);`);
    if (blockHasRaw) newBlock.push(`${indent}if (kwargs.raw) return [{ raw: gateway.responseBody }];`);
    newBlock.push(`${indent}if (gateway.data.code !== 1) {`);
    newBlock.push(`${inner}return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');`);
    newBlock.push(`${indent}}`);

    lines = [...lines.slice(0, iSign), ...newBlock, ...lines.slice(iEnd + 1)];
    mapStartLine = iSign + newBlock.length;
    out = lines.join('\n');
  }

  // pass 8: rewrite remaining response references — only inside the func
  // mapping area (mapStartLine onward). Top-level helper functions above it
  // keep their own `data` parameter (e.g. `function makeSuccessRow(data)`),
  // so a whole-file rewrite would corrupt their bodies with `gateway.data.`.
  {
    const memberLines = out.split('\n');
    for (let i = mapStartLine; i < memberLines.length; i += 1) {
      memberLines[i] = memberLines[i].replace(/(?<![\w.$])data\?\./g, 'gateway.data?.');
      memberLines[i] = memberLines[i].replace(/(?<![\w.$])data\./g, 'gateway.data.');
    }
    out = memberLines.join('\n');
  }

  // Mapping-area bare `data` references (makeSuccessRow(data), ...) also refer
  // to the response object; rewrite them. Object keys (`data:`) and quoted
  // strings ('data') are not references, and helper-function parameters
  // (fieldValue(data), ...) live above the mapping area and stay untouched.
  {
    const mapLines = out.split('\n');
    const mapText = mapLines.slice(mapStartLine).join('\n');
    if (/\{\s*data\s*\}|,\s*data\s*\}/.test(mapText)) {
      return fail('object shorthand { data } needs manual handling');
    }
    const rewriteData = (line) => line.replace(/(?<![\w.$])data(?![\w$])/g, (match, offset) => {
      const before = offset === 0 ? '' : line[offset - 1];
      const after = line.slice(offset + match.length);
      if (after.startsWith('.')) return match;
      if (after.startsWith(':') || after.startsWith("'") || after.startsWith('"') || after.startsWith('`')) return match;
      if (before === "'" || before === '"' || before === '`') return match;
      return 'gateway.data';
    });
    for (let i = mapStartLine; i < mapLines.length; i += 1) {
      if (/(?<![\w.$])data(?![\w$])/.test(mapLines[i])) mapLines[i] = rewriteData(mapLines[i]);
    }
    out = mapLines.join('\n');
  }

  const bareHits = [];
  for (const l of out.split('\n').slice(mapStartLine)) {
    for (const m of l.matchAll(/(?<![\w.$])data(?![\w$])/g)) {
      const before = m.index === 0 ? '' : l[m.index - 1];
      const after = l.slice(m.index + 4);
      if (after.startsWith('.') || after.startsWith('?.')) continue;
      if (after.startsWith(':') || after.startsWith("'") || after.startsWith('"') || after.startsWith('`')) continue;
      if (before === "'" || before === '"' || before === '`') continue;
      bareHits.push(l.trim());
    }
  }
  if (bareHits.length) return fail(`bare data reference: ${bareHits.slice(0, 3).join(' || ')}`);

  // pass 9: final assertions
  // The data-reference checks are scoped to the mapping area: top-level
  // helpers (makeSuccessRow(data), ...) legitimately keep `data.` access.
  const mapOut = out.split('\n').slice(mapStartLine).join('\n');
  const checks = [
    [!/\bcrypto\./.test(out), 'crypto usage residual'],
    [!/\bfs\.|\bos\.|\bpath\./.test(out), 'fs/os/path usage residual'],
    [!/createHash\('sha256'\)/.test(out), 'createHash residual'],
    [!/await fetch\(/.test(out), 'direct fetch residual'],
    [!/readActiveConfig/.test(out), 'readActiveConfig residual'],
    [!/buildApiUrl\(/.test(out), 'buildApiUrl call residual'],
    [!/function buildApiUrl/.test(out), 'buildApiUrl definition residual'],
    [!/function readConfig\(/.test(out), 'readConfig definition residual'],
    [!/function getRuntimeConfig\(/.test(out), 'getRuntimeConfig definition residual'],
    [!/\blastPagination\b/.test(out), 'lastPagination residual'],
    [!/\bCONFIG_(?:DIR|FILE)\b/.test(out), 'CONFIG residual'],
    [!/\bDEFAULT_BASE_URL\b/.test(out), 'DEFAULT_BASE_URL residual'],
    [!/https:\/\/proapi\./.test(out), 'full api url residual'],
    [!/^import (?:crypto|fs|os|path) from /m.test(out), 'builtin import residual'],
    [!/const (?:body|requestBody) = JSON\.stringify\(payload\)/.test(out), 'body declaration residual'],
    [out.includes('requestGateway'), 'requestGateway missing'],
    [out.includes("from './xbb-http.js'"), 'xbb-http import missing'],
    [!(/(?<![\w.$])data\?\./).test(mapOut), 'data?. reference residual'],
    [!(/(?<![\w.$])data\./).test(mapOut), 'data. reference residual'],
  ];
  if (hasPagination) {
    checks.push([out.includes('pagination.update(gateway.data);'), 'pagination.update missing']);
    checks.push([out.includes('footerExtra: pagination.footerExtra,'), 'footerExtra missing']);
    checks.push([out.includes('createPagination'), 'createPagination missing']);
  }
  const failedCheck = checks.find(([ok]) => !ok);
  if (failedCheck) return fail(`assertion: ${failedCheck[1]}`);

  if (hadCRLF) out = out.replace(/\n/g, '\r\n');
  return { status: 'ok', out, notes };
}

function listCandidates() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.js') && !SHARED_MODULES.has(f) && !NON_MIGRATABLE.has(f))
    .sort();
}

function classify(src) {
  const hasPagination = src.includes('let lastPagination = null;');
  const access = (src.match(/access: '(read|write)'/) || [])[1];
  if (hasPagination && access !== 'write') return 1;
  if (access === 'write') return 3;
  return 2;
}

function printDiff(before, after, label) {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push([' ', a[i]]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push(['-', a[i]]);
      i += 1;
    } else {
      ops.push(['+', b[j]]);
      j += 1;
    }
  }
  while (i < n) {
    ops.push(['-', a[i]]);
    i += 1;
  }
  while (j < m) {
    ops.push(['+', b[j]]);
    j += 1;
  }
  const keep = new Array(ops.length).fill(false);
  ops.forEach(([t], idx) => {
    if (t !== ' ') {
      for (let k = Math.max(0, idx - 2); k <= Math.min(ops.length - 1, idx + 2); k += 1) keep[k] = true;
    }
  });
  console.log(`\n==== ${label} ====`);
  let last = -2;
  ops.forEach(([t, line], idx) => {
    if (!keep[idx]) return;
    if (idx - last > 1) console.log('  ...');
    console.log(`${t} ${line}`);
    last = idx;
  });
}

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const apply = has('--apply');
const listOnly = has('--list');
const filesArg = opt('--files');
const batchArg = opt('--batch');

const candidates = listCandidates();

if (listOnly) {
  const batches = { 1: [], 2: [], 3: [] };
  const migrated = [];
  for (const f of candidates) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (src.includes("from './xbb-http.js'")) {
      migrated.push(f);
      continue;
    }
    batches[classify(src)].push(f);
  }
  for (const n of [1, 2, 3]) {
    console.log(`\nBatch ${n} (${batches[n].length}):`);
    for (const f of batches[n]) console.log(`  ${f}`);
  }
  console.log(`\nAlready migrated (${migrated.length}): ${migrated.join(', ')}`);
  console.log(`Excluded: ${[...NON_MIGRATABLE].join(', ')}`);
  process.exit(0);
}

let targets;
if (filesArg) {
  targets = filesArg.split(',').map((s) => s.trim()).filter(Boolean);
  for (const f of targets) {
    if (!candidates.includes(f)) {
      console.error(`not a candidate file: ${f}`);
      process.exit(1);
    }
  }
} else if (batchArg) {
  const batch = Number(batchArg);
  if (![1, 2, 3].includes(batch)) {
    console.error(`invalid batch: ${batchArg}`);
    process.exit(1);
  }
  targets = candidates.filter((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (src.includes("from './xbb-http.js'")) return false;
    return classify(src) === batch;
  });
} else {
  targets = candidates;
}

const okList = [];
const failList = [];
const skipList = [];

for (const f of targets) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const result = transform(src);
  if (result.status === 'ok') {
    okList.push({ f, result, src });
    if (filesArg) printDiff(src, result.out, f);
  } else if (result.status === 'skip') {
    skipList.push(`${f} (${result.reason})`);
  } else {
    failList.push(`${f}: ${result.reason}`);
  }
}

console.log(`\n== summary ==`);
console.log(`targets: ${targets.length}, ok: ${okList.length}, fail: ${failList.length}, skip: ${skipList.length}`);
if (skipList.length) {
  console.log(`\n-- skipped --`);
  for (const s of skipList) console.log(`  ${s}`);
}
if (failList.length) {
  console.log(`\n-- failed (left untouched, needs manual handling) --`);
  for (const s of failList) console.log(`  ${s}`);
}
if (filesArg && okList.length) {
  console.log('\n-- notes --');
  for (const { f, result } of okList) console.log(`  ${f}: ${result.notes.join('; ')}`);
}

if (apply) {
  if (failList.length) {
    console.error('\napply aborted: fix the failing files first (no files were written)');
    process.exit(1);
  }
  let written = 0;
  for (const { f, result } of okList) {
    fs.writeFileSync(path.join(ROOT, f), result.out, 'utf8');
    written += 1;
  }
  console.log(`\napplied: ${written} file(s) written`);
}
