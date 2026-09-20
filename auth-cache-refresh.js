import { cli, Strategy } from './xbb-registry.js';
import { readActiveConfig, isEnvActive } from './xbb-config.js';
import {
  refreshLocalCaches,
  getFormlistFile,
  getCommandMapFile,
  getDepartmentUserFile,
} from './xbb-token-store.js';

function trim(value) {
  return String(value ?? '').trim();
}

// 统一输出：成功时给出三份缓存与回填结果，失败时回落到合成错误行（不抛异常）
function makeRow(fields) {
  return [{
    status: '',
    message: '',
    corpid: '',
    userId: '',
    corpName: '',
    userName: '',
    formlistFile: '',
    formlistCount: '',
    commandMapFile: '',
    departmentUserFile: '',
    departmentCount: '',
    userCount: '',
    profileUpdated: '',
    code: '',
    msg: '',
    ...fields,
  }];
}

function makeErrorRow(code, msg, extra = {}) {
  return makeRow({ status: 'error', code, msg, message: msg, ...extra });
}

async function authCacheRefresh(kwargs) {
  const active = readActiveConfig();
  const corpid = trim(active.corpid);
  const userId = trim(kwargs.userId) || trim(active.userId);

  if (kwargs.debug) {
    const source = isEnvActive() ? 'env' : 'config';
    process.stderr.write(`[debug] ConfigSource: ${source}\n[debug] Corpid: ${corpid || '(none)'}\n[debug] UserId: ${userId || '(none)'}\n[debug] FormlistFile: ${corpid ? getFormlistFile(corpid) : ''}\n[debug] CommandMapFile: ${corpid ? getCommandMapFile(corpid) : ''}\n[debug] DepartmentUserFile: ${corpid ? getDepartmentUserFile(corpid) : ''}\n`);
  }

  if (!corpid) {
    return makeErrorRow('NO_ACTIVE_CONFIG', '没有生效的配置：config.env 中不存在 enable=true 的公司，环境变量 XBB_* 也为空；请先执行 xbbcli auth-login 或 xbbcli token-set');
  }

  let cache;
  try {
    cache = await refreshLocalCaches(corpid, userId);
  } catch (error) {
    const partial = error.cache || {};
    const step = trim(error.step) || 'unknown';
    const message = `刷新本地缓存失败（步骤 ${step}）：${error.message || error}`;
    return makeRow({
      status: 'error',
      code: 'CACHE_REFRESH_FAILED',
      msg: message,
      message,
      corpid,
      userId,
      corpName: partial.corpName ?? '',
      userName: partial.userName ?? '',
      formlistFile: partial.formlistFile ?? '',
      formlistCount: partial.formlistCount ?? '',
      commandMapFile: partial.commandMapFile ?? '',
      departmentUserFile: partial.departmentUserFile ?? '',
      departmentCount: partial.departmentCount ?? '',
      userCount: partial.userCount ?? '',
      profileUpdated: partial.profileUpdated ?? '',
    });
  }

  const message = cache.profileUpdated
    ? '已刷新表单清单缓存、命令映射与部门/员工缓存，并回填 corpName/userName 到 config.env'
    : isEnvActive()
      ? '已刷新表单清单缓存、命令映射与部门/员工缓存；当前为环境变量模式，corpName/userName 未回填 config.env'
      : '已刷新表单清单缓存、命令映射与部门/员工缓存；该公司不在 config.env 中，corpName/userName 未回填';

  return makeRow({
    status: 'ok',
    message,
    corpid,
    userId,
    corpName: cache.corpName,
    userName: cache.userName,
    formlistFile: cache.formlistFile,
    formlistCount: cache.formlistCount,
    commandMapFile: cache.commandMapFile,
    departmentUserFile: cache.departmentUserFile,
    departmentCount: cache.departmentCount,
    userCount: cache.userCount,
    profileUpdated: cache.profileUpdated,
  });
}

cli({
  site: 'xbb',
  name: 'auth-cache-refresh',
  description: '刷新当前启用公司的本地缓存（表单清单、命令映射、部门/员工清单），并回填 corpName/userName',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'userId', type: 'str', default: '', help: '操作人 id，用于从员工清单匹配 userName；默认取当前启用配置的 userId' },
    { name: 'debug', type: 'bool', default: false, help: '在 stderr 输出配置来源、corpid 与三份缓存文件路径' },
  ],
  columns: ['status', 'message', 'corpid', 'userId', 'corpName', 'userName', 'formlistFile', 'formlistCount', 'commandMapFile', 'departmentUserFile', 'departmentCount', 'userCount', 'profileUpdated', 'code', 'msg'],
  func: authCacheRefresh,
});
