# `xbbcli auth-login` 命令设计（浏览器登录，A 方案）

## 目标

`xbbcli auth-login` 让用户**不用手动复制 token**：命令拉起浏览器，用户在浏览器里完成任意一种登录（账号密码、短信、钉钉/企微/飞书扫码……），命令检测到登录态后自动换取 API token，并复用 `token-set` 的落盘流程。

```bash
xbbcli auth-login                 # 自动探测 Chrome / Edge
xbbcli auth-login --browser edge  # 指定浏览器
```

一次调用完成后，本地配置与 `xbbcli token-set` 完全等价，由 `--env` 控制存储方式：`--env 0`（默认）写入 `~/.xbbcli/config.env`、表单缓存、命令映射文件、部门/员工缓存（不写环境变量）；`--env 1` 仅写入 `XBB_*` 环境变量，不写任何本地文件。

## 技术方案：`--remote-debugging-pipe` + CDP

零依赖，只用 `node:child_process` 与 `node:crypto`，不安装 Playwright / Puppeteer，不监听任何 TCP 端口（避免开放调试端口的风险）。

```text
xbbcli auth-login
  └─ spawn(<chrome|edge>, ['--remote-debugging-pipe', '--user-data-dir=~/.xbbcli/browser-profile', '--new-window', 登录页])
       ├─ fd3 写 CDP 指令、fd4 读 CDP 消息（NUL 分隔 JSON）
       ├─ Target.getTargets / Target.attachToTarget → Runtime.evaluate
       ├─ 轮询 localStorage {corpid, userId, xbbAccessToken}，并等 href 命中 /#/app/home 判定登录成功
       └─ 页面内 fetch 网关换取 API token → saveCompanyCredentials(...) → Browser.close
```

要点：

- `--remote-debugging-pipe` 用 fd3/fd4 通信，不占端口，也不需要 `--remote-allow-origins`。
- `--user-data-dir=~/.xbbcli/browser-profile` 固定独立 profile：与用户日常浏览器隔离，同时保留登录态，便于下次复用。
- 关闭浏览器时 `Browser.close` 在部分 Edge/Chrome 版本上会「返回成功但不退出」，因此在 1.5s 等待后回落 `child.kill()` 并确认退出；`--keepOpen` 则改为断开管道让浏览器独立留存。

## 为什么不直接保存 `xbbAccessToken`

销帮帮存在两套彼此独立的凭证域：

| 凭证 | 签发接口 | 域名 | 用途 |
| --- | --- | --- | --- |
| `xbbAccessToken` | 登录页登录成功后写入 `localStorage` | `appwebfront` / `appgateway` | Web 前端会话 |
| API token（`user_*`） | `/pro/v1/apiToken/getApiToken` | `appgateway` / `progateway` | 换取个人 token 的中间票 |
| 个人 token（`user_*`） | `/pro/v2/api/user/generateToken` | `proapi` / `appapi` | 本仓库所有业务命令（`sign = SHA256(body + token)`） |

`xbbAccessToken` **不能**直接用于业务命令：实测用它请求 `proapi` 业务接口会被拒绝，请求网关也会返回 `100012 登录验证过期`。个人 token 反过来也不能当 `xbbAccessToken` 用（实测 `getApiToken` 返回 `100012`）。因此 `auth-login` 的模型是「浏览器完成 Web 登录 → 读 Web 会话 → 换个人 token → 落盘」。

## 登录前端的网络约定（已实测复现）

```text
baseURL = https://appgateway.xbongbong.com   # corpid 以 ding 开头或含 $$ding 时改为 https://progateway.xbongbong.com
前缀    = /pro/v1
body    = { corpid, userId, platform: 'web' }
header  corpid = localStorage.corpid || '1'
header  sign   = SHA256(JSON.stringify(body) + xbbAccessToken)
```

`appgateway` / `progateway` 的 CORS 均为全开（`access-control-allow-origin: *`，允许 `sign` / `corpid` 请求头），所以换 token 的 `fetch` 可以直接在登录页里执行，不需要 CLI 侧持有 Cookie。

## 换 API token

```text
POST https://{appgateway|progateway}.xbongbong.com/pro/v1/apiToken/getApiToken
body: { corpid, userId, platform: 'web' }
header: corpid=<corpid>, sign=SHA256(body + xbbAccessToken)
→ result: { corpid, userId, token, whiteList }
```

之后 `token-set` 的公共逻辑会用该 token 调 `proapi` / `appapi` 的 `/pro/v2/api/user/generateToken`：先 `resetToken=0` 查询是否已有个人 token，返回空串时再 `resetToken=1` 生成，最终保存 `user_*`。

## 错误返回（合成行，不抛异常）

| code | 含义 |
| --- | --- |
| `NO_BROWSER` | 未找到 Chrome / Edge，需 `--browser` 指定 |
| `BROWSER_SPAWN_FAILED` | 启动浏览器进程失败（如 profile 被占用） |
| `BROWSER_LAUNCH_FAILED` | 打开登录页失败 |
| `BROWSER_CLOSED` | 用户中途关闭了浏览器窗口 |
| `LOGIN_TIMEOUT` | 超时仍未检测到登录成功态（页面未跳转到 `/#/app/home`） |
| `API_TOKEN_FAILED` | 换取 API token 接口返回错误 |
| `CORPID_MISMATCH` | 实际登录企业与 `--corpid` 不一致 |
| `SAVE_FAILED` | 落盘 / 初始化缓存失败 |
| `INVALID_TIMEOUT` | `--timeout` 不是大于 0 的秒数 |

## 参数

| 参数 | 说明 |
| --- | --- |
| `--browser <chrome\|edge\|路径>` | 指定浏览器，不传自动探测 |
| `--timeout <秒>` | 等待登录完成的时间，默认 300 |
| `--corpid <CORPID>` | 期望登录的企业，不一致时报 `CORPID_MISMATCH` |
| `--keepOpen` | 登录成功后保留浏览器窗口 |
| `--env <0\|1>` | 存储方式：`0`（默认）仅写本地文件，`1` 仅写环境变量（不写本地文件） |
| `--debug` | 输出请求体 / 返回体 / 浏览器信息（密钥只显示掩码） |
| `--raw` | 输出换取 API token 接口的原始响应 |

## 已知限制

- 只支持 Chromium 内核浏览器（Chrome / Edge / Chromium），不支持 Firefox / Safari（它们没有 `--remote-debugging-pipe`）。
- 浏览器窗口必须是可见的真实窗口；headless 只能用于自检，不能完成人工登录。
- 账号密码登录本身另有滑块 / 短信验证码风控，因此本方案不做纯 HTTP 密码登录，登录交互完全交给浏览器。