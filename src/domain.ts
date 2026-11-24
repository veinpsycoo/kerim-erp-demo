export const LOCATIONS = ["Çamyuva (Depo)", "Ümraniye (Mağaza + E-Ticaret)", "Beşiktaş (Mağaza)"];
export const CHANNELS = [
  "askermarketi.com (ikas)",
  "cephetoptan.com",
  "askerkolisi.com",
  "Trendyol",
  "Hepsiburada",
  "N11",
];
export type Role = "Yönetici" | "Depo" | "Mağaza" | "Muhasebe";
export interface Variant {
  size: string;
  color: string;
  stock: number[];
}
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  buy: number;
  wholesale: number;
  image: string;
  source: string;
  imageSource: string;
  variantSource: string;
  variants: Variant[];
}
export interface Line {
  shipped?: number;
  received?: number;
  multiplier?: number;
  listingId?: string;
  note?: string;
  product: string;
  variant: number;
  qty: number;
  price: number;
  picked: number;
}
export interface Recipe {
  mode?: "clothing" | "fixed";
  product: string;
  qty: number;
}
export interface Kit {
  clothingCount?: number;
  source?: string;
  id: string;
  name: string;
  recipe: Recipe[];
  price: number;
}
export interface Order {
  note?: string;
  operator?: string;
  kitUnits?: number;
  kitSize?: string;
  id: string;
  channel: string;
  customer: string;
  location: number;
  created: string;
  status:
    | "Toplanacak"
    | "Stok düşüldü"
    | "Teslim edildi"
    | "Kargolandı"
    | "İptal"
    | "İade";
  lines: Line[];
  assignee: string;
  wholesale: boolean;
  posted: boolean;
  kit?: string;
}
export interface Transfer {
  note?: string;
  user?: string;
  id: string;
  from: number;
  to: number;
  lines: Line[];
  status: "Talep" | "Yolda" | "Teslim alındı" | "Reddedildi";
  created: string;
}
export interface Account {
  id: string;
  name: string;
  type: "Müşteri" | "Tedarikçi";
  limit: number;
  days: number;
  city: string;
}
export interface Entry {
  id: string;
  account: string;
  date: string;
  memo: string;
  debit: number;
  credit: number;
  due: string;
}
export interface Staff {
  email?: string;
  permissions?: string[];
  locations?: number[];
  id: string;
  name: string;
  role: Role;
  location: number;
  records: { type: string; value: number; date: string; note: string }[];
}
export interface Rule {
  multiplier: number;
  round: "none" | "90" | "integer";
  exceptions: Record<string, number>;
}
export interface Listing {
  confirmed?: boolean;
  multiplier?: number;
  variant?: number;
  channelVariant?: string;
  sku?: string;
  image?: string;
  imageHash?: string;
  score?: number;
  reason?: string;
  rejected?: boolean;
  price?: number;
  stock?: number | null;
  real?: boolean;
  id: string;
  channel: string;
  title: string;
  product: string;
  suggested: string;
}
export interface Log {
  id: string;
  date: string;
  message: string;
  kind: string;
}
export interface State {
  snapshotKey?: string;
  threshold?: number;
  readNotifications?: string[];
  version: number;
  products: Product[];
  kits: Kit[];
  orders: Order[];
  transfers: Transfer[];
  accounts: Account[];
  entries: Entry[];
  staff: Staff[];
  rules: Record<string, Rule>;
  listings: Listing[];
  logs: Log[];
  queue: {
    id: string;
    channel: string;
    count: number;
    status: string;
    date: string;
  }[];
}
export const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export const now = () => new Date().toISOString();
export const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + " ₺";
export const date = (s: string) =>
  new Date(s).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
export const dateKey = (s: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
export const totalStock = (p: Product, loc?: number) =>
  p.variants.reduce(
    (n, v) =>
      n +
      (loc === undefined ? v.stock.reduce((a, b) => a + b, 0) : v.stock[loc]),
    0,
  );
export const balance = (s: State, id: string) =>
  s.entries
    .filter((e) => e.account === id)
    .reduce((n, e) => n + e.debit - e.credit, 0);
export const orderTotal = (o: Order) =>
  o.lines.reduce((n, l) => n + (o.wholesale ? l.picked : l.qty) * l.price, 0);
export function positive(n: number, zero = false) {
  if (!Number.isFinite(n) || n < (zero ? 0 : 1) || !Number.isInteger(n))
    throw Error("Adet, sıfır veya daha büyük bir tam sayı olmalı.");
}
export function amount(n: number) {
  if (!Number.isFinite(n) || n <= 0)
    throw Error("Tutar sıfırdan büyük olmalı.");
}
export function log(s: State, message: string, kind = "İşlem") {
  s.logs.unshift({ id: uid("LOG"), date: now(), message, kind });
}
export function channelPrice(p: Product, r: Rule) {
  const v = r.exceptions[p.id] ?? p.price * r.multiplier;
  if (!Number.isFinite(v) || v <= 0)
    throw Error("Geçerli bir fiyat veya çarpan girin.");
  return r.round === "90"
    ? Math.ceil(v - 0.9 - 1e-8) + 0.9
    : r.round === "integer"
      ? Math.ceil(v)
      : Math.round(v * 100) / 100;
}
export function kitLines(s: State, k: Kit, group: string, qty: number, shoe = "42–43"): Line[] {
  positive(qty);
  return k.recipe.map((r) => {
    const p = s.products.find((x) => x.id === r.product)!;
    const vi = p.variants.findIndex((v) => v.size === (p.category === "Çorap" ? shoe : group));
    if (r.mode === "clothing" && vi < 0)
      throw Error(`${p.name}: ${group} beden eşleşmesi yok; reçeteyi kontrol edin.`);
    const variant = vi < 0 ? 0 : vi;
    return {
      product: p.id,
      variant,
      qty: r.qty * qty * (r.mode === "clothing" ? k.clothingCount || 1 : 1),
      picked: r.qty * qty * (r.mode === "clothing" ? k.clothingCount || 1 : 1),
      price: p.wholesale,
    };
  });
}
export function capacity(s: State, k: Kit, group: string, loc: number, shoe = "42–43") {
  const lines = kitLines(s, k, group, 1, shoe);
  const counts = new Map<string, number>();
  for (const l of lines) {
    const key = l.product + ":" + l.variant;
    counts.set(key, (counts.get(key) || 0) + l.qty);
  }
  return Math.min(
    ...[...counts].map(([key, q]) => {
      const [p, v] = key.split(":");
      return Math.floor(
        s.products.find((x) => x.id === p)!.variants[Number(v)].stock[loc] / q,
      );
    }),
  );
}
export function stockChange(
  s: State,
  lines: Line[],
  loc: number,
  direction: 1 | -1,
  usePicked = false,
) {
  const aggregated = new Map<string, number>();
  for (const l of lines) {
    const multiplier = l.multiplier ?? 1;
    positive(multiplier);
    const q = (usePicked ? l.picked : l.qty) * multiplier;
    positive(q, true);
    const key = l.product + ":" + l.variant;
    aggregated.set(key, (aggregated.get(key) || 0) + q);
  }
  for (const [key, q] of aggregated) {
    const [id, vi] = key.split(":");
    const v = s.products.find((p) => p.id === id)?.variants[Number(vi)];
    if (!v || !Number.isInteger(loc) || loc < 0 || loc > 2)
      throw Error("Ürün, varyant veya lokasyon bulunamadı.");
    if (v.stock[loc] + direction * q < 0)
      throw Error(
        `${id}: ${LOCATIONS[loc]} stoğu yetersiz. İşlem uygulanmadı.`,
      );
  }
  for (const [key, q] of aggregated) {
    const [id, vi] = key.split(":");
    s.products.find((p) => p.id === id)!.variants[Number(vi)].stock[loc] +=
      direction * q;
  }
}
export function bulkStock(s: State, lines: Line[], loc: number, mode: string) {
  if (!lines.length) throw Error("En az bir adet girin.");
  if (!Number.isInteger(loc) || loc < 0 || loc > 2)
    throw Error("Geçerli lokasyon seçin.");
  if (!["Mal kabulü", "Sayım düzeltme", "Fire"].includes(mode))
    throw Error("Geçerli işlem türü seçin.");
  if (mode === "Sayım düzeltme") {
    for (const l of lines) {
      positive(l.qty, true);
      if (!s.products.find((p) => p.id === l.product)?.variants[l.variant])
        throw Error("Ürün varyantı bulunamadı.");
    }
    for (const l of lines) {
      positive(l.qty, true);
      s.products.find((p) => p.id === l.product)!.variants[l.variant].stock[
        loc
      ] = l.qty;
    }
  } else stockChange(s, lines, loc, mode === "Fire" ? -1 : 1);
  log(s, `${mode} · ${LOCATIONS[loc]} · ${lines.length} varyant`, "Stok");
}
export function addOrder(s: State, o: Order) {
  if (!o.lines.length) throw Error("Siparişe ürün ekleyin.");
  if (o.wholesale) {
    const assignee = s.staff.find((p) => p.id === o.assignee);
    if (
      !assignee ||
      !(assignee.permissions ? assignee.permissions.includes("prepare") : assignee.role === "Depo") ||
      !(assignee.locations||[assignee.location]).includes(o.location)
    )
      throw Error("Sipariş lokasyonuna atanmış depo personeli seçin.");
    if (!s.accounts.some((a) => a.id === o.customer && a.type === "Müşteri"))
      throw Error("Toptan müşteri seçin.");
  }
  for (const l of o.lines) {
    positive(l.qty);
    amount(l.price);
  }
  if (!o.wholesale) {
    stockChange(s, o.lines, o.location, -1);
    o.posted = true;
    o.status = "Stok düşüldü";
  }
  s.orders.unshift(o);
  log(s, `${o.id} · ${o.channel} siparişi oluşturuldu`, "Sipariş");
}
export function deliver(s: State, id: string) {
  const o = s.orders.find((x) => x.id === id)!;
  if (o.status !== "Toplanacak" || o.posted)
    throw Error("Bu sipariş zaten işlendi.");
  if (!o.assignee) throw Error("Önce depo personeli atayın.");
  const assignee = s.staff.find((p) => p.id === o.assignee);
  if (!assignee || !(assignee.permissions ? assignee.permissions.includes("prepare") : assignee.role === "Depo") || !(assignee.locations||[assignee.location]).includes(o.location))
    throw Error("Sipariş lokasyonuna atanmış depo personeli seçin.");
  for (const l of o.lines) {
    positive(l.picked, true);
    if (l.picked > l.qty) throw Error("Teslim adedi sipariş adedini aşamaz.");
  }
  const total = orderTotal(o);
  if (total <= 0) throw Error("Teslim için en az bir adet hazırlanmalı.");
  const a = s.accounts.find((a) => a.id === o.customer)!;
  if (balance(s, a.id) + total > a.limit)
    throw Error(
      "Cari risk limiti aşılıyor. Önce tahsilat veya limit güncellemesi yapın.",
    );
  stockChange(s, o.lines, o.location, -1, true);
  o.status = "Teslim edildi";
  o.posted = true;
  s.entries.unshift({
    id: uid("CR"),
    account: o.customer,
    date: now(),
    memo: `${o.id} net teslimat`,
    debit: total,
    credit: 0,
    due: new Date(Date.now() + a.days * 86400000).toISOString(),
  });
  log(
    s,
    `${id}: net ${o.lines.reduce((n, l) => n + l.picked, 0)} adet teslim; cari ${money(total)}`,
    "Teslimat",
  );
}
export function reverseOrder(s: State, id: string, status: "İptal" | "İade") {
  const o = s.orders.find((x) => x.id === id)!;
  if (o.status === "İptal" || o.status === "İade")
    throw Error("Sipariş daha önce geri alındı.");
  if (o.posted) {
    stockChange(s, o.lines, o.location, 1, o.wholesale);
    if (o.wholesale)
      s.entries.unshift({
        id: uid("CR"),
        account: o.customer,
        date: now(),
        memo: `${o.id} ${status}`,
        debit: 0,
        credit: orderTotal(o),
        due: now(),
      });
  }
  o.status = status;
  o.posted = false;
  log(s, `${id} ${status}: ilgili stok ve cari geri alındı`, "İade");
}
export function transferStep(
  s: State,
  id: string,
  action: "send" | "receive" | "reject",
  amounts?: number[],
) {
  const t = s.transfers.find((x) => x.id === id)!;
  if(!t)throw Error("Sevkiyat bulunamadı.");
  if (action === "send") {
    if (t.status !== "Talep") throw Error("Yalnız yeni talep sevk edilebilir.");
    const lines=t.lines.map((l,i)=>{const q=amounts?.[i]??l.qty;positive(q,true);if(q>l.qty)throw Error("Sevk adedi talebi aşamaz.");return {...l,qty:q}});
    if(!lines.some(l=>l.qty>0))throw Error("En az bir ürün sevk edilmeli.");
    stockChange(s, lines, t.from, -1);
    lines.forEach((l,i)=>t.lines[i].shipped=l.qty);
    t.status = "Yolda";
  } else if (action === "receive") {
    if (t.status !== "Yolda")
      throw Error("Önce gönderen lokasyon sevki onaylamalı.");
    const lines=t.lines.map((l,i)=>{const q=amounts?.[i]??l.shipped??l.qty;positive(q,true);if(q>(l.shipped??l.qty))throw Error("Teslim adedi sevki aşamaz.");return {...l,qty:q}});
    stockChange(s, lines, t.to, 1);
    lines.forEach((l,i)=>{t.lines[i].received=l.qty;if(l.qty!==(l.shipped??t.lines[i].shipped??l.qty))log(s,`${id} · ${l.product} eksik teslim: sevk ${t.lines[i].shipped}, teslim ${l.qty}`,"Bildirim");});
    t.status = "Teslim alındı";
  } else {
    if (t.status !== "Talep") throw Error("Yalnız yeni talep reddedilebilir.");
    t.status = "Reddedildi";
  }
  log(
    s,
    `${t.id}: ${t.status} · ${LOCATIONS[t.from]} → ${LOCATIONS[t.to]}`,
    "Sevkiyat",
  );
}
export function payment(
  s: State,
  account: string,
  value: number,
  type: string,
) {
  if (!["Tahsilat", "Ödeme"].includes(type))
    throw Error("Geçerli makbuz türü seçin.");
  amount(value);
  const a = s.accounts.find((x) => x.id === account);
  if (!a) throw Error("Cari bulunamadı.");
  const e = {
    id: uid("MK"),
    account,
    date: now(),
    memo: type,
    debit: type === "Ödeme" ? value : 0,
    credit: type === "Tahsilat" ? value : 0,
    due: now(),
  };
  s.entries.unshift(e);
  log(s, `${e.id} · ${type} · ${money(value)}`, "Cari");
  return e;
}
