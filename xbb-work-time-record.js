// 工时记录命令共用：dataList 解析与新增/编辑/删除的输出行映射

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

export const MUTATION_COLUMNS = ['dataId', 'resultCode', 'resultMsg', 'code', 'msg'];
export const DEL_COLUMNS = ['resultCode', 'resultMsg', 'errorDataMemo', 'code', 'msg'];

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
    dataId: result.dataId ?? '',
    resultCode: result.code ?? '',
    resultMsg: result.msg || '',
    code: data.code ?? '',
    msg: data.msg || '',
  }];
}

export function makeDelErrorRow(code, msg) {
  return [{
    resultCode: '',
    resultMsg: '',
    errorDataMemo: '',
    code,
    msg,
  }];
}

export function makeDelRow(data) {
  const result = data.result || {};
  return [{
    resultCode: result.code ?? data.code ?? '',
    resultMsg: result.msg || '',
    errorDataMemo: result.errorDataMemo || '',
    code: data.code ?? '',
    msg: data.msg || '',
  }];
}