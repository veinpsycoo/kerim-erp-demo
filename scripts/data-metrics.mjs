import { registerHooks } from 'node:module';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.')&&context.parentURL){
      const url=new URL(specifier,context.parentURL);
      if(!/\.(ts|mjs|json)$/.test(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};
    return next(url,context);
  }
});
const {seed}=await import('../src/seed.ts');
const {real}=await import('../src/snapshot.ts');
const s=seed();
const listings=s.listings.filter(l=>l.real);
const result={syncedAt:real.syncedAt,channels:real.channels,totalListings:listings.length,sourceAnchored:listings.filter(l=>l.product).length,unmatched:listings.filter(l=>!l.product).length,proposals:listings.filter(l=>!l.product&&l.suggested).length,proposalsAt82:listings.filter(l=>!l.product&&l.suggested&&(l.score??0)>=82).length,imageAnalysis:real.imageAnalysis||null,byChannel:real.channels.map(c=>{const rows=listings.filter(l=>l.channel===c.name);return {name:c.name,listings:rows.length,sourceAnchored:rows.filter(l=>l.product).length,proposed:rows.filter(l=>!l.product&&l.suggested).length,highConfidence:rows.filter(l=>!l.product&&(l.score??0)>=82).length};}),masterProducts:s.products.length,masterVariants:s.products.reduce((n,p)=>n+p.variants.length,0),kits:s.kits.length};
mkdirSync('demo-kanit',{recursive:true});writeFileSync('demo-kanit/data-metrics.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
