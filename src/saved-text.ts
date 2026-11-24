import type { State } from "./domain";

// Update labels from older browser saves without resetting operational data.
export function normalizeSavedText(saved: State): { state: State; changed: boolean } {
  let changed = false;
  const serialized = JSON.stringify(saved, (_key, value: unknown) => {
    if (typeof value !== "string") return value;
    const text = value
      .replace(/\b(SP|SV|CR)-DEMO-(\d+)\b/g, (_match, prefix: string, number: string) =>
        `${prefix}-2026-${number.padStart(4, "0")}`,
      )
      .replace(/\bLOG-DEMO\b/g, "LOG-2026-0001")
      .replace(/^Demo açılış bakiyesi$/, "Açılış bakiyesi")
      .replace(/^Demo tedarikçi bakiyesi$/, "Tedarikçi bakiyesi")
      .replace(/^Demo /, "")
      .replace(/ \(demo\)$/, "")
      .replace(/fiyat simüle edildi; ağ isteği yapılmadı/, "fiyat önizlemesi hazırlandı.");
    if (text !== value) changed = true;
    return text;
  });
  return { state: changed ? JSON.parse(serialized) as State : saved, changed };
}
