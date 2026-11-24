import io,json,subprocess,sys,zipfile,pathlib,re
run=sys.argv[1];root=pathlib.Path(__file__).resolve().parent.parent
def api(p):
 r=subprocess.run(['gh','api','repos/veinpsycoo/kerim-erp-demo/'+p],capture_output=True)
 if r.returncode:raise RuntimeError('GitHub API failed')
 return r.stdout
archive=api('actions/runs/'+run+'/logs');out=root/'demo-kanit/round4/ci';out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(io.BytesIO(archive)) as z:
 for n in z.namelist():
  if 'e2e' in n.lower() or 'lint' in n.lower():
   data=z.read(n).decode(errors='replace');(out/(run+'-'+pathlib.Path(n).name)).write_text(data,encoding='utf-8')
   if 'e2e' in n.lower():print(data[-16000:])
a=json.loads(api('actions/runs/'+run+'/artifacts'))
print(json.dumps([{k:x[k] for k in ['id','name','size_in_bytes']} for x in a['artifacts']]))
