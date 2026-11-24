import requests, json, re, time, pathlib, xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parent.parent
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','i':'http://www.google.com/schemas/sitemap-image/1.1'}
entries=ET.parse(root/'products-sitemap.xml').getroot()
items=[(e.find('s:loc',ns).text,e.find('i:image/i:loc',ns).text if e.find('i:image/i:loc',ns) is not None else '') for e in entries]
nonsets=[x for x in items if not any(w in x[0] for w in ['seti','kolisi','paketi'])]
priority=[]
for term in ['havlu','fanila','corap','boxer','kilit','terlik','tras','sabun','dis-firca','tirnak','camasir','iclik','bot','bere','kemer','tisort','pantolon','boyun','eldiven','cantasi']:
    priority.extend([x for x in nonsets if term in x[0]][:3])
selection=list(dict.fromkeys(priority+[nonsets[int(i*(len(nonsets)-1)/155)] for i in range(156)]+items))
session=requests.Session(); products=json.loads((root/'src/catalog.json').read_text(encoding='utf8')) if (root/'src/catalog.json').exists() else []; products=[p for p in products if p['image']]; errors=[]
(root/'public/products').mkdir(exist_ok=True)
for url,image in selection:
    if len(products)>=164: break
    if any(p['source']==url for p in products): continue
    if not image: continue
    try:
        time.sleep(1.05)
        r=session.get(url.replace('https://askermarketi','https://www.askermarketi'),timeout=25); r.raise_for_status()
        s=r.content.decode('utf-8')
        raw=re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',s,re.S)
        p=json.loads(raw[1])['props']['pageProps']['pageSpecificData']
        if not p.get('variants') or not p.get('name'): continue
        v=p['variants'][0]; pr=v['prices'][0]; price=pr.get('discountPrice') or pr['sellPrice']
        if not price: continue
        types={t['variantType']['id']:t['variantType']['name'] for t in p['variantTypes']}
        variants=[]
        for vi in p['variants']:
            vals=vi.get('variantValues',[])
            size=next((q['name'] for q in vals if any(w in types.get(q['variantTypeId'],'').lower() for w in ['beden','numara'])),'Standart')
            color=next((q['name'] for q in vals if 'renk' in types.get(q['variantTypeId'],'').lower()),'Tek renk')
            if (size,color) not in [(x['size'],x['color']) for x in variants]: variants.append({'size':size,'color':color})
        n=max([int(p['id'].split('-')[1]) for p in products],default=0)+1
        local=''
        if image:
            time.sleep(1.05)
            try:
                small=image.replace('image_1080','image_360').replace('/1080/','/360/')
                ir=session.get(small,timeout=20)
                if ir.status_code!=200: ir=session.get(image,timeout=20)
                ir.raise_for_status(); (root/f'public/products/{n}.webp').write_bytes(ir.content); local=f'products/{n}.webp'
            except Exception as ex: errors.append({'image':image,'error':str(ex)})
        products.append({'id':f'AM-{n:04d}','name':p['name'],'category':p['categories'][-1]['name'] if p['categories'] else 'Askeri Malzeme','price':price,'image':local or image,'imageSource':image,'source':url,'variants':variants or [{'size':'Standart','color':'Tek renk'}],'variantSource':'Sayfadan' if p['variantTypes'] else 'Standart ürün','collectedAt':time.strftime('%Y-%m-%dT%H:%M:%S')})
        (root/'src/catalog.json').write_text(json.dumps(products,ensure_ascii=False),encoding='utf-8')
        if n%20==0: print(f'{n} products collected',flush=True)
    except Exception as ex:
        errors.append({'url':url,'error':str(ex)})
(root/'scripts/collection-log.json').write_text(json.dumps({'count':len(products),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Done: {len(products)} products / {len(errors)} issues',flush=True)
