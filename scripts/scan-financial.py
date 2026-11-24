"""Verify private monetary fields and the prior disclosure marker without printing amounts."""
import datetime,io,json,pathlib,re,subprocess,tarfile
root=pathlib.Path(__file__).resolve().parent.parent
brief=pathlib.Path('C:/Users/pc5/r10/_out/2026-11-24/kerim-erp/CODEX-ISTEM-demo-3.md').read_text(encoding='utf-8-sig')
found=re.findall(r'\d{1,3}(?:\.\d{3})+,\d{2}\s*\u20ba',brief)
markers=[]
for value in found:
 value=value.replace('\u20ba','').strip();markers.extend([value.encode(),value.replace('.','').replace(',','.').encode()])
assert markers
snapshot=json.loads((root/'src/gercek.json').read_text(encoding='utf-8-sig'))
allowed_order={'id','channel','date','status','lines'};allowed_line={'product','title','sku','qty'}
extra_order=set();extra_line=set()
for o in snapshot['orders']:
 extra_order.update(set(o)-allowed_order)
 for line in o['lines']:extra_line.update(set(line)-allowed_line)
local_flags=[];local_count=0
for folder in ['src','dist','public','scripts','tests','.github']:
 for p in (root/folder).rglob('*'):
  if p.is_file() and '__pycache__' not in p.parts:
   local_count+=1
   if any(m in p.read_bytes() for m in markers):local_flags.append(p.relative_to(root).as_posix())
for p in root.glob('*.md'):
 local_count+=1
 if any(m in p.read_bytes() for m in markers):local_flags.append(p.name)
def api(p):return subprocess.run(['gh','api','repos/veinpsycoo/kerim-erp-demo/'+p],capture_output=True,check=True).stdout
commits=json.loads(api('commits?per_page=100'));remote_flags=[];remote_count=0
for c in commits:
 with tarfile.open(fileobj=io.BytesIO(api('tarball/'+c['sha'])),mode='r:gz') as tar:
  for item in tar:
   if item.isfile():
    remote_count+=1
    if any(m in tar.extractfile(item).read() for m in markers):remote_flags.append({'commit':c['sha'],'file':item.name.split('/',1)[-1]})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':not local_flags and not remote_flags and not extra_order and not extra_line,'snapshotOrdersChecked':len(snapshot['orders']),'extraOrderFields':sorted(extra_order),'extraOrderLineFields':sorted(extra_line),'localFilesChecked':local_count,'remoteCommitsChecked':len(commits),'remoteFilesChecked':remote_count,'flaggedLocalFiles':local_flags,'flaggedRemoteFiles':remote_flags,'publicProductPricesAllowed':True}
(root/'demo-kanit/round4/financial-scan.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result));raise SystemExit(0 if result['passed'] else 1)
