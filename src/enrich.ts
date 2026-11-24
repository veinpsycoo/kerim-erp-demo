import { type State, type Listing, type Product } from './domain';
import { kerimProducts, kerimKits, normalize, suggestions, inferMultiplier, defaultPermissions } from './kerim';
import { real, snapshotKey } from './snapshot';
import { sourceComponents } from './source-recipes';
let prepared:{products:Product[];listings:Listing[]}|undefined;
export function enrich(s: State):State {
  s.version=2;s.threshold=82;s.readNotifications=[];
  s.snapshotKey=snapshotKey;
  s.products.push(...kerimProducts(),...sourceComponents());s.kits=kerimKits();
  const firstIndex=s.products.length;
  if(prepared){s.products.push(...structuredClone(prepared.products));s.listings=structuredClone(prepared.listings);}
  else {
  const groups=new Map<string,Product>();
  const source=real.products.some(p=>p.channel==='askerkolisi.com')?'askerkolisi.com':'cephetoptan.com';
  const own=new Map<string,{product:string;variant:number}>();
  for(const r of real.products.filter(p=>p.channel===source)) {
    const key=normalize(r.title);
    let p=groups.get(key);
    if(!p){p={id:'MRK-'+r.id.split(':')[1],name:r.title,category:/set/i.test(r.title)?'Gerçek set ilanı':'Gerçek katalog',price:r.price,buy:0,wholesale:r.price,image:r.image,source:r.url,imageSource:r.channel,variantSource:'Canlı API',variants:[]};groups.set(key,p);}
    const variant=p.variants.length;
    p.variants.push({size:r.variant||'Standart',color:'',stock:[120,120,60]});
    own.set(r.id,{product:p.id,variant});
  }
  s.products.push(...groups.values());
  s.listings=real.products.map(r=>({id:r.id,channel:r.channel,title:r.title,product:own.get(r.id)?.product||'',suggested:'',variant:own.get(r.id)?.variant??0,multiplier:inferMultiplier(r.title,r.variant),channelVariant:r.variant,sku:r.sku,image:r.image,imageHash:r.imageHash,price:r.price,stock:r.stock,real:true,reason:own.has(r.id)?'Kaynak katalogdan oluşturulan Merkez SKU; tekli birim ve çarpan onayı gerekli':''}));
  suggestions(s.listings,s.products);
  // Explicitly labelled teaching example; never counted as live channel inventory.
  s.listings.push(...[['askerkolisi.com',1],['cephetoptan.com',12],['Trendyol',3]].map(([channel,multiplier],i)=>({id:'ORNEK-VAT-'+i,channel:String(channel),title:`Bot Vatkası · ${multiplier}'li · öğretici örnek`,product:'VAT-001',suggested:'VAT-001',variant:0,multiplier:Number(multiplier),real:false,price:18*Number(multiplier)} satisfies Listing)));
  prepared={products:structuredClone(s.products.slice(firstIndex)),listings:structuredClone(s.listings)};
  }
  s.accounts[0].name='ABC Askeri Malzeme';s.entries[0].debit=85000;
  s.accounts[2].name='XYZ Tedarik';s.entries[2].debit=0;s.entries[2].credit=25000;
  s.staff.forEach(u=>{u.locations=[u.location];u.permissions=defaultPermissions(u.role);});
  s.staff.push({id:'P-005',name:'Beşiktaş Personeli',role:'Mağaza',location:2,locations:[2],permissions:['view','receipt','retail','transfer','count'],records:[]});
  s.orders[0]={...s.orders[0],id:'TOP-2026-00125',lines:[['FAN-HK',120,120,85,3],['DON-HK',120,100,65,3],['CRP-HK',240,240,30,3],['DFT-001',50,0,45,0]].map(([product,qty,picked,price,variant])=>({product:String(product),qty:Number(qty),picked:Number(picked),price:Number(price),variant:Number(variant),note:product==='DON-HK'?'Depoda 100 adet bulundu':product==='DFT-001'?'Raflarda bulunamadı':''}))};
  return s;
}
