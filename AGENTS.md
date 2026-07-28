# AGENTS.md

本文件为 AI Agent 在该仓库中工作时提供指引。

## 仓库说明

这是 `opencli` 的销帮帮 CRM（`xbb`）插件。每个顶层 `*.js` 文件通过 `opencli-registry.js` 注册一条 `opencli xbb <command>` 命令。无构建步骤、无 lint、无测试框架。

## 安装

```bash
npm install -g @jackwener/opencli
opencli plugin install github:chenhb1988/opencli-plugin-xbb
opencli xbb set-token --corpid <CORPID> --token <TOKEN>
```

凭证保存在 `~/.opencli/xbb/config.json`。`set-token` 同时会将表单列表缓存写入 `~/.opencli/xbb/<corpid>.formlist.json`。

## 验证方式

无自动化测试。修改命令后，加 `--debug` 对真实 API 运行，检查序列化后的请求体和原始响应。

## 代码风格规范

- **仅使用 ESM** — `package.json` 中 `"type": "module"`，始终使用 `import`/`export`。
- **Node 内置模块加 `node:` 前缀** — `node:fs`、`node:path`、`node:crypto` 等。
- **所有命令从 `./opencli-registry.js` 导入**，不直接引用 `@jackwener/opencli`。
- **不引入共享工具模块** — 跨文件复制代码，而非抽象共享，除非同一改动需同时应用于多个文件。

## 命令模块结构

每个命令文件遵循以下结构（参考 `user-list.js`、`customer-list.js` 作为标准示例）：

1. 硬编码 API URL 常量 + 配置路径（`~/.opencli/xbb/config.json`）
2. `readConfig()` — 解析配置文件，失败返回 `{}`
3. `getRuntimeConfig(kwargs)` — 合并 CLI 参数与配置文件
4. `buildPayload(kwargs)` — 忽略 `undefined` 字段，不发送未提供的参数
5. `getValidationError(payload, token)` — 返回 `{code, msg}` 或 `null`
6. `makeErrorRow(...)` / `makeSuccessRows(...)` — 返回对象数组（不抛异常）
7. `cli({...})` — 注册时使用 `site: 'xbb'`、`strategy: Strategy.PUBLIC`、`browser: false`
8. HTTP：`POST`，`Content-Type: application/json;charset=UTF-8`，签名 header = `SHA256(JSON.stringify(body) + token)`

## 关键约束

- **错误返回合成行**（`[{code, msg}]`），不抛异常。
- **`--limit` 在响应映射后截断** — 修改字段映射会影响截断后的输出。
- **可选数值字段**：用 `String(kwargs.field ?? '') !== ''` 区分"未提供"和"提供了 0"。许多 xbb 接口对二者处理不同。
- **可选数值参数必须使用 `type: 'str'`** — 将可选数值参数声明为 `type: 'int'` 时，框架会把空字符串默认值强制转为 `0`，导致 `String(kwargs.field ?? '') !== ''` 为 `true`，用户未传值也会把该字段写入请求体。可选数值参数统一声明为 `type: 'str', default: ''`，在 `buildPayload` 中通过检查后再 `Number()` 转换。
- **`--attr`/`--value` 条件**：只有两者同时存在时才拼入请求体。部分 list 命令还支持 `--conditions`（JSON 数组字符串），优先级高于 `--attr`/`--value`。
- **corpid 不一致**：大多数命令会校验 CLI 传入的 `--corpid` 与 `config.json` 中的值，不一致时返回 `CORPID_MISMATCH` 错误行。
- **Base URL 路由**：corpid 以 `ding` 开头或包含 `$$ding` 时使用 `https://proapi.xbongbong.com`，其他使用 `https://appapi.xbongbong.com`。大多数命令从保存的 `baseurl` + 各自路径拼出最终 URL。
- **`--raw` 参数模式** — 所有 list 命令均支持 `--raw`。在 `args` 中声明为 `{ name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' }`。在 `func` 中，于 `const responseBody = JSON.stringify(data);` 之后、`data.code !== 1` 判断之前插入 `if (kwargs.raw) return [{ raw: responseBody }];`。**不要**将 `raw` 加入 `columns`——框架会动态输出，加入会在 table/csv 格式下产生空列。
- **命令文件名使用连字符** — 每个 `*.js` 对应一个实际 CLI 入口；文件名与命令名保持一致，`workorder`/`work-order` 冲突情况除外（已在仓库中保留）。
- **`columns` 输出契约保持稳定** — 修改请求体字段比重命名输出列更安全。

## 工作流：依赖 formId 的命令

`form-list` → `form-get` → 数据命令（`customer-add`、`form-data-add` 等）是标准依赖链。`dataList` 以 JSON 对象字符串传入，在命令内部解析。当字段名或下拉框可选值未知时，先用 `form-get --formId <ID>` 获取表单 schema，再构建 `dataList`。
