import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, Strategy } from 'file:///C:/Users/chb/AppData/Roaming/npm/node_modules/@jackwener/opencli/dist/registry.js';

const CONFIG_DIR = path.join(os.homedir(), '.opencli', 'xbb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

cli({
  site: 'xbb',
  name: 'set-token',
  description: '保存 xbb API token 到本地配置文件',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'token', type: 'str', help: '要保存的 API token' },
  ],
  columns: ['status', 'message', 'configFile'],
  func: async (_page, kwargs) => {
    const token = String(kwargs.token || '');
    if (!token) {
      return [{ status: 'error', message: '缺少 --token', configFile: CONFIG_FILE }];
    }
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ token }, null, 2) + '\n', 'utf8');
    return [{ status: 'ok', message: '已保存 token 到本地配置文件', configFile: CONFIG_FILE }];
  },
});
