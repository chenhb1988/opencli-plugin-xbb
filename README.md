# opencli-plugin-xbb

`opencli` 的 `xbb` 插件，当前提供基于销帮帮开放平台 API 的纯 HTTP 命令。


## 安装

```bash
# 先安装opencli
npm install -g @jackwener/opencli

# 再安装本插件
opencli plugin install github:chenhb1988/opencli-plugin-xbb
```

## 当前支持的命令

- `set-token.js`：把 API token 保存到本地配置文件
- `userlist.js`：用户列表接口
- `customerlist.js`：客户列表接口
- `opportunitylist.js`：销售机会列表接口
- `cluelist.js`：线索列表接口
- `communicatelist.js`：跟进记录列表接口
- `customeradd.js`：新建客户接口
- `customeredit.js`：编辑客户接口
- `customerdetail.js`：客户详情接口
- `customeraddcouser.js`：客户添加协同人接口
## 本地配置

先保存 token：

```bash
opencli xbb set-token --token <YOUR_TOKEN>
```

token 会写入：

```text
~\.opencli\xbb\config.json
```

后续 `userlist` 和 `customerlist` 会默认从该文件读取 token，也可以继续通过 `--token` 显式覆盖。

## 命令示例

```bash
# 保存 token
opencli xbb set-token --token your_token

# 用户列表
opencli xbb userlist --corpid your_corpid
opencli xbb userlist --corpid your_corpid --debug
opencli xbb userlist --corpid your_corpid --nameLike 张三

# 客户列表（formId 必填）
opencli xbb customerlist --corpid your_corpid --formId 12345
opencli xbb customerlist --corpid your_corpid --formId 12345 --debug
opencli xbb customerlist --corpid your_corpid --formId 12345 --attr text_1 --value apiTest.001

# 销售机会列表（formId 必填）
opencli xbb opportunitylist --corpid your_corpid --formId 932

# 线索列表（formId 必填）
opencli xbb cluelist --corpid your_corpid --formId 19320 --del 0
opencli xbb cluelist --corpid your_corpid --formId 19320 --attr text_1 --value apiTest.0001

# 跟进记录列表
opencli xbb communicatelist --corpid your_corpid --attr text_1 --value 310993

# 新建客户
opencli xbb customeradd --corpid your_corpid --formId 19274 --dataList '{"text_1":"apiTest.001"}'

# 编辑客户
opencli xbb customeredit --corpid your_corpid --formId 19274 --dataId 310992 --dataList '{"text_1":"apiTest.001-编辑"}'

# 客户详情
opencli xbb customerdetail --corpid your_corpid --dataId 310992

# 客户添加协同人
opencli xbb customeraddcouser --corpid your_corpid --dataId 310995 --businessUserIdList '["xbbTest002"]'
```

## 实现方式

- 当前命令均为 `browser: false` 的纯 HTTP 实现。
- 接口签名规则为：`SHA256(JSON压缩后的请求体 + token)`，并将 `sign` 放入 HTTP Header。
- 调试时可传 `--debug` 输出 `requestBody` 和 `responseBody`。

## 已知要求

- `userlist` 需要有效 `corpid`，目前已接入钉钉版，多平台还在接入中。
- `customerlist` 除 `corpid` 外还需要有效的 `formId`。
- `customerlist` 中的筛选条件通过 `--attr`、`--value`、`--symbol` 生成 `conditions` 数组；如果没有传值，则不会发送该筛选条件。
