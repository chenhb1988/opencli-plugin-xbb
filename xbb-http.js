import crypto from 'node:crypto';
import { readActiveConfig } from './xbb-config.js';

const DEFAULT_BASE_URL = 'https://proapi.xbongbong.com';

// 标记请求来源的自定义 header：所有服务端请求统一带上，值固定为 CLI 标识
export const CLIENT_SOURCE_HEADER = { 'X-Client-Source': 'xbbcli-serv' };

// 业务命令统一的运行时配置：从 config.env 读取 enable=true 的公司并规范化字段
export function getRuntimeConfig() {
  const config = readActiveConfig();
  return {
    corpid: String(config.corpid || '').trim(),
    token: String(config.token || '').trim(),
    baseUrl: String(config.baseurl || DEFAULT_BASE_URL).trim(),
    userId: String(config.userId || '').trim(),
  };
}

// 网关 POST：序列化、SHA256 签名、headers 组装、debug 输出与 HTTP 层错误处理
// 成功返回 { ok: true, data, responseBody }；HTTP 失败返回 { ok: false, code, msg }
export async function requestGateway({ baseUrl, apiPath, payload, token, userId, debug }) {
  const body = JSON.stringify(payload);
  const sign = crypto.createHash('sha256').update(body + token).digest('hex');
  const headers = Object.assign(
    { 'Content-Type': 'application/json;charset=UTF-8', sign },
    userId ? { userId } : {},
    CLIENT_SOURCE_HEADER,
  );
  const apiUrl = `${String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')}${apiPath}`;

  if (debug) {
    process.stderr.write(`[debug] URL: ${apiUrl}\n[debug] Headers: ${JSON.stringify(headers)}\n[debug] RequestBody: ${body}\n`);
  }

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!resp.ok) {
    const responseText = await resp.text();
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseText}\n`);
    return { ok: false, code: resp.status, msg: `HTTP ${resp.status} ${resp.statusText}` };
  }

  const data = await resp.json();
  const responseBody = JSON.stringify(data);
  if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
  return { ok: true, data, responseBody };
}

// 分页 footer 骨架：update(data) 记录 totalCount/totalPage，footerExtra 交给 cli()
// countOnly 用于只有顶层 totalCount 的接口（orginal-text-list 变体）
export function createPagination({ countOnly = false } = {}) {
  let state = null;
  return {
    update(data) {
      const result = data?.result;
      const totalCount = countOnly
        ? (data?.totalCount ?? result?.totalCount)
        : (result?.totalCount ?? data?.totalCount);
      const totalPage = countOnly ? undefined : (result?.totalPage ?? data?.totalPage);
      const valid = data?.code === 1 && totalCount != null && (countOnly || totalPage != null);
      state = valid ? { totalCount, totalPage } : null;
    },
    footerExtra() {
      if (!state) return undefined;
      return countOnly
        ? `totalCount ${state.totalCount}`
        : `totalCount ${state.totalCount} / totalPage ${state.totalPage}`;
    },
  };
}
