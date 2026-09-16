import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LOGIN_PAGE_URL = 'https://appwebfront.xbongbong.com/stand-alone-login.html#/';
export const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.xbbcli', 'browser-profile');

const WINDOWS_BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const MACOS_BROWSER_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

const LINUX_BROWSER_NAMES = [
  'google-chrome',
  'google-chrome-stable',
  'microsoft-edge',
  'microsoft-edge-stable',
  'chromium',
  'chromium-browser',
];

// 别名 -> { names: PATH 查找用名, keywords: 安装目录关键字 }
const DEFAULT_BROWSER_ALIASES = [
  { names: ['google-chrome', 'chrome'], keywords: ['chrome'] },
  { names: ['microsoft-edge', 'msedge'], keywords: ['edge'] },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function findOnPath(names) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of names) {
    for (const dir of dirs) {
      const candidate = path.join(dir, name);
      if (isFile(candidate)) return candidate;
      if (process.platform === 'win32' && isFile(`${candidate}.exe`)) return `${candidate}.exe`;
    }
  }
  return '';
}

function platformCandidates() {
  if (process.platform === 'win32') return WINDOWS_BROWSER_PATHS;
  if (process.platform === 'darwin') return MACOS_BROWSER_PATHS;
  return [];
}

function resolveAlias(alias) {
  const lower = alias.toLowerCase();
  const group = DEFAULT_BROWSER_ALIASES.find((item) => item.keywords.includes(lower) || item.names.includes(lower));
  if (!group) return '';
  if (process.platform !== 'linux') {
    // 关键字命中的候选里还要过滤掉不存在的路径，否则会误报空结果
    const candidate = platformCandidates()
      .filter((item) => group.keywords.some((keyword) => path.basename(item).toLowerCase().includes(keyword)))
      .find((item) => isFile(item));
    if (candidate) return candidate;
  }
  return findOnPath(group.names);
}

// --browser 支持三种写法：浏览器别名（chrome/edge）、可执行文件绝对路径、不传则自动探测
export function findBrowserExecutable(explicit) {
  const value = String(explicit ?? '').trim();
  if (value) {
    if (isFile(value)) return value;
    return resolveAlias(value);
  }
  for (const candidate of platformCandidates()) {
    if (isFile(candidate)) return candidate;
  }
  if (process.platform === 'linux') {
    const found = findOnPath(LINUX_BROWSER_NAMES);
    if (found) return found;
  }
  return '';
}

// Chrome 的 --remote-debugging-pipe 约定：fd3 写入 CDP 指令，fd4 读取 CDP 消息（NUL 分隔的 JSON）
function createPipeClient(child) {
  const input = child.stdio[3];
  const output = child.stdio[4];
  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let nextId = 0;
  let closed = false;

  output.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let index = buffer.indexOf(0);
    while (index !== -1) {
      const raw = buffer.subarray(0, index).toString('utf8');
      buffer = buffer.subarray(index + 1);
      index = buffer.indexOf(0);
      if (!raw) continue;
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }
      const resolve = pending.get(message.id);
      if (!resolve) continue;
      pending.delete(message.id);
      resolve(message);
    }
  });

  output.on('error', () => {});
  input.on('error', () => {});

  function rejectAll(reason) {
    closed = true;
    for (const resolve of pending.values()) resolve({ error: { message: reason } });
    pending.clear();
  }

  child.once('exit', () => rejectAll('浏览器进程已退出'));
  child.once('error', (error) => rejectAll(String(error.message || error)));

  function send(method, params = {}, sessionId) {
    if (closed) return Promise.reject(new Error('浏览器进程已退出'));
    const id = nextId + 1;
    nextId = id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(id, (message) => {
        if (message.error) reject(new Error(`${method}: ${message.error.message || 'CDP 调用失败'}`));
        else resolve(message.result || {});
      });
      input.write(`${JSON.stringify(payload)}\0`);
    });
  }

  return { send };
}

const XBB_PAGE_PATTERN = /xbongbong\.com/i;

export async function openBrowser(options = {}) {
  const executablePath = findBrowserExecutable(options.browser);
  if (!executablePath) {
    throw new Error('未找到 Chrome 或 Edge 浏览器，请用 --browser <可执行文件路径> 指定');
  }

  // Chrome 要求 --user-data-dir 为绝对路径，相对路径会导致进程直接退出（exit code 21）
  const userDataDir = path.resolve(String(options.userDataDir || '').trim() || DEFAULT_PROFILE_DIR);
  fs.mkdirSync(userDataDir, { recursive: true });

  const args = [
    '--remote-debugging-pipe',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-sync',
    '--no-service-autorun',
    `--user-data-dir=${userDataDir}`,
  ];
  if (options.headless) args.push('--headless=new');
  args.push('--new-window', String(options.url || LOGIN_PAGE_URL));

  const child = spawn(executablePath, args, {
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
    windowsHide: Boolean(options.headless),
  });

  // 保留最后几行 stderr，Chrome 启动失败（如 profile 被占用）时用于提示用户
  const stderrLines = [];
  child.stderr.on('data', (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim()) stderrLines.push(line.trim());
    }
    if (stderrLines.length > 5) stderrLines.splice(0, stderrLines.length - 5);
  });
  child.stderr.on('error', () => {});

  const { send } = createPipeClient(child);
  let exited = false;
  child.once('exit', () => { exited = true; });

  const session = {
    executablePath,
    userDataDir,
    child,
    send,
    stderrText() {
      return stderrLines.join('\n');
    },
    attachedTargetId: '',
    attachedSessionId: '',
    pageReady: false,
    isClosed() {
      return exited || child.exitCode !== null;
    },
    async version() {
      const result = await send('Browser.getVersion');
      return String(result.product || '');
    },
    async pageSession(force) {
      const result = await send('Target.getTargets');
      const targets = result.targetInfos || [];
      const page = targets.find((item) => item.type === 'page' && XBB_PAGE_PATTERN.test(item.url || ''));
      if (!page) return '';
      if (force || session.attachedTargetId !== page.targetId) {
        const attached = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
        session.attachedTargetId = page.targetId;
        session.attachedSessionId = attached.sessionId;
      }
      return session.attachedSessionId;
    },
    // 页面可能尚未提交导航、或登录跳转会重建执行上下文：失败时重新 attach 并重试
    async evaluate(expression, options = {}) {
      const attempts = Number(options.attempts) > 0 ? Number(options.attempts) : 6;
      const delayMs = Number(options.delayMs) > 0 ? Number(options.delayMs) : 250;
      let lastError = null;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const sessionId = await session.pageSession(attempt > 0);
          if (!sessionId) throw new Error('未找到销帮帮页面');
          const result = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
          }, sessionId);
          if (result.exceptionDetails) {
            const message = result.exceptionDetails.text
              || result.exceptionDetails.exception?.description
              || '页面脚本执行失败';
            throw new Error(message);
          }
          session.pageReady = true;
          return result.result ? result.result.value : undefined;
        } catch (error) {
          lastError = error;
          session.attachedSessionId = '';
          session.attachedTargetId = '';
          if (attempt + 1 < attempts) await delay(delayMs);
        }
      }
      throw lastError || new Error('页面脚本执行失败');
    },
    // 等待页面真正落到销帮帮域名，避免在 about:blank 上读写 localStorage 抛 SecurityError
    async waitForPage(timeoutMs) {
      const deadline = Date.now() + (Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000);
      while (Date.now() < deadline) {
        if (session.isClosed()) throw new Error(`浏览器已关闭${session.stderrText() ? `：${session.stderrText()}` : ''}`);
        try {
          const href = await session.evaluate('location.href', { attempts: 1 });
          if (typeof href === 'string' && XBB_PAGE_PATTERN.test(href) && !/^about:/.test(href)) return href;
        } catch {
          // 页面尚未就绪，继续等待
        }
        await delay(250);
      }
      throw new Error('等待销帮帮登录页加载超时');
    },
    async close() {
      try {
        await send('Browser.close');
      } catch {
        // 忽略：进程可能已退出
      }
      if (await session.waitForExit(1500)) return true;
      // Browser.close 未生效（部分 Edge/Chrome 版本）：强制结束并确认退出
      try {
        child.kill();
      } catch {
        // 忽略
      }
      return session.waitForExit(3000);
    },
    waitForExit(timeoutMs) {
      if (session.isClosed()) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.removeListener('exit', onExit);
          resolve(session.isClosed());
        }, timeoutMs);
        function onExit() {
          clearTimeout(timer);
          resolve(true);
        }
        child.once('exit', onExit);
      });
    },
    // --keepOpen：断开 CDP 管道并解除引用，让浏览器独立留在桌面上
    detach() {
      try {
        child.stdio[3].end();
      } catch {
        // 忽略
      }
      try {
        child.stdio[4].destroy();
      } catch {
        // 忽略
      }
      try {
        child.unref();
      } catch {
        // 忽略
      }
    },
  };

  return session;
}