import type { Kit, Product, Recipe } from './domain';
import { real, type SnapshotProduct } from './snapshot';
import { FIXED, normalize } from './kerim';

export const sourceSets=[...new Map(real.products.filter(p=>p.channel==='askerkolisi.com'&&/temel/i.test(p.title)).map(p=>[p.title,p])).values()];
export function sourceComponents():Product[]{
 const specs=[['SRC-FAN-DEN','Beyaz Denizci Fanila','Giyim','body'],['SRC-DON-DEN','Siyah Denizci Boxer','Giyim','body'],['SRC-FAN-HAV','Havacı Fanila (kaynak standart renk)','Giyim','body'],['SRC-DON-HAV','Havacı Boxer (kaynak standart renk)','Giyim','body'],['SRC-CRP-SY','Siyah Asker Çorabı','Çorap','shoe'],['SRC-CRP-KIS','Kışlık Havlu Asker Çorabı','Çorap','shoe'],['SRC-TERMAL','Termal İçlik Takımı (alt-üst)','Giyim','body'],['SRC-BERE','Polar Bere','Aksesuar','single'],['SRC-BOYUN','Polar Boyunluk','Aksesuar','single'],['SRC-ELDIVEN','Polar Eldiven','Aksesuar','single'],['SRC-KLT','Dolap / Çanta Kilidi','Aksesuar','single']];
 return specs.map(([id,name,category,rule])=>{const picture=real.products.find(p=>p.channel==='askerkolisi.com'&&!/set|paket/i.test(p.title)&&normalize(p.title).includes(normalize(name.split(' ').slice(-2).join(' '))));return {id,name,category,price:0,buy:0,wholesale:0,image:picture?.image||'',source:picture?.url||'https://askerkolisi.com/',imageSource:picture?.channel||'Simgesel',variantSource:'Kaynak set açıklaması; merkez beden şablonu',variants:(rule==='body'?['S','M','L','XL','2XL','3XL']:rule==='shoe'?['36–37','38–39','40–41','42–43','44–45','46–47']:['Standart']).map(size=>({size,color:'Kaynak açıklamasındaki renk',stock:[180,90,30]}))};});
}
const aliases:Record<string,RegExp>={
 'BOYA-SY':/bot boyasi siyah|siyah bot boyasi/,'BOYA-HK':/bot boyasi haki|haki bot boyasi/,'SNG-001':/parlatici sunger/,'PUD-001':/pudra/,'VAT-001':/vatka/,'BOT-KLT':/bot kilidi/,'CUZ-001':/cuzdan/,'PEC-010':/pecete|cep mendili/,'KLT-001':/dolap veya valiz kilidi|dolap valiz kilidi/,'DKS-001':/dikis seti/,'TRC-001':/tiras cantasi/,'JLT-001':/jilet|tiras bicagi/,'SAB-001':/sabun kutusu/,'ASK-001':/dolap askisi/,'TCT-001':/temiz camasir torbasi/,'KCT-001':/kirli camasir torbasi/,
};
export function sourceDraft(p:SnapshotProduct):Omit<Kit,'id'>{
 const text=normalize(p.recipeText||'');
 if(!text||!/(fanila|tisort)/.test(text)||!/(boxer|donu)/.test(text)||!/corap/.test(text))throw Error('Kaynakta tam giyim reçetesi yok; açıklamayı inceleyerek elle oluşturun.');
 const n=Number(p.title.match(/^(3|6|9|12|18|24|30)[’']?[lL]/)?.[1]||p.variant.match(/\b(3|6|9|12|18|24|30)[’']?[lL]/)?.[1]||6);
 const navy=/denizci|beyaz/i.test(p.title),air=/havacı|havaci/i.test(p.title),winter=/kış|kis/i.test(p.title);
 const recipe:Recipe[]=[{product:navy?'SRC-FAN-DEN':air?'SRC-FAN-HAV':'FAN-HK',qty:1,mode:'clothing'},{product:navy?'SRC-DON-DEN':air?'SRC-DON-HAV':'DON-HK',qty:1,mode:'clothing'},{product:winter?'SRC-CRP-KIS':navy?'SRC-CRP-SY':'CRP-HK',qty:1,mode:'clothing'}];
 if(/tabanlik/.test(text))recipe.push({product:'TAB-TEK',qty:1,mode:'fixed'});
 for(const [id,,,defaultQty] of FIXED)if(aliases[id].test(text)){
   let qty=defaultQty;
   if(id==='JLT-001'){const match=text.match(/(\d+) adet (?:banyo )?(?:jilet|tiras bicagi)/);if(match)qty=Number(match[1]);}
   recipe.push({product:id,qty,mode:'fixed'});
 }
 if(/dolap canta kilidi/.test(text))recipe.push({product:'SRC-KLT',qty:1,mode:'fixed'});
 for(const [id,pattern] of [['SRC-TERMAL',/termal.*iclik/],['SRC-BERE',/polar bere/],['SRC-BOYUN',/polar boyunluk/],['SRC-ELDIVEN',/polar eldiven/]] as const)if(pattern.test(text))recipe.push({product:id,qty:1,mode:'fixed'});
 return {name:p.title,source:p.url,clothingCount:n,price:p.price,recipe};
}
