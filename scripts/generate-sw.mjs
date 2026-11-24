import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(dir + "/" + e.name) : [dir + "/" + e.name],
  );
}
const assets = files("dist").filter((f) => !f.endsWith("/sw.js"));
const version = createHash("sha256")
  .update(
    assets
      .map((f) => readFileSync(f))
      .map((b) => createHash("sha256").update(b).digest("hex"))
      .join(""),
  )
  .digest("hex")
  .slice(0, 12);
const urls = assets.map((f) => "/kerim-erp-demo/" + f.slice(5));
writeFileSync(
  "dist/sw.js",
  `const CACHE='am-${version}-4';const ASSETS=${JSON.stringify(urls)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('am-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(e.request,{ignoreVary:true});if(cached)return cached;if(e.request.mode==='navigate'){const shell=await cache.match('/kerim-erp-demo/index.html',{ignoreVary:true});if(shell)return shell;}return fetch(e.request);})());});`,
);
console.log(`Service worker: ${assets.length} files, version ${version}`);
