import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
]) {
  test(`toplama ilk ekran geometrisi ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await page.getByRole("button", { name: /^Depo/ }).click();
    await page
      .getByRole("button", { name: "Toplamaya başla", exact: true })
      .click();
    await expect(
      page.locator(".picking-row:visible .pick-quantity"),
    ).toHaveText("120");
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          height: r.height,
        };
      };
      const row = ".picking-row:not([hidden])";
      const body = document.querySelector(".picking-dialog .dialog-body")!;
      const quantity = document.querySelector(`${row} .pick-quantity`)!;
      return {
        name: rect(`${row} .pick-product > strong`),
        demand: rect(`${row} .pick-demand`),
        save: rect(".picking-dialog button[type=submit]"),
        footer: rect(".picking-dialog .dialog-foot"),
        body: rect(".picking-dialog .dialog-body"),
        image: rect(`${row} .product-image`),
        scrollTop: body.scrollTop,
        paddingBottom: parseFloat(getComputedStyle(body).paddingBottom),
        size: parseFloat(getComputedStyle(quantity).fontSize),
        weight: getComputedStyle(quantity).fontWeight,
      };
    });
    expect(geometry.scrollTop).toBe(0);
    for (const r of [geometry.name, geometry.demand, geometry.save]) {
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.bottom).toBeLessThanOrEqual(viewport.height);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(viewport.width);
    }
    expect(geometry.demand.bottom).toBeLessThanOrEqual(geometry.footer.top);
    expect(geometry.demand.bottom).toBeLessThanOrEqual(geometry.body.bottom);
    expect(geometry.save.top).toBeGreaterThanOrEqual(geometry.footer.top);
    expect(geometry.save.bottom).toBeLessThanOrEqual(geometry.footer.bottom);
    expect(geometry.image.height).toBeLessThanOrEqual(200);
    expect(geometry.paddingBottom).toBeGreaterThanOrEqual(
      geometry.footer.height,
    );
    expect(geometry.size).toBe(40);
    expect(geometry.weight).toBe("700");
    await page.locator(".picking-dialog .dialog-body").evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    const lastAction = await page.locator(".deliver-button").boundingBox();
    expect(lastAction!.y + lastAction!.height).toBeLessThanOrEqual(
      geometry.footer.top,
    );
  });
}

test("390 yönetici dikkat isteyenler ilk ekranda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: /^Yönetici/ }).click();
  await page.evaluate(() => document.fonts.ready);
  const r = await page
    .getByRole("heading", { name: "Dikkat isteyenler", exact: true })
    .boundingBox();
  expect(r!.y).toBeGreaterThanOrEqual(0);
  expect(r!.y + r!.height).toBeLessThanOrEqual(844 - 80);
});
