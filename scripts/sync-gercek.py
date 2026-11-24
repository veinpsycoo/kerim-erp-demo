"""Read-only snapshot. GET for Woo/Trendyol, token POST and query POST for ikas.
Run manually; never run in public CI. Orders use an explicit anonymous allowlist.
"""
import argparse, base64, datetime as dt, hashlib, json, pathlib, re, time, urllib.request, urllib.parse, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
SECRET = pathlib.Path('C:/Users/pc5/.config/kerim-erp/SECRETS-kerim-api-1124.txt')
last = 0.0
class SafeError(Exception): pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise SafeError('Yönlendirme güvenlik nedeniyle izlenmedi')
opener = urllib.request.build_opener(NoRedirect)
def get(url, params=None, auth=None):
    global last
    time.sleep(max(0, .56 - (time.monotonic()-last)))
    headers={'User-Agent':'KerimERP-ReadOnly/2.0','Accept':'application/json'}
    if auth: headers['Authorization']='Basic '+base64.b64encode(auth.encode()).decode()
    req=urllib.request.Request(url+('?' + urllib.parse.urlencode(params) if params else ''),headers=headers,method='GET')
    last=time.monotonic()
    try:
        with opener.open(req,timeout=35) as r: return json.load(r)
    except urllib.error.HTTPError as e: raise SafeError('HTTP '+str(e.code)) from None
    except Exception: raise SafeError('Bağlantı veya JSON okuma hatası') from None
def clean(v,limit=350):
    # Catalog text is public; remove contact-like content defensively.
    return re.sub(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|\+?\d[\d ()-]{9,}\d','[maskeli]',str(v or ''))[:limit]
def number(v):
    try: return float(v or 0)
    except (TypeError,ValueError): return 0
def sku(v):
    # A numeric merchant SKU/barcode is a product identifier, not a phone field.
    return re.sub(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}','[maskeli]',str(v or ''))[:200]
def woo(channel,auth,out):
    base='https://'+channel+'/wp-json/wc/v3/'
    for page in range(1,1001):
        data=get(base+'products',{'per_page':100,'page':page,'_fields':'id,name,sku,type,price,stock_quantity,images,attributes,variations,permalink,description,short_description'},auth)
        if not isinstance(data,list): raise SafeError('Beklenmeyen ürün yanıtı')
        for p in data:
            variants=[]
            if p.get('variations'):
                for vp in range(1,101):
                    vs=get(base+f'products/{p["id"]}/variations',{'per_page':100,'page':vp,'_fields':'id,sku,price,stock_quantity,attributes,image'},auth)
                    variants.extend(vs)
                    if len(vs)<100: break
            for v in variants or [p]:
                attrs=' / '.join(clean(a.get('option') or ', '.join(a.get('options',[]))) for a in v.get('attributes',[]))
                images=p.get('images',[]); image=(v.get('image') or (images[0] if images else {})).get('src','')
                out['products'].append({'id':f'{channel}:{v["id"]}','channel':channel,'title':clean(p.get('name')),'sku':sku(v.get('sku')),'variant':attrs,'price':number(v.get('price')),'stock':v.get('stock_quantity'),'image':image,'url':p.get('permalink',''),'recipeText':clean(re.sub('<[^>]+>',' ',p.get('description','')+' '+p.get('short_description','')),15000) if 'set' in p.get('name','').lower() else ''})
        print(channel+' ürün sayfası '+str(page)+' · '+str(len(out['products'])),flush=True)
        if len(data)<100: break
    after=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%S')
    for page in range(1,1001):
        data=get(base+'orders',{'per_page':100,'page':page,'after':after,'_fields':'id,date_created,total,status,line_items.product_id,line_items.variation_id,line_items.quantity,line_items.total,line_items.name,line_items.sku'},auth)
        for o in data:
            out['orders'].append({'id':hashlib.sha256((channel+str(o['id'])).encode()).hexdigest()[:16],'channel':channel,'date':o['date_created'],'total':number(o['total']),'status':clean(o.get('status')),'lines':[{'product':f'{channel}:{l.get("variation_id") or l["product_id"]}','title':clean(l.get('name')),'sku':sku(l.get('sku')),'qty':number(l['quantity']),'total':number(l['total'])} for l in o.get('line_items',[])]})
        if len(data)<100: break
def trendyol(s,out,orders_only=False,products_only=False):
    section=s.split('trendyol',1)[1].split('askerkolisi.com',1)[0]
    values=[x.split(':',1)[1].strip() for x in section.splitlines() if ':' in x]
    seller,key,secret=values[:3]; auth=key+':'+secret
    base='https://apigw.trendyol.com/integration/'
    for page in range(0 if orders_only else 1000):
        data=get(base+f'product/sellers/{seller}/products/approved',{'page':page,'size':100},auth)
        rows=data.get('content',[])
        for p in rows:
            images=p.get('images',[])
            for v in p.get('variants') or [p]:
                attrs=p.get('attributes',[])+v.get('attributes',[])
                attrs=[a for a in attrs if re.search('beden|renk|numara|boyut|paket|adet',a.get('attributeName',''),re.I)]
                barcode=v.get('barcode') or v.get('variantId') or p.get('contentId')
                if not barcode:raise SafeError('Ürün kimliği bulunamadı')
                out['products'].append({'id':'Trendyol:'+str(barcode),'channel':'Trendyol','title':clean(p.get('title')),'sku':sku(v.get('stockCode') or p.get('stockCode')),'variant':' / '.join(clean(a.get('attributeValue')) for a in attrs),'price':number((v.get('price') or {}).get('salePrice',v.get('salePrice'))),'stock':(v.get('stock') or {}).get('quantity',v.get('quantity')),'image':images[0].get('url','') if images else '','url':v.get('productUrl') or p.get('productUrl','')})
        if page+1>=data.get('totalPages',1): break
    if products_only:return
    end=dt.datetime.now(dt.timezone.utc)
    for week in range(5):
        start=max(end-dt.timedelta(days=7),dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=30))
        for page in range(1000):
            data=get(base+f'order/sellers/{seller}/v2/orders',{'page':page,'size':100,'startDate':int(start.timestamp()*1000),'endDate':int(end.timestamp()*1000)},auth)
            for o in data.get('content',[]):
                out['orders'].append({'id':hashlib.sha256(('Trendyol:'+str(o.get('orderNumber') or o.get('id'))).encode()).hexdigest()[:16],'channel':'Trendyol','date':dt.datetime.fromtimestamp(o['orderDate']/1000,dt.timezone.utc).isoformat(),'total':number(o.get('totalPrice')),'status':clean(o.get('status')),'lines':[{'product':'Trendyol:'+str(l.get('barcode')),'title':clean(l.get('productName')),'sku':sku(l.get('merchantSku')),'qty':number(l.get('quantity')),'total':number(l.get('amount'))} for l in o.get('lines',[])]})
            if page+1>=data.get('totalPages',1): break
        end=start-dt.timedelta(milliseconds=1)
def group_orders(rows):
    groups={}
    for o in rows:
        if o['id'] not in groups:groups[o['id']]=o
        else:
            row=groups[o['id']]
            if 'total' in row and 'total' in o:row['total']+=o['total']
            row['lines'].extend(o['lines'])
            if row['status']!=o['status']:row['status']='Kısmi / farklı paket durumları'
    return list(groups.values())
def public_product_url(value):
    parts=urllib.parse.urlsplit(value or '')
    query=urllib.parse.parse_qsl(parts.query,keep_blank_values=True)
    public=[(key,val) for key,val in query if key.lower() not in {'merchantid','sellerid'}]
    if len(public)==len(query):return value
    return urllib.parse.urlunsplit((parts.scheme,parts.netloc,parts.path,urllib.parse.urlencode(public),parts.fragment))

def compact_snapshot(result):
    # Public Pages snapshots must never contain transaction amounts.
    for order in result['orders']:
        order.pop('total',None)
        for line in order['lines']:line.pop('total',None)
    texts=result.get('recipeTexts',{})
    previous_path=ROOT/'src/gercek.json'
    previous=json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {}
    hashes={p['image']:p.get('imageHash') for p in previous.get('products',[]) if p.get('imageHash')}
    for p in result['products']:
        if p.get('url'):p['url']=public_product_url(p['url'])
        if not p.get('imageHash') and p['image'] in hashes:p['imageHash']=hashes[p['image']]
        text=p.pop('recipeText',None)
        if text:
            key=p['channel']+':'+p['title']
            # A truncated listing preview must not replace a full source recipe.
            prior=previous.get('recipeTexts',{}).get(key,'')
            texts[key]=prior if len(text)>=350 and len(text)<=351 and len(prior)>len(text) else text
    result['recipeTexts']=texts
    if previous.get('imageAnalysis'):result['imageAnalysis']=previous['imageAnalysis']
    return result
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--orders-only-trendyol',action='store_true');parser.add_argument('--refresh-trendyol',action='store_true');args=parser.parse_args()
    s=SECRET.read_bytes().decode('utf-8',errors='replace')
    if args.orders_only_trendyol or args.refresh_trendyol:
        path=ROOT/'src'/'gercek.json';result=json.loads(path.read_text(encoding='utf-8'));out={'products':[],'orders':[]}
        trendyol(s,out,orders_only=not args.refresh_trendyol);package_count=len(out['orders']);orders=group_orders(out['orders'])
        if args.refresh_trendyol:
            hashes={p['image']:p.get('imageHash','') for p in result['products']}
            for p in out['products']:p['imageHash']=hashes.get(p['image'],'')
            result['products']=[p for p in result['products'] if p['channel']!='Trendyol']+out['products']
        result['orders']=[o for o in result['orders'] if o['channel']!='Trendyol']+orders
        for c in result['channels']:
            if c['name']=='Trendyol':
                c['orders']=len(orders);c['packages']=package_count
                if args.refresh_trendyol:c['products']=len(out['products'])
        result['syncedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
        path.write_text(json.dumps(compact_snapshot(result),ensure_ascii=False,indent=2),encoding='utf-8')
        print('Trendyol: '+str(len(out['products']))+' ürün/varyant / '+str(package_count)+' paket / '+str(len(orders))+' benzersiz sipariş',flush=True)
        return
    keys=re.findall(r'ck_[a-zA-Z0-9]+',s); secrets=re.findall(r'cs_[a-zA-Z0-9]+',s)
    result={'syncedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'windowDays':30,'channels':[],'products':[],'orders':[]}
    import importlib.util
    ikas_spec=importlib.util.spec_from_file_location('ikas_read',ROOT/'scripts/ikas-read.py')
    ikas=importlib.util.module_from_spec(ikas_spec);ikas_spec.loader.exec_module(ikas)
    for name,fn in [('cephetoptan.com',lambda o:woo('cephetoptan.com',keys[0]+':'+secrets[0],o)),('askerkolisi.com',lambda o:woo('askerkolisi.com',keys[1]+':'+secrets[1],o)),('Trendyol',lambda o:trendyol(s,o)),('askermarketi.com (ikas)',lambda o:ikas.collect(o)),('N11',None)]:
        out={'products':[],'orders':[]}; status='bağlı · salt okuma'; error='';metrics={}
        try:
            if fn:
                value=fn(out)
                if isinstance(value,dict):metrics=value
            else:
                status='bağlanmayı bekliyor'
                error='Anahtar verilmedi'
        except SafeError as e: status='kısmi · salt okuma' if out['products'] else 'bağlantı hatası'; error=str(e)
        # Unique anonymous orders across time windows.
        out['orders']=group_orders(out['orders'])
        result['products'].extend(out['products']);result['orders'].extend(out['orders'])
        result['channels'].append({'name':name,'status':status,'error':error,'products':len(out['products']),'orders':len(out['orders']),**metrics})
        print(name+' · '+status+' · ürün '+str(len(out['products']))+' · sipariş '+str(len(out['orders']))+' · '+error,flush=True)
    # Exact secret leak guard before writing any snapshot.
    result['syncedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
    serialized=json.dumps(compact_snapshot(result),ensure_ascii=False,indent=2)
    opaque=[x.strip().split(':',1)[-1].strip() for x in s.splitlines() if len(x.strip())>=20]
    if any(x in serialized for x in opaque if len(x)>16): raise SafeError('Gizli değer kontrolü başarısız; dosya yazılmadı')
    (ROOT/'src'/'gercek.json').write_text(serialized,encoding='utf-8')
if __name__=='__main__':
    try: main()
    except Exception as e:
        print('Senkron durdu: '+(str(e) if isinstance(e,SafeError) else type(e).__name__))
        raise SystemExit(1)
