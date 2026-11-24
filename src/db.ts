import { openDB } from "idb";
import type { State } from "./domain";
import { seed } from "./seed";
import { snapshotKey } from './snapshot';
import { suggestions } from './kerim';
import { normalizeSavedText } from './saved-text';
const db = openDB("asker-marketi-demo", 1, {
  upgrade(d) {
    d.createObjectStore("state");
  },
});
export async function readState(): Promise<State> {
  const d = await db;
  const stored = await d.get("state", "main");
  const { state: s, changed } = stored?.version === 2
    ? normalizeSavedText(stored)
    : { state: stored, changed: false };
  if (s?.version === 2) {
    if (changed) await d.put('state', s, 'main');
    if(s.snapshotKey!==snapshotKey){
      const fresh=seed();
      const known=new Set(s.products.map((p:State['products'][number])=>p.id));
      s.products.push(...fresh.products.filter(p=>!known.has(p.id)));
      const current=new Map(s.listings.map((l:State['listings'][number])=>[l.id,l]));
      s.listings=fresh.listings.map(l=>{const previous=current.get(l.id) as State['listings'][number]|undefined;return previous?{...l,product:previous.product,variant:previous.variant,multiplier:previous.multiplier,rejected:previous.rejected,confirmed:previous.confirmed}:l;});
      const kitIds=new Set(s.kits.map((k:State['kits'][number])=>k.id));
      s.kits.push(...fresh.kits.filter(k=>!kitIds.has(k.id)));
      suggestions(s.listings,s.products);s.snapshotKey=snapshotKey;
      await d.put('state',s,'main');
    }
    return s;
  }
  const initial = seed();
  await d.put("state", initial, "main");
  return initial;
}
export async function saveState(s: State) {
  await (await db).put("state", s, "main");
}
