import io,json,pathlib,re,subprocess,sys,zipfile
kind=sys.argv[2];assert kind in ['presentation','matrix'];base='repos/veinpsycoo/kerim-erp-demo/'
def api(p):return subprocess.run(['gh','api',base+p],capture_output=True,check=True).stdout
name='round4-presentation' if kind=='presentation' else 'round4-matrix-geometry'
artifacts=json.loads(api('actions/runs/'+sys.argv[1]+'/artifacts'))['artifacts'];item=next(x for x in artifacts if x['name']==name)
out=pathlib.Path(__file__).resolve().parent.parent/'demo-kanit/round4'/('secme' if kind=='presentation' else 'mobile-card');out.mkdir(parents=True,exist_ok=True)
count=0
with zipfile.ZipFile(io.BytesIO(api('actions/artifacts/'+str(item['id'])+'/zip'))) as z:
 for n in z.namelist():
  p=pathlib.PurePosixPath(n)
  if p.suffix in ['.png','.json'] and (kind=='matrix' or p.name=='manifest.json' or re.match(r'^0[1-6]-',p.name)):(out/p.name).write_bytes(z.read(n));count+=1
print(json.dumps({'kind':kind,'files':count,'path':str(out)}))
