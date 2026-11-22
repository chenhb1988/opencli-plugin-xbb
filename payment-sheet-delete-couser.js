import { cli, Strategy } from './xbb-registry.js';
import { RELATION_COLUMNS, runUserRelation } from './xbb-business-user.js';

const API_PATH = '/pro/v2/api/paymentSheet/deleteCoUser';

cli({
  site: 'xbb',
  name: 'payment-sheet-delete-couser',
  group: 'payment-sheet',
  description: '回款单删除协同人接口（businessType: 702）',
  strategy: Strategy.PUBLIC,
  access: 'write',
  browser: false,
  domain: 'proapi.xbongbong.com',
  args: [
    { name: 'dataId', type: 'int', help: '回款单id（必填）' },
    { name: 'businessUserIdList', type: 'str', help: '需删除的协同人id列表，JSON数组字符串（必填）' },
    { name: 'userId', type: 'str', default: '', help: '操作人id（可选）' },
    { name: 'debug', type: 'bool', default: false, help: '输出请求体和返回体调试信息' },
  ],
  columns: RELATION_COLUMNS,
  func: (kwargs) => runUserRelation({ kwargs, apiPath: API_PATH }),
});