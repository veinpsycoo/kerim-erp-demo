import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const base = "https://veinpsycoo.github.io/kerim-erp-demo/";
const expected = await readFile("dist/index.html", "utf8");
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const html = await fetch(base, {
    headers: { "Cache-Control": "no-cache" },
  }).then((r) => r.text());
  if (html === expected) {
    ready = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
if (!ready) throw Error("Published build does not match screenshot source");
const dir = "presentation";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const images = [];
try {
  for (const [index, role] of [
    "Yönetici",
    "Depo",
    "Mağaza",
    "Muhasebe",
  ].entries()) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(base);
    await page
      .getByRole("heading", { name: "Kimsiniz?", exact: true })
      .waitFor();
    const capture = async (name) => {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() =>
        [...document.images]
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return r.top < innerHeight && r.bottom > 0;
          })
          .every((i) => i.complete),
      );
      await page.screenshot({
        path: dir + "/" + name + ".png",
        fullPage: false,
        animations: "disabled",
      });
      images.push({
        file: name + ".png",
        url: page.url(),
        width: 390,
        height: 844,
      });
    };
    if (index === 0) await capture("01-rol-secimi");
    await page.getByRole("button", { name: new RegExp("^" + role) }).click();
    await page.locator(".page-heading h1").waitFor();
    await capture(
      ["02-yonetici", "03-depo", "04-magaza", "05-muhasebe"][index],
    );
    if (index === 0) {
      await page
        .getByRole("navigation", { name: "Alt menü" })
        .getByRole("button", { name: "Stok", exact: true })
        .click();
      await page.locator(".product-row").first().waitFor();
      await capture("06-merkez-stok");
    }
    await context.close();
  }
  await writeFile(
    dir + "/manifest.json",
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        base,
        buildMatchesLive: true,
        images,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
