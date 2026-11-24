import { test, expect } from "@playwright/test";
import type { State } from "../src/domain";
import { totalStock } from "../src/domain";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

test("Yönetici: aynı stok kaynağı iki genişlikte ve sıfır dikkat boş durumu", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /^Yönetici/ }).click();
  await expect(page.locator(".page-heading h1")).toHaveText("Bugün");
  const read = () =>
    page.evaluate(
      () =>
        new Promise<State>((resolve) => {
          const r = indexedDB.open("asker-marketi-demo", 1);
          r.onsuccess = () => {
            const db = r.result;
            const q = db.transaction("state").objectStore("state").get("main");
            q.onsuccess = () => {
              db.close();
              resolve(q.result);
            };
          };
        }),
    );
  const initial = await read();
  const expected = initial.products.filter((p) => totalStock(p) < 20).length;
  const dir = process.env.EVIDENCE_DIR || "playwright-evidence/local";
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `stock-source-${test.info().project.name}.json`),
    JSON.stringify(
      {
        scope: "Tüm lokasyonlar",
        threshold: 20,
        expected,
        widths: [390, 1366],
      },
      null,
      2,
    ),
  );
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("button", { name: /^Kritik stok/ }).locator("strong"),
    ).toHaveText(String(expected));
    await expect(page.locator(".profile-chip")).toHaveText("YYönetici");
    await expect(page.locator(".topbar")).not.toContainText("Bugün");
    if (width === 390)
      await expect(page.locator(".screen-label")).toBeVisible();
    else await expect(page.locator(".screen-label")).toBeHidden();
  }
  await test.info().attach("stock-source", {
    body: JSON.stringify({
      scope: "Tüm lokasyonlar",
      threshold: 20,
      expected,
      widths: [390, 1366],
    }),
    contentType: "application/json",
  });
  initial.orders = [];
  initial.kits = [];
  initial.listings.forEach((l) => {
    l.confirmed = true;
  });
  await page.evaluate(
    (s) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open("asker-marketi-demo", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(s, "main");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    initial,
  );
  await page.reload();
  const attention = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Dikkat isteyenler" }) });
  await expect(attention).toContainText("Şu an dikkat isteyen iş yok");
  await expect(attention.locator(".task-row")).toHaveCount(0);
});
