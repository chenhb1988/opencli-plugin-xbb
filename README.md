# opencli-plugin-xbb

`opencli` 的销帮帮 CRM (`xbb`) 插件。当前命令全部走 HTTP API，不依赖浏览器。

## 安装

```bash
npm install -g @jackwener/opencli
opencli plugin install github:chenhb1988/opencli-plugin-xbb
```

## 初始化配置

首次使用先保存 `corpid`、`token` 和 `userId`：

```bash
opencli xbb set-token --corpid <CORPID> --token <TOKEN> --userId <USERID>
```

执行后会写入：

```text
~/.opencli/xbb/config.json
```

文件内容包含：

- `corpid`
- `token`
- `baseurl`
- `userId`

同时会自动拉取两份表单清单并合并缓存到：

```text
~/.opencli/xbb/<corpid>.formlist.json
```

内部等价于执行：

```bash
opencli xbb form-list --corpid <CORPID> --saasMark 2 -f json
opencli xbb form-list --corpid <CORPID> --saasMark 1 -f json
```

`baseurl` 路由规则：

- `corpid` 以 `ding` 开头，或包含 `$$ding` 时，使用 `https://proapi.xbongbong.com`
- 其他 `corpid` 使用 `https://appapi.xbongbong.com`

## 当前支持的命令

### 配置

- `set-token`：保存 `corpid`、`token`、`userId`、`baseurl`，并刷新本地表单缓存

### 组织与人员

- `user-list`：用户列表
- `user-add`：新建用户
- `user-edit`：编辑用户
- `user-del`：删除用户
- `user-handover`：用户交接
- `department-list`：部门列表
- `department-add`：新建部门
- `department-edit`：编辑部门
- `department-del`：删除部门
- `role-list`：角色列表

### CRM 主数据

- `customer-list`：客户列表
- `customer-detail`：客户详情
- `customer-add`：新增客户
- `customer-edit`：编辑客户
- `customer-add-couser`：客户添加协同人
- `customer-del`：删除客户
- `customer-back`：客户退回公海
- `customer-handover`：客户移交
- `customer-distribution`：客户分配
- `customer-delete-mainuser`：客户删除负责人
- `customer-delete-couser`：客户删除协同人
- `customer-invoice-info`：客户开票信息列表
- `customer-invoice-info-add`：新增客户开票信息
- `customer-invoice-info-edit`：编辑客户开票信息
- `customer-invoice-address`：客户开票地址列表
- `customer-invoice-address-add`：新增客户开票地址
- `customer-invoice-address-edit`：编辑客户开票地址
- `clue-list`：线索列表
- `clue-add`：新建线索
- `clue-edit`：编辑线索
- `clue-detail`：线索详情
- `clue-del`：删除线索
- `clue-add-couser`：线索添加协同人
- `clue-delete-couser`：线索删除协同人
- `clue-delete-mainuser`：线索删除负责人
- `clue-distribution`：线索分配
- `clue-back`：线索退回公海
- `clue-thorough-delete`：线索彻底删除
- `contact-list`：联系人列表
- `contact-add`：新建联系人
- `contact-edit`：编辑联系人
- `contact-detail`：联系人详情
- `contact-del`：删除联系人
- `contact-add-couser`：联系人添加协同人
- `contact-add-mainuser`：联系人添加负责人
- `contact-delete-couser`：联系人删除协同人
- `contact-delete-mainuser`：联系人删除负责人
- `contact-handover`：联系人移交

### 销售机会操作

- `opportunity-add`：新建销售机会
- `opportunity-edit`：编辑销售机会
- `opportunity-list`：销售机会列表
- `opportunity-detail`：销售机会详情
- `opportunity-del`：删除销售机会
- `opportunity-handover`：销售机会移交
- `opportunity-add-mainuser`：销售机会添加负责人
- `opportunity-delete-mainuser`：销售机会删除负责人
- `opportunity-add-couser`：销售机会添加协同人
- `opportunity-delete-couser`：销售机会删除协同人

### 合同订单操作

- `contract-add`：新建合同订单
- `contract-edit`：编辑合同订单
- `contract-list`：合同订单列表
- `contract-detail`：合同订单详情
- `contract-del`：删除合同订单
- `contract-handover`：合同订单移交
- `contract-add-mainuser`：合同订单添加负责人
- `contract-outstock-add`：新建销售出库单
- `contract-outstock-edit`：编辑销售出库单
- `contract-outstock-detail`：销售出库单详情
- `contract-outstock-del`：删除销售出库单
- `contract-outstock-list`：销售出库单列表
- `contract-delete-mainuser`：合同订单删除负责人
- `contract-add-couser`：合同订单添加协同人
- `contract-delete-couser`：合同订单删除协同人

### 跟进记录操作

- `communicate-add`：新建跟进记录
- `communicate-edit`：编辑跟进记录
- `communicate-list`：跟进记录列表
- `communicate-detail`：跟进记录详情
- `communicate-del`：删除跟进记录
- `communicate-plan-list`：拜访计划列表
- `communicate-plan-detail`：拜访计划详情
- `communicate-plan-add`：拜访计划新建
- `communicate-plan-cancel`：拜访计划取消
- `communicate-plan-del`：拜访计划删除
- `communicate-plan-single-operate`：拜访计划延期
- `market-activity-list`：市场活动列表
- `market-activity-add`：新建市场活动
- `market-activity-edit`：编辑市场活动
- `market-activity-detail`：市场活动详情
- `market-activity-del`：删除市场活动
- `market-activity-handover`：市场活动移交

### 表单相关

- `form-list`：表单模板列表
- `form-get`：表单模板字段定义，在填充参数时不清楚参数含义/下拉框可选项值，调用本接口获取 form 解释
- `form-data-list`：自定义表单数据列表
- `form-data-detail`：自定义表单数据详情
- `form-data-add`：新增自定义表单数据
- `form-data-edit`：编辑自定义表单数据
- `form-data-del`：删除自定义表单数据
- `form-data-add-mainuser`：自定义表单添加负责人
- `form-data-delete-mainuser`：自定义表单删除负责人
- `form-data-add-couser`：自定义表单添加协同人
- `form-data-delete-couser`：自定义表单删除协同人
- `form-data-handover`：自定义表单移交

### 产品

- `product-list`：产品列表
- `product-detail`：产品详情
- `product-add`：新建产品
- `product-edit`：编辑产品
- `product-del`：删除产品
- `product-online`：产品上下架
- `product-category-list`：产品分类列表
- `product-category-add`：新建产品分类
- `product-category-update`：编辑产品分类
- `product-category-del`：删除产品分类

### 应收款操作

- `payment-list`：应收款列表
- `payment-add`：新建应收款
- `payment-edit`：编辑应收款
- `payment-detail`：应收款详情
- `payment-del`：删除应收款
- `payment-handover`：应收款移交
- `payment-add-mainuser`：应收款添加负责人
- `payment-delete-mainuser`：应收款删除负责人
- `payment-add-couser`：应收款添加协同人
- `payment-delete-couser`：应收款删除协同人

### 回款与退款

- `payment-sheet-list`：回款单列表
- `payment-sheet-add-write-off`：新建核销回款单
- `payment-sheet-edit-write-off`：编辑核销回款单
- `payment-sheet-add-red`：新建红冲回款单
- `payment-sheet-edit-red`：编辑红冲回款单
- `payment-sheet-add-bad-debt`：新建坏账回款单
- `payment-sheet-edit-bad-debt`：编辑坏账回款单
- `payment-sheet-add-pre`：新建预收款回款单
- `payment-sheet-get-amount-detail`：回款单金额明细
- `payment-sheet-detail`：回款单详情
- `payment-sheet-del`：删除回款单
- `payment-sheet-handover`：回款单移交
- `pay-plan-add`：新增付款计划
- `pay-plan-add-couser`：付款计划添加协同人
- `pay-plan-add-mainuser`：付款计划添加负责人
- `pay-plan-delete-couser`：付款计划删除协同人
- `pay-plan-delete-mainuser`：付款计划删除负责人
- `pay-sheet-list`：付款单列表
- `pay-sheet-add-write-off`：新建付款单
- `pay-sheet-edit-write-off`：编辑付款单
- `pay-sheet-add-red`：新建核销付款单红冲
- `pay-sheet-edit-red`：编辑核销付款单红冲
- `pay-sheet-add-bad`：新建核销付款单坏账
- `pay-sheet-edit-bad`：编辑核销付款单坏账
- `pay-sheet-add-couser`：付款单添加协同人
- `pay-sheet-add-mainuser`：付款单添加负责人
- `pay-sheet-delete-couser`：付款单删除协同人
- `pay-sheet-delete-mainuser`：付款单删除负责人
- `pay-sheet-get-amount-detail`：付款单金额明细
- `pay-sheet-detail`：付款单详情
- `pay-sheet-del`：删除付款单
- `refund-list`：退货退款单列表
- `refund-add`：新建退货退款单
- `refund-edit`：编辑退货退款单
- `refund-detail`：退货退款单详情
- `refund-del`：删除退货退款单

### 新版工单（服务云）
- `work-order-list`：新版工单列表命令
- `work-order-detail`：工单详情
- `work-order-add`：新增工单
- `work-order-edit`：编辑工单
- `work-order-del`：删除工单
- `work-order-operate`：工单流转
- `work-order-template-list`：工单模板列表
- `work-order-template-detail`：工单模板详情
- `workorder-handover`：移交工单负责人
- `workorder-add-couser`：添加工单协同人
- `workorder-delete-couser`：删除工单协同人


### 工作报告

- `work-report-daily-list`：日报列表
- `work-report-daily-detail`：日报详情
- `work-report-daily-add`：新建日报
- `work-report-daily-edit`：编辑日报
- `work-report-daily-del`：删除日报
- `work-report-daily-get-work-plan`：获取工作计划
- `work-report-weekly-list`：周报列表
- `work-report-weekly-detail`：周报详情
- `work-report-weekly-add`：新建周报
- `work-report-weekly-edit`：编辑周报
- `work-report-weekly-del`：删除周报
- `work-report-monthly-list`：月报列表
- `work-report-monthly-detail`：月报详情
- `work-report-monthly-add`：新建月报
- `work-report-monthly-edit`：编辑月报
- `work-report-monthly-del`：删除月报

### 阶段流转

- `stage-get`：阶段获取
- `stage-jump`：阶段跳转

### 旧工单（已过时，不建议使用）
- `workorderlist`：旧版工单列表命令
- `workorderproductlist`：工单配件列表
- `worktimerecordlist`：工时记录列表
- `worktimerecorddetail`：工时记录详情

## 命名说明

仓库里现在同时保留两套工单命名：

- 旧命名：`workorderlist`、`workorderproductlist`
- 新命名：`work-order-list`、`work-order-detail`、`work-order-add`、`work-order-edit`、`work-order-del`、`work-order-operate`

建议新接入优先使用带连字符的 `work-order-*` 命令。`workorderlist` 仍保留，主要用于兼容旧功能。

## 通用行为

- 所有命令都要求有效的 `--corpid`
- 如果命令行传入的 `--corpid` 与本地配置中的 `corpid` 不一致，会返回 `CORPID_MISMATCH`
- 大部分命令会优先从 `~/.opencli/xbb/config.json` 读取 `token`
- 所有命令会从配置中读取 `userId` 并附加到请求 header 中
- 大部分命令需要formId参数，可以根据业务名称或businessType从~/.opencli/xbb/<corpid>.formlist.json中获取formId
- 未传入的可选参数不会进入请求体
- `--attr` 和 `--value` 只有同时提供时才会拼入查询条件
- `--limit` 是在响应映射之后截断结果
- 失败时返回的是带 `code` / `msg` 的结果行，不抛异常
- 加 `--debug` 可以输出 `requestBody` 和 `responseBody`
- 在填充参数时不清楚参数含义/下拉框可选项值，调用 `form-get` 命令获取 form 解释

## 常用示例

### 基础配置/初始化

```bash
opencli xbb set-token --corpid your_corpid --token your_token --userId your_userid
```

### 员工信息

```bash
opencli xbb user-list --corpid your_corpid
opencli xbb user-list --corpid your_corpid --nameLike 张三 --debug
```

### 表单查询

```bash
opencli xbb form-list --corpid your_corpid --saasMark 1
opencli xbb form-list --corpid your_corpid --saasMark 1 --businessType 100
opencli xbb form-list --corpid your_corpid --saasMark 2 --name 工单

opencli xbb form-get --corpid your_corpid --formId 19274
opencli xbb form-get --corpid your_corpid --formId 19277 --subBusinessType 100
```

### 客户

```bash
opencli xbb customer-list --corpid your_corpid --formId 12345
opencli xbb customer-list --corpid your_corpid --formId 12345 --attr text_1 --value apiTest.001

opencli xbb customer-add --corpid your_corpid --formId 19274 --dataList '{"text_1":"apiTest.001"}'
opencli xbb customer-edit --corpid your_corpid --formId 19274 --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
opencli xbb customer-detail --corpid your_corpid --dataId 310992
opencli xbb customer-add-couser --corpid your_corpid --dataId 310995 --businessUserIdList '["xbbTest002"]'
```

### 表单模型/业务数据

```bash
opencli xbb form-data-list --corpid your_corpid --formId 19274
opencli xbb form-data-detail --corpid your_corpid --dataId 310992
opencli xbb form-data-add --corpid your_corpid --formId 19274 --dataList '{"text_1":"apiTest.001"}'
opencli xbb form-data-edit --corpid your_corpid --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
opencli xbb form-data-del --corpid your_corpid --dataId 310992
```

### 产品、回款、退款

```bash
opencli xbb product-list --corpid your_corpid --attr serialNo --value CP.API.0001
opencli xbb product-detail --corpid your_corpid --dataId 10001
opencli xbb product-category-list --corpid your_corpid
opencli xbb product-category-update --corpid your_corpid --dataId 306 --name 分类A
opencli xbb product-category-del --corpid your_corpid --dataId 306

opencli xbb payment-list --corpid your_corpid --attr serialNo --value PMO.API.0001
opencli xbb payment-sheet-list --corpid your_corpid --attr serialNo --value RMO.API.0001
opencli xbb payment-sheet-list --corpid your_corpid --subBusinessType 702
opencli xbb payment-sheet-edit-write-off --corpid your_corpid --dataId 1194 --dataList '{"text_7":"编辑备注"}'
opencli xbb payment-sheet-add-red --corpid your_corpid --dataList '{"serialNo":"RMO.API.0001"}'
opencli xbb payment-sheet-edit-red --corpid your_corpid --dataId 1198 --dataList '{"text_7":"编辑红冲备注"}'
opencli xbb payment-sheet-add-bad-debt --corpid your_corpid --dataList '{"serialNo":"RMO.API.0002"}'
opencli xbb refund-list --corpid your_corpid --attr serialNo --value RFO.API.0001
```

### 工单新命名

```bash
opencli xbb work-order-list --corpid your_corpid --formId 7526034
opencli xbb work-order-list --corpid your_corpid --formId 7526034 --attr serialNo --value WOO.20210616001
opencli xbb work-order-list --corpid your_corpid --formId 7526034 --conditions "[{\"attr\":\"text_4\",\"value\":[4],\"symbol\":\"in\"},{\"attr\":\"ownerId\",\"value\":[\"02415643151585\"],\"symbol\":\"equal\"}]"

opencli xbb work-order-detail --corpid your_corpid --dataId 663
opencli xbb work-order-add --corpid your_corpid --formId 7526034 --dataList '{"text_1":"测试工单"}'
opencli xbb work-order-edit --corpid your_corpid --dataId 663 --dataList '{"text_1":"测试工单-更新"}'
opencli xbb work-order-del --corpid your_corpid --dataId 663
opencli xbb work-order-operate --corpid your_corpid --dataId 663 --operateType 12 --userId "02415643151585"
opencli xbb work-order-operate --corpid your_corpid --dataId 663 --operateType 1 --data '{"cancelReason":"测试取消"}'
```

### 工单旧命名与工时

```bash
opencli xbb workorderlist --corpid your_corpid --formId 689 --attr serialNo --value WOO.20210616001
opencli xbb workorderproductlist --corpid your_corpid --dataId 663
opencli xbb work-order-template-list --corpid your_corpid
opencli xbb work-order-template-detail --corpid your_corpid --formId 689

opencli xbb worktimerecordlist --corpid your_corpid
opencli xbb worktimerecordlist --corpid your_corpid --conditions "[{\"attr\":\"ownerId\",\"value\":[\"02415643151585\"],\"symbol\":\"equal\"}]"
opencli xbb worktimerecorddetail --corpid your_corpid --dataId 10001
```

## 参数约定

- `dataList`：JSON 对象字符串，例如 `{"text_1":"value"}`
- `conditions`：JSON 数组字符串，例如 `[{"attr":"text_4","value":[4],"symbol":"in"}]`
- `businessUserIdList`：支持 JSON 数组或逗号分隔字符串
- `operateType` 常见值：
  - `1` 取消
  - `2` 重启
  - `3` 移交
  - `4` 分配
  - `8` 接受
  - `10` 开始
  - `11` 签到
  - `12` 完成
  - `13` 签退
  - `15` 回退
  - `16` 结算
  - `17` 回访
  - `18` 指派
  - `19` 自由节点完成
  - `20` 编辑回执单

## 调试

命令加 `--debug` 后，会把请求体和原始响应一起带回结果列，便于排查签名、参数拼装和接口返回问题。
