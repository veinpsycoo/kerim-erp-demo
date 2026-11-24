"""Scan release and publishable source without printing secret values."""
import base64, datetime, json, pathlib, re, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
secret=pathlib.Path('C:/Users/pc5/.config/kerim-erp/SECRETS-kerim-api-1124.txt').read_bytes().decode('utf-8',errors='replace')
values=[x.strip().split(':',1)[-1].strip() for x in secret.splitlines() if len(x.strip())>=20]
values=[v for v in values if len(v)>=16 and ' ' not in v]
woo=re.findall(r'(?:ck|cs)_[A-Za-z0-9]+',secret)
values+=woo
for i in range(0,len(woo),2):values.append(base64.b64encode((':'.join(woo[i:i+2])).encode()).decode())
patterns=[re.compile(rb'(?:ck_|cs_)[A-Za-z0-9]{20,}'),re.compile(rb'(?<![A-Za-z0-9])s_[A-Za-z0-9]{20,}')]
files=[]
for folder in ['dist','public','src','scripts','.github']:
    files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
files += [p for p in ROOT.iterdir() if p.is_file() and p.suffix in ['.md','.json','.ts','.html']]
fail=[]
for p in files:
    data=p.read_bytes()
    if any(v.encode() in data for v in values) or any(rx.search(data) for rx in patterns):fail.append(p.relative_to(ROOT).as_posix())
result={'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'filesScanned':len(files),'checks':['exact credential values','WooCommerce ck/cs patterns','s_ token pattern','Basic auth encoding'],'passed':not fail,'flaggedFiles':fail}
out=ROOT/'demo-kanit'/'secret-scan.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=True));sys.exit(1 if fail else 0)
