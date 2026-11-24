"""Verify actual published JS/CSS against local build and scan in memory."""
import datetime, hashlib, json, pathlib, re, urllib.request
ROOT=pathlib.Path(__file__).resolve().parent.parent
BASE='https://veinpsycoo.github.io/kerim-erp-demo/'
secret=pathlib.Path('C:/Users/pc5/.config/kerim-erp/SECRETS-kerim-api-1124.txt').read_bytes().decode('utf-8',errors='replace')
values=[x.strip().split(':',1)[-1].strip().encode() for x in secret.splitlines() if len(x.strip())>=20]
values=[v for v in values if len(v)>=16 and b' ' not in v]
patterns=[rb'(?:ck_|cs_)[A-Za-z0-9]{20,}',rb'(?<![A-Za-z0-9])s_[A-Za-z0-9]{20,}']
paths=['index.html','sw.js','robots.txt']+[p.relative_to(ROOT/'dist').as_posix() for p in (ROOT/'dist'/'assets').iterdir() if p.suffix in ['.js','.css']]
checks=[]
for rel in paths:
    req=urllib.request.Request(BASE+rel,headers={'Cache-Control':'no-cache','User-Agent':'KerimERP-ReleaseVerification/2'},method='GET')
    with urllib.request.urlopen(req,timeout=40) as r:data=r.read();status=r.status
    clean=not any(v in data for v in values) and not any(re.search(p,data) for p in patterns)
    if rel=='index.html':clean=clean and b'noindex, nofollow, noarchive' in data
    if rel=='robots.txt':clean=clean and b'Disallow: /' in data
    sha=hashlib.sha256(data).hexdigest();same=sha==hashlib.sha256((ROOT/'dist'/rel).read_bytes()).hexdigest()
    checks.append({'path':rel,'status':status,'sha256':sha,'matchesBuild':same,'noSecret':clean})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':BASE,'passed':all(c['matchesBuild'] and c['noSecret'] for c in checks),'files':checks}
out=ROOT/'demo-kanit'/'live-release-check.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result));raise SystemExit(0 if result['passed'] else 1)
