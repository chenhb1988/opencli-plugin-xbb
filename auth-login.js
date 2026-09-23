import crypto from 'node:crypto';
import { cli, Strategy } from './xbb-registry.js';
import { openBrowser, findBrowserExecutable, LOGIN_PAGE_URL } from './xbb-browser.js';
import { saveCompanyCredentials } from './xbb-token-store.js';

const API_TOKEN_PATH = '/pro/v1/apiPersonalToken/generate';
const PRO_GATEWAY_ORIGIN = 'https://progateway.xbongbong.com';
const APP_GATEWAY_ORIGIN = 'https://appgateway.xbongbong.com';
const PLATFORM = 'web';
// 登录成功判据：页面已跳转到工作台首页 /#/app/home
const LOGIN_SUCCESS_PATTERN = /#\/app\/home/;
const DEFAULT_TIMEOUT_SECONDS = 300;
const POLL_INTERVAL_MS = 1000;
// 网关提示登录态过期时，清掉页面里的旧会话并继续等待用户重新登录
const SESSION_EXPIRED_CODE = 100012;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeArg(value) {
  return String(value ?? '').trim();
}

// 网关域名与企业 baseurl 用同一套 corpid 判定：ding 开头或含 $$ding 走 pro 网关
function resolveGatewayUrl(corpid) {
  const value = normalizeArg(corpid);
  const origin = value.startsWith('ding') || value.includes('$$ding') ? PRO_GATEWAY_ORIGIN : APP_GATEWAY_ORIGIN;
  return `${origin}${API_TOKEN_PATH}`;
}

function buildSign(body, secret) {
  return crypto.createHash('sha256').update(body + secret).digest('hex');
}

function maskSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  return `${text.slice(0, 6)}***(${text.length})`;
}

// debug 回显换取响应前对 token 字段做掩码（凭证明文只允许走 --raw 出口）
function maskResponseTokens(text) {
  return String(text || '').replace(/"(?:personalToken|token)"\s*:\s*"([^"]*)"/gi, (match, value) => match.replace(value, maskSecret(value)));
}

// 统一输出：成功时与 token-set 的列保持一致，失败时回落到合成错误行（不抛异常）
function makeRow(fields) {
  return [{
    status: '',
    message: '',
    configFile: '',
    corpid: '',
    baseurl: '',
    userId: '',
    enable: '',
    companyCount: '',
    formlistFile: '',
    commandMapFile: '',
    departmentUserFile: '',
    corpName: '',
    userName: '',
    envStored: '',
    envFile: '',
    code: '',
    msg: '',
    ...fields,
  }];
}

function makeErrorRow(code, msg, extra = {}) {
  return makeRow({ status: 'error', code, msg, message: msg, ...extra });
}

// 读取登录页写入的 web 会话（登录成功后前端会写入 corpid / userId / xbbAccessToken）
const READ_SESSION_EXPRESSION = `JSON.stringify({
  corpid: localStorage.getItem('corpid') || '',
  userId: localStorage.getItem('userId') || '',
  accessToken: localStorage.getItem('xbbAccessToken') || '',
  corpName: localStorage.getItem('corpName') || '',
  userName: localStorage.getItem('userName') || '',
  href: location.href
})`;

async function readSession(session) {
  const raw = await session.evaluate(READ_SESSION_EXPRESSION, { attempts: 1, delayMs: 100 });
  if (typeof raw !== 'string' || !raw) throw new Error('未读取到页面登录态');
  const parsed = JSON.parse(raw);
  return {
    corpid: normalizeArg(parsed.corpid),
    userId: normalizeArg(parsed.userId),
    accessToken: normalizeArg(parsed.accessToken),
    corpName: normalizeArg(parsed.corpName),
    userName: normalizeArg(parsed.userName),
    href: normalizeArg(parsed.href),
  };
}

// 在页面内调用网关换取个人 token：CORS 全开，sign = SHA256(JSON body + xbbAccessToken)
// resetToken=0 复用已有 token、1 重新生成；checkUserId 为目标人员，自助登录时与登录用户一致
async function exchangeApiToken(session, loginSession, resetToken, debug) {
  const url = resolveGatewayUrl(loginSession.corpid);
  const body = JSON.stringify({ corpid: loginSession.corpid, userId: loginSession.userId, checkUserId: loginSession.userId, platform: PLATFORM, resetToken });
  const sign = buildSign(body, loginSession.accessToken);
  const expression = `(async () => {
  const response = await fetch(${JSON.stringify(url)}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', corpid: ${JSON.stringify(loginSession.corpid)}, sign: ${JSON.stringify(sign)} },
    body: ${JSON.stringify(body)}
  });
  return await response.text();
})()`;

  if (debug) {
    process.stderr.write(`[debug] Gateway: ${url}\n[debug] Headers: ${JSON.stringify({ 'Content-Type': 'application/json;charset=UTF-8', corpid: loginSession.corpid, sign })}\n[debug] RequestBody: ${body}\n[debug] SessionToken: ${maskSecret(loginSession.accessToken)}\n`);
  }

  const text = await session.evaluate(expression, { attempts: 3, delayMs: 200 });
  const responseText = typeof text === 'string' ? text : JSON.stringify(text);
  if (debug) process.stderr.write(`[debug] ResponseBody: ${maskResponseTokens(responseText)}\n`);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { error: `换取 API token 失败：返回内容不是 JSON（${responseText.slice(0, 200)}）` };
  }
  if (Number(data.code) === SESSION_EXPIRED_CODE) {
    return { sessionExpired: true };
  }
  if (Number(data.code) !== 1) {
    return { error: `换取 API token 失败：${data.msg || '未知错误'}（code ${data.code ?? ''}）；也可到销帮帮「个人中心 - API 设置」复制 token 后执行 xbbcli token-set` };
  }

  const result = data.result;
  const token = normalizeArg(typeof result === 'string' ? result : (result && (result.personalToken || result.token)));
  return {
    token,
    corpid: normalizeArg(result && result.corpid) || loginSession.corpid,
    userId: normalizeArg(result && result.userId) || loginSession.userId,
    responseText,
  };
}

// resetToken=0 复用已有 token；接口返回空 token 时改用 resetToken=1 重新生成，仍未返回则给出合成错误
async function exchangeApiTokenWithFallback(session, loginSession, debug) {
  const existing = await exchangeApiToken(session, loginSession, 0, debug);
  if (existing.error || existing.sessionExpired || existing.token) return existing;

  const regenerated = await exchangeApiToken(session, loginSession, 1, debug);
  if (!regenerated.error && !regenerated.sessionExpired && !regenerated.token) {
    return { ...regenerated, error: '接口未返回 API token；可到销帮帮「个人中心 - API 设置」复制 token 后执行 xbbcli token-set' };
  }
  return regenerated;
}

async function clearAccessToken(session) {
  try {
    await session.evaluate(`(() => { localStorage.removeItem('xbbAccessToken'); return 'ok'; })()`, { attempts: 1 });
  } catch {
    // 忽略：清理旧会话失败不阻塞后续等待
  }
}

async function finish(session, keepOpen) {
  if (!session) return;
  if (keepOpen) {
    session.detach();
    return;
  }
  try {
    await session.close();
  } catch {
    // 忽略：浏览器可能已被用户手动关闭
  }
}

async function authLogin(kwargs) {
  const debug = Boolean(kwargs.debug);
  const explicitBrowser = normalizeArg(kwargs.browser);
  const keepOpen = Boolean(kwargs.keepOpen);
  const expectCorpid = normalizeArg(kwargs.corpid);
  const timeoutValue = normalizeArg(kwargs.timeout);
  const timeoutSeconds = timeoutValue === '' ? DEFAULT_TIMEOUT_SECONDS : Number(timeoutValue);

  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    return makeErrorRow('INVALID_TIMEOUT', '--timeout 需为大于 0 的秒数');
  }
  if (!findBrowserExecutable(explicitBrowser)) {
    return makeErrorRow('NO_BROWSER', '未找到 Chrome 或 Edge 浏览器；请用 --browser <chrome|edge|可执行文件路径> 指定');
  }

  let session;
  try {
    session = await openBrowser({ browser: explicitBrowser, url: LOGIN_PAGE_URL });
  } catch (error) {
    return makeErrorRow('BROWSER_SPAWN_FAILED', `启动浏览器失败：${error.message || error}`);
  }

  if (debug) {
    process.stderr.write(`[debug] Browser: ${session.executablePath}\n[debug] Profile: ${session.userDataDir}\n[debug] LoginPage: ${LOGIN_PAGE_URL}\n`);
  }

  try {
    await session.waitForPage(30000);
  } catch (error) {
    await finish(session, keepOpen);
    return makeErrorRow('BROWSER_LAUNCH_FAILED', `打开销帮帮登录页失败：${error.message || error}`);
  }

  process.stderr.write('请在打开的浏览器中完成登录，登录成功后本命令会自动获取并保存 API token。\n');

  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastMessage = '';
  while (Date.now() < deadline) {
    if (session.isClosed()) {
      await finish(session, keepOpen);
      return makeErrorRow('BROWSER_CLOSED', '浏览器已被关闭，登录未完成');
    }

    let current;
    try {
      current = await readSession(session);
    } catch (error) {
      lastMessage = String(error.message || error);
      await delay(POLL_INTERVAL_MS);
      continue;
    }

    if (!current.accessToken) {
      await delay(POLL_INTERVAL_MS);
      continue;
    }

    // accessToken 已写入但页面还在登录流程中：等跳转到工作台首页再换取，避免会话未就绪时误判
    if (!LOGIN_SUCCESS_PATTERN.test(current.href)) {
      lastMessage = `页面地址为 ${current.href || '未知'}，尚未跳转到登录成功页 /#/app/home`;
      await delay(POLL_INTERVAL_MS);
      continue;
    }

    let exchange;
    try {
      exchange = await exchangeApiTokenWithFallback(session, current, debug);
    } catch (error) {
      // 页面导航、执行上下文重建等瞬时失败：记录原因后继续轮询；浏览器已关闭则直接返回
      if (session.isClosed()) {
        await finish(session, keepOpen);
        return makeErrorRow('BROWSER_CLOSED', '浏览器已被关闭，登录未完成');
      }
      lastMessage = String(error.message || error);
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    if (exchange.sessionExpired) {
      // 旧会话已过期：清掉后继续等待用户重新登录
      await clearAccessToken(session);
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    if (exchange.error) {
      await finish(session, keepOpen);
      return makeErrorRow('API_TOKEN_FAILED', exchange.error, { corpid: current.corpid, userId: current.userId });
    }
    if (kwargs.raw) {
      await finish(session, keepOpen);
      return [{ raw: exchange.responseText }];
    }
    if (expectCorpid && exchange.corpid !== expectCorpid) {
      await finish(session, keepOpen);
      return makeErrorRow(
        'CORPID_MISMATCH',
        `浏览器登录的企业是 ${exchange.corpid}，与 --corpid ${expectCorpid} 不一致；请确认浏览器中登录了正确的企业`,
        { corpid: exchange.corpid, userId: exchange.userId },
      );
    }

    let savedRows;
    try {
      savedRows = await saveCompanyCredentials({
        corpid: exchange.corpid,
        token: exchange.token,
        userId: exchange.userId,
        env: String(kwargs.env ?? '0'),
      });
    } catch (error) {
      await finish(session, keepOpen);
      return makeErrorRow('SAVE_FAILED', `保存凭证失败：${error.message || error}`, { corpid: exchange.corpid, userId: exchange.userId });
    }

    await finish(session, keepOpen);

    const saved = (savedRows && savedRows[0]) || {};
    const savedOk = normalizeArg(saved.status) === 'ok';
    return [{
      ...saved,
      status: savedOk ? 'ok' : (normalizeArg(saved.status) || 'error'),
      message: savedOk
        ? `登录成功；${saved.message || ''}`
        : `已换取 API token，但初始化未完成：${saved.message || '未知原因'}`,
      corpid: normalizeArg(saved.corpid) || exchange.corpid,
      userId: normalizeArg(saved.userId) || exchange.userId,
      baseurl: normalizeArg(saved.baseurl),
    }];
  }

  await finish(session, keepOpen);
  return makeErrorRow(
    'LOGIN_TIMEOUT',
    `等待登录超时（${timeoutSeconds}s），未在浏览器中检测到登录成功态${lastMessage ? `；${lastMessage}` : ''}`,
  );
}

cli({
  site: 'xbb',
  name: 'auth-login',
  description: '打开浏览器完成销帮帮登录授权',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'appwebfront.xbongbong.com',
  args: [
    { name: 'browser', type: 'str', default: '', help: '浏览器：chrome / edge / 可执行文件路径；不传则自动探测' },
    { name: 'timeout', type: 'str', default: '', help: `等待登录完成的秒数（默认 ${DEFAULT_TIMEOUT_SECONDS}）` },
    { name: 'corpid', type: 'str', default: '', help: '期望登录的企业 ID；与实际登录企业不一致时报错（可选）' },
    { name: 'keepOpen', type: 'bool', default: false, help: '登录成功后保留浏览器窗口（默认自动关闭）' },
    { name: 'env', type: 'str', default: '0', help: '存储方式：0 仅写入 config.env 文件（默认），1 仅写入环境变量（不写任何本地文件）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体、返回体与浏览器信息（密钥只显示掩码）' },
    { name: 'raw', type: 'bool', default: false, help: '输出换取 API token 接口返回的原文' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'baseurl', 'userId', 'enable', 'companyCount', 'formlistFile', 'commandMapFile', 'departmentUserFile', 'corpName', 'userName', 'envStored', 'envFile', 'code', 'msg'],
  func: authLogin,
});