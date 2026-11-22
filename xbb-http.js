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
// 成功返回 { ok: true, data, responseBody }；HTTP/网络失败返回 { ok: false, code, msg }
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

  // 网络层异常（DNS/连接失败/超时）不能穿透成未捕获异常，统一转成 error code 让命令返回结果行
  let resp;
  try {
    resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body,
    });
  } catch (error) {
    if (debug) process.stderr.write(`[debug] RequestError: ${error?.message || error}\n`);
    return { ok: false, code: 'NETWORK_ERROR', msg: `请求失败：${error?.message || error}` };
  }

  if (!resp.ok) {
    const responseText = await resp.text();
    if (debug) process.stderr.write(`[debug] ResponseBody: ${responseText}\n`);
    return { ok: false, code: resp.status, msg: `HTTP ${resp.status} ${resp.statusText}` };
  }

  let data;
  try {
    data = await resp.json();
  } catch (error) {
    if (debug) process.stderr.write(`[debug] ResponseError: ${error?.message || error}\n`);
    return { ok: false, code: 'INVALID_JSON', msg: '响应不是合法 JSON' };
  }
  const responseBody = JSON.stringify(data);
  if (debug) process.stderr.write(`[debug] ResponseBody: ${responseBody}\n`);
  return { ok: true, data, responseBody };
}

// 分页 footer 骨架：update(data) 记录 totalCount/totalPage，footerExtra 交给 cli()
// countOnly 用于只有顶层 totalCount 的接口（original-text-list 变体）
// pick 用于分页信息不在 result 顶层的接口（mail-list 的 result.pageHelper）
export function createPagination({ countOnly = false, pick } = {}) {
  let state = null;
  return {
    update(data) {
      const result = pick ? pick(data) : data?.result;
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
