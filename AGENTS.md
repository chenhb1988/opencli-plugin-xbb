# AGENTS.md

本文件为 AI Agent 在该仓库中工作时提供指引。

## 仓库说明

这是销帮帮 CRM（`xbb`）的命令行工具（npm 包 `@xbongbong/xbbcli`），入口 `bin/xbbcli.js`，开发目录中可直接用 `node bin/xbbcli.js <command>` 运行。每个顶层 `*.js` 命令文件通过 `xbb-registry.js` 的 `cli()` 注册一条命令（注册键为 `xbb/<command>`，`bin/xbbcli.js` 启动时全量加载）。支持二级子命令：命令声明 `name: 'mail-send', group: 'mail'` 后，`bin/xbbcli.js` 会把 `xbbcli mail send`（以及 `xbbcli mail draft add`）的多个词依次用 `-` 连接去查找注册键，`xbbcli mail-send` 也仍可直接使用；`xbbcli mail --help` 会列出该 group 下全部子命令，顶层 `xbbcli -h` 只显示 `mail` 分组入口、不展开子命令。无构建步骤、无 lint；测试为原生 Node 脚本（见「验证方式」）。

## 安装

```bash
npm install -g @xbongbong/xbbcli
xbbcli auth-login
# 或手动配置：xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>
```

凭证保存在 `~/.xbbcli/config.env`，文件是 JSON 数组，支持保存多家公司，每家公司含 `corpid`/`corpName`/`token`/`baseurl`/`userId`/`userName`/`enable`，任何时刻仅且只有一个公司的 `enable` 为 `true`。`token-set` 会按 `corpid` 新增或覆盖配置并把该公司置为启用，同时将表单列表缓存写入 `~/.xbbcli/<corpid>.formlist.json`、命令映射写入 `~/.xbbcli/<corpid>.command-map.md`、部门与员工清单缓存写入 `~/.xbbcli/<corpid>.department-user.json`，并从部门 `id` 为 `1` 的部门名称得到公司名写入该公司的 `corpName`、从员工列表按 `userId` 匹配姓名写入 `userName`。`auth-cache-refresh` 复用 `xbb-token-store.js` 的 `refreshLocalCaches()`，对当前启用公司重刷这三份缓存并回填 `corpName`/`userName`（不重写凭证），用于插件升级后命令映射变化或缓存过期；失败时返回 `CACHE_REFRESH_FAILED` 并在 `message` 注明中断步骤（`formlist`/`command-map`/`department-user`/`profile`）。除 `token-set`/`token-list`/`token-use`/`token-del`/`auth-status`/`auth-logout` 外，其余命令都从该配置读取当前启用公司的 `corpid` 与 `token`。`auth-status` 只读回显当前生效配置，输出是 `key`/`value` 两列的键值对：固定 6 行 `corpid`/`corpName`/`userName`/`userId`/`baseurl`/`token`（token 默认中间掩码，`--showToken` 出明文），必要时追加 `note` 行（`config.env` 里多个 `enable=true` 时提示用 `token-use` 修正；无生效配置时提示下一步命令，检测到 `XBB_*` 时提示本版本不再读取）。不回显 `status`/`source`/`message`/`enable`/`companyCount`/`envActive`/`configFile`/`code`/`msg`；没有生效配置时 6 个值一律留空（不把残留的 `XBB_BASEURL`/`XBB_USERID` 当值回显）并给 `note`；配置文件路径、公司数量等调试信息只走 `--debug` 的 stderr。`auth-logout` 删除 `enable=true` 的那一条并在写回前把原文件整份备份为 `~/.xbbcli/config.env.bak`，且不自动把其他公司提升为启用（登出后可能一个启用公司都没有），默认还会通过 `clearEnvVars()` 一并清除 `XBB_*` 环境变量（`--env 0` 跳过，结果写在 `envStored`/`envFile` 列）；`config.env` 无启用公司且环境变量也不存在时返回 `NO_ACTIVE_CONFIG` 且不写文件。本分支的业务命令不再读取 `XBB_*` 环境变量：凭证来源唯一化为 `config.env` 中 `enable=true` 的公司（`xbb-config.js` 的 `readActiveConfig()` 只读文件配置），从而根除 XBB_* 影子导致的「保存凭证后缓存刷新串公司」问题；`token-set`/`auth-login` 用 `--env` 控制存储方式：`--env 0`（默认）仅写入本地文件（`config.env` 与各类缓存）不写环境变量，`--env 1` 仅写入环境变量（Windows 用 `setx` 写用户级变量、其他平台写 `~/.xbbcli/env.sh`，此模式不写 `config.env`/表单缓存/命令映射/部门员工缓存，也不会拉取部门与员工列表，故只写 `XBB_CORPID`/`XBB_TOKEN`/`XBB_BASEURL`/`XBB_USERID` 四个变量），写入的 `XBB_*` 仅供外部系统消费。读取辅助能力（`auth-status`/`token-list` 的检测提示）与写入、同步、清除能力（`persistEnvVars()`/`clearEnvVars()`）保留。所有命令的配置读取统一走 `xbb-http.js` 的 `getRuntimeConfig()`（内部经 `xbb-config.js` 的 `readActiveConfig()`），不要在命令文件里内联解析 `config.env`。

`auth-login` 是 `token-set` 的浏览器前置：用 `node:child_process` 拉起系统 Chrome/Edge（`--remote-debugging-pipe` + `--user-data-dir=~/.xbbcli/browser-profile`，fd3 写 / fd4 读，NUL 分隔的 CDP JSON，不开任何调试端口），用户在浏览器中自行完成登录（账号密码 / 短信 / 扫码均可），CLI 通过 `Target.getTargets` + `Target.attachToTarget` 后轮询页面 `localStorage` 读取 `{corpid, userId, xbbAccessToken}`，确认页面 `href` 命中 `/#/app/home`（登录成功判据）后，再在页面内 `fetch` 网关 `https://{app|pro}gateway.xbongbong.com/pro/v1/apiPersonalToken/generate`（`corpid` 以 `ding` 开头或含 `$$ding` 时用 `progateway`，否则用 `appgateway`；见 `resolveGatewayUrl`）（body `{corpid, userId, platform:'web', resetToken, checkUserId}`：`checkUserId` 为生成/获取个人 token 对应的人员，自助登录时与登录用户一致；`resetToken` 0 复用已有 token、1 重新生成，先按 0 请求、返回空 token 再按 1 重试；成功响应的 `result.personalToken`（`user_*` 前缀）即最终凭证，`saveCompanyCredentials` 因前缀命中 `user_` 直接落盘，不再调 v2 `generateToken`；header `corpid` 与 `sign = SHA256(body + xbbAccessToken)`）换取个人 token，最后复用 `token-set` 的落盘逻辑。`xbbAccessToken` 是 `appgateway` 的 Web 会话域，**不能**直接用于业务命令（网关返回 `100012`）。浏览器与 CDP 的复用封装在 `xbb-browser.js`，`token-set` 与 `auth-login` 共用的落盘逻辑在 `xbb-token-store.js`；`auth-login.js` 只负责浏览器交互与换 token。参数：`--browser <chrome|edge|路径>`、`--timeout <秒>`（默认 300）、`--corpid`、`--keepOpen`、`--env <0|1>`、`--debug`、`--raw`。在容器 / AI 客户端沙箱里，`openBrowser()` 会在 Linux 且 `process.getuid() === 0` 时自动追加 `--no-sandbox`（root 下不加 Chrome 会直接退出），非 root 沙箱可设 `XBB_CHROME_NO_SANDBOX=1` 强制追加。错误一律返回合成行：`NO_BROWSER`/`BROWSER_SPAWN_FAILED`/`BROWSER_LAUNCH_FAILED`/`BROWSER_CLOSED`/`LOGIN_TIMEOUT`/`API_TOKEN_FAILED`/`CORPID_MISMATCH`/`SAVE_FAILED`/`INVALID_TIMEOUT`。

## 验证方式

先跑离线冒烟测试 `npm test`（test/commands-smoke-test.mjs）：测试把 HOME 指向临时目录并 mock fetch，逐个加载全部命令文件，断言每个命令文件恰好注册一条命令、site/browser/args/columns 齐全；规范断言：list 命令必须提供 `--raw`/`--debug`，可选数值参数不得声明为 `type:'int', default:''`；并（除副作用命令外）以空参调用 `func({})` 要求返回非空数组（不抛异常、不发网络请求），且每行字段与 `columns` 完全一致。`npm run check`（test/check-syntax.mjs）对顶层命令文件、bin 与 test 脚本逐个执行 `node --check`。以上脚本连同 `npm run test:args`、`npm run test:demo`、`npm run test:mail` 可在本地依次执行（Node 18/20/22 兼容）。`npm run test:mail`（test/mail-commands-test.mjs）用本地 mock HTTP 服务器验证二级命令解析（`mail send` / `mail draft add`）、邮件请求体字段与可选参数省略、分页 footer 与帮助输出，不触达真实 API。`npm run test:mail:real`（test/mail-send-test.mjs）是 mail send 的真实接口用例：默认 dry-run 只打印收件人/主题/命令，必须显式加 `--execute` 才会真正发信，收件人通过 `XBB_TEST_MAIL_TO` 提供（JSON 数组或逗号分隔邮箱），可选 `XBB_TEST_MAIL_CC` / `XBB_TEST_MAIL_ATTACHMENT` / `XBB_TEST_MAIL_SUBJECT` / `XBB_TEST_MAIL_DATA` / `XBB_TEST_MAIL_DEBUG`；发送可能耗时 1 分钟以上，不要在生产租户随意执行。test/commands-smoke-test.mjs 顶部的 `SKIP_EMPTY_INVOKE` 列出「空参调用会产生真实副作用」的命令（`auth-login` 会拉起真实浏览器并轮询等待 300s；`auth-logout` 在 `XBB_*` 环境变量存在时会执行 `reg delete` 清除真实用户级变量）；新增此类命令必须同步加入，否则冒烟测试会卡住或产生真实副作用。可选数值参数（`type:'str', default:''`）的序列化契约由 `npm run test:args`（test/optional-numeric-args-test.mjs）回归：它把 baseurl 指向本地 mock HTTP 服务器，用真实 CLI 子进程验证「未传参不写入请求体、显式传 0 时写入数字 0」，覆盖 communicate-plan-add/stage-jump/work-order-handover/clue-list 等含可选数值字段的命令，不触达真实 API。`npm run test:demo`（test/add-demo-test.mjs）用本地 mock HTTP 服务器验证 `--demo` 共享链路：请求体固定为 `{corpid, formId, url: 命令 API_PATH}`、未传 formId 时按 `businessType` 从表单缓存解析、`dataList` 字段值被加工为「字段名：xxx|是否必填|字段类型：xxx」提示串（选项字段在字段类型后注明单选/多选并列出选项；`subForm_N` 与 `array_N` 两种子表容器都保留数组结构且内部字段独立作用域、复杂字段保留示例值、缺少 inputParameter 时不加工）、接口不接收 formId 时示例里剔除该字段（product/contact）、非表单接口用 `formId: 0` 且示例经 corpid/userId 归一化、`form-data-add` 无 formId 时返回 `NO_FORMID` 而不发请求、`--demo` 错误行只有 `code`/`msg`、唯一匹配但 formId 非正整数返回 `INVALID_FORM_ID`、正式新建的 formId 解析与负数校验、网络不可达返回 `NETWORK_ERROR` 行、强制 JSON 输出及三条命令的普通新建回归，不触达真实 API。真实 API 用例填好 test/real-api-cases.json 后可跑 `npm run test:real`（只允许 list/detail/get 结尾的只读命令），详见 test/REAL_API_TESTING.md。

修改命令后，加 `--debug` 对真实 API 运行，检查序列化后的请求体和原始响应。

写盘类命令（`auth-logout`、`token-del` 等）改用临时目录验证：新建临时目录并设 `USERPROFILE`/`HOME` 指向它（`os.homedir()` 在 Windows 上读 `USERPROFILE`），写入假 `config.env`，再跑 `node bin/xbbcli.js <command>`，断言写回的 JSON 与 `config.env.bak`。绝不要在真实 HOME 上跑 `auth-logout`；在 Windows 上验证时必须带 `--env 0`，否则会 `reg delete` 掉用户级真实 `XBB_*` 变量。要测环境变量清理分支，把 `process.platform` 覆写为 `linux` 后测 `~/.xbbcli/env.sh` 的清理逻辑。

`auth-login` 的验证方式：`xbbcli auth-login --browser edge --timeout 15 --keepOpen -f json`，应在 15s 后返回 `LOGIN_TIMEOUT` 合成错误行（浏览器已拉起、页面停在登录页）；`--browser nonexistent` 应返回 `NO_BROWSER`；`xbb-browser.js` 可单独用 headless 自检（`openBrowser({headless:true})` → `waitForPage()` → `close()`，`close()` 必须返回 `true`）。

`auth-cache-refresh` 的验证：真实启用配置下 `node bin/xbbcli.js auth-cache-refresh -f json` 应返回 `status=ok` 且三份缓存文件 mtime 更新、counts 与文件内容一致；临时 HOME + 假 `config.env`（enable=true、无效 token，并清空 `XBB_*`）应返回 `CACHE_REFRESH_FAILED` 且 `message` 含「步骤 formlist」，不抛异常；临时 HOME 且无任何生效配置时返回 `NO_ACTIVE_CONFIG` 且不写文件。

## 代码风格规范

- **仅使用 ESM** — `package.json` 中 `"type": "module"`，始终使用 `import`/`export`。
- **Node 内置模块加 `node:` 前缀** — `node:fs`、`node:path`、`node:crypto` 等。
- **所有命令从 `./xbb-registry.js` 导入 `cli` 与 `Strategy`**，不直接引用 `@jackwener/opencli`。
- **同一改动需同时应用于 3 个及以上文件时必须抽取共享模块** — 重复代码只允许存在于 1-2 个文件中（跨文件优先复制，而非为 1-2 处抽象共享）。仓库现有的共享模块有八个，且都不注册命令：`xbb-config.js`（配置读取与环境变量读写，导出 `readActiveConfig()`/`readEnvConfig()`/`hasEnvConfig()`/`getEnvVarNames()`/`persistEnvVars()`/`clearEnvVars()`）、`xbb-token-store.js`（token-set/auth-login 落盘与 auth-refresh-cache 共用的缓存刷新 `refreshLocalCaches()`：写 config.env、表单缓存、命令映射、部门/员工缓存、环境变量）、`xbb-browser.js`（提供 `auth-login` 用的浏览器 + CDP 能力；Linux root 或 `XBB_CHROME_NO_SANDBOX=1` 时给 Chrome 追加 `--no-sandbox`，供容器 / AI 客户端沙箱使用）、`xbb-http.js`（业务命令的共享 HTTP 网关：`getRuntimeConfig()` 读取运行时配置、`requestGateway()` 组装签名/headers/fetch/debug 输出并把 HTTP 失败与网络异常转成 `{ok:false, code, msg}`（`NETWORK_ERROR`/`INVALID_JSON`）而不抛异常、`createPagination()` 分页 footer，可用 `pick` 指定分页信息所在位置）、`xbb-mail.js`（邮件命令共用：`parseMailArray()` 解析 JSON 数组参数、`formatMailParties()` 展示收件人、`stringifyMailValue()` 序列化对象列、`resolveMailUserId()` 解析操作人 userId）、`xbb-production.js`（生产单/生产入库单/生产领料单共用：`buildListPayload()`/`buildDetailPayload()` 组装请求体、`makeListRows()`/`makeDetailRow()` 映射输出行、`makeListErrorRow()`/`makeDetailErrorRow()` 错误行、`splitCodedError()` 拆分参数错误、`LIST_COLUMNS`/`DETAIL_COLUMNS` 列定义）、`xbb-other-income.js`（其他收入单共用：`parseDataList()` 解析表单 JSON、新建/编辑/删除/详情/列表的输出行与列定义）、`xbb-form-example.js`（新建类命令的 `--demo` 能力：`DEMO_ARG` 参数声明、`resolveDemoFormat()` 强制 JSON 钩子、`parseDataList()`、`resolveFormIdByBusinessType()` 按 businessType 从表单缓存解析唯一 formId（`NO_FORMID`/`MULTIPLE_FORM`/`INVALID_FORM_ID`，多候选时提示用 `--formId` 或 `xbbcli form-get --formId <ID>` 查看指定表单字段）、`runAddDemo()` 一条命令走完「鉴权 → formId 解析 → 取示例」（`businessType` 传空表示接口与表单无关、`omitFormId` 剔除接口不接收的 formId、`requireFormId` 用于无法自动解析的通用表单接口）、`requestAddExample()` 调 `customized/param/get` 并把 `inputExample.dataList` 加工成「字段名：xxx|必填/选填|字段类型：xxx」提示串（子表容器按描述里的 `(subForm_N)`/`(array_N)` 后缀自动识别，`omitExampleKeys` 剔除接口不接收的顶层字段，示例里的 corpid/userId 换成当前配置））；`xbb-registry.js` 是命令注册中心（另提供 `registerGroup()`/`getGroups()` 维护分组元数据），`xbb-groups.js` 只注册分组描述、不注册命令，两者都不属此列。新增共享模块后必须同步加入 test/commands-smoke-test.mjs 的 `AUXILIARY_FILES`，否则冒烟测试会把它误当命令文件。

## 命令模块结构

每个命令文件遵循以下结构（参考 `user-list.js`、`clue-list.js`、`customer-add.js` 作为标准示例）：

1. 硬编码 API **path** 常量（`const XXX_API_PATH = '/pro/v2/api/...'`，不含域名；基础域名由运行时 baseUrl 提供）
2. 从 `./xbb-http.js` 导入 `getRuntimeConfig`（分页命令再导入 `createPagination`、`requestGateway`）：`getRuntimeConfig()` 返回当前启用公司的 `{corpid, token, baseUrl, userId}`（读取 `config.env` 里 `enable=true` 的公司，不读取 `XBB_*` 环境变量）
3. `buildPayload(kwargs)` — 忽略 `undefined` 字段，不发送未提供的参数
4. `getValidationError(payload, token)` — 返回 `{code, msg}` 或 `null`
5. `makeErrorRow(...)` / `makeSuccessRows(...)` — 返回对象数组（不抛异常）
6. `cli({...})` — 注册时使用 `site: 'xbb'`、`strategy: Strategy.PUBLIC`、`browser: false`；二级子命令额外声明 `group`（如 `name: 'mail-send', group: 'mail'`），文件名仍与注册名保持一致（`mail-send.js`）
7. HTTP 一律走 `requestGateway({ baseUrl, apiPath, payload, token, userId, debug })`：**新命令不得复制签名（SHA256(body + token)）/headers/fetch 骨架**。网关内部负责 POST JSON、`Content-Type: application/json;charset=UTF-8`、签名 header、`--debug` 四段输出（URL/Headers/RequestBody/ResponseBody）与 HTTP 失败分支（返回 `{ ok:false, code, msg }`；成功返回 `{ ok:true, data, responseBody }`）

func 主流程的标准骨架：

```js
const gateway = await requestGateway({
  baseUrl,
  apiPath: XXX_API_PATH,
  payload,
  token,
  userId,
  debug,
});
if (!gateway.ok) return makeErrorRow(gateway.code, gateway.msg);
if (kwargs.raw) return [{ raw: gateway.responseBody }];  // 仅支持 --raw 的命令
if (gateway.data.code !== 1) {
  return makeErrorRow(gateway.data.code ?? '', gateway.data.msg ?? '未知错误');
}
// ……业务响应映射统一从 gateway.data 出发（如 gateway.data.result?.xxx）
```

分页 list 命令：`const pagination = createPagination();`，成功路径加 `pagination.update(gateway.data);`，在 `cli()` 中写 `footerExtra: pagination.footerExtra`（默认输出 `totalCount X / totalPage Y`；只计数变体用 `createPagination({ countOnly: true })` 输出 `totalCount X`）。

## 关键约束

- **错误返回合成行**（`[{code, msg}]`），不抛异常。
- **可选数值字段**：用 `String(kwargs.field ?? '') !== ''` 区分"未提供"和"提供了 0"。许多 xbb 接口对二者处理不同。
- **可选数值参数必须使用 `type: 'str'`** — 将可选数值参数声明为 `type: 'int'` 时，框架会把空字符串默认值强制转为 `0`，导致 `String(kwargs.field ?? '') !== ''` 为 `true`，用户未传值也会把该字段写入请求体。可选数值参数统一声明为 `type: 'str', default: ''`，在 `buildPayload` 中通过检查后再 `Number()` 转换。
- **`--attr`/`--value` 条件**：只有两者同时存在时才拼入请求体。部分 list 命令还支持 `--conditions`（JSON 数组字符串），优先级高于 `--attr`/`--value`。
- **Base URL 路由**：corpid 以 `ding` 开头或包含 `$$ding` 时使用 `https://proapi.xbongbong.com`，其他使用 `https://appapi.xbongbong.com`。命令只声明 path 常量，由 `requestGateway` 用保存的 `baseUrl` + path 拼出最终 URL。
- **`--raw` 参数模式** — 所有 list 命令均支持 `--raw`（`token-list` 无网络请求，其 `--raw` 输出本地配置原文，token 仍按 `--showToken` 决定是否掩码）。在 `args` 中声明为 `{ name: 'raw', type: 'bool', default: false, help: '输出接口返回的原文' }`。在 `func` 中，于 `if (!gateway.ok)` 判断之后、`gateway.data.code !== 1` 判断之前插入 `if (kwargs.raw) return [{ raw: gateway.responseBody }];`。**不要**将 `raw` 加入 `columns`——框架会动态输出，加入会在 table/csv 格式下产生空列。
- **命令文件名使用连字符** — 每个 `*.js` 对应一个实际 CLI 入口；文件名与命令名保持一致，`workorder`/`work-order` 冲突情况除外（已在仓库中保留）。
- **`columns` 输出契约保持稳定** — 修改请求体字段比重命名输出列更安全。
- **命令级输出格式钩子** — 命令可声明 `resolveFormat: ({ kwargs, format }) => 'json' | 'table' | 'csv'` 覆盖 `-f`；未声明或返回非法值时回退用户指定的格式。所有 `-add` 命令的 `--demo` 都用 `xbb-form-example.js` 的 `resolveDemoFormat` 强制 JSON。
- **新增 `-add` 命令必须同时实现 `--demo`** — 三步：`DEMO_ARG` 放进 `args`（放在 `debug` 之前）、声明 `resolveFormat: resolveDemoFormat`、在 `func` 里紧跟 `getRuntimeConfig()` 之后插入 `if (kwargs.demo) return runAddDemo({ config: { corpid, token, baseUrl, userId: String(kwargs.userId || userId || '').trim() }, formIdArg: kwargs.formId, apiPath: '<API 路径>', businessType: '<表单 businessType>', label: '<中文表单名>', omitFormId: <请求体不含 formId 时为 true>, debug });`。**`--formId` 参数当且仅当写请求体真的接收 formId 时才声明**：请求体不含 formId 的业务（contact/communicate/invoice/payment/refund/supplier/pay-plan/市场活动/工作报告/任务/资产等）按仓库约定只有一个表单，demo 直接从缓存解析唯一表单即可，多声明一个 formId 只会让 AI 在拼参数时多做一次无意义的表单选择；这类命令若某租户真有多表单，demo 会返回 `MULTIPLE_FORM` 并引导用 `xbbcli form-get --formId <ID>` 查看指定表单字段。`businessType` 为空的接口（部门/员工/标签/分类/开票信息等）会用 `formId: 0` 直接取接口级示例；`form-data-add` 这类通用表单接口加 `requireFormId: true`。普通新建路径不要因为 demo 而改变校验顺序。目前除 `mail-draft-add`、`other-income-add`（`customized/param/get` 对这两个 url 返回 `100063`）外，全部 `*-add` 命令都已支持 `--demo`。

## 工作流：依赖 formId 的命令

`form-list` → `form-get` → 数据命令（`customer-add`、`form-data-add` 等）是标准依赖链。`dataList` 以 JSON 对象字符串传入，在命令内部解析。当字段名或下拉框可选值未知时，先用 `form-get --formId <ID>` 获取表单 schema，再构建 `dataList`。更省事的方式是先跑 `<命令> --demo`：所有 `*-add` 命令都支持（`mail-draft-add`、`other-income-add` 除外），不写入数据、只返回该接口的请求体示例，未传 formId 时按 `businessType` 从表单缓存解析，示例中 `dataList` 的字段值已替换为「字段名：xxx|是否必填|字段类型：xxx」提示串（选项字段为 `字段类型：单选/多选：选项列表`，子表保留数组结构且内部字段同样加工），把提示串换成实际值即可用于新建。formId 解析错误码为 `NO_FORMID`（无缓存/无匹配）、`MULTIPLE_FORM`（同类型多个表单，消息里列候选）、`INVALID_FORM_ID`（唯一匹配但 formId 非正整数）；`--demo` 模式下所有错误行只有 `code`/`msg` 两列（成功行是请求体示例对象），普通模式仍是 5 列结果行。`clue-add`/`customer-add` 的正式新建也会自动解析 formId；其余命令的 `--formId` 只在写请求体真的包含 formId 时才声明（contract/opportunity/work-order/quotation/form-data/communicate-plan/label-*），demo 与正式新建共用同一个参数；请求体不含 formId 的业务（contact/communicate/invoice/payment/refund/supplier/pay-plan/市场活动/工作报告/任务/资产）不声明 `--formId`，demo 直接解析唯一表单。

## 工作流：查询部门与员工

需要确认部门 id/名称，或员工 userId/所属部门时，先读 `~/.xbbcli/<corpid>.department-user.json`（由 `token-set` 分页拉取后缓存，含 `departments` 与 `users` 两份清单），避免每次都调用 `department-list` / `user-list`。缓存过期时执行 `xbbcli auth-refresh-cache` 刷新（或重新执行 `token-set`）。
