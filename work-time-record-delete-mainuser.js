import { cli, Strategy } from './xbb-registry.js';
import { RELATION_COLUMNS, runUserRelation } from './xbb-business-user.js';

const API_PATH = '/pro/v2/api/workTimeRecord/deleteMainUser';

cli({
  site: 'xbb',
  name: 'work-time-record-delete-mainuser',
  group: 'work-time-record',
  description: '删除工时记录负责人（businessType: 21100）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '工时记录id（必填）' },
    { name: 'businessUserIdList', type: 'str', help: '需删除的负责人id列表，JSON数组字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: RELATION_COLUMNS,
  func: (kwargs) => runUserRelation({ kwargs, apiPath: API_PATH }),
});