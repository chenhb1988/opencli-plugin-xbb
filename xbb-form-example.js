import fs from 'node:fs';
import { requestGateway } from './xbb-http.js';
import { getFormlistFile } from './xbb-token-store.js';

// 新建类命令的 --demo 能力：按 apiPath + formId 调 param/get 取请求体示例，
// 把 dataList 的字段值加工成「字段名：xxx|必填/选填|字段类型：xxx」提示串，并强制 JSON 输出。
// 使用方：除 mail-draft-add / other-income-add 外的全部 *-add 命令。

export const FORM_EXAMPLE_API_PATH = '/pro/v2/api/customized/param/get';

// --demo 参数声明（所有 -add 命令共用同一份文案，改文案只改这里）
export const DEMO_ARG = Object.freeze({
  name: 'demo',
  type: 'bool',
  default: false,
  help: '返回新建接口的请求体示例，正式新建时不要传本参数（强制 JSON；未传 formId 时从表单缓存自动解析）',
});

// 命令级输出格式钩子：--demo 的输出是请求体示例，table/csv 会把它压成一列，强制 JSON
export function resolveDemoFormat({ kwargs, format }) {
  return kwargs.demo ? 'json' : format;
}

// 与各新建命令一致的 --dataList 解析：对象直通、JSON 对象字符串解析；空串→null、非法 JSON→undefined
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

function parseOptionList(description) {
  const match = String(description ?? '').match(/选项说明\s*[:：]\s*(\[[\s\S]*\])/);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) && parsed.length ? parsed.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

// 子表/明细容器：不同接口用不同命名，线索/联系人是 subForm_N，报价单等是 array_N，
// 统一靠描述后缀里出现的「容器名」判定，避免硬编码某一前缀
const CONTAINER_PATTERN = /\((subForm_\d+|array_\d+)\)/g;
const CONTAINER_PATTERN_ONE = /\((subForm_\d+|array_\d+)\)/;
const CONTAINER_SUFFIX_ONLY = /\s*\((?:subForm|array)_\d+\)\s*$/;

function stripParameterDescription(description) {
  return String(description ?? '')
    .replace(/\s*选项说明\s*[:：]\s*\[[\s\S]*\]\s*$/, '')
    .replace(CONTAINER_SUFFIX_ONLY, '')
    .trim();
}

function resolveFieldKind(attr, meta) {
  if (/^date_/.test(attr) || /date/i.test(String(meta.type ?? ''))) {
    return '日期';
  }
  if (/^num_/.test(attr)) {
    return '数字';
  }
  switch (String(meta.type ?? '').trim()) {
    case 'String': return '文本';
    case 'Long':
    case 'Integer':
    case 'Float':
    case 'Double':
    case 'Number': return '数字';
    case 'Boolean': return '布尔';
    case 'Array': return '数组';
    case 'Object': return '对象';
    default: return '文本';
  }
}

function makeFieldHint(attr, meta) {
  const required = String(meta.required ?? '').trim() === '是' ? '必填' : '选填';
  const name = stripParameterDescription(meta.description) || attr;
  const options = parseOptionList(meta.description);
  if (options) {
    const kind = /^array_/.test(attr) ? '多选' : '单选';
    return `字段名：${name}|${required}|字段类型：${kind}：${options.join('/')}`;
  }
  return `字段名：${name}|${required}|字段类型：${resolveFieldKind(attr, meta)}`;
}

const PRESERVED_ATTR_PATTERN = /^(address_|file_)/;

// inputParameter 里顶层字段与子表内部字段会重名（如 text_1），
// 用描述里的 (subForm_N)/(array_N) 后缀把内部字段归到对应容器作用域。
// 容器只在「被其他字段的后缀引用」时才算数，这样多选下拉（值也是数组但没有内部字段）不会被误判。
function groupFieldMetadata(inputParameter) {
  const top = new Map();
  const scopes = new Map();
  const items = Array.isArray(inputParameter) ? inputParameter : [];
  const knownAttrs = new Set(
    items.filter((item) => item && item.attr).map((item) => String(item.attr)),
  );
  const containers = new Set();
  for (const item of items) {
    for (const match of String(item?.description ?? '').matchAll(CONTAINER_PATTERN)) {
      if (knownAttrs.has(match[1])) {
        containers.add(match[1]);
      }
    }
  }
  for (const item of items) {
    if (!item || !item.attr) {
      continue;
    }
    const attr = String(item.attr);
    if (containers.has(attr)) {
      continue;
    }
    const scope = String(item.description ?? '').match(CONTAINER_PATTERN_ONE)?.[1] ?? '';
    if (scope && containers.has(scope)) {
      if (!scopes.has(scope)) {
        scopes.set(scope, new Map());
      }
      scopes.get(scope).set(attr, item);
    } else {
      top.set(attr, item);
    }
  }
  return { top, scopes, containers };
}

// 地址、附件、人员/协同人数组保留原示例值；带「选项说明」的字段一律换成提示串（多选字段也走提示串）
function isPreservedField(attr, meta) {
  if (parseOptionList(meta.description)) {
    return false;
  }
  return PRESERVED_ATTR_PATTERN.test(attr) || String(meta.type ?? '').trim() === 'Array';
}

function transformSubFormRow(row, scopeMetadata) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const meta = scopeMetadata.get(key);
    if (!meta || isPreservedField(key, meta)) {
      return [key, value];
    }
    return [key, makeFieldHint(key, meta)];
  }));
}

function transformDataList(dataList, inputParameter) {
  if (!dataList || typeof dataList !== 'object' || Array.isArray(dataList)) {
    return dataList;
  }
  const { top, scopes, containers } = groupFieldMetadata(inputParameter);
  return Object.fromEntries(Object.entries(dataList).map(([key, value]) => {
    if (containers.has(key) && scopes.has(key)) {
      const rows = Array.isArray(value) ? value.map((row) => transformSubFormRow(row, scopes.get(key))) : value;
      return [key, rows];
    }
    const meta = top.get(key);
    if (!meta || isPreservedField(key, meta)) {
      return [key, value];
    }
    return [key, makeFieldHint(key, meta)];
  }));
}

// 未传 --formId 时从表单缓存按 businessType 解析唯一表单；
// 多个候选列出来让用户选，唯一但 formId 非法时报 INVALID_FORM_ID（不能落到「多个/未找到」上误导用户）
export function resolveFormIdByBusinessType(corpid, businessType, label = '表单') {
  const file = getFormlistFile(corpid);
  let forms;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    forms = Array.isArray(parsed) ? parsed : parsed?.data || parsed?.formList || [];
  } catch {
    return {
      code: 'NO_FORMID',
      msg: `缺少 --formId，且无法读取表单缓存 ${file}；请执行 xbbcli auth-refresh-cache 或手动传入 --formId`,
    };
  }
  const matches = [...new Map(
    forms
      .filter((form) => form && String(form?.businessType ?? '').trim() === String(businessType).trim())
      .filter((form) => String(form?.formId ?? '').trim() !== '')
      .map((form) => [String(form.formId), form]),
  ).values()];
  if (matches.length === 1) {
    const formIdValue = Number(matches[0].formId);
    if (Number.isInteger(formIdValue) && formIdValue > 0) {
      return { formId: formIdValue };
    }
    return {
      code: 'INVALID_FORM_ID',
      msg: `表单缓存中的${label} formId 非法（${matches[0].formId}）；请执行 xbbcli auth-refresh-cache 或手动传入 --formId`,
    };
  }
  if (!matches.length) {
    return {
      code: 'NO_FORMID',
      msg: `缺少 --formId，表单缓存中未找到${label}（businessType: ${businessType}）；请执行 xbbcli auth-refresh-cache 或手动传入 --formId`,
    };
  }
  const candidates = matches.map((form) => `${form.formId} ${form.name || ''}`.trim()).join('、');
  return {
    code: 'MULTIPLE_FORM',
    msg: `缓存中找到多个${label}（${candidates}）；请用 --formId 指定，或用 xbbcli form-get --formId <ID> 查看指定表单的字段`,
  };
}

// 取请求体示例：成功返回 [示例对象]，失败返回 [{code, msg}]（--demo 模式下错误行只有这两列）
// omitExampleKeys 用于剔除该接口不接收的顶层字段（如 product/add 不接受 formId）
export async function requestAddExample({ baseUrl, apiPath, corpid, formId, token, userId, debug, omitExampleKeys = [] }) {
  const gateway = await requestGateway({
    baseUrl,
    apiPath: FORM_EXAMPLE_API_PATH,
    payload: { corpid, formId, url: apiPath },
    token,
    userId,
    debug,
  });
  if (!gateway.ok) {
    return [{ code: gateway.code, msg: gateway.msg }];
  }
  if (gateway.data.code !== 1) {
    return [{ code: gateway.data.code ?? '', msg: gateway.data.msg ?? '未知错误' }];
  }
  const result = gateway.data.result || {};
  const rawExample = result.inputExample;
  const example = parseDataList(rawExample);
  if (example === undefined) {
    return [{ demo: String(rawExample ?? '') }];
  }
  if (!example) {
    return [{ code: 'DEMO_FAILED', msg: '接口未返回请求体示例（result.inputExample）' }];
  }
  for (const key of omitExampleKeys) {
    delete example[key];
  }
  if (Object.hasOwn(example, 'dataList')) {
    example.dataList = transformDataList(example.dataList, result.inputParameter);
  }
  // 非表单接口的示例里 corpid/userId 是接口文档占位值（如 "lsj"），换成当前生效配置更可信
  if (Object.hasOwn(example, 'corpid')) {
    example.corpid = corpid;
  }
  if (userId && Object.hasOwn(example, 'userId')) {
    example.userId = userId;
  }
  return [example];
}

const NO_CORPID_MESSAGE = '缺少本地 corpid；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';
const NO_TOKEN_MESSAGE = '缺少 token；请先执行 xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>';

// 新建类命令 --demo 的完整分支：鉴权检查 → formId 解析 → 取示例。
// businessType 为空表示接口与表单无关（部门/员工/标签/分类/开票信息等），此时 formId 传 0，param/get 会忽略它；
// omitFormId 用于接口本身不接收 formId、但示例里被通用拼装出来的场景。
export async function runAddDemo({ config, apiPath, formIdArg, businessType = '', label = '表单', omitFormId = false, requireFormId = false, debug = false }) {
  const { corpid, token, baseUrl, userId } = config || {};
  if (!corpid) {
    return [{ code: 'NO_CORPID', msg: NO_CORPID_MESSAGE }];
  }
  if (!token) {
    return [{ code: 'NO_TOKEN', msg: NO_TOKEN_MESSAGE }];
  }
  let formId = Number(formIdArg || 0);
  if (formId < 0) {
    return [{ code: 'INVALID_FORM_ID', msg: `--formId 必须是正整数（当前：${formIdArg}）` }];
  }
  if (!formId && requireFormId) {
    return [{ code: 'NO_FORMID', msg: `缺少 --formId，${label}无法从表单缓存自动解析；请用 --formId 指定` }];
  }
  if (!formId && businessType) {
    const resolved = resolveFormIdByBusinessType(corpid, businessType, label);
    if (resolved.code) {
      return [{ code: resolved.code, msg: resolved.msg }];
    }
    formId = resolved.formId;
    if (debug) process.stderr.write(`[debug] FormId resolved from form cache: ${formId}\n`);
  }
  return requestAddExample({
    baseUrl,
    apiPath,
    corpid,
    formId,
    token,
    userId,
    debug,
    omitExampleKeys: omitFormId ? ['formId'] : [],
  });
}
