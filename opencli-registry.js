const registry = new Map();

export const Strategy = Object.freeze({ PUBLIC: 'public', PRIVATE: 'private' });

export function fullName(site, name) {
  return `${site}/${name}`;
}

export function cli(definition) {
  const key = fullName(definition.site, definition.name);
  registry.set(key, definition);
  return definition;
}

export function registerCommand(definition) {
  return cli(definition);
}

export function getRegistry() {
  return registry;
}
