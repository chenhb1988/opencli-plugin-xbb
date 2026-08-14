export const meta = {
  name: 'xbb-debug-refactor',
  description: '将所有 xbb 命令文件的 requestBody/responseBody 从表格列移到 stderr debug 输出',
  phases: [
    { title: 'Refactor', detail: '并发改造每个命令文件' },
  ],
}

const files = [
  'worktimerecordlist.js','worktimerecorddetail.js','workorderproductlist.js','workorderlist.js',
  'workorder-handover.js','workorder-delete-couser.js','workorder-add-couser.js',
  'work-task-handover.js','work-task-edit.js','work-task-detail.js','work-task-delete-couser.js',
  'work-task-add.js','work-task-add-couser.js',
  'work-report-weekly-list.js','work-report-weekly-edit.js','work-report-weekly-detail.js',
  'work-report-weekly-del.js','work-report-weekly-add.js',
  'work-report-monthly-list.js','work-report-monthly-edit.js','work-report-monthly-detail.js',
  'work-report-monthly-del.js','work-report-monthly-add.js',
  'work-report-daily-list.js','work-report-daily-get-work-plan.js','work-report-daily-edit.js',
  'work-report-daily-detail.js','work-report-daily-del.js','work-report-daily-add.js',
  'work-order-template-list.js','work-order-template-detail.js','work-order-operate.js',
  'work-order-list.js','work-order-edit.js','work-order-detail.js','work-order-del.js','work-order-add.js',
  'user-handover.js','user-edit.js','user-del.js','user-add.js',
  'token-generate.js','supplier-add.js','stage-jump.js','stage-get.js','sign-in-list.js',
  'role-list.js',
  'refund-list.js','refund-edit.js','refund-detail.js','refund-del.js','refund-add.js',
  'quotation-handover.js',
  'product-online.js','product-list.js','product-edit.js','product-detail.js','product-del.js',
  'product-category-update.js','product-category-list.js','product-category-del.js',
  'product-category-add.js','product-add.js',
  'payment-sheet-list.js','payment-sheet-handover.js','payment-sheet-get-amount-detail.js',
  'payment-sheet-edit-write-off.js','payment-sheet-edit-red.js','payment-sheet-edit-bad-debt.js',
  'payment-sheet-detail.js','payment-sheet-del.js','payment-sheet-add-write-off.js',
  'payment-sheet-add-red.js','payment-sheet-add-pre.js','payment-sheet-add-bad-debt.js',
  'payment-list.js','payment-handover.js','payment-edit.js','payment-detail.js',
  'payment-delete-mainuser.js','payment-delete-couser.js','payment-del.js','payment-add.js',
  'payment-add-mainuser.js','payment-add-couser.js',
  'pay-sheet-list.js','pay-sheet-get-amount-detail.js','pay-sheet-edit-write-off.js',
  'pay-sheet-edit-red.js','pay-sheet-edit-bad.js','pay-sheet-detail.js',
  'pay-sheet-delete-mainuser.js','pay-sheet-delete-couser.js','pay-sheet-del.js',
  'pay-sheet-add-write-off.js','pay-sheet-add-red.js','pay-sheet-add-mainuser.js',
  'pay-sheet-add-couser.js','pay-sheet-add-bad.js',
  'pay-plan-handover.js','pay-plan-delete-mainuser.js','pay-plan-delete-couser.js',
  'pay-plan-add.js','pay-plan-add-mainuser.js','pay-plan-add-couser.js',
  'opportunity-list.js','opportunity-handover.js','opportunity-edit.js','opportunity-detail.js',
  'opportunity-delete-mainuser.js','opportunity-delete-couser.js','opportunity-del.js',
  'opportunity-add.js','opportunity-add-mainuser.js','opportunity-add-couser.js',
  'market-activity-list.js','market-activity-handover.js','market-activity-edit.js',
  'market-activity-detail.js','market-activity-del.js','market-activity-add.js',
  'form-list.js','form-get.js',
  'form-data-handover.js','form-data-edit.js','form-data-detail.js',
  'form-data-delete-mainuser.js','form-data-delete-couser.js','form-data-del.js',
  'form-data-add.js','form-data-add-mainuser.js','form-data-add-couser.js',
  'department-list.js','department-edit.js','department-del.js','department-add.js',
  'customer-list.js','customer-invoice-info.js','customer-invoice-info-edit.js',
  'customer-invoice-info-add.js','customer-invoice-address.js','customer-invoice-address-edit.js',
  'customer-invoice-address-add.js','customer-handover.js','customer-edit.js',
  'customer-distribution.js','customer-detail.js','customer-delete-mainuser.js',
  'customer-delete-couser.js','customer-del.js','customer-back.js','customer-add.js',
  'customer-add-couser.js',
  'contract-outstock-list.js','contract-outstock-edit.js','contract-outstock-detail.js',
  'contract-outstock-del.js','contract-outstock-add.js',
  'contract-list.js','contract-handover.js','contract-edit.js','contract-detail.js',
  'contract-delete-mainuser.js','contract-delete-couser.js','contract-del.js',
  'contract-add.js','contract-add-mainuser.js','contract-add-couser.js',
  'contact-list.js','contact-handover.js','contact-edit.js','contact-detail.js',
  'contact-delete-mainuser.js','contact-delete-couser.js','contact-del.js',
  'contact-add.js','contact-add-mainuser.js','contact-add-couser.js',
  'communicate-plan-single-operate.js','communicate-plan-list.js','communicate-plan-detail.js',
  'communicate-plan-del.js','communicate-plan-cancel.js','communicate-plan-add.js',
  'communicate-list.js','communicate-edit.js','communicate-detail.js',
  'communicate-del.js','communicate-add.js',
  'clue-thorough-delete.js','clue-list.js','clue-edit.js','clue-distribution.js',
  'clue-detail.js','clue-delete-mainuser.js','clue-delete-couser.js',
  'clue-del.js','clue-back.js','clue-add.js','clue-add-couser.js',
];

const dir = 'C:/Users/chb/.opencli/plugins/opencli-plugin-xbb';

phase('Refactor');

await pipeline(
  files,
  async (file) => agent(
    `你是一个代码改造 agent。请对文件 ${dir}/${file} 做以下改造（已完成改造的跳过）：

1. makeErrorRow 函数：移除 debug、requestBody（或 body）、responseBody 参数，行对象中不包含 requestBody/responseBody 字段。
2. makeSuccessRows 函数（如有）：同样移除这些参数和字段。
3. columns 数组：移除 'requestBody' 和 'responseBody' 两项。
4. func 函数内：
   - 构建 headers 对象后存入变量（如果还没有）。
   - 在 fetch 调用前，加入：
     if (debug) {
       process.stderr.write(\`[debug] URL: \${apiUrl}\\n[debug] Headers: \${JSON.stringify(headers)}\\n[debug] RequestBody: \${<请求体变量名>}\\n\`);
     }
   - 在获取响应体后，加入：
     if (debug) process.stderr.write(\`[debug] ResponseBody: \${<响应体变量名>}\\n\`);
   - 所有 makeErrorRow / makeSuccessRows 调用去掉 debug/requestBody/responseBody 参数。
   - 行数据 map 中移除 requestBody/responseBody 字段。

注意：
- 如果文件中不存在 requestBody/responseBody 相关代码（已改造或本来没有），直接跳过，不做任何修改。
- 保持原有代码风格，不要添加注释，不要引入新的抽象。
- 请求体变量名可能是 body、requestBody 等，响应体变量名可能是 responseBody、responseText 等，根据实际代码判断。
- debug 变量可能已存在也可能不存在，如不存在需要加上 const debug = Boolean(kwargs.debug);（前提是 args 中有 debug 参数）。
- 如果 args 中没有 debug 参数，则不加 debug 输出逻辑，只移除 requestBody/responseBody 列和字段。

请直接修改文件，不要输出解释。`,
    { label: file, phase: 'Refactor' }
  )
);

log('所有文件改造完成');
