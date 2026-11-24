import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  maxFailures: 0,
  workers: 2,
  retries: 0,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: process.env.EVIDENCE_DIR
          ? process.env.EVIDENCE_DIR + "/results.json"
          : "playwright-evidence/local/results.json",
      },
    ],
  ],
  use: {
    baseURL: process.env.LIVE_URL || "http://127.0.0.1:4173/kerim-erp-demo/",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
  },
  projects: [
    { name: "desktop-1366", use: { viewport: { width: 1366, height: 900 } } },
    {
      name: "mobile-390",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.LIVE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173/kerim-erp-demo/",
        reuseExistingServer: !process.env.CI,
      },
});
