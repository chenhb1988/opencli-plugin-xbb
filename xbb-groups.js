import { registerGroup } from './xbb-registry.js';

registerGroup({
  site: 'xbb',
  name: 'label',
  description: 'businessType: -1；标签/标签分组：标签增删改、彻底删除、还原、判重、批量打标/移除，分组增删改查',
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
  description: 'businessType: 702；回款单：列表、详情、删除、移交、金额明细，新建/编辑核销/红冲/坏账/预收款回款单',
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