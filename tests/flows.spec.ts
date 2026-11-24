import {
  test as base,
  expect,
  type Page,
  type TestInfo,
  type BrowserContext,
} from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { State } from "../src/domain";
import { installFooterAudit, verifyFooterAudit } from "./footer-audit";
const evidence = process.env.EVIDENCE_DIR || "playwright-evidence/local";
// Model one device per viewport. Keep immutable PWA assets cached, but reset
// IndexedDB before every scenario so operations remain isolated without
// downloading the entire catalog 36 times from the public Pages host.
const test = base.extend<
  Record<never, never>,
  { cachedContext: BrowserContext }
>({
  cachedContext: [
    async ({ browser }, use, workerInfo) => {
      const context = await browser.newContext({
        baseURL:
          process.env.LIVE_URL || "http://127.0.0.1:4173/kerim-erp-demo/",
        viewport: workerInfo.project.use.viewport,
        isMobile: workerInfo.project.use.isMobile,
        hasTouch: workerInfo.project.use.hasTouch,
        serviceWorkers: "allow",
      });
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],
  context: async ({ cachedContext }, use) => {
    await cachedContext.setOffline(false);
    await use(cachedContext);
  },
  page: async ({ context }, use, info) => {
    const page = await context.newPage();
    await installFooterAudit(page);
    await page.goto("./");
    await page.evaluate(() => localStorage.removeItem("am-role"));
    await page.reload();
    await page.getByRole("button", { name: /^Yönetici/ }).waitFor();
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const r = indexedDB.open("asker-marketi-demo", 1);
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const db = r.result;
            const tx = db.transaction("state", "readwrite");
            tx.objectStore("state").clear();
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
    await use(page);
    await verifyFooterAudit(page, info);
    await context.setOffline(false);
    await page.close();
  },
});
async function state(page: Page): Promise<State> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("asker-marketi-demo", 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const req = db.transaction("state").objectStore("state").get("main");
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}
async function shot(page: Page, info: TestInfo, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: join(evidence, `${info.project.name}-${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}
async function login(page: Page, role = "Yönetici") {
  await page.evaluate(() => localStorage.removeItem("am-role"));
  await page.goto("./");
  await page.getByRole("button", { name: new RegExp(`^${role}`) }).click();
  await expect(
    page.getByRole("heading", { name: "Bugün", exact: true }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  const desktop = page
    .getByRole("navigation", { name: "Ana menü" })
    .getByRole("button", { name, exact: true });
  if (await desktop.isVisible()) {
    await desktop.click();
    return;
  }
  const labels: Record<string, string> = {
    Bugün: "Bugün",
    "Merkez stok": "Stok",
    Siparişler: "Sipariş",
    Sevkiyatlar: "Sevkiyat",
    "Cari hesaplar": "Cari",
    Raporlar: "Raporlar",
    "Mağaza işlemleri": "Satış",
  };
  const quick = page
    .getByRole("navigation", { name: "Alt menü" })
    .getByRole("button", { name: labels[name] || name, exact: true });
  if (await quick.isVisible()) {
    await quick.click();
    return;
  }
  await page.getByRole("button", { name: "Daha fazla", exact: true }).click();
  await page
    .locator(".more-list")
    .getByRole("button", { name, exact: true })
    .click();
}
async function user(page: Page, id: string) {
  await page
    .getByRole("button", { name: "Profil ve ayarlar", exact: true })
    .last()
    .click();
  await page.getByLabel("Aktif kullanıcı").selectOption(id);
}
async function close(page: Page) {
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
}
async function approve(page: Page) {
  await page.getByRole("button", { name: "Onayla", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}
const errors = new Map<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (e) => errors.get(page)!.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.get(page)!.push(m.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(
    errors.get(page),
    "JavaScript ve tarayıcı konsolu hatasız olmalı",
  ).toEqual([]);
});
test("yönetim görünümü, gerçek ürünler ve tüm modüllerde taşmasız gezinme", async ({
  page,
}, info) => {
  await login(page);
  const s = await state(page);
  expect(s.products.length).toBeGreaterThanOrEqual(150);
  expect(new Set(s.products.map((p) => p.category)).size).toBeGreaterThan(20);
  await shot(page, info, "dashboard");
  for (const name of [
    "Merkez stok",
    "Kanallar",
    "Set reçeteleri",
    "Siparişler",
    "Sevkiyatlar",
    "Cari hesaplar",
    "Personel",
    "İşlem günlüğü",
    "Mağaza işlemleri",
    "Raporlar",
  ]) {
    await nav(page, name);
    await expect(page.locator("main h1")).toHaveText(name);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await shot(page, info, name.replaceAll(" ", "-").replaceAll("&", "ve"));
  }
});
test("ürün matrisi, çok ürünlü mal kabulü ve IndexedDB kalıcılığı", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Merkez stok");
  await page.getByRole("textbox", { name: "Ürün ara" }).fill("AM-0001");
  await page.locator(".product-row").click();
  await expect(
    page.getByRole("dialog", { name: "Ürün kartı", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Renk / beden matrisi" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".matrix-scroll")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await expect(
    page.getByRole("table", { name: "Varyant stokları", exact: true }),
  ).toBeVisible();
  const stockGaps = await page
    .locator(".location-balances>div")
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          row.children[1].getBoundingClientRect().left -
          row.children[0].getBoundingClientRect().right,
      ),
    );
  expect(stockGaps.every((gap) => gap >= 15)).toBe(true);
  await shot(page, info, "urun-karti");
  await page.locator(".matrix").scrollIntoViewIfNeeded();
  await shot(page, info, "urun-varyantlari");
  await page.getByRole("button", { name: "Bu üründe stok işlemi" }).click();
  await page.getByLabel("İşleme ürün ekle").selectOption("AM-0002");
  const b = await state(page);
  await page.locator('input[name="qty-AM-0001-0"]').fill("5");
  await page.locator('input[name="qty-AM-0002-0"]').fill("7");
  await page.getByRole("button", { name: "İşlemi onayla" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const a = await state(page);
  expect(a.products[0].variants[0].stock[0]).toBe(
    b.products[0].variants[0].stock[0] + 5,
  );
  expect(a.products[1].variants[0].stock[0]).toBe(
    b.products[1].variants[0].stock[0] + 7,
  );
  await page.reload();
  await expect(page.locator(".page-heading h1")).toHaveText("Bugün");
  expect((await state(page)).products[0].variants[0].stock[0]).toBe(
    a.products[0].variants[0].stock[0],
  );
});
test("hatalı fire işlemi atomik reddedilir ve boş arama durumu çalışır", async ({
  page,
}) => {
  await login(page);
  await nav(page, "Merkez stok");
  await page
    .getByRole("textbox", { name: "Ürün ara" })
    .fill("kesinlikle-olmayan-ürün");
  await expect(
    page.getByRole("heading", { name: "Aramanıza uygun ürün bulunamadı." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aramayı temizle", exact: true })
    .click();
  await expect(page.locator(".product-row")).toHaveCount(12);
  await page.getByRole("button", { name: "Toplu stok işlemi" }).click();
  await page.getByLabel("İşleme ürün ekle").selectOption("AM-0001");
  await page.getByLabel("İşlem türü").selectOption("Fire");
  const before = await state(page);
  await page.locator('input[name="qty-AM-0001-0"]').fill("99999");
  await page.getByRole("button", { name: "İşlemi onayla" }).click();
  await expect(page.getByRole("alert")).toContainText("stoğu yetersiz");
  expect((await state(page)).products).toEqual(before.products);
  await close(page);
});
test("gerçek kanal ilanı SKU/varyant ve paket çarpanıyla eşleştirilir", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Kanallar");
  await page.getByRole("button", { name: /^cephetoptan/ }).click();
  await page.getByLabel("Yalnız eşleşmeyenler").check();
  await page.getByLabel("İlan ara", { exact: true }).fill("Vatka");
  const row = page.locator(".mapping-row").first();
  await row.getByRole("button", { name: "Öneriyi incele" }).click();
  await page.getByLabel("Merkez SKU", { exact: true }).selectOption("VAT-001");
  await page.getByLabel("Çarpan (paketteki tekli birim)").fill("20");
  await shot(page, info, "gercek-ilan-eslestirme");
  await page.getByRole("button", { name: "Onayla", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await state(page)).listings.some(
      (l) =>
        l.real &&
        l.channel === "cephetoptan.com" &&
        l.product === "VAT-001" &&
        l.multiplier === 20,
    ),
  ).toBe(true);
  await page.getByLabel("Yalnız eşleşmeyenler").uncheck();
  await page
    .getByRole("button", { name: "Kanal siparişini dene", exact: true })
    .click();
  const before = (await state(page)).products.find((p) => p.id === "VAT-001")!
    .variants[0].stock[1];
  await page.getByLabel("İlan sipariş adedi").fill("2");
  await expect(
    page.getByText("2 × 20 = 40 merkez birimi Ümraniye stoğundan düşecek."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Çarpanlı siparişi kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).products.find((p) => p.id === "VAT-001")!
          .variants[0].stock[1],
    )
    .toBe(before - 40);
});

test("çarpan, yuvarlama, ürün istisnası ve gönderim kuyruğu", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Kanallar");
  await page.getByRole("button", { name: /^Trendyol/ }).click();
  await page
    .getByRole("button", { name: "Fiyat kuralları", exact: true })
    .click();
  await page.getByRole("spinbutton", { name: "Kanal çarpanı" }).fill("1.5");
  await page.getByRole("heading", { name: "Trendyol fiyat kuralı" }).click();
  await expect
    .poll(async () => (await state(page)).rules.Trendyol.multiplier)
    .toBe(1.5);
  await page
    .locator(".price-row")
    .first()
    .getByRole("button", { name: "İstisna", exact: true })
    .click();
  await page.getByLabel("İstisna tutarı (₺)").fill("125");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".price-row").first()).toContainText("125,90");
  await shot(page, info, "fiyat-onizleme");
  await page.getByRole("button", { name: "Fiyatları hazırla" }).click();
  await approve(page);
  await page
    .getByRole("button", { name: "Gönderim kuyruğu", exact: true })
    .click();
  await expect(page.locator(".mapping-row").first()).toContainText(
    "Tamamlandı",
  );
  expect((await state(page)).queue[0].count).toBe(
    (await state(page)).products.length,
  );
});
test("20 kalemli set satışı ortak alt stokları günceller", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Set reçeteleri");
  const before = await state(page);
  await page.getByRole("button", { name: "Reçeteyi incele" }).first().click();
  await expect(page.locator(".recipe-row")).toHaveCount(20);
  await shot(page, info, "set-recetesi");
  await page.getByRole("button", { name: /1 set satışı gir/ }).click();
  await approve(page);
  const after = await state(page);
  expect(after.orders).toHaveLength(before.orders.length + 1);
  expect(after.orders[0].kit).toBe(before.kits[0].id);
  for (const l of after.orders[0].lines) {
    const b = before.products.find((p) => p.id === l.product)!.variants[
      l.variant
    ].stock[0];
    expect(
      after.products.find((p) => p.id === l.product)!.variants[l.variant]
        .stock[0],
    ).toBe(b - l.qty);
  }
});
test("kanal siparişi stok düşer, iade aynı stoğu geri alır", async ({
  page,
}) => {
  await login(page);
  await nav(page, "Siparişler");
  const before = await state(page);
  await page.getByRole("button", { name: "Sipariş ekle" }).click();
  await page
    .locator(".line-picker")
    .getByLabel("Adet", { exact: true })
    .fill("2");
  await page.getByRole("button", { name: /Listeye ekle/ }).click();
  await page.getByRole("button", { name: "Siparişi onayla" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const after = await state(page);
  expect(after.products[0].variants[0].stock[0]).toBe(
    before.products[0].variants[0].stock[0] - 2,
  );
  await page
    .locator(".order-row")
    .filter({ hasText: after.orders[0].id })
    .click();
  await page.getByRole("button", { name: "İade al", exact: true }).click();
  await approve(page);
  expect((await state(page)).products[0].variants[0].stock[0]).toBe(
    before.products[0].variants[0].stock[0],
  );
});
test("toptan kısmi toplama net stok ve cari, fiş PDF ve iade", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Siparişler");
  const before = await state(page);
  const baseBalance = before.entries
    .filter((e) => e.account === "C-001")
    .reduce((n, e) => n + e.debit - e.credit, 0);
  await page
    .locator(".order-row")
    .filter({ hasText: "TOP-2026-00125" })
    .click();
  await page.locator('[name="picked-0"]').fill("2");
  await page.getByRole("button", { name: "Sonraki ürün", exact: true }).click();
  await page.locator('[name="picked-1"]').fill("1");
  await page.getByRole("button", { name: "Sonraki ürün", exact: true }).click();
  await page.locator('[name="picked-2"]').fill("0");
  await expect(page.locator(".picking-row").first()).toContainText("Eksik");
  await expect(page.locator(".picking-row").last()).toContainText("Yok");
  await shot(page, info, "mobil-toplama");
  await page.getByRole("button", { name: "Net teslimatı onayla" }).click();
  await approve(page);
  const after = await state(page);
  for (const l of after.orders.find((o) => o.id === "TOP-2026-00125")!.lines) {
    const old = before.products.find((p) => p.id === l.product)!.variants[
      l.variant
    ].stock[0];
    expect(
      after.products.find((p) => p.id === l.product)!.variants[l.variant]
        .stock[0],
    ).toBe(old - l.picked);
  }
  const o = after.orders.find((o) => o.id === "TOP-2026-00125")!;
  const net = o.lines.reduce((n, l) => n + l.picked * l.price, 0);
  expect(
    after.entries
      .filter((e) => e.account === "C-001")
      .reduce((n, e) => n + e.debit - e.credit, 0),
  ).toBeCloseTo(baseBalance + net);
  await page
    .locator(".order-row")
    .filter({ hasText: "TOP-2026-00125" })
    .click();
  await page.getByRole("button", { name: "Teslimat fişi / PDF" }).click();
  await shot(page, info, "teslimat-fisi");
  await mkdir(evidence, { recursive: true });
  await page.pdf({
    path: join(evidence, `${info.project.name}-teslimat-fisi.pdf`),
    format: "A4",
  });
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "true";
    };
  });
  await page
    .getByRole("button", { name: "Yazdır / PDF olarak kaydet" })
    .click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "true");
  await close(page);
  await page
    .locator(".order-row")
    .filter({ hasText: "TOP-2026-00125" })
    .click();
  await page.getByRole("button", { name: "İade al", exact: true }).click();
  await approve(page);
  expect((await state(page)).products[0].variants[0].stock[0]).toBe(
    before.products[0].variants[0].stock[0],
  );
  expect(
    (await state(page)).entries
      .filter((e) => e.account === "C-001")
      .reduce((n, e) => n + e.debit - e.credit, 0),
  ).toBeCloseTo(baseBalance);
});
test("yeni toptan sipariş personele atanır, stok başlangıçta değişmez", async ({
  page,
}) => {
  await login(page);
  await nav(page, "Siparişler");
  const before = await state(page);
  await page
    .getByRole("button", { name: "Toptan sipariş", exact: true })
    .click();
  await page
    .getByLabel("Depo personeli", { exact: true })
    .selectOption("P-002");
  await page.getByRole("button", { name: /Listeye ekle/ }).click();
  await page.getByRole("button", { name: "Siparişi onayla" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const after = await state(page);
  expect(after.orders[0].assignee).toBe("P-002");
  expect(after.orders[0].status).toBe("Toplanacak");
  expect(after.products).toEqual(before.products);
  expect(after.entries).toEqual(before.entries);
});
test("sevkiyat talebi, gönderen onayı ve alıcı teslim onayı", async ({
  page,
}) => {
  await login(page);
  await nav(page, "Sevkiyatlar");
  const before = await state(page);
  const l = before.transfers[0].lines[0];
  const p = before.products.find((p) => p.id === l.product)!;
  await page.getByRole("button", { name: "Sevki onayla", exact: true }).click();
  await approve(page);
  let after = await state(page);
  expect(
    after.products.find((p) => p.id === l.product)!.variants[l.variant].stock,
  ).toEqual([
    p.variants[l.variant].stock[0] - l.qty,
    p.variants[l.variant].stock[1],
    p.variants[l.variant].stock[2],
  ]);
  await page.getByRole("button", { name: "Teslim al", exact: true }).click();
  await approve(page);
  after = await state(page);
  expect(
    after.products.find((p) => p.id === l.product)!.variants[l.variant]
      .stock[1],
  ).toBe(p.variants[l.variant].stock[1] + l.qty);
  await page.getByRole("button", { name: "Sevkiyat talebi" }).click();
  await page.getByRole("button", { name: /Listeye ekle/ }).click();
  await page
    .getByRole("button", { name: "Talep oluştur", exact: true })
    .click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect((await state(page)).transfers[0].status).toBe("Talep");
});
test("cari tahsilat, makbuz ve tarih aralıklı ekstre PDF", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Cari hesaplar");
  const before = await state(page);
  await page
    .getByRole("button", { name: "Tahsilat al", exact: true })
    .first()
    .click();
  await page.getByLabel("Tutar (₺)", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Makbuzu kaydet" }).click();
  await expect(
    page.getByText("Tahsilat makbuzu", { exact: false }),
  ).toBeVisible();
  expect((await state(page)).entries[0].credit).toBe(500);
  await shot(page, info, "tahsilat-makbuzu");
  await close(page);
  await page.getByRole("button", { name: "Tarih aralıklı ekstre" }).click();
  const d = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  await page.getByLabel("Başlangıç tarihi").fill(d);
  await page.getByLabel("Bitiş tarihi").fill(d);
  await page.getByRole("button", { name: "Ekstreyi görüntüle" }).click();
  await expect(page.locator(".print-document")).toContainText(
    "Devir bakiyesi: 85.000,00",
  );
  await expect(page.locator(".print-document")).toContainText(
    "Dönem sonu bakiye: 84.500,00",
  );
  await shot(page, info, "cari-ekstre");
  await page.pdf({
    path: join(evidence, `${info.project.name}-cari-ekstre.pdf`),
    format: "A4",
  });
  expect((await state(page)).entries).toHaveLength(before.entries.length + 1);
});
test("sıfır gün vadeli cari kartı oluşturulur ve doğru açılır", async ({
  page,
}) => {
  await login(page);
  await nav(page, "Cari hesaplar");
  await page.getByRole("button", { name: "Cari ekle" }).click();
  await page.getByLabel("Kurgusal ticari ad").fill("Kurgusal Test Cari");
  await page.getByLabel("Şehir", { exact: true }).fill("Bursa");
  await page.getByLabel("Vade (gün)").fill("0");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const row = page
    .locator(".account-row")
    .filter({ hasText: "Kurgusal Test Cari" });
  await row.getByRole("button", { name: "Hareketler" }).click();
  await page.getByRole("button", { name: "Kartı düzenle" }).click();
  await expect(page.getByLabel("Vade (gün)")).toHaveValue("0");
  expect(
    (await state(page)).accounts.find((a) => a.name === "Kurgusal Test Cari")!
      .days,
  ).toBe(0);
});
test("personel rol ve lokasyon kartı ile izin avans kaydı", async ({
  page,
}) => {
  await login(page);
  await nav(page, "Personel");
  await page.getByRole("button", { name: "Personel ekle" }).click();
  await page.getByLabel("Kurgusal personel adı").fill("Test Depocu");
  await page.getByLabel("Rol / yetki").selectOption("Depo");
  await page.getByLabel("Atanmış lokasyon").selectOption("2");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const row = page.locator(".staff-row").filter({ hasText: "Test Depocu" });
  await expect(row).toContainText("Beşiktaş (Mağaza)");
  await row.getByRole("button", { name: "İzin / avans" }).click();
  await page.getByLabel("Kayıt türü").selectOption("Avans");
  await page.getByLabel("Gün / tutar (₺)").fill("1500");
  await page.getByLabel("Açıklama", { exact: true }).fill("Demo avans kaydı");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(row).toContainText("1.500,00");
});
for (const role of ["Depo", "Mağaza", "Muhasebe"])
  test(`${role} rolü yetki ve lokasyon ayrımı`, async ({ page }, info) => {
    await login(page, role);
    const toggle = page.getByRole("button", { name: "Menüyü aç", exact: true });
    if (await toggle.isVisible()) await toggle.click();
    await expect(
      page.getByRole("navigation").getByRole("button", { name: "Kanallar" }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: "Personel", exact: true }),
    ).toHaveCount(0);
    if (role === "Muhasebe") {
      await expect(
        page
          .getByRole("navigation")
          .getByRole("button", { name: "Merkez stok", exact: true }),
      ).toHaveCount(0);
      await nav(page, "Cari hesaplar");
    } else {
      await expect(
        page
          .getByRole("navigation")
          .getByRole("button", { name: "Cari hesaplar", exact: true }),
      ).toHaveCount(0);
      await nav(page, "Merkez stok");
      await page.locator(".filter-disclosure summary").click();
      await expect(
        page.getByRole("combobox", { name: "Stok lokasyonu" }),
      ).toHaveValue(role === "Depo" ? "0" : "1");
      await page.locator(".product-row").first().click();
      await expect(page.getByText(/Alış .* Toptan/)).toHaveCount(0);
    }
    await shot(page, info, `rol-${role}`);
  });
test("demo sıfırlama başlangıç durumunu geri getirir", async ({ page }) => {
  await login(page);
  await nav(page, "Cari hesaplar");
  await page
    .getByRole("button", { name: "Tahsilat al", exact: true })
    .first()
    .click();
  await page.getByLabel("Tutar (₺)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Makbuzu kaydet" }).click();
  await close(page);
  expect((await state(page)).entries).toHaveLength(4);
  await nav(page, "İşlem günlüğü");
  await page.getByRole("button", { name: "Çalışma alanını sıfırla" }).click();
  await approve(page);
  expect((await state(page)).entries).toHaveLength(3);
  expect((await state(page)).logs).toHaveLength(1);
});
test("PWA çevrimdışı yeniden açılır, katalog görselleri yereldir", async ({
  page,
  context,
}, info) => {
  await login(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(async () =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".page-heading h1")).toHaveText("Bugün");
  await nav(page, "Merkez stok");
  await expect(page.locator(".product-row")).toHaveCount(12);
  await expect
    .poll(async () =>
      page
        .locator(".product-image")
        .first()
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
  await shot(page, info, "cevrimdisi");
  await context.setOffline(false);
});

test("Bot Vatkası 1/12/3 çarpanlı kanal satışı ve stok önizlemesi", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Mağaza işlemleri");
  const before = await state(page);
  const stock = before.products.find((p) => p.id === "VAT-001")!.variants[0]
    .stock[1];
  await page.getByLabel("Kanal sipariş adedi").fill("2");
  await expect(page.getByText("2 sipariş × 12 = 24 tekli düşer")).toBeVisible();
  await shot(page, info, "vatka-carpan-1-12-3");
  await page
    .getByRole("button", { name: "Siparişi yerelde dene · ×12", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).products.find((p) => p.id === "VAT-001")!
          .variants[0].stock[1],
    )
    .toBe(stock - 24);
  const after = await state(page);
  expect(after.orders[0].lines[0].multiplier).toBe(12);
  expect(after.orders[0].lines[0].qty).toBe(2);
});

test("toplu kaynak SKU onayı ve öneri reddi", async ({ page }, info) => {
  await login(page);
  await nav(page, "Kanallar");
  await page.getByRole("button", { name: /^askerkolisi/ }).click();
  await page.locator(".mapping-row input[type=checkbox]").nth(0).check();
  await page.locator(".mapping-row input[type=checkbox]").nth(1).check();
  await page
    .getByRole("button", { name: "Seçilenleri incele (2)", exact: true })
    .click();
  await shot(page, info, "toplu-sku-varyant-carpan-onayi");
  await page.getByRole("button", { name: "Toplu onayla", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(
    (await state(page)).listings.filter(
      (l) => l.channel === "askerkolisi.com" && l.confirmed,
    ),
  ).toHaveLength(2);
  await page
    .locator(".mapping-row")
    .first()
    .getByRole("button", { name: "Eşleşmeyi düzenle", exact: true })
    .click();
  await page.getByRole("button", { name: "Reddet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(
    (await state(page)).listings.filter(
      (l) => l.channel === "askerkolisi.com" && l.rejected,
    ),
  ).toHaveLength(1);
});

test("12'li set XL giyim, ayak numarası, sabit aksesuar ve aylık rapor", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Set reçeteleri");
  await page.getByLabel("Beden grubu").selectOption("XL");
  await page.locator(".kit-filters summary").click();
  await page.getByLabel("Ayak numarası").selectOption("44–45");
  const card = page
    .locator(".kit-card")
    .filter({ hasText: "Temel Asker Seti · 12'li" });
  await card.getByRole("button", { name: "Reçeteyi incele" }).click();
  await expect(
    page.locator(".recipe-row").filter({ hasText: "Kesilebilir Tabanlık" }),
  ).toContainText("1 adet");
  await expect(
    page.locator(".recipe-row").filter({ hasText: "Fanila" }),
  ).toContainText("12 adet");
  await shot(page, info, "12li-set-recete");
  await page.getByRole("button", { name: /1 set satışı gir/ }).click();
  await approve(page);
  const o = (await state(page)).orders[0];
  expect(o.kit).toBe("TEMEL-12");
  expect(o.lines.find((l) => l.product === "FAN-HK")!.qty).toBe(12);
  expect(o.lines.find((l) => l.product === "PEC-010")!.qty).toBe(2);
  await nav(page, "Raporlar");
  await expect(
    page.getByRole("heading", { name: "Set satışları" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".mapping-row")
      .filter({ hasText: "Temel Asker Seti · 12'li" }),
  ).toContainText("XL");
  await shot(page, info, "set-kanal-beden-raporu");
});

test("fotoğraflı toplu günlük satış ve Beşiktaş lokasyon yetkisi", async ({
  page,
}, info) => {
  await login(page);
  await user(page, "P-005");
  await nav(page, "Mağaza işlemleri");
  await page
    .getByRole("button", { name: "Fotoğraflı toplu seçim", exact: true })
    .click();
  const before = await state(page);
  await expect(page.getByLabel("Lokasyon", { exact: true })).toHaveValue("2");
  await page.getByPlaceholder("Ad / SKU").fill("FAN-HK");
  await page.locator(".photo-picker input[type=checkbox]").check();
  await page.getByLabel("FAN-HK toplu adet").fill("3");
  await shot(page, info, "fotografli-gunluk-magaza-satisi");
  await page
    .getByRole("button", { name: "Günlük satışı kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).products.find((p) => p.id === "FAN-HK")!.variants[0]
          .stock[2],
    )
    .toBe(
      before.products.find((p) => p.id === "FAN-HK")!.variants[0].stock[2] - 3,
    );
  await page.getByRole("button", { name: "Çarpan", exact: true }).click();
  await page
    .getByRole("button", { name: "Siparişi yerelde dene · ×12", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("yetkiniz yok");
  expect(
    (await state(page)).products.find((p) => p.id === "VAT-001")!.variants[0]
      .stock[1],
  ).toBe(before.products.find((p) => p.id === "VAT-001")!.variants[0].stock[1]);
});

test("bildirim okundu ve işlem yetkisi değişikliği", async ({ page }, info) => {
  await login(page);
  await nav(page, "Mağaza işlemleri");
  await page.getByRole("button", { name: "Yetkiler", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Personel", exact: true })
    .selectOption("P-003");
  await page.getByLabel("Günlük satış (retail)", { exact: true }).uncheck();
  await expect
    .poll(async () =>
      (await state(page)).staff
        .find((p) => p.id === "P-003")!
        .permissions!.includes("retail"),
    )
    .toBe(false);
  await page.getByLabel("Beşiktaş (Mağaza)", { exact: true }).check();
  await nav(page, "Personel");
  await page
    .locator(".staff-row")
    .filter({ hasText: "Mağazacı" })
    .getByRole("button", { name: "Düzenle", exact: true })
    .click();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const edited = (await state(page)).staff.find((p) => p.id === "P-003")!;
  expect(edited.permissions!.includes("retail")).toBe(false);
  expect(edited.locations).toContain(2);
  await user(page, "P-003");
  await nav(page, "Merkez stok");
  await page.locator(".filter-disclosure summary").click();
  await page.getByLabel("Stok lokasyonu").selectOption("2");
  await expect(page.getByLabel("Stok lokasyonu")).toHaveValue("2");
  await user(page, "P-001");
  await nav(page, "Mağaza işlemleri");
  await page.getByRole("button", { name: "Yetkiler", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Personel", exact: true })
    .selectOption("P-003");
  await shot(page, info, "kullanici-lokasyon-islem-yetkileri");
  await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
  await page
    .getByRole("button", { name: "Tümünü okundu işaretle", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).readNotifications!.length)
    .toBeGreaterThan(0);
  await shot(page, info, "bildirimler");
});

test("Askerkolisi kaynağından kışlık denizci reçetesi düzenlenip kaydedilir", async ({
  page,
}, info) => {
  await login(page);
  await nav(page, "Set reçeteleri");
  await page.locator(".source-recipes>summary").click();
  await page.getByLabel("Kaynak set ara").fill("6'lı Kışlık Denizci");
  await page.locator(".source-recipes .live-order>summary").first().click();
  await expect(
    page.locator(".source-recipes .live-order").first(),
  ).toContainText("6 adet beyaz fanila");
  await page
    .getByRole("button", { name: "Kaynak reçeteyi düzenle", exact: true })
    .click();
  await expect(page.getByLabel("Giyim adedi N", { exact: true })).toHaveValue(
    "6",
  );
  await expect(page.getByLabel("Set adı", { exact: true })).toHaveValue(
    /Denizci/,
  );
  await shot(page, info, "askerkolisi-kaynak-recete");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const k = (await state(page)).kits.at(-1)!;
  expect(k.source).toMatch(/^https:\/\/askerkolisi.com\//);
  expect(k.recipe.find((r) => r.product === "SRC-TERMAL")?.mode).toBe("fixed");
  expect(k.clothingCount).toBe(6);
  await page
    .locator(".kit-card")
    .filter({ hasText: k.name })
    .getByRole("button", { name: "Reçeteyi incele" })
    .click();
  await page.getByRole("button", { name: /1 set satışı gir/ }).click();
  await approve(page);
  const order = (await state(page)).orders[0];
  expect(order.kit).toBe(k.id);
  expect(order.lines.find((l) => l.product === "SRC-TERMAL")!.qty).toBe(1);
  expect(order.lines.reduce((a, l) => a + l.qty * l.price, 0)).toBeCloseTo(
    k.price,
  );
});

test("İstanbul gece yarısı satışı aynı günün listesine girer", async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date("2026-11-24T21:30:00Z") });
  await login(page, "Mağaza");
  await nav(page, "Mağaza işlemleri");
  await expect(page.getByLabel("Satış / kabul tarihi")).toHaveValue(
    "2026-11-25",
  );
  await page
    .locator(".photo-picker article")
    .filter({ hasText: "AM-0001" })
    .locator("input[type=checkbox]")
    .check();
  await page
    .getByRole("button", { name: "Günlük satışı kaydet", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).orders.filter((o) => o.channel === "Mağaza").length,
    )
    .toBeGreaterThan(0);
  await nav(page, "Bugün");
  await expect(
    page.locator(".today-layout .task-row").filter({ hasText: /MAGAZA-/ }),
  ).toHaveCount(1);
  await shot(page, info, "geceyarisi-magaza");
});
