"""Read-only ikas adapter. Only token exchange and explicit GraphQL queries allowed."""
import json, re, urllib.parse, urllib.request, pathlib, importlib.util, datetime as dt, hashlib

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('sync',ROOT/'scripts/sync-gercek.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)

def post(url, body, token=None):
    if token:
        if url!='https://api.myikas.com/api/v1/admin/graphql' or not body.get('query','').lstrip().startswith('query ') or re.search(r'\bmutation\b',body['query'],re.I):
            raise ValueError('Only explicit read queries allowed')
        data=json.dumps(body).encode();headers={'Content-Type':'application/json','Authorization':'Bearer '+token}
    else:
        if url!='https://askermarketi.myikas.com/api/admin/oauth/token' or body.get('grant_type')!='client_credentials':raise ValueError('Invalid token endpoint')
        data=urllib.parse.urlencode(body).encode();headers={'Content-Type':'application/x-www-form-urlencoded'}
    headers['User-Agent']='Mozilla/5.0'
    req=urllib.request.Request(url,data=data,headers=headers,method='POST')
    with sync.opener.open(req,timeout=60) as r:result=json.load(r)
    if result.get('errors'):raise RuntimeError(json.dumps(result['errors'])[:1800])
    return result

def authenticate():
    s=sync.SECRET.read_text(encoding='utf-8',errors='replace')
    section=s.split('ikas - askermarketi.com',1)[1].split('trendyol',1)[0]
    values=[x.strip() for x in section.splitlines() if x.strip()]
    return post('https://askermarketi.myikas.com/api/admin/oauth/token',{'grant_type':'client_credentials','client_id':values[0],'client_secret':values[1]})['access_token']

def collect(out):
    token=authenticate();channel='askermarketi.com (ikas)'
    def query(q):return post('https://api.myikas.com/api/v1/admin/graphql',{'query':q},token)['data']
    values={}
    types=query('query VariantNames { listVariantType { id name values { id name } } }')['listVariantType']
    for t in types:
        for v in t['values']:values[v['id']]=v['name']
    page=1;product_count=0;stock_count=0
    while True:
        result=query('query Products { listProduct(pagination:{page:'+str(page)+',limit:100}) { count hasNext data { id name metaData { slug } variants { id sku deleted isActive variantValueIds { variantTypeId variantValueId } prices { sellPrice } stocks { stockCount } } } } }')['listProduct']
        for p in result['data']:
            product_count+=1
            for v in p['variants']:
                if v.get('deleted'):continue
                stocks=v.get('stocks') or [];stock=sum(sync.number(x.get('stockCount')) for x in stocks) if stocks else None
                stock_count+=stock is not None
                out['products'].append({'id':channel+':'+v['id'],'channel':channel,'title':sync.clean(p['name']),'sku':sync.sku(v.get('sku')),'variant':' / '.join(sync.clean(values.get(x['variantValueId'],'Varyant bilgisi yok')) for x in v.get('variantValueIds') or []),'price':sync.number((v.get('prices') or [{}])[0].get('sellPrice')),'stock':stock,'image':'','url':'https://askermarketi.com/'+((p.get('metaData') or {}).get('slug') or '')})
        if not result['hasNext']:break
        page+=1
    end=dt.datetime.now(dt.timezone.utc);start=end-dt.timedelta(days=30);page=1
    while True:
        result=query('query Orders { listOrder(orderedAt:{gte:'+str(int(start.timestamp()*1000))+',lte:'+str(int(end.timestamp()*1000))+'},pagination:{page:'+str(page)+',limit:100}) { count hasNext data { id orderedAt status orderLineItems { quantity variant { id productId name sku } } } } }')['listOrder']
        for o in result['data']:
            out['orders'].append({'id':hashlib.sha256((channel+o['id']).encode()).hexdigest()[:16],'channel':channel,'date':dt.datetime.fromtimestamp(float(o['orderedAt'])/1000,dt.timezone.utc).isoformat(),'status':sync.clean(o['status']),'lines':[{'product':channel+':'+l['variant']['id'],'title':sync.clean(l['variant']['name']),'sku':sync.sku(l['variant'].get('sku')),'qty':sync.number(l['quantity'])} for l in o.get('orderLineItems') or []]})
        if not result['hasNext']:break
        page+=1
    return {'sourceProducts':product_count,'variantsWithStock':stock_count,'windowStart':start.isoformat(),'windowEnd':end.isoformat()}

if __name__=='__main__':
    import sys
    token=authenticate()
    if '--schema' in sys.argv:
        query='query Inspect { __schema { queryType { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name } } } } types { name kind inputFields { name type { kind name ofType { kind name ofType { kind name } } } } fields { name type { kind name ofType { kind name ofType { kind name } } } } } } }'
        result=post('https://api.myikas.com/api/v1/admin/graphql',{'query':query},token)
        (ROOT/'.private/ikas-schema.json').write_text(json.dumps(result),encoding='utf-8')
        print('Read-only schema saved privately')
    else:
        out={'products':[],'orders':[]};metrics=collect(out)
        path=ROOT/'src/gercek.json';result=json.loads(path.read_text(encoding='utf-8'));channel='askermarketi.com (ikas)'
        for kind in ['products','orders']:result[kind]=[x for x in result[kind] if x['channel']!=channel]+out[kind]
        result['channels']=[x for x in result['channels'] if x['name']!=channel]+[{'name':channel,'status':'bağlı · salt okuma','error':'','products':len(out['products']),'orders':len(out['orders']),**metrics}]
        result['syncedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
        path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'products':len(out['products']),'orders':len(out['orders']),**metrics}))
