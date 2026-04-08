# opencli-plugin-xbb

`opencli` 的 销帮帮CRM(xbb) 插件，当前提供基于销帮帮开放平台 API 的纯 HTTP 命令。


## 安装

```bash
# 先安装opencli
npm install -g @jackwener/opencli

# 再安装本插件
opencli plugin install github:chenhb1988/opencli-plugin-xbb
```

## 当前支持的命令

- `set-token`：把 API token 保存到本地配置文件
- `userlist`：用户列表接口
- `customerlist`：客户列表接口
- `opportunitylist`：销售机会列表接口
- `cluelist`：线索列表接口
- `communicatelist`：跟进记录列表接口
- `customeradd`：新建客户接口
- `customeredit`：编辑客户接口
- `customerdetail`：客户详情接口
- `customeraddcouser`：客户添加协同人接口
- `formlist`：表单模板列表接口
- `formget`：表单模板字段解释接口
- `departmentlist`：部门列表接口
- `contactlist`：联系人列表接口
- `contractlist`：合同订单列表接口
- `refundlist`：退货退款单列表接口
- `productlist`：产品列表接口
- `productcategorylist`：产品分类列表接口
- `paymentlist`：应收款列表接口
- `paymentsheetlist`：回款单列表接口
- `workorderlist`：工单列表接口
- `workorderproductlist`：工单配件接口

## 首次使用需设置 token

先保存 token：

```bash
opencli xbb set-token --token <YOUR_TOKEN> --corpid <YOUR_CORPID>
```

token和corpid 会写入：
```text
~\.opencli\xbb\config.json
```
后续命令会默认从该文件读取 token。

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
opencli xbb cluelist --corpid your_corpid --formId 19320 

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

# 表单模板列表
opencli xbb formlist --corpid your_corpid --saasMark 1 --businessType 100
opencli xbb formlist --corpid your_corpid --saasMark 2 --name 表单名称

# 表单模板字段解释
opencli xbb formget --corpid your_corpid --formId 19274
opencli xbb formget --corpid your_corpid --formId 19277 --subBusinessType 100

# 部门列表
opencli xbb departmentlist --corpid your_corpid
opencli xbb departmentlist --corpid your_corpid --nameLike 销售
opencli xbb departmentlist --corpid your_corpid --departmentIdIn '["1","6"]'

# 联系人列表
opencli xbb contactlist --corpid your_corpid --attr text_1 --value apiTest.001

# 合同订单列表（formId 必填）
opencli xbb contractlist --corpid your_corpid --formId 19281 --attr text_1 --value apiTest.001

# 退货退款单列表
opencli xbb refundlist --corpid your_corpid --attr serialNo --value RFO.API.0001

# 产品列表
opencli xbb productlist --corpid your_corpid --attr serialNo --value CP.API.0001

# 产品分类列表
opencli xbb productcategorylist --corpid your_corpid

# 应收款列表
opencli xbb paymentlist --corpid your_corpid --attr serialNo --value PMO.API.0001

# 回款单列表
opencli xbb paymentsheetlist --corpid your_corpid --attr serialNo --value RMO.API.0001
opencli xbb paymentsheetlist --corpid your_corpid --subBusinessType 702

# 工单列表（formId 必填）
opencli xbb workorderlist --corpid your_corpid --formId 689 --attr serialNo --value WOO.20210616001

# 工单配件列表
opencli xbb workorderproductlist --corpid your_corpid --dataId 663
```

## 实现方式

- 当前命令均为 `browser: false` 的纯 HTTP 实现。
- 接口签名规则为：`SHA256(JSON压缩后的请求体 + token)`，并将 `sign` 放入 HTTP Header。
- 调试时可传 `--debug` 输出 `requestBody` 和 `responseBody`。

## 其他说明

- 所有请求需要传递有效 `corpid`，目前已接入钉钉，企微，飞书，和独立版，根据corpid自动路由。
- 部分命令需要`corpid` 外还需要有效的 `formId`，可通过formlist先获取对应业务的formId。
 