const registry = new Map();
const groups = new Map();

export const Strategy = Object.freeze({ PUBLIC: 'public', PRIVATE: 'private' });

export function fullName(site, name) {
  return `${site}/${name}`;
}

export function cli(definition) {
  const key = fullName(definition.site, definition.name);
  registry.set(key, definition);
  return definition;
}

// 分组元数据独立于子命令注册：用于顶层帮助展示分组入口与描述
export function registerGroup(definition) {
  const key = fullName(definition.site, definition.name);
  groups.set(key, definition);
  return definition;
}

export function getGroups() {
  return groups;
}

export function registerCommand(definition) {
  return cli(definition);
}

export function getRegistry() {
  return registry;
}
