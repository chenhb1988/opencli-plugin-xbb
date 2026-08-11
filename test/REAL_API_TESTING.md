# 真实接口测试

默认 `npm test` 只执行无网络的命令冒烟测试。`npm run test:real` 会读取本机
`~/.opencli/xbb/config.env` 中的凭证并请求真实 API；只允许执行名称以 `list`、
`detail` 或 `get` 结尾的只读命令。

## 配置用例

复制示例文件为本地用例文件：

```powershell
Copy-Item test/real-api-cases.example.json test/real-api-cases.json
```

在 `test/real-api-cases.json` 中手工填写真实的 `formId`、`dataId` 和其他命令参数。
该文件已加入 `.gitignore`，不会提交真实业务数据。

每个用例结构如下：

```json
{
  "name": "客户详情",
  "command": "customer-detail",
  "args": {
    "dataId": 12345678
  },
  "expect": {
    "minRows": 1
  }
}
```

`name` 用于输出，`command` 是 `opencli xbb` 后的命令名，`args` 使用命令参数名。
默认断言至少有一条非错误结果；可用 `expect.minRows` 提高最低返回行数，或设
`expect.success` 为 `false` 来保留只检查返回行数的特殊用例。
示例清单中无法预填真实 ID 的用例带有 `enabled: false`，填写参数后改为 `true`。

## 运行

```powershell
npm.cmd run test:real
```

使用列表返回的首条 `dataId` 自动更新对应详情用例：

```powershell
npm.cmd run test:real:sync-details
```

同步会运行存在对应详情命令的列表用例，忽略 `enabled`，并只在列表成功返回
有效 `dataId` 时覆盖详情用例的 `args.dataId`。

也可指定另一个用例文件：

```powershell
npm.cmd run test:real -- --cases .\test\my-real-api-cases.json
```
