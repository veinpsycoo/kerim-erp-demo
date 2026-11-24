import { useMemo, useState } from "react";
import { Field, ProductImage, Badge, Dialog } from "./components";
import {
  LOCATIONS,
  dateKey,
  now,
  addOrder,
  bulkStock,
  log,
  money,
  positive,
  uid,
  type State,
  type Staff,
  type Line,
  type Kit,
} from "./domain";
import {
  authorize,
  listingOrder,
  listingStock,
  PERMISSIONS,
  PERMISSION_NAMES,
  suggestions,
} from "./kerim";
import { real } from "./snapshot";
import { sourceSets, sourceDraft } from "./source-recipes";
type Mutate = (fn: (n: State) => void, message?: string) => Promise<boolean>;
const orderStatus = (status: string) =>
  (
    ({
      atcollectionpoint: "Teslim noktasında",
      cancelled: "İptal",
      created: "Oluşturuldu",
      delivered: "Teslim edildi",
      partially_refunded: "Kısmi iade",
      picking: "Toplanıyor",
      refunded: "İade",
      refund_requested: "İade talebi",
      returned: "İade",
      shipped: "Kargoya verildi",
      undelivered: "Teslim edilemedi",
      completed: "Tamamlandı",
      failed: "Başarısız",
      "hezarfen-shipped": "Kargoya verildi",
      "on-hold": "Beklemede",
      pending: "Onay bekliyor",
      processing: "Hazırlanıyor",
    }) as Record<string, string>
  )[status.toLowerCase()] || status;
export function SourceRecipes({
  onImport,
}: {
  onImport?: (k: Omit<Kit, "id">) => void;
}) {
  const [search, setSearch] = useState(""),
    [error, setError] = useState("");
  return (
    <details className="panel source-recipes">
      <summary>
        Askerkolisi kaynak setleri ({sourceSets.length}) · açıklama ve reçete
      </summary>
      <p>
        Giyim N ile çarpılır; aksesuarlar sabittir. Kaynak metin ve ürün adları
        korunur. İçe aktarım düzenlenebilir reçete açar; renk, beden ve toplam
        kalem sayısını burada inceleyin.
      </p>
      <Field label="Kaynak set ara">
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sourceSets
        .filter((p) =>
          p.title
            .toLocaleLowerCase("tr")
            .includes(search.toLocaleLowerCase("tr")),
        )
        .slice(0, 12)
        .map((p) => (
          <details key={p.id} className="live-order">
            <summary>{p.title}</summary>
            <p>
              {p.variant} · {money(p.price)}
            </p>
            <p>
              {p.recipeText ||
                "API açıklaması boş. Tam reçete tahmin edilmez; elle oluşturulabilir."}
            </p>
            <p>
              <a href={p.url} target="_blank" rel="noreferrer">
                Kaynak ürün sayfası
              </a>
            </p>
            {onImport && p.recipeText && (
              <button
                onClick={() => {
                  try {
                    onImport(sourceDraft(p));
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Kaynak reçeteyi düzenle
              </button>
            )}
          </details>
        ))}
      <small>İlk 12 sonuç gösterilir; diğer setler için arama kullanın.</small>
    </details>
  );
}
export function SyncStatus() {
  return (
    <section className="sync-strip" aria-label="Senkron durumu">
      <strong>
        Son senkron:{" "}
        {real.syncedAt
          ? new Date(real.syncedAt).toLocaleString("tr-TR", {
              timeZone: "Europe/Istanbul",
            })
          : "Henüz çalıştırılmadı"}
      </strong>
      <span>Son 30 gün · gerçek kanal verisi · merkez stokları örnektir</span>
      <div className="sync-channels">
        {real.channels.map((c) => (
          <div key={c.name}>
            <strong>{c.name}</strong>
            <Badge tone={c.status === "bağlı · salt okuma" ? "green" : "amber"}>
              {c.status}
            </Badge>
            <small>
              {c.products} ilan/varyant · {c.orders} sipariş
              {c.error ? " · " + c.error : ""}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LiveOrders() {
  const [channel, setChannel] = useState("Tümü"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const rows = useMemo(
    () =>
      real.orders.filter(
        (o) =>
          (channel === "Tümü" || o.channel === channel) &&
          o.lines.some((l) =>
            `${l.title} ${l.sku}`
              .toLocaleLowerCase("tr")
              .includes(search.toLocaleLowerCase("tr")),
          ),
      ),
    [channel, search],
  );
  return (
    <details className="panel live-orders">
      <summary>
        Gerçek kanal siparişleri ({real.orders.length}) · salt okuma
      </summary>
      <p>
        Müşteri bilgisi içermez. Anlık görüntü siparişleri çalışma alanı stoğunu
        ve cariyi değiştirmez.
      </p>
      <div className="toolbar">
        <Field label="Gerçek sipariş kanalı">
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setPage(0);
            }}
          >
            {["Tümü", ...real.channels.map((c) => c.name)].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Siparişte ürün ara">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </Field>
      </div>
      <p>{rows.length} sipariş · tutarlar gizlilik nedeniyle yayımlanmaz</p>
      {rows.slice(page * 20, (page + 1) * 20).map((o) => (
        <details key={o.id} className="live-order">
          <summary>
            {o.date.slice(0, 10)} · {o.channel} · {orderStatus(o.status)}
          </summary>
          {o.lines.map((l, i) => (
            <p key={i}>
              {l.title} · {l.sku || "SKU yok"} · {l.qty} adet
            </p>
          ))}
        </details>
      ))}
      <div className="toolbar">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Önceki siparişler
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(rows.length / 20))}
        </span>
        <button
          className="secondary"
          disabled={(page + 1) * 20 >= rows.length}
          onClick={() => setPage(page + 1)}
        >
          Sonraki siparişler
        </button>
      </div>
    </details>
  );
}

export function Mapping({
  s,
  channel,
  mutate,
  operationError,
}: {
  s: State;
  channel: string;
  mutate: Mutate;
  operationError?: string;
}) {
  const [search, setSearch] = useState(""),
    [unmatched, setUnmatched] = useState(false),
    [pg, setPg] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [edit, setEdit] = useState(""),
    [sku, setSku] = useState(""),
    [variant, setVariant] = useState(0),
    [mult, setMult] = useState(1),
    [error, setError] = useState(""),
    [sim, setSim] = useState(""),
    [simQty, setSimQty] = useState(1);
  const rows = useMemo(
    () =>
      s.listings
        .filter(
          (l) =>
            (channel === "Tümü" || l.channel === channel) &&
            (!unmatched || !l.product) &&
            `${l.title} ${l.sku} ${l.channelVariant}`
              .toLocaleLowerCase("tr")
              .includes(search.toLocaleLowerCase("tr")),
        )
        .sort(
          (a, b) =>
            Number(!b.product && !!b.suggested) -
              Number(!a.product && !!a.suggested) ||
            (b.score ?? 0) - (a.score ?? 0),
        ),
    [s.listings, channel, unmatched, search],
  );
  const page = rows.slice(pg * 20, (pg + 1) * 20),
    l = s.listings.find((l) => l.id === edit),
    p = s.products.find((p) => p.id === sku);
  const candidates = rows.filter(
    (l) =>
      !l.product &&
      !l.rejected &&
      l.suggested &&
      (l.score ?? 0) >= (s.threshold ?? 82),
  );
  return (
    <>
      <div className="quiet-note">
        {
          s.listings.filter(
            (l) => l.real && (channel === "Tümü" || l.channel === channel),
          ).length
        }{" "}
        gerçek ilan · {rows.filter((l) => l.product).length} eşleşmiş (filtre) ·
        Benzer ürünleri inceleyip onaylayın; paket içindeki adetleri ayrıca
        kontrol edin.
      </div>
      <div className="toolbar">
        <Field label="İlan ara">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPg(0);
            }}
            placeholder="Başlık / SKU / beden"
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={unmatched}
            onChange={(e) => {
              setUnmatched(e.target.checked);
              setPg(0);
            }}
          />
          Yalnız eşleşmeyenler
        </label>
        <Field label="Güven eşiği (%)">
          <input
            type="number"
            min="0"
            max="100"
            value={s.threshold ?? 82}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0 && v <= 100)
                void mutate((n) => {
                  n.threshold = v;
                });
            }}
          />
        </Field>
        <button
          className="secondary"
          onClick={() =>
            void mutate(
              (n) => suggestions(n.listings, n.products),
              "Öneriler yeniden hesaplandı.",
            )
          }
        >
          Önerileri yenile
        </button>
      </div>
      <div className="toolbar">
        <button
          disabled={!candidates.length}
          onClick={() => {
            setSelected(candidates.map((l) => l.id));
            setEdit("bulk");
          }}
        >
          Eşik üstünü toplu incele ({candidates.length})
        </button>
        <button
          className="secondary"
          disabled={!selected.length}
          onClick={() => setEdit("bulk")}
        >
          Seçilenleri incele ({selected.length})
        </button>
      </div>
      <section className="panel" id="mapping-proposals">
        {page.map((l) => (
          <div className="mapping-row" key={l.id}>
            <input
              type="checkbox"
              aria-label={`${l.id} seç`}
              checked={selected.includes(l.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, l.id]
                    : selected.filter((x) => x !== l.id),
                )
              }
            />
            <ProductImage image={l.image || ""} name={l.title} />
            <span>
              <strong>{l.title}</strong>
              <small>
                {l.real ? "Gerçek ilan" : "Öğretici örnek"} · {l.sku || l.id} ·{" "}
                {l.channelVariant || "Standart"}
              </small>
              <small>
                {l.product
                  ? "Merkez SKU: " + l.product
                  : `%${l.score ?? 0} benzer — onaylıyor musunuz?`}
              </small>
              <small>{l.reason}</small>
              <b>
                Çarpan ×{l.multiplier ?? 1} · {listingStock(s, l)} paket
                satılabilir (Ümraniye)
              </b>
              <small>
                Kanalda kayıtlı stok: {l.stock ?? "bilinmiyor"} ·{" "}
                {money(l.price ?? 0)}
              </small>
            </span>
            <Badge tone={l.product ? "green" : "amber"}>
              {l.rejected
                ? "Reddedildi"
                : l.product
                  ? l.confirmed
                    ? "Onaylandı"
                    : "Kaynak SKU · çarpanı incele"
                  : "Eşleşmedi"}
            </Badge>
            <button
              className="secondary"
              onClick={() => {
                setEdit(l.id);
                setSku(l.product || l.suggested);
                setVariant(l.variant ?? 0);
                setMult(l.multiplier ?? 1);
                setError("");
              }}
            >
              {l.product ? "Eşleşmeyi düzenle" : "Öneriyi incele"}
            </button>
            {l.confirmed && (
              <button
                className="secondary"
                onClick={() => {
                  setSim(l.id);
                  setSimQty(1);
                }}
              >
                Kanal siparişini dene
              </button>
            )}
          </div>
        ))}
        {!rows.length && (
          <p>
            Bu filtrede ilan yok. Kanal bağlantı durumunu yukarıda kontrol edin.
          </p>
        )}
      </section>
      <div className="toolbar">
        <button
          className="secondary"
          disabled={pg === 0}
          onClick={() => setPg(pg - 1)}
        >
          Önceki
        </button>
        <span>
          {rows.length} ilan · {pg + 1} /{" "}
          {Math.max(1, Math.ceil(rows.length / 20))}
        </span>
        <button
          className="secondary"
          disabled={(pg + 1) * 20 >= rows.length}
          onClick={() => setPg(pg + 1)}
        >
          Sonraki
        </button>
      </div>
      {sim && (
        <Dialog
          error={operationError}
          title="Kanal ilanı siparişi · çalışma alanı"
          onClose={() => setSim("")}
        >
          <p>{s.listings.find((l) => l.id === sim)?.title}</p>
          <Field label="İlan sipariş adedi">
            <input
              type="number"
              min="1"
              value={simQty}
              onChange={(e) => setSimQty(Number(e.target.value))}
            />
          </Field>
          <p>
            {simQty} × {s.listings.find((l) => l.id === sim)?.multiplier ?? 1} ={" "}
            {simQty * (s.listings.find((l) => l.id === sim)?.multiplier ?? 1)}{" "}
            merkez birimi Ümraniye stoğundan düşecek.
          </p>
          <button
            onClick={() =>
              void mutate(
                (n) => listingOrder(n, sim, simQty),
                "Kanal ilanı siparişi yerel stoktan işlendi.",
              ).then((ok) => {
                if (ok) setSim("");
              })
            }
          >
            Çarpanlı siparişi kaydet
          </button>
        </Dialog>
      )}
      {edit && (
        <Dialog
          error={operationError}
          title={
            edit === "bulk"
              ? "Toplu eşleştirme onayı"
              : "İlanı Merkez SKU’ya bağla"
          }
          onClose={() => setEdit("")}
        >
          {edit === "bulk" ? (
            <>
              <p>
                {selected.length} seçili ilanın önerilen SKU ve varyant
                bağlantısı yerel olarak kaydedilecek. Paket çarpanları ayrıca
                doğrulanmalı.
              </p>
              <div className="bulk-review">
                {selected.map((id) => {
                  const x = s.listings.find((l) => l.id === id)!;
                  return (
                    <p key={id}>
                      {x.title} · {x.channelVariant} →{" "}
                      {x.suggested || x.product || "Aday yok"} · ×
                      {x.multiplier ?? 1} · %{x.score ?? 0}
                    </p>
                  );
                })}
              </div>
              <button
                onClick={() =>
                  void mutate((n) => {
                    for (const id of selected) {
                      const l = n.listings.find((x) => x.id === id)!;
                      if ((l.suggested || l.product) && !l.rejected) {
                        l.product = l.suggested || l.product;
                        l.multiplier = l.multiplier ?? 1;
                        l.confirmed = true;
                      }
                    }
                    log(
                      n,
                      `${selected.length} ilan toplu onaylandı`,
                      "Eşleştirme",
                    );
                  }).then((ok) => {
                    if (ok) {
                      setEdit("");
                      setSelected([]);
                    }
                  })
                }
              >
                Toplu onayla
              </button>
            </>
          ) : (
            <>
              <p>
                {l?.title} · {l?.channelVariant}
              </p>
              <Field label="Merkez SKU">
                <select
                  value={sku}
                  onChange={(e) => {
                    setSku(e.target.value);
                    setVariant(0);
                  }}
                >
                  <option value="">Başka SKU seç</option>
                  {s.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Merkez varyant">
                <select
                  value={variant}
                  onChange={(e) => setVariant(Number(e.target.value))}
                >
                  {p?.variants.map((v, i) => (
                    <option key={i} value={i}>
                      {v.size} · {v.color}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Çarpan (paketteki tekli birim)">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={mult}
                  onChange={(e) => setMult(Number(e.target.value))}
                />
              </Field>
              <p>
                1 kanal adedi = {mult} merkez birimi. Kanala gösterilecek paket
                sayısı, Ümraniye stoğunun {mult} adede bölünüp aşağı
                yuvarlanmasıyla hesaplanır.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="row-actions">
                <button
                  onClick={() => {
                    try {
                      positive(mult);
                      if (!p?.variants[variant])
                        throw Error("Merkez SKU ve varyant seçin.");
                      void mutate((n) => {
                        Object.assign(
                          n.listings.find((x) => x.id === edit)!,
                          {
                            product: sku,
                            suggested: sku,
                            variant,
                            multiplier: mult,
                            rejected: false,
                            confirmed: true,
                          },
                        );
                        log(n, `${edit} → ${sku} ×${mult}`, "Eşleştirme");
                      }).then((ok) => {
                        if (ok) setEdit("");
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Onayla
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    void mutate((n) => {
                      const x = n.listings.find((x) => x.id === edit)!;
                      x.product = "";
                      x.rejected = true;
                      x.confirmed = false;
                      log(n, edit + " önerisi reddedildi", "Eşleştirme");
                    }).then((ok) => {
                      if (ok) setEdit("");
                    })
                  }
                >
                  Reddet
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}

export function Operations({
  s,
  mutate,
  user,
  manager,
}: {
  s: State;
  mutate: Mutate;
  user: Staff;
  manager: boolean;
}) {
  const [tab, setTab] = useState(manager ? "Çarpan" : "Fotoğraflı toplu seçim"),
    [loc, setLoc] = useState(user.location),
    [qty, setQty] = useState(1),
    [saleDate, setSaleDate] = useState(dateKey(now())),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Record<string, number>>({}),
    [staffId, setStaffId] = useState(s.staff[0].id),
    [mode, setMode] = useState("Günlük satış"),
    [note, setNote] = useState(""),
    [costs, setCosts] = useState<Record<string, number>>({}),
    [units, setUnits] = useState<Record<string, number>>({}),
    [variants, setVariants] = useState<Record<string, number>>({});
  const staff = s.staff.find((x) => x.id === staffId)!;
  const canStaff = manager || user.permissions?.includes("staff");
  return (
    <>
      <div className="tabs">
        {["Çarpan", "Fotoğraflı toplu seçim", "Yetkiler", "Bildirimler"]
          .filter((t) => canStaff || t !== "Yetkiler")
          .map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
      </div>
      {tab === "Çarpan" && (
        <>
          <section className="panel">
            <h2>Bot Vatkası: merkezde tekli birim</h2>
            <p>
              Bu öğretici örnek gerçek ilanlardan ayrı tutulur. Her sipariş
              adedi, ilandaki çarpan kadar tekli ürün düşürür.
            </p>
            <Field label="Kanal sipariş adedi">
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </Field>
            <div className="kit-grid">
              {s.listings
                .filter((l) => l.id.startsWith("ORNEK-VAT"))
                .map((l) => (
                  <article key={l.id} className="panel">
                    <h3>{l.channel}</h3>
                    <strong>1 paket = {l.multiplier} tekli vatka</strong>
                    <p>
                      {qty} sipariş × {l.multiplier} ={" "}
                      {qty * (l.multiplier ?? 1)} tekli düşer
                    </p>
                    <p>
                      Ümraniye tekli stok:{" "}
                      {
                        s.products.find((p) => p.id === "VAT-001")!.variants[0]
                          .stock[1]
                      }
                    </p>
                    <b>Kanala hesaplanan: {listingStock(s, l)} paket</b>
                    <button
                      onClick={() =>
                        void mutate((n) => {
                          authorize(user, "retail", 1);
                          listingOrder(n, l.id, qty);
                        }, "Çarpanlı sipariş işlendi; yalnız çalışma alanı stoğu değişti.")
                      }
                    >
                      Siparişi yerelde dene · ×{l.multiplier}
                    </button>
                  </article>
                ))}
            </div>
            <p>
              Stok sonucu her zaman aşağı yuvarlanır. Hiçbir kanala stok veya
              fiyat gönderilmez.
            </p>
          </section>
        </>
      )}
      {tab === "Fotoğraflı toplu seçim" && (
        <>
          <section className="panel">
            <h2>Günlük mağaza satışı / Mal kabulü</h2>
            <div className="form-grid">
              <Field label="İşlem">
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option>Günlük satış</option>
                  <option>Mal kabulü</option>
                </select>
              </Field>
              <Field label="Lokasyon">
                <select
                  value={loc}
                  onChange={(e) => setLoc(Number(e.target.value))}
                >
                  {LOCATIONS.map((l, i) => (
                    <option
                      key={l}
                      disabled={
                        !manager &&
                        !(user.locations || [user.location]).includes(i)
                      }
                      value={i}
                    >
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Satış / kabul tarihi">
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </Field>
              <Field label="Not">
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Field label="Ürün ara">
                <input
                  placeholder="Ad / SKU"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
            </div>
            <div className="photo-picker">
              {s.products
                .filter((p) =>
                  `${p.name} ${p.id}`
                    .toLocaleLowerCase("tr")
                    .includes(search.toLocaleLowerCase("tr")),
                )
                .slice(0, 36)
                .map((p) => (
                  <article key={p.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={p.id in selected}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? { ...selected, [p.id]: 1 }
                              : Object.fromEntries(
                                  Object.entries(selected).filter(
                                    ([id]) => id !== p.id,
                                  ),
                                ),
                          )
                        }
                      />
                      <ProductImage image={p.image} name={p.name} />
                      <strong>{p.name}</strong>
                      <small>
                        {p.id} · {p.variants[variants[p.id] ?? 0].size} · Stok{" "}
                        {p.variants[variants[p.id] ?? 0].stock[loc]}
                      </small>
                    </label>
                    <Field label="Beden / varyant">
                      <select
                        aria-label={`${p.id} toplu varyant`}
                        value={variants[p.id] ?? 0}
                        onChange={(e) =>
                          setVariants({
                            ...variants,
                            [p.id]: Number(e.target.value),
                          })
                        }
                      >
                        {p.variants.map((v, i) => (
                          <option key={i} value={i}>
                            {v.size} · {v.color}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <input
                      aria-label={`${p.id} toplu adet`}
                      type="number"
                      min="1"
                      value={selected[p.id] ?? 1}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          [p.id]: Number(e.target.value),
                        })
                      }
                    />
                    {mode === "Mal kabulü" && (
                      <>
                        <Field label="Paket birimi">
                          <select
                            value={units[p.id] ?? 1}
                            onChange={(e) =>
                              setUnits({
                                ...units,
                                [p.id]: Number(e.target.value),
                              })
                            }
                          >
                            {[1, 3, 6, 12, 24].map((n) => (
                              <option key={n} value={n}>
                                {n} adet / paket
                              </option>
                            ))}
                          </select>
                        </Field>
                        {(manager || user.permissions?.includes("cost")) && (
                          <Field label="Birim maliyet (₺)">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={costs[p.id] ?? p.buy}
                              onChange={(e) =>
                                setCosts({
                                  ...costs,
                                  [p.id]: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                        )}
                      </>
                    )}
                  </article>
                ))}
            </div>
            <p>
              {Object.keys(selected).length} seçili ürün · Her kartta beden /
              varyant seçilebilir; arama ilk 36 ürünü gösterir.
            </p>
            <button
              disabled={!Object.keys(selected).length}
              onClick={() =>
                void mutate((n) => {
                  authorize(
                    user,
                    mode === "Günlük satış" ? "retail" : "receipt",
                    loc,
                  );
                  if (!saleDate) throw Error("Tarih seçin.");
                  const lines: Line[] = Object.entries(selected).map(
                    ([id, q]) => {
                      positive(q);
                      const p = n.products.find((p) => p.id === id)!;
                      const unit = mode === "Mal kabulü" ? (units[id] ?? 1) : 1;
                      positive(unit);
                      if (
                        mode === "Mal kabulü" &&
                        id in costs &&
                        costs[id] !== p.buy
                      ) {
                        authorize(user, "cost", loc);
                        if (!Number.isFinite(costs[id]) || costs[id] < 0)
                          throw Error("Geçerli maliyet girin.");
                        p.buy = costs[id];
                      }
                      return {
                        product: id,
                        variant: variants[id] ?? 0,
                        qty: q * unit,
                        picked: q * unit,
                        price: p.price,
                      };
                    },
                  );
                  if (mode === "Mal kabulü") bulkStock(n, lines, loc, mode);
                  else
                    addOrder(n, {
                      id: uid("MAGAZA"),
                      channel: "Mağaza",
                      customer: "Anonim günlük satış",
                      operator: user.name,
                      note,
                      location: loc,
                      created: new Date(
                        saleDate + "T12:00:00+03:00",
                      ).toISOString(),
                      status: "Toplanacak",
                      lines,
                      wholesale: false,
                      posted: false,
                      assignee: "",
                    });
                  log(
                    n,
                    `${mode} · ${LOCATIONS[loc]} · ${saleDate} · ${note}`,
                    "Mağaza",
                  );
                }, "Toplu işlem kaydedildi.").then((ok) => {
                  if (ok) setSelected({});
                })
              }
            >
              {mode === "Günlük satış"
                ? "Günlük satışı kaydet"
                : "Mal kabulünü kaydet"}
            </button>
          </section>
          <section className="panel">
            <h2>Kaydedilen günlük satışlar</h2>
            {s.orders
              .filter(
                (o) =>
                  o.channel === "Mağaza" &&
                  (manager || o.location === user.location),
              )
              .map((o) => (
                <p key={o.id}>
                  {o.created.slice(0, 10)} · {LOCATIONS[o.location]} ·{" "}
                  {(o.operator || "Çalışan").replace(/^Demo /, "")} · {o.note} ·{" "}
                  {o.lines.reduce((a, l) => a + l.qty, 0)} adet ·{" "}
                  {money(o.lines.reduce((a, l) => a + l.qty * l.price, 0))}
                </p>
              ))}
          </section>
        </>
      )}
      {tab === "Yetkiler" && canStaff && (
        <section className="panel">
          <h2>Kullanıcı bazlı lokasyon ve işlem yetkileri</h2>
          <Field label="Personel">
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {s.staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name.replace(/^Demo /, "")}
                </option>
              ))}
            </select>
          </Field>
          <h3>Lokasyonlar</h3>
          {LOCATIONS.map((l, i) => (
            <label className="check" key={l}>
              <input
                type="checkbox"
                disabled={staff.role === "Yönetici"}
                checked={(staff.locations || [staff.location]).includes(i)}
                onChange={(e) =>
                  void mutate((n) => {
                    const u = n.staff.find((x) => x.id === staffId)!;
                    u.locations = e.target.checked
                      ? [...(u.locations || []), i]
                      : (u.locations || []).filter((x) => x !== i);
                  })
                }
              />
              {l}
            </label>
          ))}
          <h3>İşlemler</h3>
          <div className="permission-grid">
            {PERMISSIONS.map((p, i) => (
              <label className="check" key={p}>
                <input
                  type="checkbox"
                  disabled={staff.role === "Yönetici"}
                  checked={
                    staff.role === "Yönetici" ||
                    staff.permissions?.includes(p) ||
                    false
                  }
                  onChange={(e) =>
                    void mutate((n) => {
                      const u = n.staff.find((x) => x.id === staffId)!;
                      u.permissions = e.target.checked
                        ? [...(u.permissions || []), p]
                        : (u.permissions || []).filter((x) => x !== p);
                    })
                  }
                />
                {PERMISSION_NAMES[i]} ({p})
              </label>
            ))}
          </div>
          <p>
            Değişiklikler bu çalışma alanında uygulanır. Sunucu kimlik
            doğrulaması bu çalışma alanında yoktur.
          </p>
        </section>
      )}
      {tab === "Bildirimler" && (
        <section className="panel">
          <h2>Bildirimler</h2>
          <button
            className="secondary"
            onClick={() =>
              void mutate((n) => {
                n.readNotifications = n.logs.map((l) => l.id);
              })
            }
          >
            Tümünü okundu işaretle
          </button>
          {s.logs.slice(0, 60).map((l) => (
            <div className="mapping-row" key={l.id}>
              <span>
                <strong>
                  {l.message.replace(/^Demo çalışma alanı/, "Çalışma alanı")}
                </strong>
                <small>
                  {new Date(l.date).toLocaleString("tr-TR", {
                    timeZone: "Europe/Istanbul",
                  })}{" "}
                  · {l.kind}
                </small>
              </span>
              <Badge
                tone={s.readNotifications?.includes(l.id) ? "gray" : "amber"}
              >
                {s.readNotifications?.includes(l.id) ? "Okundu" : "Yeni"}
              </Badge>
              <button
                className="secondary"
                onClick={() =>
                  void mutate((n) => {
                    n.readNotifications = [
                      ...(n.readNotifications || []),
                      l.id,
                    ];
                  })
                }
              >
                Okundu
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

export function Reports({ s }: { s: State }) {
  const [month, setMonth] = useState(dateKey(now()).slice(0, 7)),
    [channel, setChannel] = useState("Tümü");
  const rows = s.orders.filter(
    (o) =>
      o.kit &&
      dateKey(o.created).startsWith(month) &&
      !["İptal", "İade"].includes(o.status) &&
      (channel === "Tümü" || o.channel === channel),
  );
  const summary = new Map<
    string,
    { name: string; channel: string; size: string; qty: number; total: number }
  >();
  rows.forEach((o) => {
    const k = s.kits.find((k) => k.id === o.kit),
      first = o.lines.find((l) => l.product === "FAN-HK") || o.lines[0],
      p = s.products.find((p) => p.id === first.product),
      size = o.kitSize || p?.variants[first.variant].size || "Bilinmiyor",
      key = [o.kit, o.channel, size].join("|"),
      row = summary.get(key) || {
        name: k?.name || o.kit!,
        channel: o.channel,
        size,
        qty: 0,
        total: 0,
      };
    row.qty += o.kitUnits ?? first.qty / (k?.clothingCount || 1);
    row.total += o.lines.reduce((a, l) => a + l.price * l.qty, 0);
    summary.set(key, row);
  });
  const liveOrders = real.orders.filter(
    (o) =>
      dateKey(o.date).startsWith(month) &&
      (channel === "Tümü" || o.channel === channel),
  );
  const liveRows = new Map<
    string,
    {
      name: string;
      channel: string;
      variant: string;
      qty: number;
      total: number;
    }
  >();
  liveOrders
    .filter(
      (o) =>
        ![
          "cancelled",
          "refunded",
          "failed",
          "pending",
          "returned",
          "unsupplied",
        ].includes(o.status.toLowerCase()),
    )
    .forEach((o) =>
      o.lines.forEach((l) => {
        const p = real.products.find((p) => p.id === l.product);
        if (!/set/i.test(p?.title || l.title)) return;
        const key = l.product + "|" + o.channel;
        const row = liveRows.get(key) || {
          name: p?.title || l.title,
          channel: o.channel,
          variant: p?.variant || "Beden bilgisi yok",
          qty: 0,
          total: 0,
        };
        row.qty += l.qty;
        liveRows.set(key, row);
      }),
    );
  return (
    <>
      <div className="toolbar">
        <Field label="Rapor ayı">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        <Field label="Rapor kanalı">
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {[
              "Tümü",
              ...new Set([
                ...real.channels.map((c) => c.name),
                ...s.orders.map((o) => o.channel),
              ]),
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <section className="panel">
        <h2>Gerçek satışlar · son 30 gün anlık görüntü</h2>
        <p>
          {liveOrders.length} sipariş · Yalnız sipariş ve ürün adetleri
          gösterilir; gerçek tutarlar yayımlanmaz.
        </p>
        <h3>Set bazında satış / kanal / beden</h3>
        {[...liveRows.values()].map((r, i) => (
          <div className="mapping-row" key={i}>
            <strong>{r.name}</strong>
            <span>
              {r.channel} · {r.variant}
            </span>
            <b>{r.qty} set</b>
          </div>
        ))}
        {!liveRows.size && <p>Seçili dönemde okunabilen set siparişi yok.</p>}
        <small>
          Gerçek reçete/beden çözümü ürün API bilgisinden gelir; onaysız
          başlıklardan beden veya 6’lı/12’li sayısı uydurulmaz. İptal / iade /
          başarısız / bekleyen durumları set satış adetlerinden çıkarılır; brüt
          özet bütün siparişleri kapsar.
        </small>
      </section>
      <section className="panel">
        <h2>Set satışları · tutarlar örnektir</h2>
        {[...summary.values()].map((r, i) => (
          <div className="mapping-row" key={i}>
            <strong>{r.name}</strong>
            <span>
              {r.channel} · {r.size}
            </span>
            <b>
              {r.qty} set · {money(r.total)}
            </b>
          </div>
        ))}
        {!summary.size && (
          <p>Bu ay yerel set satışı yok. Set reçetesinden bir satış deneyin.</p>
        )}
      </section>
    </>
  );
}

export function MultiplierGuide() {
  return (
    <section className="panel" id="multiplier-example">
      <h2>Nasıl çalışır? Bot Vatkası</h2>
      <p>
        Örnek merkez stok: 120 adet. Aynı ürün, her kanalda farklı paketle
        satılır.
      </p>
      <div className="multiplier-grid">
        {[
          ["askerkolisi.com", 1],
          ["cephetoptan.com", 12],
          ["Trendyol", 3],
        ].map(([name, m]) => (
          <div key={name}>
            <strong>{name}</strong>
            <p>Çarpan ×{m}</p>
            <p>2 paket sipariş → {2 * Number(m)} adet stok düşer.</p>
            <b>Kanala gösterilen: {Math.floor(120 / Number(m))} paket</b>
          </div>
        ))}
      </div>
      <p>
        Hesap: sipariş adedi × paket çarpanı stoktan düşer; kalan stok paketteki
        adede bölünür ve aşağı yuvarlanır. Bu kart öğretici örnektir.
      </p>
    </section>
  );
}
