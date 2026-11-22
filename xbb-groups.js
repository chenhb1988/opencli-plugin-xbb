import { registerGroup } from './xbb-registry.js';

registerGroup({
  site: 'xbb',
  name: 'auth',
  description: '登录授权/登出、回显当前配置并校验 token、刷新本地缓存、查询员工业务权限',
});

registerGroup({
  site: 'xbb',
  name: 'communicate',
  description: 'businessType: 501（拜访计划 601）；跟进记录：列表、详情、新建、编辑、删除；拜访计划：列表、详情、新建、取消、删除、延期',
});

registerGroup({
  site: 'xbb',
  name: 'contact',
  description: 'businessType: 401；联系人：列表、详情、新建、编辑、删除、移交，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'contract',
  description: 'businessType: 201（销售出库单 1504）；合同订单：列表、详情、新建、编辑、删除、移交，添加/删除负责人/协同人；销售出库单：列表、详情、新建、编辑、删除',
});

registerGroup({
  site: 'xbb',
  name: 'product',
  description: 'businessType: 2401；产品：列表、详情、新建、编辑、删除、上下架，产品分类列表/新建/编辑/删除',
});

registerGroup({
  site: 'xbb',
  name: 'quotation',
  description: 'businessType: 4700；报价单：列表、详情、新建、编辑、删除、移交，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'refund',
  description: 'businessType: 202；退货退款单：列表、详情、新建、编辑、删除',
});

registerGroup({
  site: 'xbb',
  name: 'work-task',
  description: 'businessType: 21500；工作任务：详情、新建、编辑、移交，添加/删除协同人',
});

registerGroup({
  site: 'xbb',
  name: 'opportunity',
  description: 'businessType: 301；销售机会：列表、详情、新建、编辑、删除、移交，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'market-activity',
  description: 'businessType: 8100；市场活动：列表、详情、新建、编辑、删除、移交',
});

registerGroup({
  site: 'xbb',
  name: 'department',
  description: 'businessType: -1；部门：列表、新建、编辑、删除',
});

registerGroup({
  site: 'xbb',
  name: 'invoice',
  description: 'businessType: 901；销项发票：列表、详情、新建、编辑、删除、作废、红冲、金额明细',
});

registerGroup({
  site: 'xbb',
  name: 'customer',
  description: 'businessType: 100；客户：列表、详情、新建、编辑、删除、退回公海、分配、移交，添加/删除负责人/协同人，开票信息与开票地址',
});

registerGroup({
  site: 'xbb',
  name: 'form-data',
  description: 'businessType: 0；自定义表单数据：列表、详情、新增、编辑、删除、移交，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'user',
  description: 'businessType: -1；用户：列表、新建、编辑、删除、交接',
});

registerGroup({
  site: 'xbb',
  name: 'token',
  description: '本地凭证配置（无 businessType）：保存/列出/切换/删除公司配置，生成个人 token',
});

registerGroup({
  site: 'xbb',
  name: 'label',
  description: 'businessType: -1；标签/标签分组：标签增删改、彻底删除、还原、判重、批量打标/移除，分组增删改查',
});

registerGroup({
  site: 'xbb',
  name: 'lead',
  description: 'businessType: 8000；线索(别名clue)：列表/详情/新建/编辑/删除/彻底删除/分配/退回公海/移交，添加/删除协同人/负责人',
});

registerGroup({
  site: 'xbb',
  name: 'mail',
  description: '邮件收发/草稿箱：发送、列表、详情，草稿新建/编辑',
});

registerGroup({
  site: 'xbb',
  name: 'other-income',
  description: 'businessType: 5710；其他收入单：新建、编辑、删除、详情、列表',
});

registerGroup({
  site: 'xbb',
  name: 'other-expense',
  description: 'businessType: 5750；其他支出单：新建、编辑、删除、详情、列表',
});

registerGroup({
  site: 'xbb',
  name: 'work-order',
  description: 'businessType: 20300（资产接口 -1）；新工单/服务云：工单列表/详情/新建/编辑/删除/流转/动态/移交/协同人，工单资产增删改查/移交/负责人',
});

registerGroup({
  site: 'xbb',
  name: 'workorder',
  description: 'businessType: 2301（已过时不推荐使用）；工单列表、配件列表、工单模板列表/详情',
});

registerGroup({
  site: 'xbb',
  name: 'work-report',
  description: 'businessType: 2102/2103/2104；日报/周报/月报：列表、详情、新建、编辑、删除，日报工作计划',
});

registerGroup({
  site: 'xbb',
  name: 'pay-plan',
  description: 'businessType: 801；付款计划：列表、详情、新增、移交，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'payment',
  description: 'businessType: 701；应收款：列表、详情、新建、编辑、删除、移交，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'payment-sheet',
  description: 'businessType: 702；回款单：列表、详情、删除、移交、金额明细，新建/编辑核销/红冲/坏账/预收款回款单，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'pay-sheet',
  description: 'businessType: 802；付款单：列表、详情、删除、金额明细，新建/编辑核销/红冲/坏账，添加/删除负责人/协同人',
});

registerGroup({
  site: 'xbb',
  name: 'production',
  description: '生产单/生产领料单/生产入库单：各类单据的列表与详情',
});

registerGroup({
  site: 'xbb',
  name: 'receipt-order',
  description: 'businessType: 20340；回执单：新建、编辑、删除、详情、列表',
});

registerGroup({
  site: 'xbb',
  name: 'work-time-record',
  description: 'businessType: 21100；工时记录：列表、详情、新增、编辑、删除、移交给负责人，添加/删除负责人/协同人',
});