# 销帮帮 CRM 接口清单

共 405 个接口，其中已实现 272 个、未实现 133 个。是否已实现以仓库命令中硬编码的 `/pro/v2/api/...` 路径为准；business_type 为 -1 表示非表单/通用接口。备注列标记与命令代码声明不一致的 businessType（共 18 处）。

| 是否已实现 | id | 名称 | business_type | url | 备注 |
| --- | --- | --- | --- | --- | --- |
| 是 | 318 | 新建线索接口 | 8000 | `/pro/v2/api/clue/add` |
| 是 | 323 | 线索添加协同人接口 | 8000 | `/pro/v2/api/clue/addCoUser` |
| 是 | 328 | 线索退回公海接口 | 8000 | `/pro/v2/api/clue/back` |
| 是 | 322 | 删除线索接口 | 8000 | `/pro/v2/api/clue/del` |
| 是 | 324 | 线索删除协同人接口 | 8000 | `/pro/v2/api/clue/deleteCoUser` |
| 是 | 327 | 线索删除负责人接口 | 8000 | `/pro/v2/api/clue/deleteMainUser` |
| 是 | 321 | 线索详情接口 | 8000 | `/pro/v2/api/clue/detail` |
| 是 | 326 | 线索分配接口 | 8000 | `/pro/v2/api/clue/distribution` |
| 是 | 319 | 编辑线索接口 | 8000 | `/pro/v2/api/clue/edit` |
| 是 | 325 | 线索移交接口 | 8000 | `/pro/v2/api/clue/handover` |
| 是 | 320 | 线索列表接口 | 8000 | `/pro/v2/api/clue/list` |
| 是 | 597 | 彻底删除线索接口 | 8000 | `/pro/v2/api/clue/thorough/delete` |
| 是 | 224 | 新建跟进记录接口 | 501 | `/pro/v2/api/communicate/add` |
| 是 | 228 | 删除跟进记录接口 | 501 | `/pro/v2/api/communicate/del` |
| 是 | 227 | 跟进记录详情接口 | 501 | `/pro/v2/api/communicate/detail` |
| 是 | 225 | 编辑跟进记录接口 | 501 | `/pro/v2/api/communicate/edit` |
| 是 | 226 | 跟进记录列表接口 | 501 | `/pro/v2/api/communicate/list` |
| 是 | 581 | 访客计划新建接口 | 601 | `/pro/v2/api/communicatePlan/add` |
| 是 | 421 | 访客计划取消接口 | -1 | `/pro/v2/api/communicatePlan/cancel` | 不一致：文档 -1，命令描述 601 |
| 是 | 419 | 访客计划删除接口 | -1 | `/pro/v2/api/communicatePlan/del` | 不一致：文档 -1，命令描述 601 |
| 是 | 557 | 访客计划详情接口 | 601 | `/pro/v2/api/communicatePlan/detail` |
| 是 | 556 | 访客计划列表接口 | 601 | `/pro/v2/api/communicatePlan/list` |
| 是 | 420 | 访客计划延期接口 | -1 | `/pro/v2/api/communicatePlan/singleOperate` | 不一致：文档 -1，命令描述 601 |
| 是 | 200 | 新建联系人接口 | 401 | `/pro/v2/api/contact/add` |
| 是 | 382 | 联系人添加协同人接口 | 401 | `/pro/v2/api/contact/addCoUser` |
| 是 | 380 | 联系人添加负责人接口 | 401 | `/pro/v2/api/contact/addMainUser` |
| 是 | 204 | 删除联系人接口 | 401 | `/pro/v2/api/contact/del` |
| 是 | 383 | 联系人删除协同人接口 | 401 | `/pro/v2/api/contact/deleteCoUser` |
| 是 | 381 | 联系人删除负责人接口 | 401 | `/pro/v2/api/contact/deleteMainUser` |
| 是 | 203 | 联系人详情接口 | 401 | `/pro/v2/api/contact/detail` |
| 是 | 201 | 编辑联系人接口 | 401 | `/pro/v2/api/contact/edit` |
| 是 | 202 | 联系人列表接口 | 401 | `/pro/v2/api/contact/list` |
| 是 | 215 | 新建合同订单接口 | 201 | `/pro/v2/api/contract/add` |
| 是 | 222 | 合同订单添加协同人接口 | 201 | `/pro/v2/api/contract/addCoUser` |
| 是 | 220 | 合同订单添加负责人接口 | 201 | `/pro/v2/api/contract/addMainUser` |
| 是 | 219 | 删除合同订单接口 | 201 | `/pro/v2/api/contract/del` |
| 是 | 223 | 合同订单删除协同人接口 | 201 | `/pro/v2/api/contract/deleteCoUser` |
| 是 | 221 | 合同订单删除负责人接口 | 201 | `/pro/v2/api/contract/deleteMainUser` |
| 是 | 218 | 合同订单详情接口 | 201 | `/pro/v2/api/contract/detail` |
| 是 | 216 | 编辑合同订单接口 | 201 | `/pro/v2/api/contract/edit` |
| 是 | 217 | 合同订单列表接口 | 201 | `/pro/v2/api/contract/list` |
| 是 | 290 | 新建销售出库单接口 | 1504 | `/pro/v2/api/contractOutstock/add` |
| 是 | 294 | 删除销售出库单接口 | 1504 | `/pro/v2/api/contractOutstock/del` |
| 是 | 293 | 销售出库单详情接口 | 1504 | `/pro/v2/api/contractOutstock/detail` |
| 是 | 291 | 编辑销售出库单接口 | 1504 | `/pro/v2/api/contractOutstock/edit` |
| 是 | 292 | 销售出库单列表接口 | 1504 | `/pro/v2/api/contractOutstock/list` |
| 是 | 189 | 新建客户接口 | 100 | `/pro/v2/api/customer/add` |
| 是 | 194 | 客户添加协同人接口 | 100 | `/pro/v2/api/customer/addCoUser` |
| 是 | 199 | 客户退回公海接口 | 100 | `/pro/v2/api/customer/back` |
| 是 | 193 | 删除客户接口 | 100 | `/pro/v2/api/customer/del` |
| 是 | 195 | 客户删除协同人接口 | 100 | `/pro/v2/api/customer/deleteCoUser` |
| 是 | 198 | 客户删除负责人接口 | 100 | `/pro/v2/api/customer/deleteMainUser` |
| 是 | 192 | 客户详情接口 | 100 | `/pro/v2/api/customer/detail` |
| 是 | 197 | 客户分配接口 | 100 | `/pro/v2/api/customer/distribution` |
| 是 | 190 | 编辑客户接口 | 100 | `/pro/v2/api/customer/edit` |
| 是 | 196 | 客户移交接口 | 100 | `/pro/v2/api/customer/handover` |
| 是 | 571 | 客户开票地址接口 | 100 | `/pro/v2/api/customer/invoice/address` |
| 是 | 578 | 添加客户开票地址接口 | 100 | `/pro/v2/api/customer/invoice/addressAdd` |
| 是 | 579 | 编辑客户开票地址接口 | 100 | `/pro/v2/api/customer/invoice/addressEdit` |
| 是 | 570 | 客户开票信息接口 | 100 | `/pro/v2/api/customer/invoice/info` |
| 是 | 576 | 添加客户开票信息接口 | 100 | `/pro/v2/api/customer/invoice/infoAdd` |
| 是 | 577 | 编辑客户开票信息接口 | 100 | `/pro/v2/api/customer/invoice/infoEdit` |
| 是 | 191 | 客户列表接口 | 100 | `/pro/v2/api/customer/list` |
| 是 | 361 | 新建部门接口 | -1 | `/pro/v2/api/department/add` |
| 是 | 363 | 删除部门接口 | -1 | `/pro/v2/api/department/del` |
| 是 | 362 | 编辑部门接口 | -1 | `/pro/v2/api/department/edit` |
| 是 | 186 | 部门列表接口 | -1 | `/pro/v2/api/department/list` |
| 是 | 188 | 表单模板字段解释接口 | -1 | `/pro/v2/api/form/get` |
| 是 | 187 | 表单模板列表接口 | -1 | `/pro/v2/api/form/list` |
| 是 | 601 | 批量AI呼叫接口 | -1 | `/pro/v2/api/hkh/call/addTask` |
| 是 | 602 | 获取AI话术列表接口 | -1 | `/pro/v2/api/hkh/call/aiWords` |
|  | 305 | 新建盘点单接口 | 1701 | `/pro/v2/api/inventory/add` |
|  | 309 | 盘点单删除接口 | 1701 | `/pro/v2/api/inventory/del` |
|  | 308 | 盘点单详情接口 | 1701 | `/pro/v2/api/inventory/detail` |
|  | 306 | 编辑盘点单接口 | 1701 | `/pro/v2/api/inventory/edit` |
|  | 307 | 盘点单列表接口 | 1701 | `/pro/v2/api/inventory/list` |
| 是 | 313 | 新建销项发票接口 | 901 | `/pro/v2/api/invoice/add` |
| 是 | 372 | 销项发票作废接口 | 901 | `/pro/v2/api/invoice/cancel` |
| 是 | 317 | 删除销项发票接口 | 901 | `/pro/v2/api/invoice/del` |
| 是 | 316 | 销项发票详情接口 | 901 | `/pro/v2/api/invoice/detail` |
| 是 | 314 | 编辑销项发票接口 | 901 | `/pro/v2/api/invoice/edit` |
| 是 | 574 | 销项发票金额明细接口 | 901 | `/pro/v2/api/invoice/getAmountDetail` |
| 是 | 315 | 销项发票列表接口 | 901 | `/pro/v2/api/invoice/list` |
| 是 | 373 | 销项发票红冲接口 | 901 | `/pro/v2/api/invoice/red` |
| 是 | 343 | 新建标签接口 | -1 | `/pro/v2/api/label/add` |
| 是 | 342 | 表单标签列表接口 | -1 | `/pro/v2/api/label/allList` |
| 是 | 335 | 打标签接口 | -1 | `/pro/v2/api/label/batch/add` |
| 是 | 336 | 移除标签接口 | -1 | `/pro/v2/api/label/batch/remove` |
| 是 | 346 | 删除标签接口 | -1 | `/pro/v2/api/label/del` |
| 是 | 348 | 彻底删除标签接口 | -1 | `/pro/v2/api/label/del/completely` |
| 是 | 344 | 编辑标签接口 | -1 | `/pro/v2/api/label/edit` |
| 是 | 337 | 新建标签分组接口 | -1 | `/pro/v2/api/label/group/add` |
| 是 | 338 | 删除标签分组接口 | -1 | `/pro/v2/api/label/group/del` |
| 是 | 340 | 标签分组列表接口 | -1 | `/pro/v2/api/label/group/list` |
| 是 | 339 | 编辑标签分组接口 | -1 | `/pro/v2/api/label/group/update` |
| 是 | 341 | 标签列表接口 | -1 | `/pro/v2/api/label/list` |
| 是 | 347 | 标签还原接口 | -1 | `/pro/v2/api/label/reduction` |
| 是 | 345 | 标签判重接口 | -1 | `/pro/v2/api/label/repeat` |
| 是 | 329 | 新建市场活动接口 | 8100 | `/pro/v2/api/marketActivity/add` |
| 是 | 334 | 删除市场活动接口 | 8100 | `/pro/v2/api/marketActivity/del` |
| 是 | 332 | 市场活动详情接口 | 8100 | `/pro/v2/api/marketActivity/detail` |
| 是 | 330 | 编辑市场活动接口 | 8100 | `/pro/v2/api/marketActivity/edit` |
| 是 | 333 | 市场活动移交接口 | 8100 | `/pro/v2/api/marketActivity/handover` |
| 是 | 331 | 市场活动列表接口 | 8100 | `/pro/v2/api/marketActivity/list` |
| 是 | 206 | 新建销售机会接口 | 301 | `/pro/v2/api/opportunity/add` |
| 是 | 213 | 销售机会添加协同人接口 | 301 | `/pro/v2/api/opportunity/addCoUser` |
| 是 | 211 | 销售机会添加负责人接口 | 301 | `/pro/v2/api/opportunity/addMainUser` |
| 是 | 210 | 删除销售机会接口 | 301 | `/pro/v2/api/opportunity/del` |
| 是 | 214 | 销售机会删除协同人接口 | 301 | `/pro/v2/api/opportunity/deleteCoUser` |
| 是 | 212 | 销售机会删除负责人接口 | 301 | `/pro/v2/api/opportunity/deleteMainUser` |
| 是 | 209 | 销售机会详情接口 | 301 | `/pro/v2/api/opportunity/detail` |
| 是 | 207 | 编辑销售机会接口 | 301 | `/pro/v2/api/opportunity/edit` |
| 是 | 208 | 销售机会列表接口 | 301 | `/pro/v2/api/opportunity/list` |
|  | 312 | 批次保质期查询接口 | 2401 | `/pro/v2/api/other/batchStock` |
|  | 310 | 成本计算接口 | 2401 | `/pro/v2/api/other/calCost` |
|  | 311 | 仓库库存查询接口 | 2401 | `/pro/v2/api/other/warehouseStock` |
| 是 | 565 | 其他支出单新建 | 5750 | `/pro/v2/api/otherExpense/add` |
| 是 | 567 | 其他支出单删除 | 5750 | `/pro/v2/api/otherExpense/del` |
| 是 | 568 | 其他支出单详情 | 5750 | `/pro/v2/api/otherExpense/detail` |
| 是 | 566 | 其他支出单编辑 | 5750 | `/pro/v2/api/otherExpense/edit` |
| 是 | 569 | 其他支出单列表 | 5750 | `/pro/v2/api/otherExpense/list` |
| 是 | 603 | 其他收入单新建 | 5710 | `/pro/v2/api/otherIncome/add` |
| 是 | 605 | 其他收入单删除 | 5710 | `/pro/v2/api/otherIncome/del` |
| 是 | 606 | 其他收入单详情 | 5710 | `/pro/v2/api/otherIncome/detail` |
| 是 | 604 | 其他收入单编辑 | 5710 | `/pro/v2/api/otherIncome/edit` |
| 是 | 607 | 其他收入单列表 | 5710 | `/pro/v2/api/otherIncome/list` |
|  | 285 | 新建其他入库单接口 | 1406 | `/pro/v2/api/otherInstock/add` |
|  | 289 | 删除其他入库单接口 | 1406 | `/pro/v2/api/otherInstock/del` |
|  | 288 | 其他入库单详情接口 | 1406 | `/pro/v2/api/otherInstock/detail` |
|  | 286 | 编辑其他入库单接口 | 1406 | `/pro/v2/api/otherInstock/edit` |
|  | 287 | 其他入库单列表接口 | 1406 | `/pro/v2/api/otherInstock/list` |
|  | 295 | 新建其他出库单接口 | 1506 | `/pro/v2/api/otherOutstock/add` |
|  | 299 | 删除其他出库单接口 | 1506 | `/pro/v2/api/otherOutstock/del` |
|  | 298 | 其他出库单详情接口 | 1506 | `/pro/v2/api/otherOutstock/detail` |
|  | 296 | 编辑其他出库单接口 | 1506 | `/pro/v2/api/otherOutstock/edit` |
|  | 297 | 其他出库单列表接口 | 1506 | `/pro/v2/api/otherOutstock/list` |
| 是 | 262 | 新建自定义表单数据接口 | 0 | `/pro/v2/api/paas/add` |
| 是 | 369 | 自定义表单添加协同人接口 | 0 | `/pro/v2/api/paas/addCoUser` |
| 是 | 367 | 自定义表单添加负责人接口 | 0 | `/pro/v2/api/paas/addMainUser` |
| 是 | 266 | 删除自定义表单数据接口 | 0 | `/pro/v2/api/paas/del` |
| 是 | 370 | 自定义表单删除协同人接口 | 0 | `/pro/v2/api/paas/deleteCoUser` |
| 是 | 368 | 自定义表单删除负责人接口 | 0 | `/pro/v2/api/paas/deleteMainUser` |
| 是 | 265 | 自定义表单数据详情接口 | 0 | `/pro/v2/api/paas/detail` |
| 是 | 263 | 编辑自定义表单数据接口 | 0 | `/pro/v2/api/paas/edit` |
| 是 | 264 | 自定义表单数据列表接口 | 0 | `/pro/v2/api/paas/list` |
| 是 | 243 | 新建应收款接口 | 701 | `/pro/v2/api/payment/add` |
| 是 | 394 | 应收款添加协同人接口 | 701 | `/pro/v2/api/payment/addCoUser` |
| 是 | 392 | 应收款添加负责人接口 | 701 | `/pro/v2/api/payment/addMainUser` |
| 是 | 247 | 删除应收款接口 | 701 | `/pro/v2/api/payment/del` |
| 是 | 395 | 应收款删除协同人接口 | 701 | `/pro/v2/api/payment/deleteCoUser` |
| 是 | 393 | 应收款删除负责人接口 | 701 | `/pro/v2/api/payment/deleteMainUser` |
| 是 | 246 | 应收款详情接口 | 701 | `/pro/v2/api/payment/detail` |
| 是 | 244 | 编辑应收款接口 | 701 | `/pro/v2/api/payment/edit` |
| 是 | 245 | 应收款列表接口 | 701 | `/pro/v2/api/payment/list` |
| 是 | 252 | 新建坏账回款单接口 | 702 | `/pro/v2/api/paymentSheet/addBadDebt` |
| 是 | 390 | 回款单添加协同人接口 | 702 | `/pro/v2/api/paymentSheet/addCoUser` |
| 是 | 388 | 回款单添加负责人接口 | 702 | `/pro/v2/api/paymentSheet/addMainUser` |
| 是 | 598 | 新建预收款回款单接口 | 702 | `/pro/v2/api/paymentSheet/addPre` |
| 是 | 250 | 新建红冲回款单接口 | 702 | `/pro/v2/api/paymentSheet/addRed` |
| 是 | 248 | 新建核销回款单接口 | 702 | `/pro/v2/api/paymentSheet/addWriteOff` |
| 是 | 256 | 删除回款单接口 | 702 | `/pro/v2/api/paymentSheet/del` |
| 是 | 391 | 回款单删除协同人接口 | 702 | `/pro/v2/api/paymentSheet/deleteCoUser` |
| 是 | 389 | 回款单删除负责人接口 | 702 | `/pro/v2/api/paymentSheet/deleteMainUser` |
| 是 | 255 | 回款单详情接口 | 702 | `/pro/v2/api/paymentSheet/detail` |
| 是 | 253 | 编辑坏账回款单接口 | 702 | `/pro/v2/api/paymentSheet/editBadDebt` |
| 是 | 251 | 编辑红冲回款单接口 | 702 | `/pro/v2/api/paymentSheet/editRed` |
| 是 | 249 | 编辑核销回款单接口 | 702 | `/pro/v2/api/paymentSheet/editWriteOff` |
| 是 | 572 | 回款单金额明细接口 | 702 | `/pro/v2/api/paymentSheet/getAmountDetail` |
| 是 | 254 | 回款单列表接口 | 702 | `/pro/v2/api/paymentSheet/list` |
| 是 | 563 | 新增付款计划 | 801 | `/pro/v2/api/payPlan/add` |
| 是 | 402 | 付款计划添加协同人接口 | 801 | `/pro/v2/api/payPlan/addCoUser` |
| 是 | 400 | 付款计划添加负责人接口 | 801 | `/pro/v2/api/payPlan/addMainUser` |
| 是 | 403 | 付款计划删除协同人接口 | 801 | `/pro/v2/api/payPlan/deleteCoUser` |
| 是 | 401 | 付款计划删除负责人接口 | 801 | `/pro/v2/api/payPlan/deleteMainUser` |
| 是 | 609 | 付款计划详情接口 | 801 | `/pro/v2/api/payPlan/detail` |
| 是 | 608 | 付款计划列表接口 | 801 | `/pro/v2/api/payPlan/list` |
| 是 | 524 | 新建核销付款单坏账接口 | 801 | `/pro/v2/api/paySheet/addBad` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 398 | 付款单添加协同人接口 | 801 | `/pro/v2/api/paySheet/addCoUser` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 396 | 付款单添加负责人接口 | 801 | `/pro/v2/api/paySheet/addMainUser` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 522 | 新建核销付款单红冲接口 | 801 | `/pro/v2/api/paySheet/addRed` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 517 | 新建付款单接口 | 801 | `/pro/v2/api/paySheet/addWriteOff` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 521 | 删除付款单接口 | 801 | `/pro/v2/api/paySheet/del` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 399 | 付款单删除协同人接口 | 801 | `/pro/v2/api/paySheet/deleteCoUser` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 397 | 付款单删除负责人接口 | 801 | `/pro/v2/api/paySheet/deleteMainUser` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 520 | 付款单详情接口 | 801 | `/pro/v2/api/paySheet/detail` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 525 | 编辑核销付款单坏账接口 | 801 | `/pro/v2/api/paySheet/editBad` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 523 | 编辑核销付款单红冲接口 | 801 | `/pro/v2/api/paySheet/editRed` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 518 | 编辑付款单接口 | 801 | `/pro/v2/api/paySheet/editWriteOff` | 不一致：文档 801，命令 802（801 为 pay-plan） |
| 是 | 573 | 付款单金额明细接口 | 802 | `/pro/v2/api/paySheet/getAmountDetail` |
| 是 | 519 | 付款单列表接口 | 801 | `/pro/v2/api/paySheet/list` | 不一致：文档 801，命令 802（801 为 pay-plan） |
|  | 496 | 新建员工个人仓接口 | 21600 | `/pro/v2/api/personalWarehouse/add` |
|  | 497 | 删除员工个人仓接口 | 21600 | `/pro/v2/api/personalWarehouse/del` |
|  | 498 | 员工个人仓详情接口 | 21600 | `/pro/v2/api/personalWarehouse/detail` |
|  | 495 | 编辑员工个人仓接口 | 21600 | `/pro/v2/api/personalWarehouse/edit` |
|  | 499 | 员工个人仓列表接口 | 21600 | `/pro/v2/api/personalWarehouse/list` |
| 是 | 234 | 新建产品接口 | 2401 | `/pro/v2/api/product/add` |
| 是 | 239 | 添加产品分类接口 | 2401 | `/pro/v2/api/product/categoryAdd` |
| 是 | 241 | 删除产品分类接口 | 2401 | `/pro/v2/api/product/categoryDel` |
| 是 | 242 | 产品分类列表接口 | 2401 | `/pro/v2/api/product/categoryList` |
| 是 | 240 | 编辑产品分类接口 | 2401 | `/pro/v2/api/product/categoryUpdate` |
| 是 | 238 | 删除产品接口 | 2401 | `/pro/v2/api/product/del` |
| 是 | 237 | 产品详情接口 | 2401 | `/pro/v2/api/product/detail` |
| 是 | 235 | 编辑产品接口 | 2401 | `/pro/v2/api/product/edit` |
| 是 | 236 | 产品列表接口 | 2401 | `/pro/v2/api/product/list` |
| 是 | 371 | 产品上下架接口 | 2401 | `/pro/v2/api/product/online` |
| 是 | 618 | 生产入库单详情接口 | -1 | `/pro/v2/api/productionInstock/detail` |
| 是 | 617 | 生产入库单列表接口 | -1 | `/pro/v2/api/productionInstock/list` |
| 是 | 623 | 生产领料单详情接口 | -1 | `/pro/v2/api/productionMaterielOutstock/detail` |
| 是 | 622 | 生产领料单列表接口 | -1 | `/pro/v2/api/productionMaterielOutstock/list` |
| 是 | 613 | 生产单详情接口 | -1 | `/pro/v2/api/productionOrder/detail` |
| 是 | 612 | 生产单列表接口 | -1 | `/pro/v2/api/productionOrder/list` |
|  | 467 | 项目新建 | 20800 | `/pro/v2/api/project/add` |
|  | 477 | 添加项目协同人 | 20800 | `/pro/v2/api/project/addCoUser` |
|  | 475 | 添加项目负责人 | 20800 | `/pro/v2/api/project/addMainUser` |
|  | 471 | 项目删除 | 20800 | `/pro/v2/api/project/del` |
|  | 478 | 删除项目协同人 | 20800 | `/pro/v2/api/project/deleteCoUser` |
|  | 476 | 删除项目负责人 | 20800 | `/pro/v2/api/project/deleteMainUser` |
|  | 468 | 项目详情 | 20800 | `/pro/v2/api/project/detail` |
|  | 470 | 项目编辑 | 20800 | `/pro/v2/api/project/edit` |
|  | 479 | 移交项目负责人 | 20800 | `/pro/v2/api/project/handover` |
|  | 469 | 项目列表 | 20800 | `/pro/v2/api/project/list` |
|  | 456 | 新建风险接口 | 21000 | `/pro/v2/api/projectRisk/add` |
|  | 487 | 添加项目风险协同人 | 21000 | `/pro/v2/api/projectRisk/addCoUser` |
|  | 485 | 添加项目风险负责人 | 21000 | `/pro/v2/api/projectRisk/addMainUser` |
|  | 462 | 删除风险接口 | 21000 | `/pro/v2/api/projectRisk/del` |
|  | 488 | 删除项目风险协同人 | 21000 | `/pro/v2/api/projectRisk/deleteCoUser` |
|  | 486 | 删除项目风险负责人 | 21000 | `/pro/v2/api/projectRisk/deleteMainUser` |
|  | 466 | 风险详情接口 | 21000 | `/pro/v2/api/projectRisk/detail` |
|  | 460 | 编辑风险接口 | 21000 | `/pro/v2/api/projectRisk/edit` |
|  | 489 | 移交项目风险负责人 | 21000 | `/pro/v2/api/projectRisk/handover` |
|  | 464 | 风险列表接口 | 21000 | `/pro/v2/api/projectRisk/list` |
|  | 454 | 新建任务接口 | 20900 | `/pro/v2/api/projectTask/add` |
|  | 482 | 添加项目任务协同人 | 20900 | `/pro/v2/api/projectTask/addCoUser` |
|  | 480 | 添加项目任务负责人 | 20900 | `/pro/v2/api/projectTask/addMainUser` |
|  | 461 | 删除任务接口 | 20900 | `/pro/v2/api/projectTask/del` |
|  | 483 | 删除项目任务协同人 | 20900 | `/pro/v2/api/projectTask/deleteCoUser` |
|  | 481 | 删除项目任务负责人 | 20900 | `/pro/v2/api/projectTask/deleteMainUser` |
|  | 465 | 任务详情接口 | 20900 | `/pro/v2/api/projectTask/detail` |
|  | 459 | 编辑任务接口 | 20900 | `/pro/v2/api/projectTask/edit` |
|  | 484 | 移交项目任务负责人 | 20900 | `/pro/v2/api/projectTask/handover` |
|  | 463 | 任务列表接口 | 20900 | `/pro/v2/api/projectTask/list` |
|  | 275 | 新建采购合同接口 | 1101 | `/pro/v2/api/purchase/add` |
|  | 279 | 删除采购合同接口 | 1101 | `/pro/v2/api/purchase/del` |
|  | 278 | 采购合同详情接口 | 1101 | `/pro/v2/api/purchase/detail` |
|  | 276 | 编辑采购合同接口 | 1101 | `/pro/v2/api/purchase/edit` |
|  | 510 | 进项发票新建接口 | 903 | `/pro/v2/api/purchase/invoice/add` |
|  | 516 | 进项发票作废接口 | 903 | `/pro/v2/api/purchase/invoice/cancel` |
|  | 514 | 进项发票删除接口 | 903 | `/pro/v2/api/purchase/invoice/del` |
|  | 513 | 进项发票详情接口 | 903 | `/pro/v2/api/purchase/invoice/detail` |
|  | 511 | 进项发票编辑接口 | 903 | `/pro/v2/api/purchase/invoice/edit` |
|  | 575 | 进项发票金额明细接口 | 903 | `/pro/v2/api/purchase/invoice/getAmountDetail` |
|  | 512 | 进项发票列表接口 | 903 | `/pro/v2/api/purchase/invoice/list` |
|  | 515 | 进项发票红冲接口 | 903 | `/pro/v2/api/purchase/invoice/red` |
|  | 277 | 采购合同列表接口 | 1101 | `/pro/v2/api/purchase/list` |
|  | 280 | 新建采购入库单接口 | 1404 | `/pro/v2/api/purchaseInstock/add` |
|  | 284 | 删除采购入库单接口 | 1404 | `/pro/v2/api/purchaseInstock/del` |
|  | 283 | 采购入库单详情接口 | 1404 | `/pro/v2/api/purchaseInstock/detail` |
|  | 281 | 编辑采购入库单接口 | 1404 | `/pro/v2/api/purchaseInstock/edit` |
|  | 282 | 采购入库单列表接口 | 1404 | `/pro/v2/api/purchaseInstock/list` |
| 是 | 350 | 新建报价单接口 | 4700 | `/pro/v2/api/quotation/add` |
| 是 | 357 | 报价单添加协同人接口 | 4700 | `/pro/v2/api/quotation/addCoUser` |
| 是 | 355 | 报价单添加负责人接口 | 4700 | `/pro/v2/api/quotation/addMainUser` |
| 是 | 352 | 删除报价单接口 | 4700 | `/pro/v2/api/quotation/del` |
| 是 | 358 | 报价单删除协同人接口 | 4700 | `/pro/v2/api/quotation/deleteCoUser` |
| 是 | 356 | 报价单删除负责人接口 | 4700 | `/pro/v2/api/quotation/deleteMainUser` |
| 是 | 354 | 报价单详情接口 | 4700 | `/pro/v2/api/quotation/detail` |
| 是 | 351 | 编辑报价单接口 | 4700 | `/pro/v2/api/quotation/edit` |
| 是 | 353 | 报价单列表接口 | 4700 | `/pro/v2/api/quotation/list` |
| 是 | 445 | 新建回执单 | 20340 | `/pro/v2/api/receiptOrder/add` |
| 是 | 442 | 回执单删除接口 | 20340 | `/pro/v2/api/receiptOrder/del` |
| 是 | 444 | 回执单详情接口 | 20340 | `/pro/v2/api/receiptOrder/detail` |
| 是 | 446 | 编辑回执单接口 | 20340 | `/pro/v2/api/receiptOrder/edit` |
| 是 | 443 | 回执单列表接口 | 20340 | `/pro/v2/api/receiptOrder/list` |
| 是 | 229 | 新建退货退款单接口 | 202 | `/pro/v2/api/refund/add` |
| 是 | 233 | 删除退货退款单接口 | 202 | `/pro/v2/api/refund/del` |
| 是 | 232 | 退货退款单详情接口 | 202 | `/pro/v2/api/refund/detail` |
| 是 | 230 | 编辑退货退款单接口 | 202 | `/pro/v2/api/refund/edit` |
| 是 | 231 | 退货退款单列表接口 | 202 | `/pro/v2/api/refund/list` |
|  | 558 | 新建销售退货入库单 | 1405 | `/pro/v2/api/refundInstock/add` |
|  | 562 | 删除销售退货入库单 | 1405 | `/pro/v2/api/refundInstock/del` |
|  | 561 | 销售退货入库单详情 | 1405 | `/pro/v2/api/refundInstock/detail` |
|  | 559 | 编辑销售退货入库单 | 1405 | `/pro/v2/api/refundInstock/edit` |
|  | 560 | 销售退货入库单列表 | 1405 | `/pro/v2/api/refundInstock/list` |
| 是 | 359 | 角色列表接口 | -1 | `/pro/v2/api/role/list` |
|  | 451 | 服务项目新建接口 | 20330 | `/pro/v2/api/serviceProject/add` |
|  | 449 | 服务项目删除接口 | 20330 | `/pro/v2/api/serviceProject/del` |
|  | 447 | 服务项目详情接口 | 20330 | `/pro/v2/api/serviceProject/detail` |
|  | 450 | 服务项目编辑接口 | 20330 | `/pro/v2/api/serviceProject/edit` |
|  | 448 | 服务项目列表接口 | 20330 | `/pro/v2/api/serviceProject/list` |
| 是 | 435 | 签到列表接口 | 2001 | `/pro/v2/api/signIn/list` |
| 是 | 532 | 阶段获取接口 | -1 | `/pro/v2/api/stage/get` |
| 是 | 533 | 阶段跳转接口 | -1 | `/pro/v2/api/stage/jump` |
| 是 | 267 | 新建供应商接口 | 1001 | `/pro/v2/api/supplier/add` |
|  | 594 | 供应商添加协同人接口 | 1001 | `/pro/v2/api/supplier/addCoUser` |
|  | 592 | 供应商添加负责人接口 | 1001 | `/pro/v2/api/supplier/addMainUser` |
|  | 271 | 删除供应商接口 | 1001 | `/pro/v2/api/supplier/del` |
|  | 595 | 供应商删除协同人接口 | 1001 | `/pro/v2/api/supplier/deleteCoUser` |
|  | 593 | 供应商删除负责人接口 | 1001 | `/pro/v2/api/supplier/deleteMainUser` |
|  | 270 | 供应商详情接口 | 1001 | `/pro/v2/api/supplier/detail` |
|  | 268 | 编辑供应商接口 | 1001 | `/pro/v2/api/supplier/edit` |
|  | 596 | 供应商移交接口 | 1001 | `/pro/v2/api/supplier/handover` |
|  | 269 | 供应商列表接口 | 1001 | `/pro/v2/api/supplier/list` |
|  | 386 | 供应商联系人添加协同人接口 | 1002 | `/pro/v2/api/supplierContact/addCoUser` |
|  | 384 | 供应商联系人添加负责人接口 | 1002 | `/pro/v2/api/supplierContact/addMainUser` |
|  | 387 | 供应商联系人删除协同人接口 | 1002 | `/pro/v2/api/supplierContact/deleteCoUser` |
|  | 385 | 供应商联系人删除负责人接口 | 1002 | `/pro/v2/api/supplierContact/deleteMainUser` |
|  | 272 | 新增供应商产品接口 | 1001 | `/pro/v2/api/supplierProduct/add` |
|  | 273 | 删除供应商产品接口 | 1001 | `/pro/v2/api/supplierProduct/del` |
|  | 274 | 供应商产品列表接口 | 1001 | `/pro/v2/api/supplierProduct/list` |
|  | 300 | 新建调拨单接口 | 1601 | `/pro/v2/api/transfer/add` |
|  | 304 | 删除调拨单接口 | 1601 | `/pro/v2/api/transfer/del` |
|  | 303 | 调拨单详情接口 | 1601 | `/pro/v2/api/transfer/detail` |
|  | 301 | 编辑调拨单接口 | 1601 | `/pro/v2/api/transfer/edit` |
|  | 302 | 调拨单列表接口 | 1601 | `/pro/v2/api/transfer/list` |
| 是 | 364 | 新建用户接口 | -1 | `/pro/v2/api/user/add` |
| 是 | 366 | 删除用户接口 | -1 | `/pro/v2/api/user/del` |
| 是 | 365 | 编辑用户接口 | -1 | `/pro/v2/api/user/edit` |
| 是 | 360 | 用户交接接口 | -1 | `/pro/v2/api/user/handover` |
| 是 | 205 | 用户列表接口 | -1 | `/pro/v2/api/user/list` |
|  | 600 | 新建仓库接口 | 1801 | `/pro/v2/api/warehouse/add` |
|  | 599 | 编辑仓库接口 | 1801 | `/pro/v2/api/warehouse/edit` |
|  | 349 | 仓库列表接口 | 1801 | `/pro/v2/api/warehouse/list` |
|  | 582 | 新建质保计划接口 | -1 | `/pro/v2/api/warranty/plan/add` |
|  | 589 | 添加质保计划协同人 | -1 | `/pro/v2/api/warranty/plan/addCoUser` |
|  | 587 | 添加质保计划负责人 | -1 | `/pro/v2/api/warranty/plan/addMainUser` |
|  | 584 | 删除质保计划接口 | -1 | `/pro/v2/api/warranty/plan/del` |
|  | 590 | 删除质保计划协同人 | -1 | `/pro/v2/api/warranty/plan/deleteCoUser` |
|  | 588 | 删除质保计划负责人 | -1 | `/pro/v2/api/warranty/plan/deleteMainUser` |
|  | 586 | 质保计划详情接口 | -1 | `/pro/v2/api/warranty/plan/detail` |
|  | 583 | 编辑质保计划接口 | -1 | `/pro/v2/api/warranty/plan/edit` |
|  | 591 | 移交质保计划负责人 | -1 | `/pro/v2/api/warranty/plan/handover` |
|  | 585 | 质保计划列表接口 | -1 | `/pro/v2/api/warranty/plan/list` |
|  | 375 | 接收工单接口 | 2301 | `/pro/v2/api/workOrder/accept` |
|  | 374 | 新建工单接口 | 2301 | `/pro/v2/api/workOrder/add` |
|  | 378 | 关闭工单接口 | 2301 | `/pro/v2/api/workOrder/close` |
|  | 377 | 完成工单接口 | 2301 | `/pro/v2/api/workOrder/complete` |
|  | 258 | 工单详情接口 | 2301 | `/pro/v2/api/workOrder/detail` |
|  | 434 | 编辑工单接口 | 2301 | `/pro/v2/api/workOrder/edit` |
| 是 | 257 | 工单列表接口 | 2301 | `/pro/v2/api/workOrder/list` |
| 是 | 259 | 工单配件接口 | 2301 | `/pro/v2/api/workOrder/productList` |
|  | 379 | 重启工单接口 | 2301 | `/pro/v2/api/workOrder/restart` |
| 是 | 261 | 工单模板详情接口 | 2301 | `/pro/v2/api/workOrder/templateDetail` |
| 是 | 260 | 工单模板列表接口 | 2301 | `/pro/v2/api/workOrder/templateList` |
|  | 376 | 转派工单接口 | 2301 | `/pro/v2/api/workOrder/transfer` |
| 是 | 437 | 新增工单接口 | 20300 | `/pro/v2/api/workOrderV2/add` |
| 是 | 472 | 添加工单协同人 | 20300 | `/pro/v2/api/workOrderV2/addCoUser` |
| 是 | 534 | 资产新建接口 | -1 | `/pro/v2/api/workOrderV2/asset/add` | 不一致：文档/描述 -1，demo 使用 20370 |
| 是 | 541 | 资产添加协同人接口 | -1 | `/pro/v2/api/workOrderV2/asset/addCoUser` |
| 是 | 539 | 资产添加负责人接口 | -1 | `/pro/v2/api/workOrderV2/asset/addMinUser` |
| 是 | 538 | 资产删除接口 | -1 | `/pro/v2/api/workOrderV2/asset/del` |
| 是 | 554 | 资产删除协同人接口 | -1 | `/pro/v2/api/workOrderV2/asset/delCoUser` |
| 是 | 540 | 资产删除负责人接口 | -1 | `/pro/v2/api/workOrderV2/asset/delMinUser` |
| 是 | 537 | 资产详情接口 | -1 | `/pro/v2/api/workOrderV2/asset/detail` |
| 是 | 535 | 资产编辑接口 | -1 | `/pro/v2/api/workOrderV2/asset/edit` |
| 是 | 555 | 资产移交接口 | -1 | `/pro/v2/api/workOrderV2/asset/handover` |
| 是 | 536 | 资产列表接口 | -1 | `/pro/v2/api/workOrderV2/asset/list` |
| 是 | 439 | 删除工单接口 | 20300 | `/pro/v2/api/workOrderV2/del` |
| 是 | 473 | 删除工单协同人 | 20300 | `/pro/v2/api/workOrderV2/deleteCoUser` |
| 是 | 441 | 工单详情接口 | 20300 | `/pro/v2/api/workOrderV2/detail` |
| 是 | 438 | 编辑工单接口 | 20300 | `/pro/v2/api/workOrderV2/edit` |
| 是 | 474 | 移交工单负责人 | 20300 | `/pro/v2/api/workOrderV2/handover` |
| 是 | 440 | 工单列表接口 | 20300 | `/pro/v2/api/workOrderV2/list` |
| 是 | 436 | 工单流转接口 | 20300 | `/pro/v2/api/workOrderV2/operate` |
|  | 500 | 新建工单领料单 | 21700 | `/pro/v2/api/workOrderV2ReceiveMaterial/add` |
|  | 502 | 删除工单领料单 | 21700 | `/pro/v2/api/workOrderV2ReceiveMaterial/del` |
|  | 504 | 工单领料单详情接口 | 21700 | `/pro/v2/api/workOrderV2ReceiveMaterial/detail` |
|  | 501 | 编辑工单领料单接口 | 21700 | `/pro/v2/api/workOrderV2ReceiveMaterial/edit` |
|  | 503 | 工单领料单列表接口 | 21700 | `/pro/v2/api/workOrderV2ReceiveMaterial/list` |
|  | 505 | 新建工单退料单 | 21800 | `/pro/v2/api/workOrderV2ReturnMaterial/add` |
|  | 507 | 删除工单退料单 | 21800 | `/pro/v2/api/workOrderV2ReturnMaterial/del` |
|  | 509 | 工单退料单详情接口 | 21800 | `/pro/v2/api/workOrderV2ReturnMaterial/detail` |
|  | 506 | 编辑工单退料单接口 | 21800 | `/pro/v2/api/workOrderV2ReturnMaterial/edit` |
|  | 508 | 工单退料单列表接口 | 21800 | `/pro/v2/api/workOrderV2ReturnMaterial/list` |
| 是 | 418 | 新建日报接口 | 2102 | `/pro/v2/api/workReportDaily/add` |
| 是 | 412 | 删除日报接口 | 2102 | `/pro/v2/api/workReportDaily/del` |
| 是 | 409 | 日报详情接口 | 2102 | `/pro/v2/api/workReportDaily/detail` |
| 是 | 415 | 编辑日报接口 | 2102 | `/pro/v2/api/workReportDaily/edit` |
| 是 | 564 | 获取工作计划接口 | 2101 | `/pro/v2/api/workReportDaily/getWorkPlan` | 不一致：文档 2101，命令描述 2102 |
| 是 | 406 | 日报列表接口 | 2102 | `/pro/v2/api/workReportDaily/list` |
| 是 | 416 | 新建月报接口 | 2104 | `/pro/v2/api/workReportMonthly/add` |
| 是 | 410 | 删除月报接口 | 2104 | `/pro/v2/api/workReportMonthly/del` |
| 是 | 407 | 月报详情接口 | 2104 | `/pro/v2/api/workReportMonthly/detail` |
| 是 | 413 | 编辑月报接口 | 2104 | `/pro/v2/api/workReportMonthly/edit` |
| 是 | 404 | 月报列表接口 | 2104 | `/pro/v2/api/workReportMonthly/list` |
| 是 | 417 | 新建周报接口 | 2103 | `/pro/v2/api/workReportWeekly/add` |
| 是 | 411 | 删除周报接口 | 2103 | `/pro/v2/api/workReportWeekly/del` |
| 是 | 408 | 周报详情接口 | 2103 | `/pro/v2/api/workReportWeekly/detail` |
| 是 | 414 | 编辑周报接口 | 2103 | `/pro/v2/api/workReportWeekly/edit` |
| 是 | 405 | 周报列表接口 | 2103 | `/pro/v2/api/workReportWeekly/list` |
| 是 | 526 | 工作任务新建 | 21500 | `/pro/v2/api/workTask/add` |
| 是 | 530 | 工作任务添加协同人接口 | 21500 | `/pro/v2/api/workTask/addCoUser` |
| 是 | 531 | 工作任务删除协同人接口 | 21500 | `/pro/v2/api/workTask/deleteCoUser` |
| 是 | 527 | 工作任务详情 | 21500 | `/pro/v2/api/workTask/detail` |
| 是 | 528 | 工作任务编辑 | 21500 | `/pro/v2/api/workTask/edit` |
| 是 | 529 | 工作任务移交接口 | 21500 | `/pro/v2/api/workTask/handover` |
| 是 | 452 | 新增工时记录接口 | 21100 | `/pro/v2/api/workTimeRecord/add` |
| 是 | 492 | 添加工时记录协同人 | 21100 | `/pro/v2/api/workTimeRecord/addCoUser` |
| 是 | 490 | 添加工时记录负责人 | 21100 | `/pro/v2/api/workTimeRecord/addMainUser` |
| 是 | 455 | 删除工时记录接口 | 21100 | `/pro/v2/api/workTimeRecord/del` |
| 是 | 493 | 删除工时记录协同人 | 21100 | `/pro/v2/api/workTimeRecord/deleteCoUser` |
| 是 | 491 | 删除工时记录负责人 | 21100 | `/pro/v2/api/workTimeRecord/deleteMainUser` |
| 是 | 458 | 工时记录详情接口 | 21100 | `/pro/v2/api/workTimeRecord/detail` |
| 是 | 453 | 编辑工时记录接口 | 21100 | `/pro/v2/api/workTimeRecord/edit` |
| 是 | 494 | 移交工时记录负责人 | 21100 | `/pro/v2/api/workTimeRecord/handover` |
| 是 | 457 | 工时记录列表接口 | 21100 | `/pro/v2/api/workTimeRecord/list` |
