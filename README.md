# xbbcli

销帮帮 CRM (`xbb`) 命令行工具。业务命令全部直接调用 HTTP API，不依赖 `opencli`；只有 `auth-login` 会拉起本地浏览器完成一次交互式登录。

## 安装

```bash
npm install -g @xbongbong/xbbcli
xbbcli --help
```

开发目录中也可以直接运行 `node bin/xbbcli.js`。

`xbbcli -h` 只展示顶层命令与分组入口；要一次查看全部命令，用 `xbbcli -h --all`（或 `xbbcli --all`），分组内命令会以 `分组 子命令` 形式平铺列出。

需要升级时运行 `npm update -g @xbongbong/xbbcli`。



首次使用时配置销帮帮凭证（二选一）：

```bash
# 方式一：浏览器登录（推荐），自动换取 API token 并完成初始化
xbbcli auth-login

# 方式二：手动填入已有 token
xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>
```

配置完成后即可运行各业务命令，例如：

```bash
xbbcli user-list
xbbcli form-list --saasMark 1 -f json
```

## 初始化配置

首次使用先保存 `corpid`、`token` 和 `userId`：

```bash
xbbcli token-set --corpid <CORPID> --token <TOKEN> --userId <USERID>
```

执行后会写入：

```text
~/.xbbcli/config.env
```

`config.env` 是一个 JSON 文件，可同时保存多家公司，每个公司包含：

- `corpid`
- `token`
- `baseurl`
- `userId`
- `enable`：是否启用；任何时刻**仅且只有一个**公司的 `enable` 为 `true`
- `corpName`：公司名称，取部门列表中 `id` 为 `1` 的部门名称（`token-set` 自动写入）
- `userName`：当前 `userId` 对应的员工姓名，从员工列表中按 `userId` 匹配（`token-set` 自动写入）

示例：

```json
[
  {
    "corpid": "<CORPID_A>",
    "token": "<TOKEN_A>",
    "baseurl": "https://proapi.xbongbong.com",
    "userId": "<USERID_A>",
    "corpName": "<CORP_NAME_A>",
    "userName": "<USER_NAME_A>",
    "enable": true
  },
  {
    "corpid": "<CORPID_B>",
    "token": "<TOKEN_B>",
    "baseurl": "https://appapi.xbongbong.com",
    "userId": "<USERID_B>",
    "enable": false
  }
]
```

### 浏览器登录（auth-login，推荐）

不带参数执行 `xbbcli auth-login`：命令会拉起本地 Chrome / Edge 打开销帮帮登录页，你在浏览器里用**任意方式**完成登录（账号密码、短信验证码、钉钉 / 企微 / 飞书扫码都可以），命令检测到登录态后自动换取 API token：

```bash
xbbcli auth-login                 # 自动探测 Chrome / Edge
xbbcli auth-login --browser edge  # 指定浏览器（chrome / edge / 可执行文件路径）
xbbcli auth-login --timeout 600   # 等待登录完成的秒数，默认 300
xbbcli auth-login --corpid <CORPID>  # 校验登录的企业，不一致时报错
xbbcli auth-login --keepOpen      # 登录成功后保留浏览器窗口（默认自动关闭）
```

执行后与 `token-set` 等价：`--env 0`（默认）写入 `~/.xbbcli/config.env`、刷新表单缓存、命令映射与部门/员工缓存（不写环境变量）；`--env 1` 仅写入 `XBB_*` 环境变量，不写任何本地文件。

在容器 / AI 客户端沙箱里启动浏览器：Linux 下以 root 运行时自动追加 `--no-sandbox`（否则 Chrome 会直接退出）；如果以非 root 运行但被 seccomp / user namespace 限制，可显式指定 `XBB_CHROME_NO_SANDBOX=1` 强制追加该参数，例如：

```bash
XBB_CHROME_NO_SANDBOX=1 xbbcli auth-login --timeout 600
```

技术实现：零依赖，用 `node:child_process` 以 `--remote-debugging-pipe` 启动浏览器（fd3 写 / fd4 读 CDP，**不开任何调试端口**），profile 固定为 `~/.xbbcli/browser-profile`（与日常浏览器隔离，登录态可复用）；CLI 读取页面 `localStorage` 的 `{corpid, userId, xbbAccessToken}`，再在页面内 `fetch` 网关 `apiPersonalToken/generate` 换取个人 token。只支持 Chromium 内核浏览器（Chrome / Edge / Chromium），更多细节见 [`doc/auth-login-command-design.md`](doc/auth-login-command-design.md)。

- `--debug` 输出请求体、返回体与浏览器信息（密钥只显示掩码），`--raw` 输出换取 API token 接口的原始响应
- 失败时返回合成错误行：`NO_BROWSER`、`BROWSER_CLOSED`、`LOGIN_TIMEOUT`、`API_TOKEN_FAILED`、`CORPID_MISMATCH`、`SAVE_FAILED` 等

### 刷新本地缓存（auth-refresh-cache）

`token-set` / `auth-login` 保存凭证时会顺带刷新三份本地缓存。插件升级（新增命令导致命令映射变化）、缓存过期或被删除后，可以单独重刷，不需要重新输入 token：

```bash
xbbcli auth-refresh-cache -f json
```

- 刷新范围（仅当前启用公司）：`~/.xbbcli/<corpid>.formlist.json`（表单清单）、`~/.xbbcli/<corpid>.command-map.md`（命令映射）、`~/.xbbcli/<corpid>.department-user.json`（部门/员工清单），并把 `corpName` / `userName` 回填进 `config.env`
- 环境变量模式（`XBB_*`）下同样可用：只刷新缓存文件，不回填 `config.env`
- 只支持当前启用公司：底层接口一律使用启用公司的凭证，切换公司请先用 `xbbcli token-use`
- `--userId` 覆盖用于匹配 `userName` 的员工 id（默认取配置里的 `userId`）；`--debug` 在 stderr 输出配置来源、corpid 与三份缓存文件路径
- 失败时返回 `status=error`、`code=CACHE_REFRESH_FAILED`，`message` 以「步骤 formlist / command-map / department-user / profile」指出中断位置，已完成的部分照常在对应列输出

`token-set` 会按 `corpid` 新增或覆盖一家公司，并把该公司置为 `enable=true`（其余公司自动置为 `false`），同时写入公司名称 `corpName`（取部门 `id` 为 `1` 的部门名称）和操作人姓名 `userName`（从员工列表中按 `userId` 匹配）。除 `token-set`、`token-list`、`token-use`、`token-del`、`auth-status`、`auth-logout` 外，其余命令都使用 `enable` 为 `true` 的公司配置。

同时会自动拉取两份表单清单并合并缓存到：

```text
~/.xbbcli/<corpid>.formlist.json
```

初始化过程会直接调用接口拉取两份表单清单：

```bash
xbbcli form-list --saasMark 2 -f json
xbbcli form-list --saasMark 1 -f json
```

同时会自动分页拉取所有部门与员工并缓存到：

```text
~/.xbbcli/<corpid>.department-user.json
```

初始化过程调用：

```bash
xbbcli department-list --pageSize 200 -f json
xbbcli user-list --pageSize 200 -f json
```

缓存文件内容：

- `departments`：部门清单（`id`、`name`、`parentId`、`depIdRouter`）
- `users`：员工清单（`userId`、`name`、`position`、`jobnumber`、`departmentList`）
- `departmentCount`、`userCount`、`pageSize`、`updatedAt`

以后需要查询部门或员工信息时，可以先查这个文件，避免重复调用接口。

`baseurl` 路由规则：

- `corpid` 以 `ding` 开头，或包含 `$$ding` 时，使用 `https://proapi.xbongbong.com`
- 其他 `corpid` 使用 `https://appapi.xbongbong.com`

### 查询员工权限（auth permission）

查询某员工在指定业务下的权限项集合（返回的是被查询员工实际拥有的权限，与当前登录人无关）：

```bash
xbbcli auth permission --checkUserId <USER_ID> --businessType 100                 # 客户管理（SaaS）
xbbcli auth permission --checkUserId <USER_ID> --businessType 8000 -f json        # 线索（SaaS）
xbbcli auth permission --checkUserId <USER_ID> --businessType 0 --formId 2040862  # 自定义表单（PaaS）
```

- `--checkUserId` 必填，为被查询员工 `userId`；`--businessType` 必填，`0` 表示自定义表单（此时 `--formId` 必填）
- 输出列：`checkUserId`、`businessType`、`formId`、`permissionCount`、`permissions`、`code`、`msg`；`permissions` 在 JSON 格式下是数组
- 错误码透传接口返回（如 `100001` 用户不存在、`100002` 参数无效），不抛异常

## 查看当前配置与登出

```bash
xbbcli auth-status                # 回显当前激活的配置（token 默认掩码）
xbbcli auth-status --showToken    # 需要完整 token 时
xbbcli auth-logout                # 登出：删除激活的那一家配置 + 清除 XBB_* 环境变量
xbbcli auth-logout --env 0        # 只删 config.env，保留环境变量
```

- `auth-status` 以 `key` / `value` 两列回显当前生效的配置值，固定 6 行：`corpid`、`corpName`、`userName`、`userId`、`baseurl`、`token`；随后追加 1 行 `验证`（用一次 `user-list --pageSize 1` 调用实测 token：`有效` / `无效-请重新配置token`）；不再输出 `status`、`source`、`message`、`enable`、`companyCount`、`envActive`、`configFile`、`code`、`msg` 这些元信息列。

```text
key       value
corpid    dinge3fa697f86d461d2
corpName  杭州逍邦网络科技有限公司
userName  陈会兵
userId    02415643151585
baseurl   https://proapi.xbongbong.com
token     user_6***a7da
验证      有效
note      以上取值来自环境变量 XBB_*（config.env 中没有启用公司，回落到环境变量）；环境变量模式不支持多公司切换
```

- 来源（`config.env` 启用公司 还是 `XBB_*`）与冲突提醒只在需要时以 `note` 行追加：环境变量与 `config.env` 同时存在时提示「环境变量优先，`config.env` 中启用（`enable=true`）的公司被覆盖」并提示清除环境变量可切回配置文件；`config.env` 里出现多个 `enable=true` 时提示用 `token-use` 修正。
- `auth-status` 的 `验证` 行会实打实发起一次 `user-list --pageSize 1` 请求（等价于手工执行 `xbbcli user-list --pageSize 1`）：接口成功（含 `NO_DATA` 空清单）→ `有效`；接口返回业务错误码或请求异常 → `无效-请重新配置token`。没有生效配置或缺少 token 时不再发起请求，直接给出 `无效-请重新配置token`；`--debug` 会输出判定结果与原因。
- 没有任何生效配置时，6 个配置值一律留空（`验证` 行为 `无效-请重新配置token`）并给出 `note` 提示下一步命令（即使 `XBB_BASEURL` / `XBB_USERID` 单独残留也不会当成生效值回显）。配置文件路径、公司数量、生效的环境变量名改用 `--debug` 输出到 stderr。
- `auth-status` 默认把 token 掩码为「前 6 + `***` + 后 4」（长度不足 11 时只保留前 2 位），只有 `--showToken` 才输出明文。
- `auth-logout` 只删除 `enable=true` 的那一条，**不会**把其他公司自动提升为启用：登出后本地可能一个启用公司都没有，需要 `xbbcli token-use --corpid <CORPID>` 或重新 `auth-login` / `token-set`。想保留其他公司并可切换时，用 `xbbcli token-del --corpid <CORPID>`（它会保证剩余配置仍有且仅有一个启用；默认还会删除 `XBB_*` 环境变量，传 `--env 0` 可保留）。
- 删除前 `config.env` 会整份备份到 `~/.xbbcli/config.env.bak`（每次登出覆盖），`backupFile` 列给出路径；误删把 `.bak` 复制回 `config.env` 即可恢复。
- 默认**同时**清除 `XBB_*` 环境变量：Windows 用 `reg delete HKCU\Environment` 删除用户级变量（已打开的终端要重开才生效，`envStored` 为 `user`，原本就不存在时为 `none`）；macOS/Linux 清理 `~/.xbbcli/env.sh` 里的 `export XBB_*` 行（文件清空则删除，`envStored` 为 `cleared` / `removed` / `none`）。传 `--env 0` 时只删 `config.env`，此时若环境变量仍在，`message` 会提示「其优先级高于 config.env，业务命令仍会使用它，本次不算彻底登出」（`XBB_ENV_ONLY=1` 时提示为「已强制只用环境变量」）。
- `config.env` 没有启用公司时：只有在环境变量确实存在时才只清环境变量（`config.env` 保持不动）；两者都不存在则返回 `NO_ACTIVE_CONFIG`，不写任何文件。
- 任何情况都不改动 `<corpid>.formlist.json` / `<corpid>.command-map.md` / `<corpid>.department-user.json` 三份缓存，重新启用该公司时无需再次拉取。

## 环境变量模式（单公司）

除 `config.env` 外，命令也支持从环境变量读取一家公司的凭证，便于 CI、容器与其他工具集成：

| 环境变量 | 对应字段 |
| --- | --- |
| `XBB_CORPID` | `corpid` |
| `XBB_TOKEN` | `token` |
| `XBB_BASEURL` | `baseurl` |
| `XBB_USERID` | `userId` |
| `XBB_CORPNAME` | `corpName` |
| `XBB_USERNAME` | `userName` |

读取优先级：

1. 环境变量 `XBB_*` 中 `XBB_CORPID` / `XBB_TOKEN` 有值时，优先使用环境变量（`config.env` 中 `enable=true` 的公司被覆盖，命令会以环境变量为准）
2. 环境变量不存在时，使用 `config.env` 中存在 `enable=true` 的公司（多公司切换行为不变）
3. 设置 `XBB_ENV_ONLY=1` 可强制只使用环境变量（完全忽略 `config.env`）

> 注意：由于环境变量优先，早先 `--env 1` 写入的 `XBB_*` 会覆盖之后 `token-set --env 0` 写入的 `config.env`（`token-set` 的 `message` 会给出提示）。要切回 `config.env` 请先清除 `XBB_*` 环境变量，或执行 `xbbcli auth-logout`（默认会一并清除）。

`token-set` / `auth-login` 通过 `--env` 控制存储方式：`--env 0`（默认）仅写入本地文件（`config.env` 与各类缓存），`--env 1` 仅写入环境变量（不写任何本地文件）。选 `--env 1` 时会把 `corpid`/`token`/`baseurl`/`userId` 写入环境变量：

- Windows：用 `setx` 写入用户级环境变量，**只对新开的终端生效**
- macOS/Linux：写入 `~/.xbbcli/env.sh`（`export` 形式，权限 600），需要 `source ~/.xbbcli/env.sh` 才在当前 shell 生效

环境变量模式只支持一家公司：此时 `token-list` 会把环境变量行（`source=env`）与 `config.env` 中的公司行（`source=config`）一起列出，并在 `msg` 列标注各自当前是否生效；`token-use` 会在切换 `config.env` 启用公司的同时，把该公司凭证同步写回 `XBB_*` 环境变量（目标公司缺 `token` 时拒绝切换，避免残留旧 `XBB_TOKEN`）；`token-del` 默认在删除公司的同时一并删除 `XBB_*` 环境变量（`--env 0` 可保留），并在 `message` 说明删除后的实际生效来源。

> 注意：`token-del --env 0` 保留环境变量时，若 `XBB_*` 仍有效，其优先级高于 `config.env`，业务命令仍会使用它（`message` 会给出提示）；要连环境变量一起清理，用 `token-del` 默认行为（不传 `--env`）或执行 `xbbcli auth-logout`（默认就会清除 `XBB_*`）；也可以手工执行 `setx XBB_TOKEN ""`（其余 `XBB_*` 同理，Windows 需重开终端）或删除 `~/.xbbcli/env.sh` 并 `unset` 当前 shell 中已导出的变量。

## 当前支持的命令

### 配置

认证与权限命令统一归入 `auth` 分组：`xbbcli auth login` / `auth logout` / `auth status` / `auth refresh-cache` / `auth permission`（`xbbcli auth -h` 查看子命令；`xbbcli auth-login` 等旧写法仍可直接使用）。

- `auth-login`：拉起本地浏览器完成交互式登录（账号密码 / 短信 / 扫码均可），自动读取 Web 会话、换取 API token 并复用 `token-set` 落盘；支持 `--browser`、`--timeout`、`--corpid`、`--keepOpen`、`--env`、`--debug`、`--raw`
- `auth-status`：以 `key` / `value` 两列回显当前激活配置的 `corpid`、`corpName`、`userName`、`userId`、`baseurl`、`token`（token 默认中间掩码，`--showToken` 出明文），并追加 `验证` 行（调用一次 `user-list --pageSize 1` 实测 token，`有效` / `无效-请重新配置token`）；来源与冲突提醒以 `note` 行追加，无生效配置时六个值留空并给出 `note`；`--debug` 在 stderr 输出配置文件路径、公司数量、生效的环境变量名与验证结果
- `auth-logout`：删除 `config.env` 中 `enable=true` 的那一条配置，删除前整份备份为 `~/.xbbcli/config.env.bak`；不自动把其他公司提升为启用；默认同时清除 `XBB_*` 环境变量（`--env 0` 跳过，返回 `envStored` / `envFile`）；既无启用公司又无环境变量时返回 `NO_ACTIVE_CONFIG` 且不改动文件
- `auth-refresh-cache`：对当前启用公司重新拉取表单缓存、命令映射与部门/员工缓存，并回填 `corpName` / `userName`；失败时返回 `code=CACHE_REFRESH_FAILED`，`message` 注明中断步骤（`formlist` / `command-map` / `department-user` / `profile`），已完成的部分照常输出；支持 `--userId`、`--debug`
- `auth permission`：查询员工（`--checkUserId`，与当前登录人无关）在指定业务（`--businessType`）下的权限项集合；SaaS 业务传 businessType（如 `100`/`201`/`301`/`401`/`8000`/`20300`），自定义表单传 `--businessType 0` 并附 `--formId`；返回 `permissions` 集合、`permissionCount` 与 `code` / `msg`
### 本地凭证（token 分组）

本地凭证命令统一挂在 `token` 分组下，用 `xbbcli token <subcommand>` 调用（`xbbcli token-set` 等连字符写法同样可用；无 businessType）：

- `xbbcli token set`：保存个人 token、corpid、userId、baseurl，并刷新本地表单缓存、命令映射与部门/员工缓存；`--env 0`（默认）仅写本地文件，`--env 1` 仅写 `XBB_*` 环境变量
- `xbbcli token list`：列出本地保存的多家公司配置，`--showToken` 显示明文，`--raw` 输出原文
- `xbbcli token use`：切换当前启用公司，`XBB_*` 有值时同步写回环境变量
- `xbbcli token del`：删除指定公司配置，默认同时清理 `XBB_*`（`--env 0` 保留）
- `xbbcli token generate`：生成/获取个人 token，`--resetToken 0` 获取（默认）、`1` 刷新

`xbbcli token --help` 查看全部子命令。

### 组织与人员

- `role-list`：角色列表

### 用户（二级命令）

用户命令统一挂在 `user` 分组下，用 `xbbcli user <subcommand>` 调用（`xbbcli user-list` 等连字符写法同样可用）：

- `xbbcli user list` / `add` / `edit` / `del` / `handover`：用户列表、新建、编辑、删除、交接

`xbbcli user --help` 查看全部子命令。

### 部门（二级命令）

部门命令统一挂在 `department` 分组下，用 `xbbcli department <subcommand>` 调用（`xbbcli department-list` 等连字符写法同样可用）：

- `xbbcli department list` / `add` / `edit` / `del`：部门列表、新建、编辑、删除

`xbbcli department --help` 查看全部子命令。

### 企业工商信息

- `business-info-search`：按关键词搜索企业，返回企业准确全称与 `pid`（供 `business-info-detail` 使用）
- `business-info-detail`：按 `pid` 查询企业工商登记信息，key/value 逐字段回显；`dateOfEstablishment` / `approvalDate` / `cancellationDate` 等时间戳转为 `YYYY-MM-DD`（UTC+8），`registeredAddress` / `shareholder` 为 JSON 字符串

### 邮件（二级命令）

邮件命令统一挂在 `mail` 分组下，用 `xbbcli mail <subcommand>` 调用（`xbbcli mail-send` 这种连字符写法同样可用）；`xbbcli -h` 顶层帮助只显示 `mail` 分组入口，子命令列表用 `xbbcli mail --help` 查看：

- `xbbcli mail send`：发送邮件；`--to` 必填（收件人 JSON 数组），`--cc` / `--attachment` 可选，传 `--draftId` 可发送草稿
- `xbbcli mail list`：按文件夹分页查看邮件；`--folderId` 必填（1 收件箱、2 已发送、3 草稿箱、4 已删除、5 垃圾邮件、6 未读），支持 `--page` / `--pageSize` / `--filterType` / `--raw`
- `xbbcli mail detail`：查看邮件或草稿详情；`--id` 与 `--folderId` 必填，草稿详情传 `--folderId 3`；查看未读邮件会将其标记为已读
- `xbbcli mail draft add`：新建草稿，允许内容未填写完整
- `xbbcli mail draft edit`：编辑草稿；只传需要修改的字段（空数组 / `null` 不会清空旧值）

收件人 / 抄送人格式：`[{"name":"张三","mailAddress":"zhangsan@example.com"}]`；附件格式：`[{"fileName":"报价单","attachIndex":"https://files.example.com/q.pdf","ext":"pdf","size":102400}]`（`attachIndex` 是邮件服务可访问的文件 URL）。单封邮件最多 20 个附件，收件人与抄送人合计最多 48 人。`xbbcli mail --help` 查看全部子命令。

### 客户（二级命令）

客户命令统一挂在 `customer` 分组下，用 `xbbcli customer <subcommand>` 调用（`xbbcli customer-add` 等连字符写法同样可用）：

- `xbbcli customer list` / `detail` / `add` / `edit` / `del`：客户列表、详情、新增、编辑、删除（`add --demo` 返回请求体示例）
- `xbbcli customer back` / `distribution` / `handover`：退回公海、分配、移交
- `xbbcli customer add-mainuser` / `add-couser` / `delete-mainuser` / `delete-couser`：添加/删除负责人与协同人
- `xbbcli customer invoice info` / `invoice info add` / `invoice info edit`：客户开票信息列表、新增、编辑
- `xbbcli customer invoice address` / `invoice address add` / `invoice address edit`：客户开票地址列表、新增、编辑

`xbbcli customer --help` 查看全部子命令。
### 联系人（二级命令）

联系人命令统一挂在 `contact` 分组下，用 `xbbcli contact <subcommand>` 调用（`xbbcli contact-add` 等连字符写法同样可用）：

- `xbbcli contact list` / `detail` / `add` / `edit` / `del`：联系人列表、详情、新建、编辑、删除
- `xbbcli contact add-couser` / `add-mainuser` / `delete-couser` / `delete-mainuser` / `handover`：添加/删除协同人与负责人、移交

`xbbcli contact --help` 查看全部子命令。

### 线索（lead 分组，二级命令）

线索命令统一挂在 `lead` 分组下，用 `xbbcli lead <subcommand>` 调用（`xbbcli lead-add` 这种连字符写法同样可用）；`xbbcli -h` 顶层帮助只显示 `lead` 分组入口，子命令列表用 `xbbcli lead --help` 查看：

- `xbbcli lead list`：线索列表（`--formId` 必填）
- `xbbcli lead add`：新建线索（`--demo` 只返回请求体示例，字段值替换为「字段名：xxx|是否必填|字段类型：xxx」提示，强制 JSON；未传 `--formId` 时从表单缓存解析线索表单，`--demo` 与正式新建一致）
- `xbbcli lead edit` / `lead detail` / `lead del`：编辑、详情、删除线索
- `xbbcli lead add-couser` / `lead delete-couser` / `lead delete-mainuser`：添加协同人、删除协同人、删除负责人
- `xbbcli lead distribution` / `lead back` / `lead handover` / `lead thorough-delete`：分配、退回公海、移交、彻底删除

`xbbcli lead --help` 查看全部子命令。

### 销售机会（二级命令）

销售机会命令统一挂在 `opportunity` 分组下，用 `xbbcli opportunity <subcommand>` 调用（`xbbcli opportunity-add` 等连字符写法同样可用）：

- `xbbcli opportunity list` / `detail` / `add` / `edit` / `del` / `handover`：销售机会列表、详情、新建、编辑、删除、移交
- `xbbcli opportunity add-mainuser` / `add-couser` / `delete-mainuser` / `delete-couser`：添加/删除负责人与协同人

`xbbcli opportunity --help` 查看全部子命令。

### 合同订单与销售出库单（二级命令）

合同订单（businessType: 201）与销售出库单（businessType: 1504）统一挂在 `contract` 分组下，用 `xbbcli contract <subcommand>` 调用（`xbbcli contract-add` 等连字符写法同样可用）：

- `xbbcli contract list` / `detail` / `add` / `edit` / `del`：合同订单列表、详情、新建、编辑、删除
- `xbbcli contract add-mainuser` / `add-couser` / `delete-mainuser` / `delete-couser` / `handover`：添加/删除负责人与协同人、移交
- `xbbcli contract outstock list` / `outstock detail` / `outstock add` / `outstock edit` / `outstock del`：销售出库单列表、详情、新建、编辑、删除

`xbbcli contract --help` 查看全部子命令。

### 跟进记录与拜访计划（二级命令）

跟进记录（businessType: 501）与拜访计划（businessType: 601）统一挂在 `communicate` 分组下，用 `xbbcli communicate <subcommand>` 调用：

- `xbbcli communicate list` / `detail` / `add` / `edit` / `del`：跟进记录列表、详情、新建、编辑、删除
- `xbbcli communicate plan list` / `plan detail` / `plan add` / `plan cancel` / `plan del` / `plan single operate`：拜访计划列表、详情、新建、取消、删除、延期

`xbbcli communicate --help` 查看全部子命令。

### 市场活动（二级命令）

市场活动命令统一挂在 `market-activity` 分组下，用 `xbbcli market-activity <subcommand>` 调用（`xbbcli market-activity-add` 等连字符写法同样可用）：

- `xbbcli market-activity list` / `detail` / `add` / `edit` / `del` / `handover`：市场活动列表、详情、新建、编辑、删除、移交

`xbbcli market-activity --help` 查看全部子命令。

### 表单相关

- `form-list`：表单模板列表
- `form-get`：表单模板字段定义，在填充参数时不清楚参数含义/下拉框可选项值，调用本接口获取 form 解释

### 自定义表单数据（二级命令）

自定义表单数据命令统一挂在 `form-data` 分组下，用 `xbbcli form-data <subcommand>` 调用（`xbbcli form-data-list` 等连字符写法同样可用）：

- `xbbcli form-data list` / `detail` / `add` / `edit` / `del` / `handover`：数据列表、详情、新增、编辑、删除、移交
- `xbbcli form-data add-mainuser` / `add-couser` / `delete-mainuser` / `delete-couser`：添加/删除负责人与协同人

`xbbcli form-data --help` 查看全部子命令。

### 产品（二级命令）

产品命令统一挂在 `product` 分组下，用 `xbbcli product <subcommand>` 调用（`xbbcli product-add` 等连字符写法同样可用）：

- `xbbcli product list` / `detail` / `add` / `edit` / `del` / `online`：产品列表、详情、新建、编辑、删除、上下架（`add --demo` 返回请求体示例）
- `xbbcli product category list` / `category add` / `category update` / `category del`：产品分类列表、新建、编辑、删除

`xbbcli product --help` 查看全部子命令。

### 报价单（二级命令）

报价单命令统一挂在 `quotation` 分组下，用 `xbbcli quotation <subcommand>` 调用（`xbbcli quotation-add` 等连字符写法同样可用）：

- `xbbcli quotation list` / `detail` / `add` / `edit` / `del` / `handover`：报价单列表、详情、新建、编辑、删除、移交
- `xbbcli quotation add-mainuser` / `add-couser` / `delete-mainuser` / `delete-couser`：添加/删除负责人与协同人

`xbbcli quotation --help` 查看全部子命令。

### 销项发票（二级命令）

销项发票命令统一挂在 `invoice` 分组下，用 `xbbcli invoice <subcommand>` 调用（`xbbcli invoice-list` 等连字符写法同样可用）：

- `xbbcli invoice list` / `detail` / `add` / `edit` / `del`：销项发票列表、详情、新建、编辑、删除
- `xbbcli invoice cancel` / `invoice red` / `invoice get-amount-detail`：作废、红冲、金额明细

`xbbcli invoice --help` 查看全部子命令。

### 应收款操作

- `xbbcli payment list` / `payment detail` / `payment del`：应收款列表、详情、删除
- `xbbcli payment add` / `payment edit` / `payment handover`：新建、编辑、移交应收款
- `xbbcli payment add-mainuser` / `add-couser` / `delete-mainuser` / `delete-couser`：应收款添加/删除负责人、协同人

### 回款与退款

- `xbbcli payment-sheet list` / `detail` / `del` / `handover`：回款单列表、详情、删除、移交
- `xbbcli payment-sheet add-write-off` / `edit-write-off`：新建/编辑核销回款单
- `xbbcli payment-sheet add-red` / `edit-red`：新建/编辑红冲回款单
- `xbbcli payment-sheet add-bad-debt` / `edit-bad-debt`：新建/编辑坏账回款单
- `xbbcli payment-sheet add-pre`：新建预收款回款单
- `xbbcli payment-sheet get-amount-detail`：回款单金额明细
- `xbbcli payment-sheet add-couser` / `add-mainuser` / `delete-couser` / `delete-mainuser`：回款单添加/删除协同人与负责人
- `xbbcli pay-plan list` / `pay-plan detail`：付款计划列表、详情
- `xbbcli pay-plan add` / `pay-plan handover`：新增、移交付款计划
- `xbbcli pay-plan add-couser` / `add-mainuser` / `delete-couser` / `delete-mainuser`：付款计划添加/删除协同人与负责人
- `xbbcli pay-sheet list` / `pay-sheet detail` / `pay-sheet del`：付款单列表、详情、删除
- `xbbcli pay-sheet add-write-off` / `edit-write-off`：新建/编辑付款单
- `xbbcli pay-sheet add-red` / `edit-red`：新建/编辑核销付款单红冲
- `xbbcli pay-sheet add-bad` / `edit-bad`：新建/编辑核销付款单坏账
- `xbbcli pay-sheet get-amount-detail`：付款单金额明细
- `xbbcli pay-sheet add-couser` / `add-mainuser` / `delete-couser` / `delete-mainuser`：付款单添加/删除协同人与负责人
### 退货退款单（二级命令）

退货退款单命令统一挂在 `refund` 分组下，用 `xbbcli refund <subcommand>` 调用（`xbbcli refund-list` 等连字符写法同样可用）：

- `xbbcli refund list` / `detail` / `add` / `edit` / `del`：退货退款单列表、详情、新建、编辑、删除

`xbbcli refund --help` 查看全部子命令。

### 新版工单（服务云，二级命令）

工单命令统一挂在 `work-order` 分组下：

- `xbbcli work-order list`：新版工单列表；`xbbcli work-order detail`：工单详情
- `xbbcli work-order add` / `work-order edit` / `work-order del` / `work-order operate`：新增、编辑、删除、流转
- `xbbcli work-order dynamic list`：工单动态列表
- `xbbcli work-order handover` / `work-order add-couser` / `work-order delete-couser`：移交负责人、添加/删除协同人
- `xbbcli work-order asset list` / `asset detail` / `asset add` / `asset edit` / `asset del` / `asset handover`：工单资产增删改查与移交
- `xbbcli work-order asset add-couser` / `asset add-mainuser` / `asset del-couser` / `asset del-mainuser`：资产添加/删除协同人与负责人
- `workorder-template-list` / `workorder-template-detail`：工单模板列表与详情（归入 `workorder` 分组，不在 `work-order` 分组内）

`xbbcli work-order --help` 查看全部子命令。


### 生产（二级命令）

生产单 / 生产入库单 / 生产领料单统一挂在 `production` 分组下，用 `xbbcli production <subcommand>` 调用：

- `xbbcli production order list`：生产单列表，支持 `--conditions` / `--attr`+`--value` / `--page` / `--pageSize` / `--viewApproval` / `--raw`
- `xbbcli production order detail --dataId <ID>`：生产单详情，可选 `--queryFlag`（0 非审批、1 审批、2 全部）
- `xbbcli production instock list`：生产入库单列表（参数同上）
- `xbbcli production instock detail --dataId <ID>`：生产入库单详情
- `xbbcli production materiel outstock list`：生产领料单列表（参数同上）
- `xbbcli production materiel outstock detail --dataId <ID>`：生产领料单详情

`xbbcli production --help` 查看全部子命令。

### 其他收入单（二级命令）

其他收入单命令统一挂在 `other-income` 分组下，用 `xbbcli other-income <subcommand>` 调用：

- `xbbcli other-income list`：其他收入单列表，支持 `--conditions` / `--attr`+`--value` / `--page` / `--pageSize` / `--raw`
- `xbbcli other-income detail --dataId <ID>`：其他收入单详情
- `xbbcli other-income add --dataList '<JSON>'`：新建其他收入单
- `xbbcli other-income edit --dataId <ID> --dataList '<JSON>'`：编辑其他收入单
- `xbbcli other-income del --dataId <ID>`：删除其他收入单

`xbbcli other-income --help` 查看全部子命令。

### 其他支出单（二级命令）

其他支出单命令统一挂在 `other-expense` 分组下，用 `xbbcli other-expense <subcommand>` 调用：

- `xbbcli other-expense list`：其他支出单列表，支持 `--conditions` / `--attr`+`--value` / `--page` / `--pageSize` / `--viewApproval` / `--raw`
- `xbbcli other-expense detail --dataId <ID>`：其他支出单详情，可选 `--queryFlag`（0 非审批、1 审批、2 全部）
- `xbbcli other-expense add --dataList '<JSON>'`：新建其他支出单，支持 `--demo`
- `xbbcli other-expense edit --dataId <ID> --dataList '<JSON>'`：编辑其他支出单
- `xbbcli other-expense del --dataId <ID>`：删除其他支出单

`xbbcli other-expense --help` 查看全部子命令。

### 回执单（二级命令）

回执单命令统一挂在 `receipt-order` 分组下，用 `xbbcli receipt-order <subcommand>` 调用：

- `xbbcli receipt-order list --formId <FORMID>`：回执单列表，支持 `--conditions` / `--attr`+`--value` / `--page` / `--pageSize` / `--viewApproval` / `--raw`
- `xbbcli receipt-order detail --dataId <ID>`：回执单详情，可选 `--queryFlag`（0 非审批、1 审批、2 全部）
- `xbbcli receipt-order add --formId <FORMID> --dataList '<JSON>'`：新建回执单，支持 `--demo`
- `xbbcli receipt-order edit --dataId <ID> --dataList '<JSON>'`：编辑回执单
- `xbbcli receipt-order del --dataId <ID>`：删除回执单

`xbbcli receipt-order --help` 查看全部子命令。

### 工时记录（二级命令）

工时记录命令统一挂在 `work-time-record` 分组下，用 `xbbcli work-time-record <subcommand>` 调用：

- `xbbcli work-time-record list`：工时记录列表，支持 `--conditions` / `--attr`+`--value` / `--page` / `--pageSize` / `--viewApproval` / `--raw`
- `xbbcli work-time-record detail --dataId <ID>`：工时记录详情，可选 `--queryFlag`
- `xbbcli work-time-record add --dataList '<JSON>'`：新增工时记录，支持 `--demo`
- `xbbcli work-time-record edit --dataId <ID> --dataList '<JSON>'`：编辑工时记录
- `xbbcli work-time-record del --dataId <ID>`：删除工时记录
- `xbbcli work-time-record add-couser` / `add-mainuser` / `delete-couser` / `delete-mainuser --dataId <ID> --businessUserIdList '["<USERID>"]'`：添加/删除协同人、负责人
- `xbbcli work-time-record handover --dataIdList '[<ID>]' --businessUserId <USERID>`：移交负责人

`xbbcli work-time-record --help` 查看全部子命令。

### 工作任务（二级命令）

工作任务命令统一挂在 `work-task` 分组下，用 `xbbcli work-task <subcommand>` 调用（`xbbcli work-task-add` 等连字符写法同样可用）：

- `xbbcli work-task detail --dataId <ID>`：任务详情
- `xbbcli work-task add --dataList '<JSON>'`：新建任务，支持 `--demo`
- `xbbcli work-task edit --dataId <ID> --dataList '<JSON>'`：编辑任务
- `xbbcli work-task add-couser` / `delete-couser --dataId <ID> --businessUserIdList '["<USERID>"]'`：添加/删除协同人
- `xbbcli work-task handover --dataIdList '[<ID>]' --businessUserId <USERID>`：移交任务

`xbbcli work-task --help` 查看全部子命令。

### 标签（二级命令）

标签与标签分组命令统一挂在 `label` 分组下：

- `xbbcli label list`：标签列表；`xbbcli label all list`：表单标签列表
- `xbbcli label add` / `label edit` / `label del` / `label del-completely` / `label reduction` / `label repeat`：标签增删改、彻底删除、还原、判重
- `xbbcli label batch add` / `label batch remove`：批量打标签 / 移除标签
- `xbbcli label group list` / `label group add` / `label group update` / `label group del`：标签分组列表、新建、编辑、删除

`xbbcli label --help` 查看全部子命令。

### 工作报告（二级命令）

日报 / 周报 / 月报命令统一挂在 `work-report` 分组下：

- `xbbcli work-report daily list`：日报列表
- `xbbcli work-report daily detail --dataId <ID>`：日报详情
- `xbbcli work-report daily add`：新建日报
- `xbbcli work-report daily edit`：编辑日报
- `xbbcli work-report daily del`：删除日报
- `xbbcli work-report daily get work plan`：获取工作计划
- `xbbcli work-report weekly list`：周报列表
- `xbbcli work-report weekly detail --dataId <ID>`：周报详情
- `xbbcli work-report weekly add`：新建周报
- `xbbcli work-report weekly edit`：编辑周报
- `xbbcli work-report weekly del`：删除周报
- `xbbcli work-report monthly list`：月报列表
- `xbbcli work-report monthly detail --dataId <ID>`：月报详情
- `xbbcli work-report monthly add`：新建月报
- `xbbcli work-report monthly edit`：编辑月报
- `xbbcli work-report monthly del`：删除月报

`xbbcli work-report --help` 查看全部子命令。

### 阶段流转

- `stage-get`：阶段获取
- `stage-jump`：阶段跳转

### 旧工单（已过时，不建议使用，workorder 分组）

- `xbbcli workorderlist`：旧版工单列表命令
- `xbbcli workorderproductlist`：工单配件列表
- `xbbcli workorder template list`：工单模板列表
- `xbbcli workorder template detail`：工单模板详情

`xbbcli workorder -h` 可查看分组子命令。工时记录命令归入 `work-time-record` 分组，旧命令名 `worktimerecordlist` / `worktimerecorddetail` 已更名为 `work-time-record list` / `work-time-record detail`。

## 命名说明

仓库里现在同时保留两套工单命名：

- 旧命名：`workorderlist`、`workorderproductlist`
- 新命名：`work-order-list`、`work-order-detail`、`work-order-add`、`work-order-edit`、`work-order-del`、`work-order-operate`

建议新接入优先使用带连字符的 `work-order-*` 命令。`workorderlist` 仍保留，主要用于兼容旧功能。

## 通用行为

- 先执行一次 `token-set`（或 `auth-login`）保存有效的 `corpid`、`token`、`userId`
- 用 `xbbcli auth-status` 查看当前生效的配置来自 `config.env` 还是环境变量；`xbbcli auth-logout` 删除激活配置并默认清除 `XBB_*` 环境变量（`--env 0` 保留）
- 除 `token-set` 外，其余命令都会从 `~/.xbbcli/config.env` 读取 `corpid`
- 大部分命令会从 `~/.xbbcli/config.env` 读取 `token`
- 环境变量 `XBB_*` 的优先级高于 `config.env`：`XBB_CORPID` / `XBB_TOKEN` 有值时，所有命令都以环境变量为准（`config.env` 中的启用公司被覆盖）；两者都不存在时才没有任何生效配置。`XBB_ENV_ONLY=1` 可强制只用环境变量
- 所有命令会从配置中读取 `userId` 并附加到请求 header 中
- 大部分命令需要 formId 参数，可以根据业务名称或 businessType 从 `~/.xbbcli/<corpid>.formlist.json` 中获取 formId
- 需要查询部门 id/名称，或员工 userId/所属部门时，可以先查 `~/.xbbcli/<corpid>.department-user.json`（由 `token-set` 分页抓取并缓存全部部门与员工）
- 当前公司名称存在 `~/.xbbcli/config.env` 的 `corpName` 字段（取部门 `id` 为 `1` 的部门名称），操作人姓名存在 `userName` 字段（按 `userId` 匹配员工列表）
- 未传入的可选参数不会进入请求体
- `--attr` 和 `--value` 只有同时提供时才会拼入查询条件
- 失败时返回的是带 `code` / `msg` 的结果行，不抛异常；网络不可达时返回 `NETWORK_ERROR` 行（不会抛 `fetch failed`）
- 加 `--debug` 可以输出 `requestBody` 和 `responseBody`
- 加 `--raw` 可以输出接口返回的原始 JSON 字符串（所有 list 命令均支持）
- 所有以 `-add` 结尾的命令都支持 `--demo`（`mail-draft-add`、`other-income-add` 除外）：不写入数据，只返回新建接口的请求体示例，`dataList` 的字段值被替换为提示串 `字段名：企业名称|必填|字段类型：文本`，选项字段为 `字段名：线索来源|选填|字段类型：单选：选项1/选项2`（`array_` 多选字段为 `多选`），子表保留数组结构并加工内部字段，地址/附件/负责人等复杂结构保留原示例值；未传 `--formId` 时从表单缓存按 `businessType` 自动解析，且强制 JSON 输出（忽略 `-f table/csv`）；`--demo` 的错误行只有 `code` / `msg` 两列
- 在填充参数时不清楚参数含义/下拉框可选项值，调用 `form-get` 命令获取 form 解释
- 邮件命令为二级命令：`xbbcli mail send`、`xbbcli mail draft add` 等；`xbbcli mail --help` 列出全部子命令
- `xbbcli -v` / `xbbcli --version` 查看版本号（读取 `package.json` 的 `version`）

## 常用示例

### 基础配置/初始化

```bash
xbbcli auth-login
xbbcli token-set --corpid your_corpid --token your_token --userId your_userid
xbbcli auth-status
xbbcli auth-logout
```

### 员工信息

```bash
xbbcli user-list
xbbcli user-list --nameLike 张三 --debug
```

### 表单查询

```bash
xbbcli form-list --saasMark 1
xbbcli form-list --saasMark 1 --businessType 100
xbbcli form-list --saasMark 2 --name 工单

xbbcli form-get --formId 19274
xbbcli form-get --formId 19277 --subBusinessType 100
```

### 客户

```bash
xbbcli customer-list --formId 12345
xbbcli customer-list --formId 12345 --attr text_1 --value apiTest.001

xbbcli customer-add --demo                       # 不写数据，只返回请求体示例
xbbcli customer-add --demo --formId 1969375      # 缓存里有多个客户表单时用它指定
xbbcli customer-add --formId 19274 --dataList '{"text_1":"apiTest.001"}'
xbbcli customer-edit --formId 19274 --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
xbbcli customer-detail --dataId 310992
xbbcli customer-add-couser --dataId 310995 --businessUserIdList '["xbbTest002"]'
```

### 线索

```bash
xbbcli lead add --demo                       # formId 从表单缓存自动解析
xbbcli lead add --demo --formId 2795678
xbbcli lead add --demo --formId 2795678 -f table   # 仍输出 JSON
xbbcli lead add --dataList '{"text_1":"测试线索"}'  # 正式新建同样会从缓存解析 formId
```

### 新建接口的请求体示例（--demo）

**所有以 `-add` 结尾的命令都支持 `--demo`**（`mail-draft-add`、`other-income-add` 除外，平台示例接口 `customized/param/get` 不支持这两个 url，会返回 `100063 网络请求失败`）：不写入任何数据，只返回该接口的请求体示例。表单型接口的 `dataList` 中每个字段值都是提示串，例如 `"text_1": "字段名：企业名称|必填|字段类型：文本"`、`"text_4": "字段名：线索来源|选填|字段类型：单选：名片/展会/客户介绍/官网/推广"`；把提示串替换为实际值即可得到可以直接使用的 `--dataList`。子表（`subForm_N` / `array_N`）保留数组结构且内部字段同样是提示串，地址、附件、负责人/协同人等复杂字段保留原示例结构。

- `--demo` 强制 JSON 输出（`-f table/csv` 会被忽略），错误行只有 `code` / `msg` 两列，成功行是示例对象本身；示例里的 `corpid` / `userId` 已换成当前生效配置，不会出现接口文档里的占位值。
- 未传 `--formId` 时按 `businessType` 从表单缓存解析（线索 `8000`、客户 `100`、联系人 `401`、合同 `201`、工单 `20300` 等，具体见 `xbbcli <command> -h`）。缓存里同类型有多个表单时返回 `MULTIPLE_FORM` 并列出候选，此时用 `--formId` 指定（未声明该参数的命令见下一条）；唯一表单的 `formId` 非法时返回 `INVALID_FORM_ID`。
- `--formId` 参数只在**写请求体真的接收 formId** 的命令上提供（`lead-add`、`customer-add`、`contract-add`、`opportunity-add`、`work-order-add`、`quotation-add`、`form-data-add`、`communicate-plan-add`、`label-*`）。写请求体不接收 formId 的命令（`contact-add`、`communicate-add`、`payment-add`、`product-add` 等）不声明该参数——这类业务按约定只有一个表单，demo 直接从缓存解析；示例里的 `formId` 字段会被剔除。若某租户确实有多个表单，demo 返回 `MULTIPLE_FORM`，可用 `xbbcli form-get --formId <ID>` 查看指定表单的字段。
- 非表单接口（`department-add`、`user-add`、`label-*`、`product-category-add`、`customer-invoice-*`）返回的是接口级参数示例，没有 `dataList`。
- `form-data-add` 面向任意自定义表单，没有可自动匹配的表单类型，`--demo` 必须显式传 `--formId`。

```bash
xbbcli customer-add --demo --formId 1969375   # 客户有多个表单，需要指定
xbbcli product-add --demo                    # 产品表单唯一，直接解析
xbbcli contact-add --demo                    # 联系人只有一个表单，直接解析
xbbcli department-add --demo                 # 非表单接口，返回 name/parentId 等参数示例
```

### 企业工商信息

```bash
xbbcli business-info-search --keyword 杭州逍邦网络科技有限公司
xbbcli business-info-detail --pid 5bb73e72a9ae9a0318fd95ce
```

### 邮件

```bash
xbbcli mail list --folderId 1
xbbcli mail list --folderId 3 --pageSize 50
xbbcli mail detail --id 12345 --folderId 1
xbbcli mail detail --id 12345 --folderId 3

xbbcli mail send --to '[{"name":"张三","mailAddress":"zhangsan@example.com"}]' --subject 项目报价 --data '<p>您好，附件是项目报价单。</p>'
xbbcli mail send --to '[{"name":"张三","mailAddress":"zhangsan@example.com"}]' --subject 项目报价 --attachment '[{"fileName":"报价单","attachIndex":"https://files.example.com/quotation.pdf","ext":"pdf","size":102400}]'
xbbcli mail send --to '[{"name":"张三","mailAddress":"zhangsan@example.com"}]' --subject 项目报价 --draftId 12345

xbbcli mail draft add --to '[{"name":"张三","mailAddress":"zhangsan@example.com"}]' --subject 待确认的项目报价
xbbcli mail draft edit --id 12345 --subject '项目报价（修订版）'
```

### 表单模型/业务数据

```bash
xbbcli form-data-list --formId 19274
xbbcli form-data-detail --dataId 310992
xbbcli form-data-add --formId 19274 --dataList '{"text_1":"apiTest.001"}'
xbbcli form-data-edit --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
xbbcli form-data-del --dataId 310992
```

### 产品、回款、退款

```bash
xbbcli product-add --demo                    # 产品表单唯一，formId 直接解析
xbbcli product-list --attr serialNo --value CP.API.0001
xbbcli product-detail --dataId 10001
xbbcli product-category-list
xbbcli product-category-update --dataId 306 --name 分类A
xbbcli product-category-del --dataId 306

xbbcli payment list --attr serialNo --value PMO.API.0001
xbbcli pay-plan list --attr serialNo --value PPO.API.0001
xbbcli pay-plan detail --dataId 1071
xbbcli payment-sheet list --attr serialNo --value RMO.API.0001
xbbcli payment-sheet list --subBusinessType 702
xbbcli payment-sheet edit-write-off --dataId 1194 --dataList '{"text_7":"编辑备注"}'
xbbcli payment-sheet add-red --dataList '{"serialNo":"RMO.API.0001"}'
xbbcli payment-sheet edit-red --dataId 1198 --dataList '{"text_7":"编辑红冲备注"}'
xbbcli payment-sheet add-bad-debt --dataList '{"serialNo":"RMO.API.0002"}'
xbbcli payment-sheet add-couser --dataId 2206 --businessUserIdList '["xbbTest002"]'
xbbcli payment-sheet delete-couser --dataId 2206 --businessUserIdList '["xbbTest002"]'
xbbcli refund-list --attr serialNo --value RFO.API.0001
```

### 工单新命名

```bash
xbbcli work-order-list --formId 7526034
xbbcli work-order-list --formId 7526034 --attr serialNo --value WOO.20210616001
xbbcli work-order-list --formId 7526034 --conditions "[{\"attr\":\"text_4\",\"value\":[4],\"symbol\":\"in\"},{\"attr\":\"ownerId\",\"value\":[\"02415643151585\"],\"symbol\":\"equal\"}]"

xbbcli work-order-detail --dataId 663
xbbcli work-order-add --formId 7526034 --dataList '{"text_1":"测试工单"}'
xbbcli work-order-edit --dataId 663 --dataList '{"text_1":"测试工单-更新"}'
xbbcli work-order-del --dataId 663
xbbcli work-order-operate --dataId 663 --operateType 12 --userId "02415643151585"
xbbcli work-order-operate --dataId 663 --operateType 1 --data '{"cancelReason":"测试取消"}'
```

### 生产单 / 生产入库单 / 生产领料单

```bash
xbbcli production order list --pageSize 10
xbbcli production order list --attr serialNo --value PRO.API.001
xbbcli production order detail --dataId 2529

xbbcli production instock list --viewApproval 0
xbbcli production instock detail --dataId 2529 --queryFlag 2

xbbcli production materiel outstock list
xbbcli production materiel outstock detail --dataId 2529
```

### 其他收入单

```bash
xbbcli other-income list --pageSize 10
xbbcli other-income list --attr serialNo --value OIO.20260920003
xbbcli other-income detail --dataId 87

xbbcli other-income add --dataList '{"serialNo":"OIO.20260920004","num_1":100,"date_1":1789833600}'
xbbcli other-income edit --dataId 87 --dataList '{"num_1":200}'
xbbcli other-income del --dataId 87
```

### 其他支出单

```bash
xbbcli other-expense list --pageSize 10
xbbcli other-expense list --attr serialNo --value OEO.20250115003
xbbcli other-expense detail --dataId 87 --queryFlag 2

xbbcli other-expense add --demo
xbbcli other-expense add --dataList '{"serialNo":"OEO.20251122001","num_1":100,"date_1":1789833600}'
xbbcli other-expense edit --dataId 87 --dataList '{"num_1":200}'
xbbcli other-expense del --dataId 87
```

### 回执单

```bash
xbbcli receipt-order list --formId 7226810 --pageSize 10
xbbcli receipt-order list --formId 7226810 --attr serialNo --value RS.20230113003
xbbcli receipt-order detail --dataId 341 --queryFlag 2

xbbcli receipt-order add --demo
xbbcli receipt-order add --formId 7226810 --dataList '{"serialNo":"RS.20251122001","text_3":"回执单ABC"}'
xbbcli receipt-order edit --dataId 341 --dataList '{"text_3":"编辑后的回执单"}'
xbbcli receipt-order del --dataId 341
```

### 工单旧命名与工时

```bash
xbbcli workorderlist --formId 689 --attr serialNo --value WOO.20210616001
xbbcli workorderproductlist --dataId 663
xbbcli workorder-template-list
xbbcli workorder-template-detail --formId 689

xbbcli work-time-record list
xbbcli work-time-record list --conditions "[{\"attr\":\"ownerId\",\"value\":[\"02415643151585\"],\"symbol\":\"equal\"}]"
xbbcli work-time-record detail --dataId 10001

xbbcli work-time-record add --demo
xbbcli work-time-record add --dataList '{"serialNo":"WR.20251122001","text_1":"工时记录名称","num_1":2}'
xbbcli work-time-record edit --dataId 10001 --dataList '{"num_1":3}'
xbbcli work-time-record del --dataId 10001
xbbcli work-time-record add-couser --dataId 10001 --businessUserIdList '["02415643151585"]'
xbbcli work-time-record handover --dataIdList '[10001]' --businessUserId 02415643151585
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

命令加 `--raw` 后，直接返回接口原始 JSON 字符串（单行 `{ raw: "..." }`），适合管道处理或人工检查响应结构。所有 list 命令均支持该参数。
