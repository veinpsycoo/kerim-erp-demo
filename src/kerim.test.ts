import { describe,it,expect } from 'vitest';
import { seed } from './seed';
import { kitLines, reverseOrder, stockChange, transferStep } from './domain';
import { authorize, listingOrder, listingStock, suggestions, inferMultiplier } from './kerim';
import { real } from './snapshot';
import { sourceSets, sourceDraft } from './source-recipes';
describe('Kerim öncelikleri',()=>{
 it('paket başlığı çarpan önerir, Temel setin giyim N değerini paket çarpanı yapmaz',()=>{expect(inferMultiplier("Bot Vatkası (12'li)")).toBe(12);expect(inferMultiplier('Bot Vatkası (20 Çift)')).toBe(20);expect(inferMultiplier("12'li Temel Asker Seti")).toBe(1);});
 it('Askerkolisi kışlık denizci kaynak reçetesi N giyim ve sabit kışlık aksesuarları ayırır',()=>{const source=sourceSets.find(p=>p.title.startsWith("6'lı Kışlık Denizci")&&p.recipeText);expect(source).toBeDefined();const draft=sourceDraft(source!),s=seed(),lines=kitLines(s,{...draft,id:'SOURCE-TEST'},'XL',1,'44–45');expect(draft.clothingCount).toBe(6);expect(draft.source).toMatch(/^https:\/\/askerkolisi.com\//);expect(lines.find(l=>l.product==='SRC-FAN-DEN')!.qty).toBe(6);expect(lines.find(l=>l.product==='SRC-TERMAL')!.qty).toBe(1);expect(lines.find(l=>l.product==='TAB-TEK')!.qty).toBe(1);expect(draft.recipe.length).toBeGreaterThan(20);});
 it('Trendyol V2 varyant fiyatı, stok ve SKU alanları gerçekten okunmuştur',()=>{const rows=real.products.filter(p=>p.channel==='Trendyol');if(rows.length){expect(rows.some(p=>p.price>0)).toBe(true);expect(rows.some(p=>p.stock!==null)).toBe(true);expect(rows.some(p=>p.sku)).toBe(true);}});
 it('kısmi mağaza sevkiyatında talep, sevk ve teslim ayrı tutulur',()=>{const s=seed(),t=s.transfers[0],p=s.products.find(p=>p.id===t.lines[0].product)!,from=p.variants[0].stock[t.from],to=p.variants[0].stock[t.to];transferStep(s,t.id,'send',[3]);expect(p.variants[0].stock[t.from]).toBe(from-3);transferStep(s,t.id,'receive',[2]);expect(p.variants[0].stock[t.to]).toBe(to+2);expect(t.lines[0].qty).toBe(4);expect(t.lines[0].shipped).toBe(3);expect(t.lines[0].received).toBe(2);expect(s.logs.some(l=>l.message.includes('eksik teslim'))).toBe(true);expect(()=>transferStep(s,t.id,'receive',[2])).toThrow();});
 it('1/12/3 paket çarpanı tekli stok düşer, aşağı yuvarlanır, iade geri koyar',()=>{
  const s=seed();const p=s.products.find(p=>p.id==='VAT-001')!;p.variants[0].stock[1]=101;
  for(const [i,m] of [1,12,3].entries()){
   const l=s.listings.find(l=>l.id==='ORNEK-VAT-'+i)!;const before=p.variants[0].stock[1];
   expect(listingStock(s,l)).toBe(Math.floor(before/m));listingOrder(s,l.id,2);
   expect(p.variants[0].stock[1]).toBe(before-2*m);reverseOrder(s,s.orders[0].id,'İade');expect(p.variants[0].stock[1]).toBe(before);
  }
 });
 it('12 ve 24 giyim N kadar, peçete 2, tabanlık 1, jilet 6 sabit kalır',()=>{
  for(const n of [12,24]){const s=seed(),k=s.kits.find(k=>k.clothingCount===n)!;k.recipe.find(r=>r.product==='JLT-001')!.qty=6;
   const lines=kitLines(s,k,'XL',1,'44–45');
   for(const id of ['FAN-HK','DON-HK','CRP-HK'])expect(lines.find(l=>l.product===id)!.qty).toBe(n);
   expect(lines.find(l=>l.product==='TAB-TEK')!.qty).toBe(1);expect(lines.find(l=>l.product==='PEC-010')!.qty).toBe(2);expect(lines.find(l=>l.product==='JLT-001')!.qty).toBe(6);
   const sock=lines.find(l=>l.product==='CRP-HK')!;expect(s.products.find(p=>p.id===sock.product)!.variants[sock.variant].size).toBe('44–45');
   expect(()=>kitLines(s,k,'8XL',1)).toThrow();
  }
 });
 it('stok yetersizliği ve geçersiz çarpan atomik reddedilir',()=>{const s=seed(),p=s.products.find(p=>p.id==='VAT-001')!,l=s.listings.find(l=>l.id==='ORNEK-VAT-1')!;p.variants[0].stock[1]=11;expect(()=>listingOrder(s,l.id,1)).toThrow();expect(p.variants[0].stock[1]).toBe(11);l.multiplier=0;expect(()=>listingOrder(s,l.id,1)).toThrow();expect(s.orders).toHaveLength(3);});
 it('lokasyon ve işlem izni birlikte zorunludur',()=>{const s=seed(),u=s.staff.find(u=>u.id==='P-003')!;expect(()=>authorize(u,'retail',1)).not.toThrow();expect(()=>authorize(u,'retail',2)).toThrow();expect(()=>authorize(u,'cost',1)).toThrow();u.permissions=[];expect(()=>authorize(u,'retail',1)).toThrow();});
 it('reçete çıkışı tüm satırlar kontrol edilmeden stok değiştirmez',()=>{const s=seed(),lines=kitLines(s,s.kits[0],'M',1);const first=s.products.find(p=>p.id===lines[0].product)!.variants[lines[0].variant];const last=lines.at(-1)!;s.products.find(p=>p.id===last.product)!.variants[last.variant].stock[0]=0;const before=first.stock[0];expect(()=>stockChange(s,lines,0,-1)).toThrow();expect(first.stock[0]).toBe(before);});
 it('aynı SKU farklı varyantı otomatik tam eşleştirmez, reddedilen öneriyi korur',()=>{const s=seed();const listings=[{id:'a',channel:'a',title:'Bot',product:s.products[0].id,suggested:'',sku:'A',channelVariant:'XL'},{id:'b',channel:'b',title:'Bot',product:'',suggested:'',sku:'A',channelVariant:'S',score:0},{id:'c',channel:'b',title:'Bot',product:'',suggested:'',rejected:true}];suggestions(listings,s.products);expect(listings[1].score).toBeLessThan(82);expect(listings[2].suggested).toBe('');});
 it('snapshot kimlikleri benzersiz, sipariş alanları anonim ve kanal adetleri tutarlıdır',()=>{expect(new Set(real.products.map(p=>p.id)).size).toBe(real.products.length);expect(new Set(real.orders.map(p=>p.channel+':'+p.id)).size).toBe(real.orders.length);for(const c of real.channels){expect(real.products.filter(p=>p.channel===c.name)).toHaveLength(c.products);expect(real.orders.filter(o=>o.channel===c.name)).toHaveLength(c.orders);}for(const o of real.orders){expect(Object.keys(o).sort()).toEqual(['id','channel','date','status','lines'].sort());for(const l of o.lines)expect(Object.keys(l).sort()).toEqual(['product','title','sku','qty'].sort());}});
});
