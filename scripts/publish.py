"""Publish workspace files using the authenticated gh CLI; no credentials are read or stored."""
import subprocess,json,base64,pathlib,hashlib,sys
orphan='--orphan' in sys.argv
root=pathlib.Path(__file__).resolve().parent.parent
subprocess.run(['python',str(root/'scripts'/'scan-secrets.py')],cwd=root,check=True)
subprocess.run(['python',str(root/'scripts'/'scan-round4.py'),'--local-only'],cwd=root,check=True)
repo='repos/veinpsycoo/kerim-erp-demo'
def api(path,data=None,method=None):
    args=['gh','api',path]
    if method:args+=['-X',method]
    if data is not None:args+=['--input','-']
    r=subprocess.run(args,input=json.dumps(data).encode() if data is not None else None,capture_output=True)
    if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[:500])
    return json.loads(r.stdout) if r.stdout else {}
try:
    ref=api(repo+'/git/ref/heads/main');parent=ref['object']['sha']
except RuntimeError:
    c=api(repo+'/contents/README.md',{'message':'Initialize Asker Marketi ERP demo','content':base64.b64encode((root/'README.md').read_bytes()).decode()},'PUT')
    parent=c['commit']['sha']
commit=api(repo+'/git/commits/'+parent);base=commit['tree']['sha']
remote=api(repo+'/git/trees/'+base+'?recursive=1')['tree'];previous={x['path']:x['sha'] for x in remote if x['type']=='blob'}
known_objects=set(previous.values())
if commit.get('parents'):
    prior=api(repo+'/git/commits/'+commit['parents'][0]['sha'])
    prior_tree=api(repo+'/git/trees/'+prior['tree']['sha']+'?recursive=1')['tree']
    known_objects.update(x['sha'] for x in prior_tree if x['type']=='blob')
files=[p for p in root.iterdir() if p.is_file() and p.name in ['.gitignore','DEMO-RAPOR.md','DESIGN.md','PRODUCT.md','README.md','HANDOFF-round4-2026-11-24.md','eslint.config.js','index.html','package-lock.json','package.json','playwright.config.ts','tsconfig.json','tsconfig.tests.json','vite.config.ts']]
for d in ['.github','public','scripts','src','tests']:files+=list((root/d).rglob('*'))
tree=[];changed=0
for p in files:
    if not p.is_file() or '__pycache__' in str(p):continue
    rel=p.relative_to(root).as_posix();data=p.read_bytes();sha=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    if previous.get(rel)==sha:
        if orphan:tree.append({'path':rel,'mode':'100644','type':'blob','sha':sha})
        continue
    changed+=1
    if sha in known_objects:
        tree.append({'path':rel,'mode':'100644','type':'blob','sha':sha});continue
    try:
        content=data.decode('utf-8-sig');tree.append({'path':rel,'mode':'100644','type':'blob','content':content})
    except UnicodeDecodeError:
        b=api(repo+'/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'});tree.append({'path':rel,'mode':'100644','type':'blob','sha':b['sha']})
    if changed%40==0:print(f'{changed} changed files prepared',flush=True)
if not orphan:
    managed={p.relative_to(root).as_posix() for p in files if p.is_file() and '__pycache__' not in str(p)}
    for rel in previous:
        if rel.startswith(('.github/','public/','scripts/','src/','tests/')) and rel not in managed:
            tree.append({'path':rel,'mode':'100644','type':'blob','sha':None});changed+=1
if not tree:print('Remote already matches workspace');raise SystemExit(0)
t=api(repo+'/git/trees',{'tree':tree} if orphan else {'base_tree':base,'tree':tree})
c=api(repo+'/git/commits',{'message':'Round 4 audit fixes: unclipped dialogs, quiet dashboard and consistent stock','tree':t['sha'],'parents':[] if orphan else [parent]})
current=api(repo+'/git/ref/heads/main')['object']['sha']
if current!=parent:raise RuntimeError('Remote head changed; refusing to overwrite concurrent work')
api(repo+'/git/refs/heads/main',{'sha':c['sha'],'force':orphan},'PATCH')
print(f'Published {changed} files · commit {c["sha"]}',flush=True)

