import { addOrder, now, positive, totalStock, uid, type State, type Product, type Listing, type Staff } from './domain';

export const PERMISSIONS = ['view','receipt','cost','transfer','retail','order','prepare','ledger','report','staff','count'];
export const PERMISSION_NAMES = ['Stok görüntüleme','Mal kabul','Maliyet değiştirme','Sevkiyat / talep','Günlük satış','Toptan sipariş','Sipariş hazırlama','Cari hesap','Finansal rapor','Personel yönetimi','Stok sayımı'];
export function defaultPermissions(role:string) {return role==='Yönetici'?[...PERMISSIONS]:role==='Depo'?['view','receipt','cost','transfer','prepare','order','count']:role==='Mağaza'?['view','receipt','retail','transfer','count']:['ledger','report'];}
export function authorize(u: Staff, permission: string, loc: number) {
  if (u.role === 'Yönetici') return;
  if (!u.permissions?.includes(permission) || !(u.locations || [u.location]).includes(loc)) throw Error('Bu işlem veya lokasyon için yetkiniz yok.');
}
export const FIXED: [string,string,number,number][] = [
  ['BOYA-SY','Siyah Bot Boyası',32,1],['BOYA-HK','Haki Bot Boyası',32,1],['SNG-001','Bot Parlatıcı Sünger',15,1],['PUD-001','Ayak ve Pişik Pudrası',25,1],['VAT-001','Bot Vatkası',18,1],['BOT-KLT','Bot Kilidi',29,1],['CUZ-001','İpli Asker Cüzdanı',38,1],['PEC-010','10’lu Peçete',12,2],['KLT-001','Dolap / Valiz Kilidi',27,1],['DKS-001','Dikiş Seti',17,1],['TRC-001','Tıraş Çantası',34,1],['JLT-001','Banyo Jileti',16,1],['SAB-001','Sabun Kutusu',14,1],['ASK-001','Metal Dolap Askısı',10,2],['TCT-001','Temiz Çamaşır Torbası',22,1],['KCT-001','Kirli Çamaşır Torbası',22,1],
];
const sizes=['S','M','L','XL','2XL','3XL'];
export function kerimProducts(): Product[] {
  return [
    {id:'FAN-HK',name:'Haki Asker Fanila / Tişört',cost:100,category:'Giyim',sizes,stock:[800,420,80]},
    {id:'DON-HK',name:'Haki Asker Don / Boxer',cost:70,category:'Giyim',sizes,stock:[650,300,65]},
    {id:'CRP-HK',name:'Haki Asker Çorabı',cost:23,category:'Çorap',sizes:['36–37','38–39','40–41','42–43','44–45','46–47'],stock:[1800,950,180]},
    {id:'TAB-TEK',name:'Kesilebilir Tabanlık',cost:45,category:'Aksesuar',sizes:['Tek tip'],stock:[200,110,15]},
    ...[...FIXED,['DFT-001','Asker Hatıra Defteri',25,1] as [string,string,number,number]].map(([id,name,cost])=>({id,name,cost,category:'Asker Malzemeleri',sizes:['Standart'],stock:[850,360,100]})),
  ].map(p=>({id:p.id,name:p.name,category:p.category,price:p.cost*1.5,buy:p.cost,wholesale:p.cost,image:'',source:'Kerim KORDAK · örnek reçete ve lokasyon stoğu',imageSource:'Simgesel',variantSource:'Kerim KORDAK',variants:p.sizes.map(size=>({size,color:'Haki',stock:[...p.stock]}))}));
}
export function kerimKits() {
  const suffix:Record<number,string>={3:'lü',6:'lı',9:'lu',12:'li',18:'li',24:'lü',30:'lu'};
  return [3,6,9,12,18,24,30].map(n=>({id:`TEMEL-${n}`,name:`Temel Asker Seti · ${n}'${suffix[n]}`,clothingCount:n,price:n*193+FIXED.reduce((a,x)=>a+x[2]*x[3],0)+45,source:'Kerim’in Temel Asker Seti reçetesi',recipe:[...['FAN-HK','DON-HK','CRP-HK'].map(product=>({product,qty:1,mode:'clothing' as const})),{product:'TAB-TEK',qty:1,mode:'fixed' as const},...FIXED.map(([product,,,qty])=>({product,qty,mode:'fixed' as const}))]}));
}
export function listingStock(s: State,l: Listing,loc=1) {
  const p=s.products.find(p=>p.id===l.product);
  const m=l.multiplier??1; positive(m);
  return p ? Math.floor((p.variants[l.variant??0]?.stock[loc]??0)/m) : 0;
}
export function listingOrder(s:State,id:string,qty:number,loc=1) {
  positive(qty);
  const l=s.listings.find(l=>l.id===id);
  if(!l?.product) throw Error('Önce ilanı Merkez SKU’ya bağlayın.');
  if(l.real&&!l.confirmed)throw Error('Önce gerçek ilanın SKU, varyant ve paket çarpanını onaylayın.');
  if(l.rejected) throw Error('Reddedilmiş ilan için eşleşme onayı gerekli.');
  const p=s.products.find(p=>p.id===l.product)!;
  positive(l.multiplier??1);
  addOrder(s,{id:uid('KANAL'),channel:l.channel,customer:'Anonim demo',location:loc,created:now(),status:'Toplanacak',assignee:'',wholesale:false,posted:false,lines:[{listingId:id,product:p.id,variant:l.variant??0,qty,picked:qty,price:l.price||p.price*(l.multiplier??1),multiplier:l.multiplier??1}]});
}
export const normalize=(v:string)=>v.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
export function inferMultiplier(title:string,variant='') {
  const text=title.toLocaleLowerCase('tr');
  if(/(?:^|\s)set(?:i|leri|ler)?\b/.test(normalize(text)))return 1;
  const m=(text+' '+variant.toLocaleLowerCase('tr')).match(/(?:^|[\s(])(\d{1,4})\s*(?:['’]?l[ıiuü]|adet|çift)(?:\b|[)\s,])/u);
  return m?Math.max(1,Number(m[1])):1;
}
export function textScore(a:string,b:string) {
  const x=new Set(normalize(a).split(' '));const y=new Set(normalize(b).split(' '));
  return Math.round(100*[...x].filter(t=>y.has(t)).length/Math.max(x.size,y.size,1));
}
export function hashScore(a:string,b:string) {
  if(a.length!==b.length||!a.length)return 0;
  let bits=0;for(let i=0;i<a.length;i++)bits+=(parseInt(a[i],16)^parseInt(b[i],16)).toString(2).replace(/0/g,'').length;
  return Math.round(100*(1-bits/(a.length*4)));
}
export function suggestions(listings:Listing[],products:Product[]) {
  const refs=new Map(products.map(p=>[p.id,p]));
  const exact=new Map<string,Listing[]>();
  for(const l of listings) if(l.product&&l.sku) {const key=normalize(l.sku);exact.set(key,[...(exact.get(key)||[]),l]);}
  const candidates=listings.filter(l=>l.product);
  const words=(v:string)=>new Set(normalize(v).split(' ').filter(Boolean));
  const overlap=(a:Set<string>,b:Set<string>)=>Math.round(100*[...a].filter(t=>b.has(t)).length/Math.max(a.size,b.size,1));
  const groups=new Map<string,{words:Set<string>;rows:Listing[]}>();
  const variantWords=new Map<Listing,Set<string>>();
  for(const c of candidates){const key=c.product;const g=groups.get(key)||{words:words(c.title),rows:[]};g.rows.push(c);groups.set(key,g);variantWords.set(c,words(c.channelVariant||''));}
  const cache=new Map<string,{group:{words:Set<string>;rows:Listing[]};title:number}[]>();
  for(const l of listings) {
    if(l.product||l.rejected)continue;
    const same=l.sku?exact.get(normalize(l.sku))?.find(c=>normalize(c.channelVariant||'')===normalize(l.channelVariant||'')):undefined;
    if(same&&same.channel!==l.channel){l.suggested=same.product;l.variant=same.variant;l.score=99;l.reason='SKU birebir; paket çarpanı ayrıca kontrol edilmeli';continue;}
    let best=0;let target='';let variant=0;let reason='';
    const key=normalize(l.title);let top=cache.get(key);
    if(!top){const w=words(l.title);top=[...groups.values()].map(group=>({group,title:overlap(w,group.words)})).filter(x=>x.title>0).sort((a,b)=>b.title-a.title).slice(0,3);cache.set(key,top);}
    const vw=words(l.channelVariant||'');
    for(const {group,title} of top)for(const c of group.rows) {
      if(c.channel===l.channel||!refs.has(c.product))continue;
      const v=l.channelVariant&&c.channelVariant?overlap(vw,variantWords.get(c)!):(!l.channelVariant&&!c.channelVariant?100:0);
      const image=l.imageHash&&c.imageHash?hashScore(l.imageHash,c.imageHash):undefined;
      let score=Math.round(image===undefined?title*.85+v*.15:title*.6+v*.15+image*.25);
      if(l.channelVariant&&c.channelVariant&&v<45) score=Math.min(score,75);
      if(score>best){best=score;target=c.product;variant=c.variant??0;reason=`Başlık %${title} · varyant %${v} · görsel ${image===undefined?'hesaplanamadı':'%'+image}`;}
    }
    l.suggested=target;l.score=best;l.variant=variant;l.reason=reason;
  }
}
export const centralStock = (s:State,id:string)=>{const p=s.products.find(p=>p.id===id);return p?totalStock(p):0;};
