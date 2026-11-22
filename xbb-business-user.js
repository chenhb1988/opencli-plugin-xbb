// 负责人/协同人增删命令共用：参数解析、请求组装与结果行映射

import { getRuntimeConfig, requestGateway } from './xbb-http.js';

export const RELATION_COLUMNS = ['resultCode', 'resultMsg', 'messageList', 'code', 'msg'];

export function parseUserIdList(raw) {
  try {
    const parsed = JSON.parse(String(raw || ''));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function makeErrorRow(code, msg) {
  return [{
    resultCode: '',
    resultMsg: '',
    messageList: '',
    code,
    msg,
  }];
}

function makeSuccessRow(data) {
  return [{
    resultCode: data.code ?? '',
    resultMsg: data.msg || '',
    messageList: JSON.stringify(data.result?.messageList || []),
    code: data.code ?? '',
    msg: data.msg || '',
  }];
}

export async function runUserRelation({ kwargs = {}, apiPath }) {
  const debug = Boolean(kwargs.debug);
  const { corpid, token, baseUrl, userId } = getRuntimeConfig();
  const payload = {
    corpid,
    dataId: Number(kwargs.dataId || 0),
  };
  if (kwargs.userId) payload.userId = String(kwargs.userId);

  const userIdList = parseUserIdList(kwargs.businessUserIdList);
  if (userIdList) payload.businessUserIdList = userIdList;

  if (!payload.dataId) return makeErrorRow('NO_DATAID', '缺少 --dataId');
  if (!payload.corpid) return makeErrorRow('NO_CORPID', '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');
  if (!userIdList || !userIdList.length) return makeErrorRow('NO_USERIDLIST', '缺少 --businessUserIdList 或格式不正确，需为JSON数组');
  if (!token) return makeErrorRow('NO_TOKEN', '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>');

  const gateway = await requestGateway({
    baseUrl,
    apiPath,
    payload,
    token,
    userId,
    debug,
  });
  if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
  if (gateway.data.code !== 1) {
    return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
  }

  return makeSuccessRow(gateway.data);
}