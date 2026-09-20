# AGENTS.md

本文件为 AI Agent 在该仓库中工作时提供指引。

## 仓库说明

这是 `opencli` 的销帮帮 CRM（`xbb`）插件。每个顶层 `*.js` 文件通过 `opencli-registry.js` 注册一条 `opencli xbb <command>` 命令。无构建步骤、无 lint、无测试框架。

## 安装

```bash
npm install -g @jackwener/opencli
opencli plugin install github:chenhb1988/opencli-plugin-xbb
opencli xbb token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>
```

凭证保存在 `~/.xbbcli/config.env`，文件是 JSON 数组，支持保存多家公司，每家公司含 `corpid`/`corpName`/`token`/`baseurl`/`userId`/`userName`/`enable`，任何时刻仅且只有一个公司的 `enable` 为 `true`。`token-set` 会按 `corpid` 新增或覆盖配置并把该公司置为启用，同时将表单列表缓存写入 `~/.xbbcli/<corpid>.formlist.json`、命令映射写入 `~/.xbbcli/<corpid>.command-map.md`、部门与员工清单缓存写入 `~/.xbbcli/<corpid>.department-user.json`，并从部门 `id` 为 `1` 的部门名称得到公司名写入该公司的 `corpName`、从员工列表按 `userId` 匹配姓名写入 `userName`。`auth-cache-refresh` 复用 `xbb-token-store.js` 的 `refreshLocalCaches()`，对当前启用公司重刷这三份缓存并回填 `corpName`/`userName`（不重写凭证），用于插件升级后命令映射变化或缓存过期；失败时返回 `CACHE_REFRESH_FAILED` 并在 `message` 注明中断步骤（`formlist`/`command-map`/`department-user`/`profile`）。除 `token-set`/`token-list`/`token-use`/`token-del`/`auth-status`/`auth-logout` 外，其余命令都从该配置读取当前启用公司的 `corpid` 与 `token`。`auth-status` 只读回显当前生效配置，输出是 `key`/`value` 两列的键值对：固定 6 行 `corpid`/`corpName`/`userName`/`userId`/`baseurl`/`token`（token 默认中间掩码，`--showToken` 出明文），必要时追加 `note` 行说明来源（config.env 启用公司 / `XBB_*` 回落 / 多个 `enable=true`）。不回显 `status`/`source`/`message`/`enable`/`companyCount`/`envActive`/`configFile`/`code`/`msg`；没有生效配置时 6 个值一律留空（不把残留的 `XBB_BASEURL`/`XBB_USERID` 当值回显）并给 `note`；配置文件路径、公司数量等调试信息只走 `--debug` 的 stderr。`auth-logout` 删除 `enable=true` 的那一条并在写回前把原文件整份备份为 `~/.xbbcli/config.env.bak`，且不自动把其他公司提升为启用（登出后可能一个启用公司都没有），默认还会通过 `clearEnvVars()` 一并清除 `XBB_*` 环境变量（`--noEnv` 或 `--env=false` 跳过，结果写在 `envStored`/`envFile` 列）；`config.env` 无启用公司且环境变量也不存在时返回 `NO_ACTIVE_CONFIG` 且不写文件。此外支持环境变量兼容模式（只支持单公司）：`config.env` 缺失、解析失败或没有启用公司时，回落到 `XBB_CORPID`/`XBB_TOKEN`/`XBB_BASEURL`/`XBB_USERID`/`XBB_CORPNAME`/`XBB_USERNAME`；`XBB_ENV_ONLY=1` 强制只用环境变量；`token-set`/`auth-login` 用 `--env` 控制存储方式：`--env 0`（默认）仅写入本地文件（`config.env` 与各类缓存）不写环境变量，`--env 1` 仅写入环境变量（Windows 用 `setx` 写用户级变量、其他平台写 `~/.xbbcli/env.sh`，此模式不写 `config.env`/表单缓存/命令映射/部门员工缓存，也不会拉取部门与员工列表，故只写 `XBB_CORPID`/`XBB_TOKEN`/`XBB_BASEURL`/`XBB_USERID` 四个变量）。所有命令的配置读取统一走 `xbb-config.js`，不要在命令文件里内联解析 `config.env`。

`auth-login` 是 `token-set` 的浏览器前置：用 `node:child_process` 拉起系统 Chrome/Edge（`--remote-debugging-pipe` + `--user-data-dir=~/.xbbcli/browser-profile`，fd3 写 / fd4 读，NUL 分隔的 CDP JSON，不开任何调试端口），用户在浏览器中自行完成登录（账号密码 / 短信 / 扫码均可），CLI 通过 `Target.getTargets` + `Target.attachToTarget` 后轮询页面 `localStorage` 读取 `{corpid, userId, xbbAccessToken}`，确认页面 `href` 命中 `/#/app/home`（登录成功判据）后，再在页面内 `fetch` 网关 `https://{app|pro}gateway.xbongbong.com/pro/v1/apiToken/getApiToken`（`corpid` 以 `ding` 开头或含 `$$ding` 时用 `progateway`，否则用 `appgateway`；见 `resolveGatewayUrl`）（body `{corpid, userId, platform:'web'}`，header `corpid` 与 `sign = SHA256(body + xbbAccessToken)`）换取个人 token，最后复用 `token-set` 的落盘逻辑。`xbbAccessToken` 是 `appgateway` 的 Web 会话域，**不能**直接用于业务命令（网关返回 `100012`）。浏览器与 CDP 的复用封装在 `xbb-browser.js`，`token-set` 与 `auth-login` 共用的落盘逻辑在 `xbb-token-store.js`；`auth-login.js` 只负责浏览器交互与换 token。参数：`--browser <chrome|edge|路径>`、`--timeout <秒>`（默认 300）、`--corpid`、`--keepOpen`、`--env <0|1>`、`--debug`、`--raw`。错误一律返回合成行：`NO_BROWSER`/`BROWSER_SPAWN_FAILED`/`BROWSER_LAUNCH_FAILED`/`BROWSER_CLOSED`/`LOGIN_TIMEOUT`/`API_TOKEN_FAILED`/`CORPID_MISMATCH`/`SAVE_FAILED`/`INVALID_TIMEOUT`。

## 验证方式

无自动化测试。修改命令后，加 `--debug` 对真实 API 运行，检查序列化后的请求体和原始响应。

写盘类命令（`auth-logout`、`token-del` 等）改用临时目录验证：新建临时目录并设 `USERPROFILE`/`HOME` 指向它（`os.homedir()` 在 Windows 上读 `USERPROFILE`），写入假 `config.env`，再跑 `node bin/xbbcli.js <command>`，断言写回的 JSON 与 `config.env.bak`。绝不要在真实 HOME 上跑 `auth-logout`；在 Windows 上验证时必须带 `--env 0`，否则会 `reg delete` 掉用户级真实 `XBB_*` 变量。要测环境变量清理分支，把 `process.platform` 覆写为 `linux` 后测 `~/.xbbcli/env.sh` 的清理逻辑。

`auth-login` 的验证方式：`xbbcli auth-login --browser edge --timeout 15 --keepOpen -f json`，应在 15s 后返回 `LOGIN_TIMEOUT` 合成错误行（浏览器已拉起、页面停在登录页）；`--browser nonexistent` 应返回 `NO_BROWSER`；`xbb-browser.js` 可单独用 headless 自检（`openBrowser({headless:true})` → `waitForPage()` → `close()`，`close()` 必须返回 `true`）。

`auth-cache-refresh` 的验证：真实启用配置下 `node bin/xbbcli.js auth-cache-refresh -f json` 应返回 `status=ok` 且三份缓存文件 mtime 更新、counts 与文件内容一致；临时 HOME + 假 `config.env`（enable=true、无效 token，并清空 `XBB_*`）应返回 `CACHE_REFRESH_FAILED` 且 `message` 含「步骤 formlist」，不抛异常；临时 HOME 且无任何生效配置时返回 `NO_ACTIVE_CONFIG` 且不写文件。

## 代码风格规范

- **仅使用 ESM** — `package.json` 中 `"type": "module"`，始终使用 `import`/`export`。
- **Node 内置模块加 `node:` 前缀** — `node:fs`、`node:path`、`node:crypto` 等。
- **所有命令从 `./opencli-registry.js` 导入**，不直接引用 `@jackwener/opencli`。
- **不引入新的共享工具模块** — 跨文件优先复制代码，而非抽象共享，除非同一改动需同时应用于多个文件。仓库现有的共享模块只有两个，且都不注册命令：`xbb-config.js`（配置读取/环境变量，导出 `readActiveConfig()`/`isEnvActive()`/`isEnvOnly()`/`persistEnvVars()`/`clearEnvVars()`）与 `xbb-token-store.js`（token-set/auth-login 落盘与 auth-refresh-cache 共用的缓存刷新 `refreshLocalCaches()`：写 config.env、表单缓存、命令映射、部门/员工缓存、环境变量），`xbb-browser.js` 提供 `auth-login` 用的浏览器 + CDP 能力。新增共享模块前先确认是否真的多处复用。

## 命令模块结构

每个命令文件遵循以下结构（参考 `user-list.js`、`customer-list.js` 作为标准示例）：

1. 硬编码 API URL 常量 + 配置路径（`~/.opencli/xbb/config.env`）
2. `readConfig()` — 委托给 `./xbb-config.js` 的 `readActiveConfig()`：`config.env` 有启用公司时用配置，否则回落 `XBB_*` 环境变量
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
- **Base URL 路由**：corpid 以 `ding` 开头或包含 `$$ding` 时使用 `https://proapi.xbongbong.com`，其他使用 `https://appapi.xbongbong.com`。大多数命令从保存的 `baseurl` + 各自路径拼出最终 URL。
- **`--raw` 参数模式** — 所有 list 命令均支持 `--raw`。在 `args` 中声明为 `{ name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' }`。在 `func` 中，于 `const responseBody = JSON.stringify(data);` 之后、`data.code !== 1` 判断之前插入 `if (kwargs.raw) return [{ raw: responseBody }];`。**不要**将 `raw` 加入 `columns`——框架会动态输出，加入会在 table/csv 格式下产生空列。
- **命令文件名使用连字符** — 每个 `*.js` 对应一个实际 CLI 入口；文件名与命令名保持一致，`workorder`/`work-order` 冲突情况除外（已在仓库中保留）。
- **`columns` 输出契约保持稳定** — 修改请求体字段比重命名输出列更安全。

## 工作流：依赖 formId 的命令

`form-list` → `form-get` → 数据命令（`customer-add`、`form-data-add` 等）是标准依赖链。`dataList` 以 JSON 对象字符串传入，在命令内部解析。当字段名或下拉框可选值未知时，先用 `form-get --formId <ID>` 获取表单 schema，再构建 `dataList`。

## 工作流：查询部门与员工

需要确认部门 id/名称，或员工 userId/所属部门时，先读 `~/.xbbcli/<corpid>.department-user.json`（由 `token-set` 分页拉取后缓存，含 `departments` 与 `users` 两份清单），避免每次都调用 `department-list` / `user-list`。缓存过期时执行 `xbbcli auth-refresh-cache` 刷新（或重新执行 `token-set`）。
