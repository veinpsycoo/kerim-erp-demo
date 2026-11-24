"""Local perceptual dHash, no AI service. GET only, <= 2 requests/sec.
Cache contains hashes, not source response bodies or credentials.
"""
import argparse, hashlib, importlib.util, io, json, pathlib, re, time, urllib.request
from PIL import Image, ImageOps

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('sync',ROOT/'scripts'/'sync-gercek.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int,default=0);args=parser.parse_args()
    path=ROOT/'src'/'gercek.json';d=json.loads(path.read_text(encoding='utf-8'))
    secret=sync.SECRET.read_bytes().decode('utf-8',errors='replace')
    auth=re.findall(r'ck_[A-Za-z0-9]+',secret)[1]+':'+re.findall(r'cs_[A-Za-z0-9]+',secret)[1]
    recipes={}
    for page in range(1,20):
        try: rows=sync.get('https://askerkolisi.com/wp-json/wc/v3/products',{'search':'set','per_page':100,'page':page,'_fields':'id,name,description,short_description,permalink'},auth)
        except sync.SafeError as e: print('Reçete metni: '+str(e),flush=True);break
        for p in rows:
            text=re.sub('<[^>]+>',' ',p.get('description','')+' '+p.get('short_description',''))
            text=re.sub(r'\s+',' ',text).strip()
            # Public product description; contact data removed by clean before keeping each chunk.
            recipes[p['name']]=sync.clean(text,15000)
        if len(rows)<100:break
    for p in d['products']:
        if p['channel']=='askerkolisi.com' and p['title'] in recipes:p['recipeText']=recipes[p['title']]
    cachepath=ROOT/'.private'/'image-hashes.json';cachepath.parent.mkdir(exist_ok=True)
    cache=json.loads(cachepath.read_text()) if cachepath.exists() else {}
    urls=list(dict.fromkeys(p['image'] for p in d['products'] if p['image'].startswith('https://')))
    # Round-robin channels ensures useful cross-channel coverage even if interrupted.
    buckets=[list(dict.fromkeys(p['image'] for p in d['products'] if p['channel']==c and p['image'].startswith('https://'))) for c in ['askerkolisi.com','cephetoptan.com','Trendyol']]
    urls=list(dict.fromkeys(u for i in range(max(map(len,buckets))) for b in buckets for u in b[i:i+1]))
    if args.limit:urls=urls[:args.limit]
    last=time.monotonic();ok=0;failed=0
    for i,url in enumerate(urls):
        key=hashlib.sha256(url.encode()).hexdigest()
        if key not in cache:
            time.sleep(max(0,.56-(time.monotonic()-last)));last=time.monotonic()
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'KerimERP-ReadOnly/2.0'},method='GET')
                with sync.opener.open(req,timeout=8) as r:
                    data=r.read(8_000_001)
                if len(data)>8_000_000:raise ValueError('too large')
                image=ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('L').resize((9,8))
                px=list(image.getdata());bits=0
                for y in range(8):
                    for x in range(8):bits=(bits<<1)|int(px[y*9+x]>px[y*9+x+1])
                cache[key]=f'{bits:016x}';ok+=1
            except Exception:cache[key]='';failed+=1
        if (i+1)%100==0:
            cachepath.write_text(json.dumps(cache),encoding='utf-8');print(f'Görsel {i+1}/{len(urls)} · yeni hash {ok} · hata {failed}',flush=True)
    cachepath.write_text(json.dumps(cache),encoding='utf-8')
    for p in d['products']:p['imageHash']=cache.get(hashlib.sha256(p['image'].encode()).hexdigest(),'')
    current={hashlib.sha256(p['image'].encode()).hexdigest() for p in d['products'] if p['image'].startswith('https://')}
    d['imageAnalysis']={'algorithm':'dHash 64-bit, grayscale 9x8, local Pillow','uniqueImages':len(current),'hashedImages':sum(bool(cache.get(k)) for k in current),'listingsWithHash':sum(bool(p.get('imageHash')) for p in d['products']),'failedImages':sum(not cache.get(k) for k in current)}
    path.write_text(json.dumps(sync.compact_snapshot(d),ensure_ascii=False,indent=2),encoding='utf-8')
    print(d['imageAnalysis'],flush=True)
if __name__=='__main__':main()
