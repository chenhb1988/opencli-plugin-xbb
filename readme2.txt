 opencli xbb set-token --token e664686b8f396d6d610585c186d39f63 --corpid dingf6576c4f7359fd1f
  opencli xbb set-token --token 15760448139bf3e6f1e72a485f75e7 --corpid dinge3fa697f86d461d2
  
 opencli xbb userlist --corpid  dingf6576c4f7359fd1f
 opencli xbb customerlist --corpid dingf6576c4f7359fd1f --formId 928 
  opencli xbb opportunitylist --corpid dingf6576c4f7359fd1f --formId 932 
  opencli xbb customeradd --corpid 'dingf6576c4f7359fd1f' --formId 928 --dataList '{"text_1": "apiTest.001","text_16": "0241564315965"}' --debug
 opencli xbb customeredit --corpid 'dingf6576c4f7359fd1f' --formId 928 --dataId 160620424 --dataList '{"text_1":"apiTest.001","text_16":"0241564315965"}' --debug
  
  opencli xbb formlist --corpid dingf6576c4f7359fd1f --saasMark 1 --businessType 100
  opencli xbb customerdetail --dataId 7097514 --corpid dingf6576c4f7359fd1f
  
  opencli xbb cluelist --corpid dingf6576c4f7359fd1f --formId 2875705 
  
  opencli xbb communicatelist --corpid dingf6576c4f7359fd1f --attr text_1 --value 310993
  
  
  ========多平台
   opencli xbb set-token --token 6dcf0c7d9251bf77b04c41b43ba976cc --corpid ww59948f9d1fd96ad7
   opencli xbb userlist --corpid  ww59948f9d1fd96ad7
   opencli xbb formlist --corpid dinge3fa697f86d461d2 --saasMark 1 --businessType 100
   
   
  xcopy /e D:\github\opencli-plugin-xbb\*.js C:\Users\chb\.opencli\plugins\opencli-plugin-xbb\
 
    
        {
          "appId": 552455 // 应用 ID
          "formId": 7526034 // 模板、表单 ID
          "businessType": 20300 // 业务类型
          "subBusinessType":  20300 // 子业务类型
          "saasMark":  1 // 1 为 saas 业务  2 为 paas 业务
        }
		
		opencli xbb work-order-list --corpid dinge3fa697f86d461d2 --formId 7526034 --debug --conditions  '[{"attr": "ownerId","value": ["02415643151585"],"symbol": "equal"}]'
		
		 
  "conditions": [
    '{"attr": "ownerId","value": ["02415643151585"],"symbol": "equal"}'
  ]
  
		conditions
work-order-list 传了未指定值的参数，"page":0,"pageSize":0,"viewApproval":0。
牢记一点，未指明确指定的值，不要传默认值
 cli-anything :https://blog.csdn.net/helianxiaoye/article/details/159283297
 
 实现 opportunitylist
 ##获取销售机会列表接口文档
 
 Bash(curl -sS "https://proapi.xbongbong.com/pro/v2/online/interface/detail" -H "Content-Type: application/json;charset=UTF-8" --data-raw '{"id":197}')
 
 
 实现这个接口，接口文档为
  Bash(curl -sS "https://proapi.xbongbong.com/pro/v2/online/interface/detail" -H "Content-Type: application/json;charset=UTF-8" --data-raw '{"id":226}')
  576,575,574,573,571,570,
   ,,,,,
   依次实现以下接口，接口文档通过以下bash方式，请求时需替换id参数，id分别为[200,201,203,204,229,230,232,233,234,235,238,239,240,241,248,249,250,251,252,253,255,256 ]
  Bash(curl -sS "https://proapi.xbongbong.com/pro/v2/online/interface/detail" -H "Content-Type: application/json;charset=UTF-8" --data-raw "{\"id\":251}")
 
  ===
  
   
优化set-token命令，增加传递1个参数corpid，保存到配置文件中为corpid,token,baseurl
 对corpid参数进行判断，  
 如果corpd以'ding' 开头，或包含 '$$ding' 则baseurl为域名 https://proapi.xbongbong.com,
 baseurl域名https://appapi.xbongbong.com
 
 优化userlist命令在 获取token时，同时从配置文件获取corpid，token，baseurl。
获取的baseurl作为命令中请求的api_url的域名部分。
如果配置中的corpid与命名请求参数中的corpid不一致，则报错corpid与配置中不一致。


==========
修改formlist命令，在businessType在未指定参数值时，请求体不要带这个businessType。
修改set-token命令，在当前set-token执行成功后，
执行两个命令， 
opencli xbb formlist --corpid ww59948f9d1fd96ad7 --saasMark 2 -f json
和
opencli xbb formlist --corpid ww59948f9d1fd96ad7 --saasMark 1 -f json
将两次请求的结果进行合并，存入本地配置文件，与config.json文件在同一个目录中，命名格式为 {corpid}.formlist.json


所有命令在构造参数时，用户未指定参数值时，请求体不要带这个参数。


=========

   
        {
          "appId": 552455 // 应用 ID
          "formId": 7526034 // 模板、表单 ID
          "businessType": 20300 // 业务类型
          "subBusinessType":  20300 // 子业务类型
          "saasMark":  1 // 1 为 saas 业务  2 为 paas 业务
        }
		
		opencli xbb work-order-list --corpid dinge3fa697f86d461d2 --formId 7526034
		opencli xbb work-order-detail --corpid dinge3fa697f86d461d2 --dataId 7526034
		conditions
		所有命令在构造参数时，用户未指定参数值时，请求体不要带这个参数。这两个命令都带了多余的默认值，请不要带默认值
		work-order-list
		
		
		opencli xbb work-order-list --corpid dinge3fa697f86d461d2 --formId 7526034 --debug --conditions  "[{\"attr\": \"ownerId\",\"value\": [\"02415643151585\"],\"symbol\": \"equal\"}, {\"attr\": \"text_4\",  \"value\": [ 6, 7, 8, 9],\"symbol\": \"noin\"}]"
		
		opencli xbb work-order-list --corpid dinge3fa697f86d461d2 --formId 7526034 --debug --conditions  "[{\"attr\": \"serialNo\",\"value\": [\"WO.CRM.20260518017\"],\"symbol\": \"equal\"}]"
		
		opencli xbb work-order-detail  --corpid dinge3fa697f86d461d2 --dataId 406850
		
		
		待分配，待确认，待修复，
		
		
		
		
		==========个人token
		  opencli xbb set-token --token user_0c9beb6836ee37a1994a28ce775 --corpid dinge3fa697f86d461d2 --userId 17788064424996538
		   opencli xbb work-order-list --corpid dinge3fa697f86d461d2 --formId 7226809  --conditions  "[{\"attr\": \"ownerId\",\"value\": [\"03333417082337\"],\"symbol\": \"equal\"}, {\"attr\": \"text_4\",  \"value\": [ 1, 2, 4],\"symbol\": \"in\"}]"
		   
		   
		   opencli xbb set-token --corpid dinge3fa697f86d461d2 --userId *** --token user_***
		   
		   opencli xbb set-token --token user_f4ae5ee6eccd6dfdb6ee009d58b --corpid dinge3fa697f86d461d2 --userId "02415643151585"
		   
		   
		   
		   python C:\Users\chb\.opencli\plugins\opencli-plugin-datacenter\python\do-work-order-va.py WO.CRM.20260625016

		   
		   批量生成xbb命令，接口清单文件是api-docs-80.json，这次有80个接口。
		   
		   
===
  遍历这个清单，id是客户id，根据这个客户id，
  通过命令查 合同数量，回填到md文件的“合同数量”列。
  opencli xbb contract-list --corpid dinge3fa697f86d461d2 --formId 4579303 --attr text_2 --value {客户id}
  
  写一个python脚本 通过下面这个命令，获取这些客户id的跟进记录（73515123 ,147059405 ,128249017,125604804 ），并且保存到 communicate/communicate-list.{客户id}.json
  opencli xbb communicate-list --corpid dinge3fa697f86d461d2   --attr text_1 --value 73515123 --pageSize 100 --raw -f json

  从 ‘客户管理2026-07-24.md’ 中筛选出 ‘截止日期’字段为 2025年01月的 客户id，
  根据{客户id}从文件中找到对应客户的跟进记录  communicate/communicate-list.{客户id}.json
  分析客户未续费原因，填写到 ‘客户管理2026-07-24.md’ 的 ‘未续费原因’
  

  
  
  