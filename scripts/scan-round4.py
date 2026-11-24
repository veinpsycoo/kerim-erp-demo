"""Round 4 exact-value scans. Never prints credentials or matching text."""
import base64,datetime,io,json,pathlib,re,subprocess,tarfile,sys
root=pathlib.Path(__file__).resolve().parent.parent
raw=pathlib.Path('C:/Users/pc5/.config/kerim-erp/SECRETS-kerim-api-1124.txt').read_text(encoding='utf-8-sig')
values={line.strip().split(':',1)[-1].strip() for line in raw.splitlines() if len(line.strip())>=16}
values={v for v in values if len(v)>=16 and not re.search(r'\s',v)}
short_values=set()
for line in raw.splitlines():
 match=re.match(r'^([^:=]{1,70})\s*[:=]\s*(.*)$',line.strip())
 if not match:continue
 scalar=match[2].strip().strip("\"'")
 if len(scalar)<4 or re.search(r'\s',scalar) or scalar.startswith(('http://','https://')):continue
 if len(scalar)<16:short_values.add(scalar)
 else:values.add(scalar)
woo=re.findall(r'(?:ck|cs)_[A-Za-z0-9]+',raw)
for i in range(0,len(woo)-1,2):values.add(base64.b64encode(':'.join(woo[i:i+2]).encode()).decode())
checks=[v.encode(encoding) for v in values for encoding in ['utf-8','utf-16-le','utf-16-be']]
short_patterns=[re.compile(r'(?<!\w)'+re.escape(v)+r'(?!\w)') for v in short_values]
patterns=[re.compile(rb'(?:ck_|cs_)[A-Za-z0-9]{20,}'),re.compile(rb'(?<![A-Za-z0-9])s_[A-Za-z0-9]{20,}')]
def clean(data):
 if any(v in data for v in checks) or any(p.search(data) for p in patterns):return False
 texts=[data.decode('utf-8',errors='ignore')]
 if data.startswith((b'\xff\xfe',b'\xfe\xff')):texts.append(data.decode('utf-16',errors='ignore'))
 return not any(p.search(text) for text in texts for p in short_patterns) and not any(p.search(text.encode('utf-8')) for text in texts for p in patterns)
failed=[];count=0
skip={'node_modules','.git','.browser-round4','.browser-round4-single','.npm-cache','.browser-profile','__pycache__'}
for base,dirs,files in __import__('os').walk(root):
 dirs[:]=[d for d in dirs if d not in skip]
 for name in files:
  p=pathlib.Path(base)/name;count+=1
  if not clean(p.read_bytes()):failed.append(p.relative_to(root).as_posix())
def command(args):
 r=subprocess.run(args,cwd=root,capture_output=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+' (details withheld)')
 return r.stdout
local_objects=command(['git','rev-list','--objects','--all']).decode().splitlines()
for line in local_objects:
 sha=line.split(' ',1)[0];data=command(['git','cat-file','-p',sha])
 if not clean(data):failed.append('local-git-object:'+sha)
refs=[] if '--local-only' in sys.argv else json.loads(command(['gh','api','repos/veinpsycoo/kerim-erp-demo/git/refs']))
refs_covered=all(r['ref']=='refs/heads/main' for r in refs)
commits=[] if '--local-only' in sys.argv else json.loads(command(['gh','api','repos/veinpsycoo/kerim-erp-demo/commits?per_page=100']))
remote_files=0;remote_flags=[]
for c in commits:
 archive=command(['gh','api','repos/veinpsycoo/kerim-erp-demo/tarball/'+c['sha']])
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
  for item in tar:
   if item.isfile():
    remote_files+=1
    if not clean(tar.extractfile(item).read()):remote_flags.append({'commit':c['sha'],'file':item.name.split('/',1)[-1]})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localFiles':count,'localHistoryObjects':len(local_objects),'remoteHistoryCommits':len(commits),'remoteRefs':[r['ref'] for r in refs],'allRefsCovered':refs_covered,'remoteFiles':remote_files,'remoteHead':commits[0]['sha'] if commits else None,'localOnly':'--local-only' in sys.argv,'passed':not failed and not remote_flags and refs_covered,'flaggedFiles':failed,'remoteFlaggedFiles':remote_flags,'releasePublished':'--published' in sys.argv}
out=root/'demo-kanit/round4/security-scan.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ["flaggedFiles","remoteFlaggedFiles"]}|{"flaggedFileCount":len(failed),"remoteFlaggedFileCount":len(remote_flags)}));raise SystemExit(0 if result['passed'] else 1)
