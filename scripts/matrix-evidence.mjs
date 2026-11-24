import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "matrix-evidence";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto("https://veinpsycoo.github.io/kerim-erp-demo/");
  await page.getByRole("button", { name: /^Yönetici/ }).click();
  await page
    .getByRole("navigation", { name: "Alt menü" })
    .getByRole("button", { name: "Stok", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Ürün ara" }).fill("AM-0001");
  await page.locator(".product-row").click();
  await page.locator("dialog[open]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const checks = [];
  const check = async (name) => {
    const bounds = await page.evaluate(() => {
      const box = (s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      return {
        header: box("dialog[open] .dialog-head"),
        footer: box("dialog[open] .dialog-foot"),
        viewport: { width: innerWidth, height: innerHeight },
        scrollY,
        script: [...document.scripts].map((s) => s.src).filter(Boolean),
      };
    });
    checks.push({ name, ...bounds });
    if (
      bounds.header.top < -0.5 ||
      bounds.header.bottom > 844.5 ||
      bounds.footer.top < -0.5 ||
      bounds.footer.bottom > 844.5
    )
      throw Error("Dialog chrome outside viewport");
    await page.screenshot({
      path: dir + "/" + name + ".png",
      fullPage: false,
      animations: "disabled",
    });
  };
  await check("urun-karti-390");
  await page.locator(".matrix").scrollIntoViewIfNeeded();
  await check("urun-varyantlari-390");
  await writeFile(
    dir + "/geometry.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), passed: true, checks },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
