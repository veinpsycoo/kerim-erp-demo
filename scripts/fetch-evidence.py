"""Download only reviewable test evidence, never traces or caches."""
import io,json,pathlib,subprocess,sys,zipfile
root=pathlib.Path(__file__).resolve().parent.parent
run=sys.argv[1];stage=sys.argv[2];out=root/'demo-kanit/round4'/stage;out.mkdir(parents=True,exist_ok=True)
def api(p):return subprocess.run(['gh','api','repos/veinpsycoo/kerim-erp-demo/'+p],capture_output=True,check=True).stdout
items=json.loads(api('actions/runs/'+run+'/artifacts'))['artifacts'];item=next(x for x in items if x['name']==stage+'-test-evidence')
count=0;total=0
with zipfile.ZipFile(io.BytesIO(api('actions/artifacts/'+str(item['id'])+'/zip'))) as z:
 for name in z.namelist():
  p=pathlib.PurePosixPath(name)
  if (('playwright-evidence/'+stage+'/') in name or len(p.parts)==1) and p.suffix in ['.png','.json','.pdf']:
   data=z.read(name);(out/p.name).write_bytes(data);count+=1;total+=len(data)
print(json.dumps({'run':run,'stage':stage,'files':count,'bytes':total}))
