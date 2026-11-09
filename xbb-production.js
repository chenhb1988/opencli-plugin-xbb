// 生产单 / 生产入库单 / 生产领料单命令共用：查询参数组装、错误拆分与输出行映射

function parseOptionalInteger(value, code, msg) {
  if (String(value ?? '') === '') {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${code}:${msg}`);
  }

  return parsed;
}

function buildConditions(kwargs) {
  if (typeof kwargs.conditions === 'string' && kwargs.conditions.trim()) {
    let parsed;
    try {
      parsed = JSON.parse(kwargs.conditions);
    } catch {
      throw new Error('INVALID_CONDITIONS:conditions 必须是 JSON 数组');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('INVALID_CONDITIONS:conditions 必须是 JSON 数组');
    }
    return parsed;
  }

  if (!(kwargs.attr && kwargs.value)) {
    return [];
  }

  return [{
    attr: String(kwargs.attr),
    value: [String(kwargs.value)],
    symbol: String(kwargs.symbol || 'equal'),
  }];
}

export function buildListPayload(kwargs, corpid) {
  const payload = { corpid };

  const userId = String(kwargs.userId || '');
  if (userId) payload.userId = userId;

  const page = parseOptionalInteger(kwargs.page, 'INVALID_PAGE', 'page 必须是数字');
  if (page !== null) payload.page = page;

  const pageSize = parseOptionalInteger(kwargs.pageSize, 'INVALID_PAGE_SIZE', 'pageSize 必须是数字');
  if (pageSize !== null) payload.pageSize = pageSize;

  const viewApproval = parseOptionalInteger(kwargs.viewApproval, 'INVALID_VIEW_APPROVAL', 'viewApproval 必须是数字');
  if (viewApproval !== null) payload.viewApproval = viewApproval;

  const conditions = buildConditions(kwargs);
  if (conditions.length) payload.conditions = conditions;

  return payload;
}

export function buildDetailPayload(kwargs, corpid) {
  const payload = {
    dataId: Number(kwargs.dataId || 0),
    corpid,
  };

  const userId = String(kwargs.userId || '');
  if (userId) payload.userId = userId;

  const queryFlag = parseOptionalInteger(kwargs.queryFlag, 'INVALID_QUERY_FLAG', 'queryFlag 必须是数字');
  if (queryFlag !== null) payload.queryFlag = queryFlag;

  return payload;
}

// 组装参数时抛出的 `${code}:${msg}` 错误拆回合成行字段
export function splitCodedError(error, fallbackCode) {
  const message = String(error?.message || error);
  const separatorIndex = message.indexOf(':');
  if (separatorIndex > 0) {
    return { code: message.slice(0, separatorIndex), detail: message.slice(separatorIndex + 1) };
  }
  return { code: fallbackCode, detail: message };
}

function stringifyValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return value ?? '';
}

export const LIST_COLUMNS = ['rank', 'dataId', 'formId', 'serialNo', 'creatorId', 'ownerId', 'addTime', 'updateTime', 'data', 'code', 'msg'];
export const DETAIL_COLUMNS = ['dataId', 'formId', 'serialNo', 'creatorId', 'ownerId', 'addTime', 'updateTime', 'data', 'code', 'msg'];

export function makeListErrorRow(code, msg) {
  return [{
    rank: '',
    dataId: '',
    formId: '',
    serialNo: '',
    creatorId: '',
    ownerId: '',
    addTime: '',
    updateTime: '',
    data: '',
    code,
    msg,
  }];
}

export function makeListRows(list) {
  return list.map((item, index) => ({
    rank: index + 1,
    dataId: item.dataId || '',
    formId: item.formId || '',
    serialNo: item.data?.serialNo || '',
    creatorId: stringifyValue(item.data?.creatorId),
    ownerId: stringifyValue(item.data?.ownerId),
    addTime: item.addTime || '',
    updateTime: item.updateTime || '',
    data: JSON.stringify(item.data || {}),
    code: '',
    msg: '',
  }));
}

export function makeDetailErrorRow(code, msg) {
  return [{
    dataId: '',
    formId: '',
    serialNo: '',
    creatorId: '',
    ownerId: '',
    addTime: '',
    updateTime: '',
    data: '',
    code,
    msg,
  }];
}

export function makeDetailRow(data) {
  const result = data.result || {};
  return [{
    dataId: result.dataId || '',
    formId: result.formId || '',
    serialNo: result.data?.serialNo || '',
    creatorId: stringifyValue(result.data?.creatorId),
    ownerId: stringifyValue(result.data?.ownerId),
    addTime: result.addTime || '',
    updateTime: result.updateTime || '',
    data: JSON.stringify(result.data || {}),
    code: data.code ?? '',
    msg: data.msg || '',
  }];
}