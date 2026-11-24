import { describe, it, expect } from "vitest";
import { seed } from "./seed";
import {
  bulkStock,
  stockChange,
  channelPrice,
  capacity,
  kitLines,
  addOrder,
  deliver,
  reverseOrder,
  transferStep,
  balance,
  payment,
  orderTotal,
  dateKey,
  date,
  type Line,
  type Order,
  now,
} from "./domain";
const line = (id: string, q = 2, v = 0): Line => ({
  product: id,
  variant: v,
  qty: q,
  picked: q,
  price: 100,
});
const online = (id: string): Order => ({
  id: "TEST",
  channel: "Trendyol",
  customer: "Kurgusal müşteri",
  location: 0,
  created: now(),
  status: "Stok düşüldü",
  lines: [line(id)],
  wholesale: false,
  posted: false,
  assignee: "",
});
describe("Türkiye iş günü", () => {
  it("UTC gece sınırını Türkiye gününe doğru taşır", () =>
    expect(dateKey("2026-11-23T21:30:00Z")).toBe("2026-11-24"));
  it("Türkçe gösterim ve ekstre günü aynı kalır", () =>
    expect(date("2026-11-23T21:30:00Z")).toBe("24.11.2026"));
});
describe("Gerçek katalog bütünlüğü", () => {
  it("en az 150 gerçek kaynaklı ürün içerir", () => {
    const s = seed();
    expect(s.products.length).toBeGreaterThanOrEqual(150);
    expect(
      s.products.every((p) => p.source.startsWith("https://") || p.source.startsWith("Kerim KORDAK")),
    ).toBe(true);
  });
  it("benzersiz SKU, kategori, kaynak ve geçerli fiyat taşır; API görseli eksik olabilir", () => {
    const s = seed();
    expect(new Set(s.products.map((p) => p.id)).size).toBe(s.products.length);
    expect(
      s.products.every(
        (p) => p.source && p.category && Number.isFinite(p.price) && p.price >= 0 && p.variants.length,
      ),
    ).toBe(true);
  });
  it("Türkçe karakterler bozulmamıştır", () =>
    expect(JSON.stringify(seed())).not.toContain("�"));
  it("yedi giyim adedi için ayrı set kodları 20 alt ürün içerir", () => {
    const s = seed();
    expect(s.kits.map(k=>k.clothingCount)).toEqual([3,6,9,12,18,24,30]);
    s.kits.forEach((k) => expect(k.recipe.length).toBeGreaterThanOrEqual(15));
    s.kits.forEach((k) => expect(k.recipe.length).toBeLessThanOrEqual(20));
  });
});
describe("Stok işlemleri", () => {
  it("mal kabulü yalnız seçili lokasyona ekler", () => {
    const s = seed(),
      p = s.products[0],
      before = [...p.variants[0].stock];
    bulkStock(s, [line(p.id, 5)], 1, "Mal kabulü");
    expect(p.variants[0].stock).toEqual([before[0], before[1] + 5, before[2]]);
  });
  it("sayım mevcut bakiyeyi değiştirir ve sıfırı kabul eder", () => {
    const s = seed(),
      p = s.products[0];
    bulkStock(s, [line(p.id, 0)], 0, "Sayım düzeltme");
    expect(p.variants[0].stock[0]).toBe(0);
  });
  it("fire stoğu düşürür", () => {
    const s = seed(),
      p = s.products[0],
      b = p.variants[0].stock[0];
    bulkStock(s, [line(p.id, 1)], 0, "Fire");
    expect(p.variants[0].stock[0]).toBe(b - 1);
  });
  it("yetersiz stokta tüm hareketi reddeder", () => {
    const s = seed(),
      p = s.products[0],
      q = s.products[1],
      before = p.variants[0].stock[0];
    expect(() =>
      stockChange(s, [line(p.id, 1), line(q.id, 99999)], 0, -1),
    ).toThrow();
    expect(p.variants[0].stock[0]).toBe(before);
  });
  it("yinelenen satırları topluca kontrol eder", () => {
    const s = seed(),
      p = s.products[0];
    p.variants[0].stock[0] = 3;
    expect(() =>
      stockChange(s, [line(p.id, 2), line(p.id, 2)], 0, -1),
    ).toThrow();
    expect(p.variants[0].stock[0]).toBe(3);
  });
  it.each([-1, 1.5, NaN, Infinity])("geçersiz adet %s reddedilir", (q) => {
    const s = seed();
    expect(() => stockChange(s, [line(s.products[0].id, q)], 0, -1)).toThrow();
  });
});
describe("Set motoru", () => {
  it("en düşük alt stok kapasiteyi belirler", () => {
    const s = seed(),
      k = s.kits[0];
    kitLines(s, k, "M", 1).forEach(
      (l) =>
        (s.products.find((p) => p.id === l.product)!.variants[
          l.variant
        ].stock[0] = 20),
    );
    const l = kitLines(s, k, "M", 1)[3];
    s.products.find((p) => p.id === l.product)!.variants[l.variant].stock[0] =
      4;
    expect(capacity(s, k, "M", 0)).toBe(4);
  });
  it("reçete adedine böler", () => {
    const s = seed(),
      k = s.kits[0];
    k.recipe = [{ product: s.products[0].id, qty: 3 }];
    s.products[0].variants[0].stock[0] = 8;
    expect(capacity(s, k, "M", 0)).toBe(2);
  });
  it("beden grubu aynı beden varyantını seçer", () => {
    const s = seed(),
      p = s.products.find((p) => p.variants.some((v) => v.size === "L"))!;
    const k = { ...s.kits[0], recipe: [{ product: p.id, qty: 1 }] };
    const l = kitLines(s, k, "L", 1)[0];
    expect(p.variants[l.variant].size).toBe("L");
  });
  it("ortak alt ürün kullanan diğer setin kapasitesi anında değişir", () => {
    const s = seed(),
      k = s.kits[0],
      other = s.kits[1];
    const id = k.recipe[0].product;
    other.recipe = [{ product: id, qty: 1 }];
    const b = capacity(s, other, "M", 0);
    stockChange(s, kitLines(s, k, "M", 1), 0, -1);
    expect(capacity(s, other, "M", 0)).toBe(b - k.clothingCount!);
  });
  it("yinelenen alt ürünleri birleştirerek kapasite bulur", () => {
    const s = seed(),
      k = s.kits[0];
    k.recipe = [
      { product: s.products[0].id, qty: 2 },
      { product: s.products[0].id, qty: 2 },
    ];
    s.products[0].variants[0].stock[0] = 9;
    expect(capacity(s, k, "M", 0)).toBe(2);
  });
});
describe("Kanal fiyat kuralları", () => {
  it("çarpan ve yukarı ,90 yuvarlaması", () => {
    const p = seed().products[0];
    p.price = 100;
    expect(
      channelPrice(p, { multiplier: 1.35, round: "90", exceptions: {} }),
    ).toBe(135.9);
  });
  it("zaten ,90 fiyatı değişmez", () => {
    const p = seed().products[0];
    p.price = 135.9;
    expect(
      channelPrice(p, { multiplier: 1, round: "90", exceptions: {} }),
    ).toBe(135.9);
  });
  it(",90 üstü sonraki liraya çıkar", () => {
    const p = seed().products[0];
    p.price = 135.91;
    expect(
      channelPrice(p, { multiplier: 1, round: "90", exceptions: {} }),
    ).toBe(136.9);
  });
  it("ürün istisnası çarpanı geçersiz kılar", () => {
    const p = seed().products[0];
    expect(
      channelPrice(p, {
        multiplier: 1.35,
        round: "none",
        exceptions: { [p.id]: 125 },
      }),
    ).toBe(125);
  });
  it("tam TL yukarı yuvarlar", () => {
    const p = seed().products[0];
    p.price = 100.1;
    expect(
      channelPrice(p, { multiplier: 1, round: "integer", exceptions: {} }),
    ).toBe(101);
  });
  it("sıfır/NaN çarpanı reddeder", () => {
    const p = seed().products[0];
    expect(() =>
      channelPrice(p, { multiplier: 0, round: "none", exceptions: {} }),
    ).toThrow();
    expect(() =>
      channelPrice(p, { multiplier: NaN, round: "none", exceptions: {} }),
    ).toThrow();
  });
});
describe("Sipariş ve net teslimat", () => {
  it("kanal siparişinde stok düşer, iptal ile iade edilir", () => {
    const s = seed(),
      p = s.products[0],
      b = p.variants[0].stock[0];
    addOrder(s, online(p.id));
    expect(p.variants[0].stock[0]).toBe(b - 2);
    reverseOrder(s, "TEST", "İptal");
    expect(p.variants[0].stock[0]).toBe(b);
  });
  it("iadede aynı ürünler geri alınır ve ikinci iade engellenir", () => {
    const s = seed(),
      p = s.products[0],
      b = p.variants[0].stock[0];
    addOrder(s, online(p.id));
    reverseOrder(s, "TEST", "İade");
    expect(p.variants[0].stock[0]).toBe(b);
    expect(() => reverseOrder(s, "TEST", "İade")).toThrow();
  });
  it("toptan oluştururken stok/cari değişmez", () => {
    const s = seed(),
      p = s.products[0],
      b = p.variants[0].stock[0],
      c = balance(s, "C-001");
    const o = {
      ...online(p.id),
      wholesale: true,
      customer: "C-001",
      assignee: "P-002",
      status: "Toplanacak" as const,
    };
    addOrder(s, o);
    expect(p.variants[0].stock[0]).toBe(b);
    expect(balance(s, "C-001")).toBe(c);
  });
  it("kısmi teslimde yalnız net adet stok ve cariye işlenir", () => {
    const s = seed(),
      o = s.orders[0];
    o.lines.forEach((l) => (l.picked = 0));
    o.lines[0].picked = 2;
    const p = s.products.find(p=>p.id===o.lines[0].product)!,
      b = p.variants[o.lines[0].variant].stock[0],
      c = balance(s, o.customer);
    deliver(s, o.id);
    expect(p.variants[o.lines[0].variant].stock[0]).toBe(b - 2);
    expect(balance(s, o.customer)).toBeCloseTo(c + 2 * o.lines[0].price);
    expect(() => deliver(s, o.id)).toThrow();
  });
  it("eksik (0) teslim cari yaratmaz", () => {
    const s = seed(),
      o = s.orders[0],
      c = s.entries.length;
    o.lines.forEach((l) => (l.picked = 0));
    expect(() => deliver(s, o.id)).toThrow();
    expect(s.entries).toHaveLength(c);
  });
  it("fazla hazırlanan adet engellenir", () => {
    const s = seed(),
      o = s.orders[0];
    o.lines[0].picked = 999;
    expect(() => deliver(s, o.id)).toThrow();
  });
  it("risk limiti aşılırsa stok düşmez", () => {
    const s = seed(),
      o = s.orders[0],
      b = s.products[0].variants[0].stock[0];
    s.accounts[0].limit = 1;
    expect(() => deliver(s, o.id)).toThrow();
    expect(s.products[0].variants[0].stock[0]).toBe(b);
  });
  it("net teslim iadesi stok ve cariyi tam geri alır", () => {
    const s = seed(),
      o = s.orders[0];
    o.lines.forEach((l) => (l.picked = 0));
    o.lines[0].picked = 1;
    const b = s.products[0].variants[0].stock[0],
      c = balance(s, o.customer);
    deliver(s, o.id);
    expect(orderTotal(o)).toBe(o.lines[0].price);
    reverseOrder(s, o.id, "İade");
    expect(s.products[0].variants[0].stock[0]).toBe(b);
    expect(balance(s, o.customer)).toBeCloseTo(c);
  });
});
describe("Onaylı sevkiyat ve cari", () => {
  it("talep stok değiştirmez; sevk düşer, teslim ekler", () => {
    const s = seed(),
      t = s.transfers[0],
      p = s.products.find((p) => p.id === t.lines[0].product)!,
      b = [...p.variants[0].stock];
    transferStep(s, t.id, "send");
    expect(p.variants[0].stock).toEqual([b[0] - 4, b[1], b[2]]);
    transferStep(s, t.id, "receive");
    expect(p.variants[0].stock).toEqual([b[0] - 4, b[1] + 4, b[2]]);
    expect(() => transferStep(s, t.id, "receive")).toThrow();
  });
  it("sevk öncesi teslim engellenir", () => {
    const s = seed();
    expect(() => transferStep(s, s.transfers[0].id, "receive")).toThrow();
  });
  it("reddetme stok değiştirmez", () => {
    const s = seed(),
      b = JSON.stringify(s.products);
    transferStep(s, s.transfers[0].id, "reject");
    expect(JSON.stringify(s.products)).toBe(b);
  });
  it("tahsilat müşteri borcunu azaltır", () => {
    const s = seed(),
      b = balance(s, "C-001");
    payment(s, "C-001", 500, "Tahsilat");
    expect(balance(s, "C-001")).toBe(b - 500);
  });
  it("ödeme tedarikçi alacağını azaltır", () => {
    const s = seed(),
      b = balance(s, "C-003");
    payment(s, "C-003", 500, "Ödeme");
    expect(balance(s, "C-003")).toBe(b + 500);
  });
  it("negatif tahsilat reddedilir", () => {
    const s = seed();
    expect(() => payment(s, "C-001", -1, "Tahsilat")).toThrow();
  });
});
