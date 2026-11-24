import snapshot from './gercek.json';
export interface SnapshotProduct { id:string;channel:string;title:string;sku:string;variant:string;price:number;stock:number|null;image:string;url:string;imageHash?:string;recipeText?:string }
export interface SnapshotOrder { id:string;channel:string;date:string;status:string;lines:{product:string;title:string;sku:string;qty:number}[] }
export interface Snapshot { syncedAt:string;windowDays:number;channels:{name:string;status:string;error:string;products:number;orders:number}[];products:SnapshotProduct[];orders:SnapshotOrder[];recipeTexts?:Record<string,string>;imageAnalysis?:{algorithm:string;uniqueImages:number;hashedImages:number;listingsWithHash:number;failedImages:number} }
export const real = snapshot as Snapshot;
for(const p of real.products)if(!p.recipeText)p.recipeText=real.recipeTexts?.[p.channel+':'+p.title]||'';
export const snapshotKey = real.syncedAt+':'+(real.imageAnalysis?.hashedImages||0)+':schema4-private-totals';
