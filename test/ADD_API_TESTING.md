# Add 接口测试

`add-api-cases.example.json` 按 `~/.opencli/xbb/command-map.md` 的 formId 选择，并使用 `opencli xbb form-get --formId <formId> -f json` 返回的字段解释填写 `dataList`。每个实体创建用例后，负责人/协同人和客户开票用例通过 `from` 自动复用刚创建的 `dataId`。

默认只校验用例文件，不访问网络：

```powershell
npm.cmd run test:add
```

确认 `~/.opencli/xbb/config.env`、用户 ID 和测试数据无误后，显式执行真实写入：

```powershell
node test/add-api-test.mjs --execute
```

真实执行会按文件顺序创建数据，失败即停止；测试数据带有时间戳，便于在 CRM 中检索和清理。`--execute` 可能产生真实业务数据，请勿在生产租户运行。


输出原始命令
 node test\add-api-test.mjs --print-commands

## 合同订单（`4579303`）已验证用例

已通过真实 `contract-add` 创建验证。关联产品 `array_4` 的 `text_1` 必须传产品**子产品 ID**，不能传 `product-add` 返回的产品主记录 ID；当前测试租户已验证的子产品 ID 为 `25430570`。

每个关联产品还必须提供 `text_4`（是否周期性产品，`是`）、`text_6`（产品分类，`软件主产品`）、`text_5`、`text_2`、`date_1`、`date_2`，以及金额/数量字段。完整的成功请求参数已写入 `add-api-cases.example.json`。主表字段 `text_27` 使用 `否`，因此不需要填写分润子表单。

## 销售机会（`572930`）已验证用例

已通过真实 `opportunity-add` 创建验证。`text_17`（销售阶段）使用 `了解需求`，`text_18`（输单原因）使用 `竟品赢单`。负责人 `ownerId` 必须传用户 ID 数组，例如 `["${userId}"]`，传单个字符串会返回 `701020`。完整的成功请求参数已写入 `add-api-cases.example.json`。

## 跟进记录（`572943`）已验证用例

已通过真实 `communicate-add` 创建验证。`text_4`（跟进方式）使用 `无效联系`，`text_2`（是否有效联系）使用 `无效沟通`，`text_9`（是否培训）使用 `未培训`。这些值均取当前表单解释中对应 `items[0].text`；完整成功参数已写入 `add-api-cases.example.json`。

## 拜访计划（`572951`）已验证用例

已通过真实 `communicate-plan-add` 创建验证。`array_1`（执行人）是选项数组，使用 `["负责人"]`，不能传用户 ID；`text_19`（拜访类型）使用 `新签`，`text_20`（拜访模式）使用 `线下拜访`。执行时间 `date_1` 必须晚于当前时刻，因此用例使用 `${timestampSecondsPlusDay}`，测试运行器会生成未来一天的 Unix 秒级时间戳。`departmentId` 必须是有效的数值部门 ID；当前测试变量使用已验证的 `63749999`。

## 市场活动（`2795677`）已验证用例

已通过真实 `market-activity-add` 创建验证。命令本身不支持 `--formId`，该表单 ID 仅用于通过 `form-get` 查询字段解释。`text_7`（投放渠道）使用首项 `抖音`，负责人 `ownerId` 必须传用户 ID 数组，例如 `["${userId}"]`，不能传单个字符串。完整成功参数已写入 `add-api-cases.example.json`。

## 产品（`572947`）已验证用例

已通过真实 `product-add` 创建验证。命令本身不支持 `--formId`，表单 ID 仅用于查询字段解释。`num_13`（分类）是分类关联字段，必须传有效的数值分类 ID；当前测试变量使用分类列表首项 `23166`（软件主产品）。`text_6`（是否周期性产品）使用首项 `是`。完整成功参数已写入 `add-api-cases.example.json`。

## 产品分类已验证用例

已通过真实 `product-category-add` 创建验证。分类名称是顶层必填参数 `--name`，不能放入 `dataList`。测试执行器以 `testName` 保存用例显示名称，避免与命令的 `name` 参数冲突。产品分类新增还要求请求体带操作人 ID；命令会优先使用 `--userId`，未提供时自动使用本地配置中的 `userId`。`parentId` 和 `sort` 为可选数值，未提供时不发送。
