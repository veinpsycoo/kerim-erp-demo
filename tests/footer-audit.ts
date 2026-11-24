import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function installFooterAudit(page: Page) {
  await page.addInitScript(() => {
    const result: { checked: string[]; failures: unknown[] } = JSON.parse(
      sessionStorage.getItem("footer-audit") || '{"checked":[],"failures":[]}',
    );
    Object.assign(window, { footerAudit: result });
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      document
        .querySelectorAll<HTMLButtonElement>("dialog[open] .dialog-foot button")
        .forEach((button) => {
          const r = button.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const title =
            button.closest("dialog")?.querySelector("h2")?.textContent || "";
          const label = button.textContent?.trim() || "";
          const key = title + ": " + label;
          if (!result.checked.includes(key)) result.checked.push(key);
          const range = document.createRange();
          range.selectNodeContents(button);
          const text = range.getBoundingClientRect();
          const clipped =
            button.scrollHeight > button.clientHeight + 1 ||
            button.scrollWidth > button.clientWidth + 1 ||
            text.top < r.top - 1 ||
            text.bottom > r.bottom + 1 ||
            text.left < r.left - 1 ||
            text.right > r.right + 1 ||
            r.bottom > innerHeight + 1 ||
            r.top < 0;
          if (
            clipped &&
            !result.failures.some((f) => JSON.stringify(f).includes(key))
          )
            result.failures.push({
              key,
              rect: r.toJSON(),
              text: text.toJSON(),
              scrollHeight: button.scrollHeight,
              clientHeight: button.clientHeight,
            });
        });
      sessionStorage.setItem("footer-audit", JSON.stringify(result));
    };
    const start = () => {
      new MutationObserver(() => {
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(() => requestAnimationFrame(scan));
        }
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    };
    if (document.body) start();
    else addEventListener("DOMContentLoaded", start, { once: true });
  });
}

export async function verifyFooterAudit(page: Page, info: TestInfo) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const result = await page.evaluate(
    () =>
      (
        window as unknown as {
          footerAudit?: { checked: string[]; failures: unknown[] };
        }
      ).footerAudit,
  );
  const dir = process.env.EVIDENCE_DIR || "playwright-evidence/local";
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(
      dir,
      `footer-${info.project.name}-${info.testId.replace(/[^a-z0-9]/gi, "-")}.json`,
    ),
    JSON.stringify(result, null, 2),
  );
  expect(
    result?.failures,
    "All visited dialog footer buttons: scroll and text bounds",
  ).toEqual([]);
}
