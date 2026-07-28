import json
import subprocess
from pathlib import Path

IDS = [ 318,323,328,322,324,327,321,326,319,597,424,581,421,419,420,382,380,383,381,290,294,293,291,292,571,579,570,361,363,362,313,372,317,316,314,574,315,373,329,334,332,330,333,331,598,572,563,402,400,403,401,524,398,396,522,517,521,399,397,520,525,523,518,573,519,371,359,532,364,366,365,360,205,418,564,406,416,404,417,405]
##[359,360,361,362,363,364,365,366,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,510,511,512,513,514,515,516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,556,557,572,573,574,575]
OUTPUT = Path('api-docs-80.json')
URL = 'https://appapi.xbongbong.com/pro/v2/online/interface/detail'
HEADERS = ['-H', 'Content-Type: application/json;charset=UTF-8']

results = []
for interface_id in IDS:
    payload = json.dumps({'id': interface_id}, ensure_ascii=False)
    completed = subprocess.run(
        ['curl', '-sS', URL, *HEADERS, '--data-raw', payload],
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    results.append({
        'id': interface_id,
        'status': completed.returncode,
        'stdout': completed.stdout,
        'stderr': completed.stderr,
    })

OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'written {OUTPUT}')
