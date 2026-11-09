// 邮件命令共用能力：JSON 数组参数解析、收件人展示与操作人 userId 解析

export function parseMailArray(raw, { code, label }) {
  const text = String(raw ?? '').trim();
  if (!text) {
    return { value: undefined };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: { code, msg: `${label} 必须是 JSON 数组字符串` } };
  }

  if (!Array.isArray(parsed)) {
    return { error: { code, msg: `${label} 必须是 JSON 数组字符串` } };
  }

  return { value: parsed };
}

function formatParty(party) {
  if (party == null) return '';
  if (typeof party !== 'object') return String(party);

  const name = party.name ?? '';
  const address = party.mailAddress ?? '';
  if (name && address) return `${name} <${address}>`;
  return String(name || address || '');
}

export function formatMailParties(value) {
  if (Array.isArray(value)) {
    return value.map(formatParty).filter((item) => item !== '').join('; ');
  }
  return formatParty(value);
}

export function stringifyMailValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function resolveMailUserId(kwargs, runtimeUserId = '') {
  return String(kwargs?.userId || runtimeUserId || '').trim();
}