import { expect, test } from "vitest";
import { seed } from "./seed";
import { normalizeSavedText } from "./saved-text";

test("fresh labels contain no legacy demo markers", () => {
  const state = seed();
  expect(normalizeSavedText(state)).toEqual({ state, changed: false });
  expect(JSON.stringify(state)).not.toMatch(/DEMO|Demo |\(demo\)/);
});

test("old saves retain stock, money and relationships when labels are updated", () => {
  const saved = seed();
  saved.orders[0].id = "SP-DEMO-001";
  saved.orders[0].operator = "Demo Depocu";
  saved.transfers[0].id = "SV-DEMO-001";
  saved.entries[0].id = "CR-DEMO-1";
  saved.entries[0].memo = "Demo açılış bakiyesi";
  saved.staff[0].name = "Demo Yönetici";
  saved.logs[0].id = "LOG-DEMO";
  saved.logs[0].message = "SP-DEMO-001 kaydedildi";
  saved.queue.push({ id: "KY-1", channel: "Trendyol", count: 3, status: "Tamamlandı (demo)", date: "2026-11-25" });
  const { state, changed } = normalizeSavedText(saved);
  expect(changed).toBe(true);
  expect(state.orders[0]).toEqual({ ...saved.orders[0], id: "SP-2026-0001", operator: "Depocu" });
  expect(state.transfers[0]).toEqual({ ...saved.transfers[0], id: "SV-2026-0001" });
  expect(state.entries[0]).toEqual({ ...saved.entries[0], id: "CR-2026-0001", memo: "Açılış bakiyesi" });
  expect(state.products).toEqual(saved.products);
  expect(state.staff[0]).toEqual({ ...saved.staff[0], name: "Yönetici" });
  expect(state.logs[0].message).toBe("SP-2026-0001 kaydedildi");
  expect(state.queue[0].status).toBe("Tamamlandı");
  expect(normalizeSavedText(state)).toEqual({ state, changed: false });
});
