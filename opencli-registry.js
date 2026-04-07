import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

async function importRegistry(specifier) {
  try {
    return await import(specifier);
  } catch {
    return null;
  }
}

async function importRegistryFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return import(pathToFileURL(filePath).href);
}

async function loadRegistryModule() {
  const directSpecifiers = [
    '@jackwener/opencli/registry',
    '@jackwener/opencli/dist/registry-api.js',
  ];

  for (const specifier of directSpecifiers) {
    const module = await importRegistry(specifier);
    if (module) return module;

    try {
      const resolved = require.resolve(specifier);
      const resolvedModule = await importRegistryFromFile(resolved);
      if (resolvedModule) return resolvedModule;
    } catch {
      // Ignore resolution failures and continue to fallback paths.
    }
  }

  const roamingDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const prefix = process.env.npm_config_prefix || '';
  const candidates = [
    process.env.OPENCLI_REGISTRY_PATH,
    path.join(roamingDir, 'npm', 'node_modules', '@jackwener', 'opencli', 'dist', 'registry-api.js'),
    path.join(prefix, 'node_modules', '@jackwener', 'opencli', 'dist', 'registry-api.js'),
    path.join(prefix, 'lib', 'node_modules', '@jackwener', 'opencli', 'dist', 'registry-api.js'),
  ];

  for (const candidate of candidates) {
    const module = await importRegistryFromFile(candidate);
    if (module) return module;
  }

  throw new Error('Cannot resolve @jackwener/opencli registry. Install @jackwener/opencli or set OPENCLI_REGISTRY_PATH.');
}

const registryModule = await loadRegistryModule();

export const {
  cli,
  Strategy,
  getRegistry,
  fullName,
  registerCommand,
} = registryModule;
