// 其他收入单命令共用：dataList 解析与新建/编辑/删除/详情/列表的输出行映射

export function parseDataList(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  const text = String(raw || '').trim();
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function stringifyValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return value ?? '';
}

export const MUTATION_COLUMNS = ['dataId', 'resultCode', 'resultMsg', 'code', 'msg'];
export const LIST_COLUMNS = ['rank', 'dataId', 'formId', 'serialNo', 'creatorId', 'ownerId', 'addTime', 'updateTime', 'data', 'code', 'msg'];
export const DETAIL_COLUMNS = ['dataId', 'formId', 'serialNo', 'creatorId', 'ownerId', 'addTime', 'updateTime', 'data', 'code', 'msg'];

export function makeMutationErrorRow(code, msg) {
  return [{
    dataId: '',
    resultCode: '',
    resultMsg: '',
    code,
    msg,
  }];
}

export function makeMutationRow(data) {
  const result = data.result || {};
  return [{
    dataId: result.dataId ?? result.formDataId ?? '',
    resultCode: result.code ?? '',
    resultMsg: result.msg || '',
    code: data.code ?? '',
    msg: data.msg || '',
  }];
}

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