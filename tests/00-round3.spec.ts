import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const evidence = process.env.EVIDENCE_DIR || "demo-kanit/round4/local";
const menus = [
  ["dashboard", "Bugün"],
  ["stock", "Merkez stok"],
  ["channels", "Kanallar"],
  ["kits", "Set reçeteleri"],
  ["operations", "Mağaza işlemleri"],
  ["reports", "Raporlar"],
  ["orders", "Siparişler"],
  ["transfers", "Sevkiyatlar"],
  ["accounts", "Cari hesaplar"],
  ["staff", "Personel"],
  ["settings", "İşlem günlüğü"],
];
async function nav(page: Page, id: string, name: string) {
  const desktop = page
    .getByRole("navigation", { name: "Ana menü" })
    .getByRole("button", { name, exact: true });
  if (await desktop.isVisible()) {
    await desktop.click();
    return;
  }
  const labels: Record<string, string> = {
    dashboard: "Bugün",
    stock: "Stok",
    operations: "Satış",
    reports: "Raporlar",
    orders: "Sipariş",
    transfers: "Sevkiyat",
    accounts: "Cari",
  };
  const quick = page
    .getByRole("navigation", { name: "Alt menü" })
    .getByRole("button", { name: labels[id] || name, exact: true });
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
async function measure(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect(),
        s = getComputedStyle(e);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        !e.closest("[hidden],details:not([open]) > :not(summary)")
      );
    };
    const tinyText = Array.from(document.querySelectorAll("body *"))
      .filter(
        (e) =>
          visible(e) &&
          Array.from(e.childNodes).some(
            (n) => n.nodeType === 3 && n.textContent?.trim(),
          ) &&
          parseFloat(getComputedStyle(e).fontSize) < 13,
      )
      .map((e) => ({
        text: e.textContent?.slice(0, 60),
        size: getComputedStyle(e).fontSize,
      }));
    const tinyTargets = Array.from(
      document.querySelectorAll("button,a[href],input,select,textarea,summary"),
    )
      .filter((e) => visible(e) && !e.matches("input[type=hidden]"))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      })
      .map((e) => ({
        text: (
          e.getAttribute("aria-label") ||
          e.textContent ||
          e.tagName
        ).slice(0, 60),
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      }));
    const rgb = (value: string) => {
      const a = value.match(/[\d.]+/g)?.map(Number) || [255, 255, 255];
      return a;
    };
    const luminance = (c: number[]) =>
      c
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrastFailures = Array.from(document.querySelectorAll("body *"))
      .filter(
        (e) =>
          visible(e) &&
          Array.from(e.childNodes).some(
            (n) => n.nodeType === 3 && n.textContent?.trim(),
          ),
      )
      .flatMap((e) => {
        const style = getComputedStyle(e),
          fg = rgb(style.color);
        let node: Element | null = e,
          bg = [255, 255, 255];
        while (node) {
          const c = rgb(getComputedStyle(node).backgroundColor);
          if (c.length < 4 || c[3] === 1) {
            bg = c;
            break;
          }
          node = node.parentElement;
        }
        const l1 = luminance(fg),
          l2 = luminance(bg),
          ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const large =
          parseFloat(style.fontSize) >= 24 ||
          (parseFloat(style.fontSize) >= 18.66 &&
            Number(style.fontWeight) >= 700);
        return ratio < (large ? 3 : 4.5)
          ? [{ text: e.textContent?.slice(0, 60), ratio }]
          : [];
      });
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      tinyText,
      tinyTargets,
      contrastFailures,
      text: document.body.innerText,
    };
  });
}
for (const role of ["Yönetici", "Depo", "Mağaza", "Muhasebe"])
  test(`${role}: tüm ekranlar, ölçüler, rol ve kanıt`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await mkdir(evidence, { recursive: true });
    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: "Kimsiniz?" }),
    ).toBeVisible();
    if (role === "Yönetici")
      await page.screenshot({
        path: join(evidence, `${info.project.name}-rol-secimi.png`),
        fullPage: true,
      });
    await page.getByRole("button", { name: new RegExp("^" + role) }).click();
    await expect(page.locator(".page-heading h1")).toHaveText("Bugün");
    const results = [];
    for (const [id, name] of menus) {
      const allowed =
        role === "Yönetici" ||
        (role === "Muhasebe"
          ? ["dashboard", "reports", "orders", "accounts", "settings"]
          : ["dashboard", "stock", "kits", "operations", "orders", "transfers"]
        ).includes(id);
      await expect(
        page
          .getByRole("navigation", { name: "Ana menü", includeHidden: true })
          .getByRole("button", { name, exact: true, includeHidden: true }),
      ).toHaveCount(allowed ? 1 : 0);
      if (!allowed) continue;
      await nav(page, id, name);
      await expect(page.locator(".page-heading h1")).toHaveText(name);
      await expect(page).toHaveURL(new RegExp("#" + id + "$"));
      const m = await measure(page);
      results.push({ id, ...m });
      expect(m.overflow, "overflow " + id).toBe(false);
      expect(m.tinyText, "small text " + id).toEqual([]);
      expect(m.contrastFailures, "AA contrast " + id).toEqual([]);
      expect(m.tinyTargets, "touch targets " + id).toEqual([]);
      expect(m.text).not.toContain("Demo:");
      expect(
        m.text.replace(/(?:SP|SV)-DEMO-\d+/g, "").match(/\bdemo\b/gi),
      ).toEqual(["Demo"]);
      if (["dashboard", "stock", "channels", "accounts"].includes(id))
        await page.screenshot({
          path: join(evidence, `${info.project.name}-${role}-${id}.png`),
          fullPage: true,
          animations: "disabled",
        });
      if (id === "channels") {
        await expect(page.locator("#multiplier-example")).toBeVisible();
        await expect(page.locator("#multiplier-example")).toContainText(
          "Çarpan ×12",
        );
        await expect(page.locator(".mapping-row")).toHaveCount(20);
      }
    }
    if (role === "Yönetici" || role === "Depo") {
      await nav(page, "dashboard", "Bugün");
      const shortcut = page
        .getByRole("button", { name: /^Kritik stok/ })
        .first();
      const count = Number(await shortcut.locator("strong").innerText());
      await shortcut.click();
      await expect(page.locator(".result-meta>span").first()).toHaveText(
        `${count} ürün bulundu`,
      );
      await page.locator(".filter-disclosure summary").click();
      await expect(
        page.getByRole("checkbox", { name: "Yalnız kritik stok", exact: true }),
      ).toBeChecked();
    }
    if (role === "Depo") {
      await nav(page, "dashboard", "Bugün");
      await page.getByRole("button", { name: "Toplamaya başla" }).click();
      await expect(page.locator(".picking-row:visible")).toHaveCount(1);
      const m = await measure(page);
      expect(m.overflow).toBe(false);
      expect(m.tinyTargets).toEqual([]);
      await page.screenshot({
        path: join(evidence, `${info.project.name}-toplama.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Topladım", exact: true }).click();
      await page.getByRole("button", { name: "Pencereyi kapat" }).click();
    }
    await page
      .getByRole("button", { name: "Profil ve ayarlar", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "Rol değiştir" }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".profile-chip")).toContainText(role);
    expect(errors).toEqual([]);
    await writeFile(
      join(evidence, `${info.project.name}-${role}.json`),
      JSON.stringify({ role, errors, results }, null, 2),
    );
  });

test("Klavye odağı, hareket tercihi ve rol değiştirme", async ({ page }) => {
  await page.goto("./");
  const button = page.getByRole("button", { name: /^Yönetici/ });
  await button.focus();
  const ring = await button.evaluate((e) => ({
    style: getComputedStyle(e).outlineStyle,
    width: parseFloat(getComputedStyle(e).outlineWidth),
  }));
  expect(ring.style).toBe("solid");
  expect(ring.width).toBeGreaterThanOrEqual(3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await button.evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  await button.click();
  await page
    .getByRole("button", { name: "Profil ve ayarlar", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Rol değiştir" }).click();
  await expect(page.getByRole("heading", { name: "Kimsiniz?" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("am-role"))).toBeNull();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const keys = await page.evaluate(() => caches.keys());
  expect(
    keys.filter((k) => k.startsWith("am-")).every((k) => k.endsWith("-4")),
  ).toBe(true);
});
