# xbbcli

销帮帮 CRM (`xbb`) 命令行工具。业务命令全部直接调用 HTTP API，不依赖 `opencli`；只有 `auth-login` 会拉起本地浏览器完成一次交互式登录。

## 安装

```bash
npm install -g @xbongbong/xbbcli
xbbcli --help
```

开发目录中也可以直接运行 `node bin/xbbcli.js`。

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

技术实现：零依赖，用 `node:child_process` 以 `--remote-debugging-pipe` 启动浏览器（fd3 写 / fd4 读 CDP，**不开任何调试端口**），profile 固定为 `~/.xbbcli/browser-profile`（与日常浏览器隔离，登录态可复用）；CLI 读取页面 `localStorage` 的 `{corpid, userId, xbbAccessToken}`，再在页面内 `fetch` 网关 `apiToken/getApiToken` 换取个人 token。只支持 Chromium 内核浏览器（Chrome / Edge / Chromium），更多细节见 [`doc/auth-login-command-design.md`](doc/auth-login-command-design.md)。

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

## 查看当前配置与登出

```bash
xbbcli auth-status                # 回显当前激活的配置（token 默认掩码）
xbbcli auth-status --showToken    # 需要完整 token 时
xbbcli auth-logout                # 登出：删除激活的那一家配置 + 清除 XBB_* 环境变量
xbbcli auth-logout --env 0        # 只删 config.env，保留环境变量
```

- `auth-status` 以 `key` / `value` 两列回显当前生效的配置值，固定 6 行：`corpid`、`corpName`、`userName`、`userId`、`baseurl`、`token`；不再输出 `status`、`source`、`message`、`enable`、`companyCount`、`envActive`、`configFile`、`code`、`msg` 这些元信息列。

```text
key       value
corpid    dinge3fa697f86d461d2
corpName  杭州逍邦网络科技有限公司
userName  陈会兵
userId    02415643151585
baseurl   https://proapi.xbongbong.com
token     user_6***a7da
note      以上取值来自环境变量 XBB_*（config.env 中没有启用公司，回落到环境变量）；环境变量模式不支持多公司切换
```

- 来源（`config.env` 启用公司 还是 `XBB_*`）与冲突提醒只在需要时以 `note` 行追加：环境变量与 `config.env` 同时存在时提示「config.env 启用项优先」；`config.env` 里出现多个 `enable=true` 时提示用 `token-use` 修正。
- 没有任何生效配置时，6 个值一律留空并给出 `note` 提示下一步命令（即使 `XBB_BASEURL` / `XBB_USERID` 单独残留也不会当成生效值回显）。配置文件路径、公司数量、生效的环境变量名改用 `--debug` 输出到 stderr。
- `auth-status` 默认把 token 掩码为「前 6 + `***` + 后 4」（长度不足 11 时只保留前 2 位），只有 `--showToken` 才输出明文。
- `auth-logout` 只删除 `enable=true` 的那一条，**不会**把其他公司自动提升为启用：登出后本地可能一个启用公司都没有，需要 `xbbcli token-use --corpid <CORPID>` 或重新 `auth-login` / `token-set`。想保留其他公司并可切换时，用 `xbbcli token-del --corpid <CORPID>`（它会保证剩余配置仍有且仅有一个启用）。
- 删除前 `config.env` 会整份备份到 `~/.xbbcli/config.env.bak`（每次登出覆盖），`backupFile` 列给出路径；误删把 `.bak` 复制回 `config.env` 即可恢复。
- 默认**同时**清除 `XBB_*` 环境变量：Windows 用 `reg delete HKCU\Environment` 删除用户级变量（已打开的终端要重开才生效，`envStored` 为 `user`，原本就不存在时为 `none`）；macOS/Linux 清理 `~/.xbbcli/env.sh` 里的 `export XBB_*` 行（文件清空则删除，`envStored` 为 `cleared` / `removed` / `none`）。传 `--env 0` 时只删 `config.env`，此时若环境变量仍在，`message` 会提示「业务命令会回落到它，本次不算彻底登出」（`XBB_ENV_ONLY=1` 时提示为「已强制只用环境变量」）。
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

1. `config.env` 中存在 `enable=true` 的公司时，使用该配置（多公司切换行为不变）
2. `config.env` 缺失、解析失败或没有启用公司时，回落到上述环境变量
3. 设置 `XBB_ENV_ONLY=1` 可强制只使用环境变量（完全忽略 `config.env`）

`token-set` / `auth-login` 通过 `--env` 控制存储方式：`--env 0`（默认）仅写入本地文件（`config.env` 与各类缓存），`--env 1` 仅写入环境变量（不写任何本地文件）。选 `--env 1` 时会把 `corpid`/`token`/`baseurl`/`userId` 写入环境变量：

- Windows：用 `setx` 写入用户级环境变量，**只对新开的终端生效**
- macOS/Linux：写入 `~/.xbbcli/env.sh`（`export` 形式，权限 600），需要 `source ~/.xbbcli/env.sh` 才在当前 shell 生效

环境变量模式只支持一家公司：此时 `token-list` 以 `source=env` 单行显示，`token-use` / `token-del` 会返回不支持多公司的错误行，并提示改用 `config.env`。

> 注意：`token-del` 不会清理已经写入的环境变量。要连环境变量一起登出，执行 `xbbcli auth-logout`（默认就会清除 `XBB_*`）；也可以手工执行 `setx XBB_TOKEN ""`（其余 `XBB_*` 同理，Windows 需重开终端）或删除 `~/.xbbcli/env.sh` 并 `unset` 当前 shell 中已导出的变量。

## 当前支持的命令

### 配置

- `auth-login`：拉起本地浏览器完成交互式登录（账号密码 / 短信 / 扫码均可），自动读取 Web 会话、换取 API token 并复用 `token-set` 落盘；支持 `--browser`、`--timeout`、`--corpid`、`--keepOpen`、`--env`、`--debug`、`--raw`
- `auth-status`：以 `key` / `value` 两列回显当前激活配置的 `corpid`、`corpName`、`userName`、`userId`、`baseurl`、`token`（token 默认中间掩码，`--showToken` 出明文），来源与冲突提醒以 `note` 行追加，无生效配置时六个值留空并给出 `note`；`--debug` 在 stderr 输出配置文件路径、公司数量与生效的环境变量名
- `auth-logout`：删除 `config.env` 中 `enable=true` 的那一条配置，删除前整份备份为 `~/.xbbcli/config.env.bak`；不自动把其他公司提升为启用；默认同时清除 `XBB_*` 环境变量（`--env 0` 跳过，返回 `envStored` / `envFile`）；既无启用公司又无环境变量时返回 `NO_ACTIVE_CONFIG` 且不改动文件
- `auth-refresh-cache`：对当前启用公司重新拉取表单缓存、命令映射与部门/员工缓存，并回填 `corpName` / `userName`；失败时返回 `code=CACHE_REFRESH_FAILED`，`message` 注明中断步骤（`formlist` / `command-map` / `department-user` / `profile`），已完成的部分照常输出；支持 `--userId`、`--debug`
- `token-set`：保存个人 token、`corpid`、`userId`、`baseurl`，并刷新本地表单缓存、命令映射文件与部门/员工缓存；传入的 token 不以 `user_` 开头时，会先为该 `userId` 刷新并保存个人 token；`--env` 控制存储方式：`0`（默认）仅写入本地文件，`1` 仅写入 `XBB_*` 环境变量（Windows 用 `setx`，其他平台写 `~/.xbbcli/env.sh`）且不写任何本地文件；返回 `envStored` / `envFile` 两列
- `token-list`：列出本地保存的所有公司配置和唯一启用的公司（含 `corpName` 公司名称与 `userName` 操作人姓名，`source` 列标记来源 `config`/`env`）；`--showToken` 显示完整 token（默认脱敏）；环境变量模式下单行显示
- `token-use`：切换当前启用的公司（`xbbcli token-use --corpid <CORPID>`），保证仅且只有一个公司被启用
- `token-del`：删除指定公司的本地配置（`xbbcli token-del --corpid <CORPID>`），并保证剩余配置中仅且只有一个公司被启用
- `token-generate`：生成/获取个人 token，`--resetToken 0` 获取（默认）、`1` 刷新；`--checkUserId` 未传则用配置中的 `userId`

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

- 先执行一次 `token-set`（或 `auth-login`）保存有效的 `corpid`、`token`、`userId`
- 用 `xbbcli auth-status` 查看当前生效的配置来自 `config.env` 还是环境变量；`xbbcli auth-logout` 删除激活配置并默认清除 `XBB_*` 环境变量（`--env 0` 保留）
- 除 `token-set` 外，其余命令都会从 `~/.xbbcli/config.env` 读取 `corpid`
- 大部分命令会从 `~/.xbbcli/config.env` 读取 `token`
- 未配置 `config.env`（或其中没有启用公司）时，命令会回落到 `XBB_CORPID` / `XBB_TOKEN` / `XBB_BASEURL` / `XBB_USERID` / `XBB_CORPNAME` / `XBB_USERNAME` 环境变量；`XBB_ENV_ONLY=1` 可强制只用环境变量
- 所有命令会从配置中读取 `userId` 并附加到请求 header 中
- 大部分命令需要 formId 参数，可以根据业务名称或 businessType 从 `~/.xbbcli/<corpid>.formlist.json` 中获取 formId
- 需要查询部门 id/名称，或员工 userId/所属部门时，可以先查 `~/.xbbcli/<corpid>.department-user.json`（由 `token-set` 分页抓取并缓存全部部门与员工）
- 当前公司名称存在 `~/.xbbcli/config.env` 的 `corpName` 字段（取部门 `id` 为 `1` 的部门名称），操作人姓名存在 `userName` 字段（按 `userId` 匹配员工列表）
- 未传入的可选参数不会进入请求体
- `--attr` 和 `--value` 只有同时提供时才会拼入查询条件
- `--limit` 是在响应映射之后截断结果
- 失败时返回的是带 `code` / `msg` 的结果行，不抛异常
- 加 `--debug` 可以输出 `requestBody` 和 `responseBody`
- 加 `--raw` 可以输出接口返回的原始 JSON 字符串（所有 list 命令均支持）
- 在填充参数时不清楚参数含义/下拉框可选项值，调用 `form-get` 命令获取 form 解释
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

xbbcli customer-add --formId 19274 --dataList '{"text_1":"apiTest.001"}'
xbbcli customer-edit --formId 19274 --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'
xbbcli customer-detail --dataId 310992
xbbcli customer-add-couser --dataId 310995 --businessUserIdList '["xbbTest002"]'
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
xbbcli product-list --attr serialNo --value CP.API.0001
xbbcli product-detail --dataId 10001
xbbcli product-category-list
xbbcli product-category-update --dataId 306 --name 分类A
xbbcli product-category-del --dataId 306

xbbcli payment-list --attr serialNo --value PMO.API.0001
xbbcli payment-sheet-list --attr serialNo --value RMO.API.0001
xbbcli payment-sheet-list --subBusinessType 702
xbbcli payment-sheet-edit-write-off --dataId 1194 --dataList '{"text_7":"编辑备注"}'
xbbcli payment-sheet-add-red --dataList '{"serialNo":"RMO.API.0001"}'
xbbcli payment-sheet-edit-red --dataId 1198 --dataList '{"text_7":"编辑红冲备注"}'
xbbcli payment-sheet-add-bad-debt --dataList '{"serialNo":"RMO.API.0002"}'
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

### 工单旧命名与工时

```bash
xbbcli workorderlist --formId 689 --attr serialNo --value WOO.20210616001
xbbcli workorderproductlist --dataId 663
xbbcli work-order-template-list
xbbcli work-order-template-detail --formId 689

xbbcli worktimerecordlist
xbbcli worktimerecordlist --conditions "[{\"attr\":\"ownerId\",\"value\":[\"02415643151585\"],\"symbol\":\"equal\"}]"
xbbcli worktimerecorddetail --dataId 10001
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
