import { cli, Strategy } from './xbb-registry.js';
import { saveCompanyCredentials } from './xbb-token-store.js';

cli({
  site: 'xbb',
  name: 'token-set',
  description: '保存 xbb API token,corpid,formId清单 到本地配置文件，并缓存部门与员工清单(<corpid>.department-user.json)；其他命令需要意图识别或找formId时，优先查命令映射文件(<corpid>.command-map.md)',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  args: [
    { name: 'corpid', type: 'str', help: '公司id（必填）' },
    { name: 'token', type: 'str', help: '要保存的 API token' },
    { name: 'userId', type: 'str', help: '操作人id（必填）' },
    { name: 'noEnv', type: 'bool', default: false, help: '不写入环境变量，仅保存到 config.env' },
  ],
  columns: ['status', 'message', 'configFile', 'corpid', 'baseurl', 'userId', 'enable', 'companyCount', 'formlistFile', 'commandMapFile', 'departmentUserFile', 'corpName', 'userName', 'envStored', 'envFile'],
  func: saveCompanyCredentials,
});