import { cli, Strategy } from './opencli-registry.js';

const VERSION = 'v1.3';

cli({
  site: 'xbb',
  name: 'version',
  description: '查看销帮帮插件版本号',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [],
  columns: ['version'],
  func: async function () {
    return [{ version: VERSION }];
  },
});
