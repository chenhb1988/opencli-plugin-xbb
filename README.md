# opencli-plugin-xbb

`opencli` 的销帮帮 CRM (`xbb`) 插件。当前命令全部走 HTTP API，不依赖浏览器。

## 安装

```bash
npm install -g @jackwener/opencli
opencli plugin install github:chenhb1988/opencli-plugin-xbb
```

## 初始化配置

首次使用先保存 `corpid` 和 `token`：

```bash
opencli xbb set-token --corpid <CORPID> --token <TOKEN>
```

执行后会写入：

```text
~/.opencli/xbb/config.json
```

文件内容包含：

- `corpid`
- `token`
- `baseurl`

同时会自动拉取两份表单清单并合并缓存到：

```text
~/.opencli/xbb/<corpid>.formlist.json
```

内部等价于执行：

```bash
opencli xbb formlist --corpid <CORPID> --saasMark 2 -f json
opencli xbb formlist --corpid <CORPID> --saasMark 1 -f json
```

`baseurl` 路由规则：

- `corpid` 以 `ding` 开头，或包含 `$$ding` 时，使用 `https://proapi.xbongbong.com`
- 其他 `corpid` 使用 `https://appapi.xbongbong.com`

## 当前支持的命令

### 配置

- `set-token`：保存 `corpid`、`token`、`baseurl`，并刷新本地表单缓存

### 组织与人员

- `userlist`：用户列表
- `departmentlist`：部门列表

### CRM 主数据

- `customerlist`：客户列表
- `customerdetail`：客户详情
- `customeradd`：新增客户
- `customeredit`：编辑客户
- `customeraddcouser`：客户添加协同人
- `customer-del`：删除客户
- `customer-back`：客户退回公海
- `customer-handover`：客户移交
- `customer-distribution`：客户分配
- `customer-delete-mainuser`：客户删除负责人
- `customer-delete-couser`：客户删除协同人
- `cluelist`：线索列表
- `contactlist`：联系人列表



### 销售机会操作

- `opportunity-add`：新建销售机会
- `opportunity-edit`：编辑销售机会
- `opportunitylist`：销售机会列表
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
- `contractlist`：合同订单列表
- `contract-detail`：合同订单详情
- `contract-del`：删除合同订单
- `contract-handover`：合同订单移交
- `contract-add-mainuser`：合同订单添加负责人
- `contract-delete-mainuser`：合同订单删除负责人
- `contract-add-couser`：合同订单添加协同人
- `contract-delete-couser`：合同订单删除协同人

### 跟进记录操作

- `communicate-add`：新建跟进记录
- `communicate-edit`：编辑跟进记录
- `communicatelist`：跟进记录列表
- `communicate-detail`：跟进记录详情
- `communicate-del`：删除跟进记录

### 表单相关

- `formlist`：表单模板列表
- `formget`：表单模板字段定义，在填充参数时不清楚参数含义/下拉框可选项值，调用本接口获取form解释
- `formdatalist`：自定义表单数据列表
- `formdatadetail`：自定义表单数据详情
- `formdataadd`：新增自定义表单数据
- `formdataedit`：编辑自定义表单数据
- `formdatadel`：删除自定义表单数据

### 产品

- `productlist`：产品列表
- `productdetail`：产品详情
- `productcategorylist`：产品分类列表

### 应收款操作

- `paymentlist`：应收款列表
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

- `paymentsheetlist`：回款单列表
- `refundlist`：退货退款单列表

### 新版工单（服务云）
- `work-order-list`：新版工单列表命令
- `work-order-detail`：工单详情
- `work-order-add`：新增工单
- `work-order-edit`：编辑工单
- `work-order-del`：删除工单
- `work-order-operate`：工单流转
- `workorder-handover`：移交工单负责人
- `workorder-add-couser`：添加工单协同人
- `workorder-delete-couser`：删除工单协同人


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
- 大部分命令需要formId参数，可以根据业务名称或businessType从~/.opencli/xbb/<corpid>.formlist.json中获取formId
- 未传入的可选参数不会进入请求体
- `--attr` 和 `--value` 只有同时提供时才会拼入查询条件
- `--limit` 是在响应映射之后截断结果
- 失败时返回的是带 `code` / `msg` 的结果行，不抛异常
- 加 `--debug` 可以输出 `requestBody` 和 `responseBody`
- 在填充参数时不清楚参数含义/下拉框可选项值，调用 formget命令获取form解释

## 常用示例

### 基础配置/初始化

```bash
opencli xbb set-token --corpid your_corpid --token your_token


### 员工信息

```bash
opencli xbb userlist --corpid your_corpid
opencli xbb userlist --corpid your_corpid --nameLike 张三 --debug
```

### 表单查询

```bash
opencli xbb formlist --corpid your_corpid --saasMark 1
opencli xbb formlist --corpid your_corpid --saasMark 1 --businessType 100
opencli xbb formlist --corpid your_corpid --saasMark 2 --name 工单

opencli xbb formget --corpid your_corpid --formId 19274
opencli xbb formget --corpid your_corpid --formId 19277 --subBusinessType 100
```

### 客户

```bash
opencli xbb customerlist --corpid your_corpid --formId 12345
opencli xbb customerlist --corpid your_corpid --formId 12345 --attr text_1 --value apiTest.001

opencli xbb customeradd --corpid your_corpid --formId 19274 --dataList '{"text_1":"apiTest.001"}'
opencli xbb customeredit --corpid your_corpid --formId 19274 --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
opencli xbb customerdetail --corpid your_corpid --dataId 310992
opencli xbb customeraddcouser --corpid your_corpid --dataId 310995 --businessUserIdList '["xbbTest002"]'

### 表单模型/业务数据

```bash
opencli xbb formdatalist --corpid your_corpid --formId 19274
opencli xbb formdatadetail --corpid your_corpid --dataId 310992
opencli xbb formdataadd --corpid your_corpid --formId 19274 --dataList '{"text_1":"apiTest.001"}'
opencli xbb formdataedit --corpid your_corpid --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
opencli xbb formdatadel --corpid your_corpid --dataId 310992
```

### 产品、回款、退款

```bash
opencli xbb productlist --corpid your_corpid --attr serialNo --value CP.API.0001
opencli xbb productdetail --corpid your_corpid --dataId 10001
opencli xbb productcategorylist --corpid your_corpid

opencli xbb paymentlist --corpid your_corpid --attr serialNo --value PMO.API.0001
opencli xbb paymentsheetlist --corpid your_corpid --attr serialNo --value RMO.API.0001
opencli xbb paymentsheetlist --corpid your_corpid --subBusinessType 702
opencli xbb refundlist --corpid your_corpid --attr serialNo --value RFO.API.0001
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
