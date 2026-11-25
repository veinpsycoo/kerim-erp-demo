import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  Ellipsis as MenuMore,
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Truck,
  Users,
  Contact,
  Settings,
  Search,
  Plus,
  ChevronRight,
  Check,
  RefreshCw,
  Link2,
  Clock,
  AlertTriangle,
  Warehouse,
  ShieldCheck,
  X,
  Download,
  ChevronLeft,
} from "lucide-react";
import { readState, saveState } from "./db";
import { seed } from "./seed";
import {
  Mapping,
  MultiplierGuide,
  SyncStatus,
  Operations,
  Reports,
  LiveOrders,
  SourceRecipes,
} from "./KerimUI";
import { authorize, defaultPermissions } from "./kerim";
import { real } from "./snapshot";
import {
  LOCATIONS,
  CHANNELS,
  money,
  date,
  dateKey,
  uid,
  now,
  totalStock,
  balance,
  capacity,
  kitLines,
  channelPrice,
  bulkStock,
  addOrder,
  deliver,
  reverseOrder,
  transferStep,
  payment,
  orderTotal,
  amount,
  positive,
  log,
  type State,
  type Product,
  type Role,
  type Line,
  type Staff,
  type Kit,
} from "./domain";
import {
  Badge,
  Empty,
  Field,
  Dialog,
  Doc,
  ProductImage,
  LinePicker,
} from "./components";
type Modal = { kind: string; id?: string };
const menus = [
  ["dashboard", "Bugün", LayoutDashboard],
  ["stock", "Merkez stok", Package],
  ["channels", "Kanallar", Link2],
  ["kits", "Set reçeteleri", Layers],
  ["operations", "Mağaza işlemleri", Warehouse],
  ["reports", "Raporlar", LayoutDashboard],
  ["orders", "Siparişler", ShoppingBag],
  ["transfers", "Sevkiyatlar", Truck],
  ["accounts", "Cari hesaplar", Contact],
  ["staff", "Personel", Users],
  ["settings", "İşlem günlüğü", Settings],
] as const;

const value = (f: HTMLFormElement, n: string) =>
  String(new FormData(f).get(n) || "");
const num = (f: HTMLFormElement, n: string) => Number(value(f, n));
const Tone = ({ status }: { status: string }) => (
  <Badge
    tone={
      /İptal|İade|Reddedildi|Eksik/.test(status)
        ? "gray"
        : /Talep|Toplanacak|Yolda|Stok düşüldü|Kısmi/.test(status)
          ? "amber"
          : "green"
    }
  >
    {status}
  </Badge>
);
export default function App() {
  const [s, setS] = useState<State>();
  const [bootError, setBootError] = useState("");
  const [role, setRole] = useState<Role | undefined>(() => {
    const saved = localStorage.getItem("am-role");
    return ["Yönetici", "Depo", "Mağaza", "Muhasebe"].includes(saved || "")
      ? (saved as Role)
      : undefined;
  });
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [loc, setLoc] = useState(-1);
  const [category, setCategory] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [modal, setModal] = useState<Modal>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [toast, setToast] = useState("");
  const [group, setGroup] = useState("M");
  const [shoe, setShoe] = useState("42–43");
  const [channel, setChannel] = useState("Tümü");
  const [tab, setTab] = useState("mapping");
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<
    { product: string; qty: number; mode?: "clothing" | "fixed" }[]
  >([]);
  const [sourceKitDraft, setSourceKitDraft] = useState<Omit<Kit, "id">>();
  const [orderDraft, setOrderDraft] = useState<Line[]>([]);
  const [pickIndex, setPickIndex] = useState(0);
  const [pickNotes, setPickNotes] = useState<Record<number, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statementId, setStatementId] = useState("C-001");
  const confirmRef = useRef<(() => void) | undefined>(undefined);
  const [confirmText, setConfirmText] = useState("");
  useEffect(() => {
    readState()
      .then(setS)
      .catch(() =>
        setBootError(
          "Tarayıcı veritabanı açılamadı. Depolama izinlerini kontrol edip yeniden deneyin.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(p: string) {
    setPriceDrafts({});
    setPage(p);
    window.location.hash = p;
    setQuery("");
    setPageNum(1);
    setCategory("");
    setCriticalOnly(false);
    setLoc(-1);
    if (p === "channels") {
      setChannel("Tümü");
      setTab("mapping");
    }
  }
  function open(kind: string, id?: string) {
    setSourceKitDraft(undefined);
    setPickNotes({});
    setPickIndex(0);
    setError("");
    setModal({ kind, id });
    if (kind === "statement" && id) setStatementId(id);
    setDraft({});
    setBulkIds(id ? [id] : []);
    setOrderDraft([]);
    if (kind === "kit-edit")
      setRecipeDraft(
        s!.kits.find((k) => k.id === id)?.recipe.map((r) => ({ ...r })) || [],
      );
  }
  async function mutate(
    fn: (next: State) => void,
    message = "İşlem kaydedildi.",
  ) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = structuredClone(s!);
      fn(next);
      if (activeUser && activeUser.role !== "Yönetici") {
        if (JSON.stringify(next.staff) !== JSON.stringify(s!.staff))
          authorize(activeUser, "staff", ownLoc);
        const orderChanged =
          JSON.stringify(next.orders) !== JSON.stringify(s!.orders);
        const transferChanged =
          JSON.stringify(next.transfers) !== JSON.stringify(s!.transfers);
        if (orderChanged)
          for (const o of next.orders) {
            const previous = s!.orders.find((x) => x.id === o.id);
            if (previous && JSON.stringify(previous) !== JSON.stringify(o))
              authorize(
                activeUser,
                o.wholesale ? "prepare" : "retail",
                o.location,
              );
          }
        if (transferChanged)
          for (const t of next.transfers) {
            const previous = s!.transfers.find((x) => x.id === t.id);
            if (JSON.stringify(previous) !== JSON.stringify(t))
              authorize(
                activeUser,
                "transfer",
                t.status === "Teslim alındı"
                  ? t.to
                  : t.status === "Yolda"
                    ? t.from
                    : (activeUser.locations || [ownLoc]).includes(t.to)
                      ? t.to
                      : t.from,
              );
          }
        for (const p of next.products) {
          const old = s!.products.find((x) => x.id === p.id);
          if (!old) {
            authorize(activeUser, "receipt", ownLoc);
            continue;
          }
          if (p.buy !== old.buy) authorize(activeUser, "cost", ownLoc);
          p.variants.forEach((v, i) =>
            v.stock.forEach((stock, loc) => {
              if (stock === old.variants[i]?.stock[loc]) return;
              const perm = transferChanged
                ? "transfer"
                : orderChanged
                  ? page === "operations"
                    ? "retail"
                    : modal?.kind === "order"
                      ? "prepare"
                      : modal?.kind === "wholesale"
                        ? "order"
                        : "retail"
                  : /^(Sayım düzeltme|Fire)/.test(next.logs[0]?.message || "")
                    ? "count"
                    : "receipt";
              authorize(activeUser, perm, loc);
            }),
          );
        }
        if (
          JSON.stringify(next.entries) !== JSON.stringify(s!.entries) &&
          !orderChanged
        )
          authorize(activeUser, "ledger", ownLoc);
        if (orderChanged && next.orders.length > s!.orders.length)
          authorize(
            activeUser,
            next.orders[0].wholesale ? "order" : "retail",
            next.orders[0].location,
          );
      }
      setS(next);
      try {
        await saveState(next);
      } catch (persistError) {
        setS(s);
        throw persistError;
      }
      setToast(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "İşlem kaydedilemedi. Yeniden deneyin.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function confirm(text: string, fn: (n: State) => void, message?: string) {
    confirmRef.current = () => {
      void mutate(fn, message).then((ok) => {
        if (ok) setModal(undefined);
      });
    };
    setConfirmText(text);
    setError("");
    setModal({ kind: "confirm" });
  }
  async function submit(
    f: HTMLFormElement,
    fn: (n: State, f: HTMLFormElement) => void,
    message?: string,
  ) {
    if (await mutate((n) => fn(n, f), message)) setModal(undefined);
  }
  const activeUser =
    s?.staff.find((p) => p.id === userId) ||
    s?.staff.find((p) => p.role === role);
  const userLocations = activeUser?.locations || [activeUser?.location ?? 0];
  const ownLoc = userLocations.includes(activeUser?.location ?? 0)
    ? (activeUser?.location ?? 0)
    : (userLocations[0] ?? 0);
  const manager = role === "Yönetici";
  const hasPermission = (p: string) =>
    manager ||
    (activeUser?.permissions || defaultPermissions(role || "Mağaza")).includes(
      p,
    );
  const finance = hasPermission("ledger") || hasPermission("report");
  const canStaff = hasPermission("staff");
  const canStock = [
    "receipt",
    "count",
    "retail",
    "order",
    "prepare",
    "transfer",
  ].some(hasPermission);
  const menuAccess = menus
    .filter(
      ([id]) =>
        manager ||
        id === "dashboard" ||
        ((id === "stock" || id === "kits") &&
          hasPermission("view") &&
          userLocations.length > 0) ||
        (id === "orders" &&
          ["order", "prepare", "retail", "ledger", "report"].some(
            hasPermission,
          )) ||
        (id === "transfers" && hasPermission("transfer")) ||
        (id === "accounts" && hasPermission("ledger")) ||
        (id === "staff" && canStaff) ||
        (id === "reports" && hasPermission("report")) ||
        (id === "settings" && finance) ||
        (id === "operations" &&
          [
            "view",
            "receipt",
            "retail",
            "cost",
            "transfer",
            "staff",
            "count",
            "prepare",
          ].some(hasPermission)),
    )
    .map(([id]) => id);
  const visibleOrders =
    s?.orders.filter((o) =>
      role === "Mağaza" || role === "Depo"
        ? userLocations.includes(o.location)
        : true,
    ) || [];
  const pName = (id: string) =>
    s?.products.find((p) => p.id === id)?.name || id;
  const accountName = (id: string) =>
    s?.accounts.find((a) => a.id === id)?.name || id;
  const pById = (id: string) => s!.products.find((p) => p.id === id)!;
  if (!s)
    return (
      <main className="boot">
        <ShieldCheck size={42} />
        <h1>Asker Marketi Yönetim</h1>
        <p role={bootError ? "alert" : "status"}>
          {bootError || "Çalışma alanınız hazırlanıyor…"}
        </p>
        {!bootError && (
          <div className="boot-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {bootError && (
          <button onClick={() => location.reload()}>Tekrar dene</button>
        )}
      </main>
    );
  const effectiveLoc = manager
    ? loc
    : loc >= 0 && userLocations.includes(loc)
      ? loc
      : ownLoc;
  const isCritical = (p: Product, location?: number) =>
    totalStock(p, location) < 20;
  const filtered = s.products.filter(
    (p) =>
      (!criticalOnly ||
        isCritical(p, effectiveLoc < 0 ? undefined : effectiveLoc)) &&
      (!category || p.category === category) &&
      `${p.name.replace(/^Demo /, "")} ${p.id} ${p.category}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const active = s.orders.filter((o) => !["İptal", "İade"].includes(o.status));
  const todayOrders = active.filter((o) => date(o.created) === date(now()));
  const revenue = real.orders.length;
  const transfers = s.transfers.filter(
    (t) => manager || t.from === ownLoc || t.to === ownLoc,
  );
  const product = modal?.id
    ? s.products.find((p) => p.id === modal.id)
    : undefined;
  const order = modal?.id ? s.orders.find((o) => o.id === modal.id) : undefined;
  const account = modal?.id
    ? s.accounts.find((a) => a.id === modal.id)
    : undefined;
  const staff = modal?.id ? s.staff.find((p) => p.id === modal.id) : undefined;
  const kit = modal?.id ? s.kits.find((k) => k.id === modal.id) : undefined;
  function locOptions(all = false) {
    return (
      <>
        {all && <option value={-1}>Tüm lokasyonlar</option>}
        {LOCATIONS.map((l, i) => (
          <option
            key={l}
            value={i}
            disabled={!manager && !userLocations.includes(i)}
          >
            {l}
          </option>
        ))}
      </>
    );
  }
  function productOptions() {
    return s!.products.map((p) => (
      <option key={p.id} value={p.id}>
        {p.id} · {p.name.replace(/^Demo /, "")}
      </option>
    ));
  }
  function addDraftLine(line: Line) {
    const existing = orderDraft.find(
      (l) => l.product === line.product && l.variant === line.variant,
    );
    if (existing)
      setOrderDraft(
        orderDraft.map((l) =>
          l === existing
            ? { ...l, qty: l.qty + line.qty, picked: l.qty + line.qty }
            : l,
        ),
      );
    else setOrderDraft([...orderDraft, line]);
  }
  function lineList(lines: Line[], net = false) {
    return (
      <div className="line-list">
        {lines.map((l, i) => (
          <div key={i}>
            <span>
              {pName(l.product)}
              <small>
                {pById(l.product).variants[l.variant]?.size} ·{" "}
                {pById(l.product).variants[l.variant]?.color}
              </small>
            </span>
            <strong>{net ? l.picked : l.qty} adet</strong>
            <span>{money((net ? l.picked : l.qty) * l.price)}</span>
          </div>
        ))}
      </div>
    );
  }
  function documentContent(): ReactNode {
    if (modal?.kind === "delivery-doc" && order)
      return (
        <Doc title={`Teslimat fişi · ${order.id}`}>
          <p>
            {accountName(order.customer)} · {date(order.created)} ·{" "}
            {LOCATIONS[order.location]}
          </p>
          {lineList(order.lines, true)}
          <h3>Net teslimat: {money(orderTotal(order))}</h3>
          <p>
            Teslim eden:{" "}
            {s!.staff
              .find((p) => p.id === order.assignee)
              ?.name.replace(/^Demo /, "")}{" "}
            · Teslim alanın imzası: __________________
          </p>
        </Doc>
      );
    if (modal?.kind === "receipt") {
      const e = s!.entries.find((e) => e.id === modal.id)!;
      return (
        <Doc title={`${e.memo} makbuzu · ${e.id}`}>
          <p>
            {accountName(e.account)} · {date(e.date)}
          </p>
          <h2>{money(e.debit || e.credit)}</h2>
          <p>Kaydedildi.</p>
        </Doc>
      );
    }
    const es = s!.entries.filter(
      (e) =>
        e.account === statementId &&
        (!dateFrom || dateKey(e.date) >= dateFrom) &&
        (!dateTo || dateKey(e.date) <= dateTo),
    );
    const opening = s!.entries
      .filter(
        (e) =>
          e.account === statementId && dateFrom && dateKey(e.date) < dateFrom,
      )
      .reduce((n, e) => n + e.debit - e.credit, 0);
    let running = opening;
    return (
      <Doc title="Cari hesap ekstresi">
        <p>
          {accountName(statementId)} · {dateFrom ? date(dateFrom) : "İlk kayıt"}{" "}
          — {dateTo ? date(dateTo) : "Bugün"}
        </p>
        <p>Devir bakiyesi: {money(opening)}</p>
        <div className="statement">
          {es
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => {
              running += e.debit - e.credit;
              return (
                <div key={e.id}>
                  <span>
                    {date(e.date)}
                    <small>{e.memo}</small>
                  </span>
                  <span>
                    Borç {money(e.debit)}
                    <small>Alacak {money(e.credit)}</small>
                  </span>
                  <strong>{money(running)}</strong>
                </div>
              );
            })}
        </div>
        {!es.length && <p>Seçili tarih aralığında hareket yok.</p>}
        <h3>Dönem sonu bakiye: {money(running)}</h3>
      </Doc>
    );
  }
  const pending = visibleOrders.filter((o) => o.status === "Toplanacak");
  const shipping = transfers.filter((t) =>
    ["Talep", "Yolda"].includes(t.status),
  );
  const critical = s.products.filter((p) =>
    isCritical(p, manager ? undefined : ownLoc),
  );
  const overdueCount = pending.filter(
    (o) => Date.now() - new Date(o.created).getTime() > 86400000,
  ).length;
  const unmappedCount = s.listings.filter(
    (l) => !l.confirmed && !l.rejected,
  ).length;
  const lowKitCount = s.kits.filter((k) => capacity(s, k, "M", 1) < 5).length;
  const debtors = s.accounts.filter((a) => balance(s, a.id) > 0);
  const title =
    page === "profile"
      ? "Profil ve ayarlar"
      : page === "more"
        ? "Daha fazla"
        : menus.find((m) => m[0] === page)?.[1] || "Bugün";
  const quick = [
    "dashboard",
    ...(role === "Muhasebe"
      ? ["accounts", "reports", "orders"]
      : role === "Mağaza"
        ? ["operations", "stock", "transfers"]
        : ["orders", "stock", "transfers"]),
  ].filter((id) => menuAccess.some((x) => x === id));
  if (!role)
    return (
      <main className="role-entry">
        <div className="entry-brand">
          <ShieldCheck size={28} />
          <span>
            Asker Marketi<strong>Yönetim</strong>
          </span>
        </div>
        <section className="entry-content">
          <h1>Kimsiniz?</h1>
          <p>İşinize uygun çalışma alanını seçin.</p>
          <div className="role-list">
            {(["Yönetici", "Depo", "Mağaza", "Muhasebe"] as Role[]).map(
              (r, i) => {
                const Icon = [ShieldCheck, Warehouse, ShoppingBag, Contact][i];
                return (
                  <button
                    className="role-button"
                    key={r}
                    onClick={() => {
                      setRole(r);
                      localStorage.setItem("am-role", r);
                      setUserId("");
                      navigate("dashboard");
                    }}
                  >
                    <Icon size={26} />
                    <span>
                      <strong>{r}</strong>
                      <small>
                        {
                          [
                            "İşin tamamını gör, öncelikleri yönet.",
                            "Siparişleri topla, stok say.",
                            "Satış gir, mağaza stoğunu takip et.",
                            "Tahsilat gir, cari hesapları izle.",
                          ][i]
                        }
                      </small>
                    </span>
                    <ChevronRight size={22} />
                  </button>
                );
              },
            )}
          </div>
          <p className="entry-footer">
            Depodan mağazaya. Her şey yerli yerinde.
          </p>
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          Asker Marketi <span>Yönetim</span>
        </a>
        <nav aria-label="Ana menü">
          {menus
            .filter(([id]) => menuAccess.includes(id))
            .map(([id, label, Icon]) => (
              <button
                key={id}
                aria-current={page === id ? "page" : undefined}
                className={page === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={21} />
                {label}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span>{LOCATIONS[ownLoc]}</span>
          <button className="profile-link" onClick={() => navigate("profile")}>
            <Settings size={20} />
            Profil ve ayarlar
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="screen-label">Asker Marketi</span>
          <div className="profile-area">
            <span className="demo-badge">Demo</span>
            <button
              className="profile-chip"
              aria-label={`${role} — profil ve ayarlar`}
              onClick={() => navigate("profile")}
            >
              <span className="avatar">{role[0]}</span>
              <span>{role}</span>
            </button>
          </div>
        </header>
        <main className="content">
          {error && !modal && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="page-heading">
            <div>
              <h1>{page === "dashboard" ? `Bugün` : title}</h1>
              <p>
                {
                  (
                    {
                      dashboard:
                        role === "Depo"
                          ? "Sıradaki sipariş hazır. Raflardan başlayalım."
                          : role === "Mağaza"
                            ? "Mağazanızın günlük işleri bir arada."
                            : role === "Muhasebe"
                              ? "Tahsilatları ve cari hareketleri takip edin."
                              : "Tüm lokasyonlardaki işlerinize genel bir bakış.",
                      profile: "Çalışma alanınızı ve erişiminizi yönetin.",
                      more: "İhtiyacınız olan diğer çalışma alanları.",
                      stock:
                        "Ürünlerin üç lokasyondaki stoklarını buradan yönetin.",
                      channels:
                        "Eşleştirmeleri tamamlayın, fiyatları tek merkezden yönetin.",
                      kits: "Setin içindeki ürünleri ve her üründen kaç adet düşeceğini belirleyin.",
                      orders:
                        "Siparişleri hazırlayın ve teslim durumunu takip edin.",
                      transfers:
                        "Lokasyonlar arasında ürün sevk edin ve teslimatı onaylayın.",
                      accounts:
                        "Cari bakiyelerini inceleyin, tahsilat ve ödemeleri kaydedin.",
                      staff:
                        "Personelin görevini ve erişebileceği lokasyonları belirleyin.",
                      settings: "Yapılan işlemleri buradan inceleyin.",
                      reports:
                        "Kanal ve set satış adetlerini buradan inceleyin.",
                      operations:
                        "Mağaza satışını, stok girişini ve günlük işlemleri kaydedin.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {page === "dashboard" && manager && (
                <button onClick={() => navigate("orders")}>
                  Siparişleri incele
                </button>
              )}
              {page === "channels" && (
                <button
                  onClick={() => {
                    setChannel("Tümü");
                    setTab("mapping");
                    requestAnimationFrame(() =>
                      document
                        .getElementById("multiplier-example")
                        ?.scrollIntoView({ block: "center" }),
                    );
                  }}
                >
                  Çarpan örneğini göster
                </button>
              )}
              {page === "reports" && (
                <button onClick={() => window.print()}>Raporu yazdır</button>
              )}
              {page === "operations" && (
                <button
                  onClick={() =>
                    document
                      .querySelector(".content .tabs")
                      ?.scrollIntoView({ block: "start" })
                  }
                >
                  İşlem seç
                </button>
              )}
              {page === "settings" && (
                <button
                  onClick={() =>
                    document
                      .querySelector(".log-row")
                      ?.scrollIntoView({ block: "start" })
                  }
                >
                  İşlemleri incele
                </button>
              )}
              {page === "kits" && !manager && (
                <button
                  onClick={() =>
                    document
                      .querySelector(".kit-card")
                      ?.scrollIntoView({ block: "start" })
                  }
                >
                  Setleri incele
                </button>
              )}
              {page === "orders" && !canStock && (
                <button
                  onClick={() => {
                    const el =
                      document.querySelector<HTMLDetailsElement>(
                        ".live-orders",
                      );
                    if (el) {
                      el.open = true;
                      el.scrollIntoView({ block: "start" });
                    }
                  }}
                >
                  Kanal siparişlerini incele
                </button>
              )}

              {page === "stock" && canStock && (
                <>
                  <button onClick={() => open("bulk")}>
                    Toplu stok işlemi
                  </button>
                  {manager && (
                    <button
                      className="secondary"
                      onClick={() => open("product-edit")}
                    >
                      <Plus size={16} /> Ürün ekle
                    </button>
                  )}
                </>
              )}
              {page === "orders" && canStock && (
                <>
                  <button onClick={() => open("online")}>Sipariş ekle</button>
                  {manager && (
                    <button
                      className="secondary"
                      onClick={() => open("wholesale")}
                    >
                      <Plus size={16} /> Toptan sipariş
                    </button>
                  )}
                </>
              )}
              {page === "transfers" && canStock && (
                <button onClick={() => open("transfer")}>
                  <Plus size={16} /> Sevkiyat talebi
                </button>
              )}
              {page === "accounts" && finance && (
                <button onClick={() => open("account-edit")}>
                  <Plus size={16} /> Cari ekle
                </button>
              )}
              {page === "staff" && canStaff && (
                <button onClick={() => open("staff-edit")}>
                  <Plus size={16} /> Personel ekle
                </button>
              )}
              {page === "kits" && manager && (
                <button onClick={() => open("kit-edit")}>
                  <Plus size={16} /> Set oluştur
                </button>
              )}
            </div>
          </div>
          {page === "profile" && (
            <section className="panel profile-page">
              <h2>{activeUser?.name.replace(/^Demo /, "")}</h2>
              <p>
                {role} · {LOCATIONS[ownLoc]}
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem("am-role");
                  setRole(undefined);
                  setUserId("");
                }}
              >
                Rol değiştir
              </button>
              <Field label="Çalışan">
                <select
                  aria-label="Aktif kullanıcı"
                  value={activeUser?.id || ""}
                  onChange={(e) => {
                    const u = s.staff.find((u) => u.id === e.target.value)!;
                    setUserId(u.id);
                    setRole(u.role);
                    localStorage.setItem("am-role", u.role);
                    navigate("dashboard");
                  }}
                >
                  {s.staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name.replace(/^Demo /, "")}
                    </option>
                  ))}
                </select>
              </Field>
              <h2>Bu çalışma alanı hakkında</h2>
              <p>
                Ürünler ve anonim sipariş adetleri kanallardan salt okunur.
                Lokasyon stokları, cari tutarlar ve burada kaydedilen işlemler
                örnektir; yalnız bu tarayıcıda saklanır. Kanallara veri
                gönderilmez. Faturalama Paraşüt’te devam eder.
              </p>
            </section>
          )}
          {page === "more" && (
            <section className="panel more-list">
              {menus
                .filter(
                  ([id]) => menuAccess.includes(id) && !quick.includes(id),
                )
                .map(([id, label, Icon]) => (
                  <button
                    className="task-row"
                    key={id}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={22} />
                    <span>{label}</span>
                    <ChevronRight size={20} />
                  </button>
                ))}
              <button className="task-row" onClick={() => navigate("profile")}>
                <Settings size={22} />
                <span>Profil ve ayarlar</span>
                <ChevronRight size={20} />
              </button>
            </section>
          )}
          {activeUser && page === "operations" && (
            <Operations
              s={s}
              mutate={mutate}
              user={activeUser}
              manager={manager}
            />
          )}
          {page === "reports" && finance && <Reports s={s} />}
          {page === "dashboard" && (
            <div className="today-layout">
              {manager && (
                <>
                  <div className="kpi-grid">
                    {[
                      ["Son 30 gün sipariş", revenue, "orders"],
                      ["Toplanacak", pending.length, "orders"],
                      ["Bekleyen sevkiyat", shipping.length, "transfers"],
                      ["Kritik stok", critical.length, "stock"],
                    ].map(([label, count, target]) => (
                      <button
                        className="kpi"
                        key={label}
                        onClick={() => {
                          navigate(String(target));
                          if (target === "stock") setCriticalOnly(true);
                        }}
                      >
                        <span>{label}</span>
                        <strong>{count}</strong>
                        <span className="kpi-link">
                          İncele <ChevronRight size={18} />
                        </span>
                      </button>
                    ))}
                  </div>
                  <section className="panel">
                    <h2>Dikkat isteyenler</h2>
                    {[
                      {
                        count: overdueCount,
                        label: "24 saati aşan siparişler",
                        detail: "Hazırlanmayı bekleyen siparişleri inceleyin.",
                        target: "orders",
                        Icon: Clock,
                      },
                      {
                        count: unmappedCount,
                        label: "Eşleştirilecek ilan",
                        detail: "1 Ocak 2027’ye kadar eşleştirilecek",
                        target: "channels",
                        Icon: Link2,
                      },
                      {
                        count: lowKitCount,
                        label: "Stoğu azalan setler",
                        detail: "Reçete ve kullanılabilir stok.",
                        target: "kits",
                        Icon: Layers,
                      },
                    ]
                      .filter((item) => item.count > 0)
                      .map(({ count, label, detail, target, Icon }) => (
                        <button
                          key={target}
                          className="task-row"
                          onClick={() => navigate(target)}
                        >
                          <Icon />
                          <span>
                            {label}
                            <small>{detail}</small>
                          </span>
                          <strong>{count}</strong>
                          <ChevronRight />
                        </button>
                      ))}
                    {overdueCount + unmappedCount + lowKitCount === 0 && (
                      <p>Şu an dikkat isteyen iş yok.</p>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Kanallar</h2>
                    <button
                      className="task-row"
                      onClick={() => navigate("channels")}
                    >
                      <Link2 />
                      <span>
                        {real.channels.length} kanal ·{" "}
                        {
                          real.channels.filter(
                            (x) => x.status === "bağlı · salt okuma",
                          ).length
                        }{" "}
                        bağlı
                        <small>
                          Son güncelleme{" "}
                          {new Date(real.syncedAt).toLocaleTimeString("tr-TR", {
                            timeZone: "Europe/Istanbul",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  </section>
                </>
              )}
              {role === "Depo" && (
                <>
                  <section className="work-hero">
                    <Warehouse size={32} />
                    <p>Toplanacak</p>
                    <strong className="hero-number">
                      {pending.length}
                      <span>sipariş</span>
                    </strong>
                    <p>Ürünleri sırayla toplayın, hazır adetleri kaydedin.</p>
                    <button
                      onClick={() =>
                        pending.length
                          ? open("order", pending[0].id)
                          : navigate("orders")
                      }
                    >
                      Toplamaya başla <ChevronRight size={22} />
                    </button>
                  </section>
                  <section className="panel">
                    <h2>Sıradaki işler</h2>
                    <button
                      className="task-row"
                      onClick={() => navigate("transfers")}
                    >
                      <Truck />
                      <span>Bekleyen sevkiyat</span>
                      <strong>{shipping.length}</strong>
                      <ChevronRight />
                    </button>
                    <button
                      className="task-row"
                      onClick={() => {
                        navigate("stock");
                        setCriticalOnly(true);
                      }}
                    >
                      <AlertTriangle />
                      <span>Kritik stok</span>
                      <strong>{critical.length}</strong>
                      <ChevronRight />
                    </button>
                  </section>
                </>
              )}
              {role === "Mağaza" && (
                <>
                  <section className="work-hero">
                    <ShoppingBag size={32} />
                    <h2>Yeni bir satış mı var?</h2>
                    <p>Ürünleri fotoğraflarından seçin, adetleri girin.</p>
                    <button onClick={() => navigate("operations")}>
                      Satış gir <Plus size={22} />
                    </button>
                  </section>
                  <section className="panel">
                    <h2>Bugünkü satışlar</h2>
                    {todayOrders.filter(
                      (o) => o.channel === "Mağaza" && o.location === ownLoc,
                    ).length ? (
                      todayOrders
                        .filter(
                          (o) =>
                            o.channel === "Mağaza" && o.location === ownLoc,
                        )
                        .map((o) => (
                          <button
                            className="task-row"
                            key={o.id}
                            onClick={() => open("order", o.id)}
                          >
                            <ShoppingBag />
                            <span>
                              {o.id}
                              <small>
                                {o.lines.reduce((n, l) => n + l.qty, 0)} ürün
                              </small>
                            </span>
                            <ChevronRight />
                          </button>
                        ))
                    ) : (
                      <Empty text="Bugün henüz satış kaydı yok.">
                        <button
                          className="text-btn"
                          onClick={() => navigate("operations")}
                        >
                          İlk satışı gir
                        </button>
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <button
                      className="task-row"
                      onClick={() => navigate("transfers")}
                    >
                      <Truck />
                      <span>Mağazaya gelecek transfer</span>
                      <strong>
                        {
                          shipping.filter((t) => userLocations.includes(t.to))
                            .length
                        }
                      </strong>
                      <ChevronRight />
                    </button>
                  </section>
                </>
              )}
              {role === "Muhasebe" && (
                <>
                  <section className="work-hero">
                    <Contact size={32} />
                    <p>Bekleyen tahsilat</p>
                    <strong className="hero-number">
                      {money(debtors.reduce((n, a) => n + balance(s, a.id), 0))}
                    </strong>
                    <p>Cari hesaplarda tahsil edilmeyi bekleyen bakiye.</p>
                    <button
                      onClick={() =>
                        open("payment", debtors[0]?.id || s.accounts[0]?.id)
                      }
                    >
                      Tahsilat gir <Plus size={22} />
                    </button>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Borçlu cari hesaplar</h2>
                      <button
                        className="text-btn"
                        onClick={() => navigate("accounts")}
                      >
                        Tümü <ChevronRight size={18} />
                      </button>
                    </div>
                    {debtors.map((a) => (
                      <button
                        className="task-row"
                        key={a.id}
                        onClick={() => open("statement", a.id)}
                      >
                        <span>
                          {a.name.replace(/^Demo /, "")}
                          <small>Ekstreyi aç</small>
                        </span>
                        <strong>{money(balance(s, a.id))}</strong>
                        <ChevronRight />
                      </button>
                    ))}
                    {!debtors.length && (
                      <Empty text="Bekleyen cari bakiye yok.">
                        <button
                          className="text-btn"
                          onClick={() => navigate("accounts")}
                        >
                          Cari hesapları aç
                        </button>
                      </Empty>
                    )}
                  </section>
                  <button
                    className="text-btn"
                    onClick={() => {
                      setStatementId(s.accounts[0]?.id || "C-001");
                      open("statement", s.accounts[0]?.id);
                    }}
                  >
                    Ekstre görüntüle <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
          )}
          {page === "stock" && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Ürün ara"
                    placeholder="Ürün adı, Merkez SKU veya kategori ara…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPageNum(1);
                    }}
                  />
                </label>
                <select
                  aria-label="Kategori filtresi"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPageNum(1);
                  }}
                >
                  <option value="">Tüm kategoriler</option>
                  {[...new Set(s.products.map((p) => p.category))]
                    .sort()
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </select>
                <details className="filter-disclosure">
                  <summary>Filtre</summary>
                  <select
                    aria-label="Stok lokasyonu"
                    value={effectiveLoc}
                    onChange={(e) => setLoc(Number(e.target.value))}
                  >
                    {locOptions(true)}
                  </select>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={criticalOnly}
                      onChange={(e) => {
                        setCriticalOnly(e.target.checked);
                        setPageNum(1);
                      }}
                    />
                    Yalnız kritik stok
                  </label>
                </details>
              </div>
              <div className="result-meta">
                <span>{filtered.length} ürün bulundu</span>
                <span>
                  {criticalOnly
                    ? "20 adetten az stok gösteriliyor."
                    : "Lokasyon bakiyeleri örnek stoklardır."}
                </span>
              </div>
              <section className="panel product-table">
                <div className="table-head">
                  <span>Ürün / Merkez SKU</span>
                  <span>Kategori</span>
                  <span>Lokasyon stoğu</span>
                  <span>Perakende</span>
                  <span />
                </div>
                {filtered.slice((pageNum - 1) * 12, pageNum * 12).map((p) => (
                  <button
                    className="product-row"
                    key={p.id}
                    onClick={() => open("product", p.id)}
                  >
                    <span className="product-title">
                      <ProductImage
                        image={p.image}
                        name={p.name.replace(/^Demo /, "")}
                      />
                      <span>
                        <strong>{p.name.replace(/^Demo /, "")}</strong>
                        <small>
                          {p.id} · {p.variants.length} varyant
                        </small>
                      </span>
                    </span>
                    <span className="category-cell">{p.category}</span>
                    <span className="stock-cell">
                      <Badge
                        tone={
                          totalStock(
                            p,
                            effectiveLoc < 0 ? undefined : effectiveLoc,
                          ) < 20
                            ? "amber"
                            : "green"
                        }
                      >
                        {totalStock(
                          p,
                          effectiveLoc < 0 ? undefined : effectiveLoc,
                        )}{" "}
                        adet
                      </Badge>
                      <small>
                        {effectiveLoc < 0
                          ? "3 lokasyon toplamı"
                          : LOCATIONS[effectiveLoc]}
                      </small>
                    </span>
                    <strong className="price-cell">{money(p.price)}</strong>
                    <ChevronRight size={16} />
                  </button>
                ))}
                {!filtered.length && (
                  <Empty text="Aramanıza uygun ürün bulunamadı.">
                    <button
                      className="text-btn"
                      onClick={() => {
                        setQuery("");
                        setCategory("");
                        setCriticalOnly(false);
                        setPageNum(1);
                      }}
                    >
                      Aramayı temizle
                    </button>
                  </Empty>
                )}
              </section>
              <div className="pagination">
                <span>
                  {filtered.length
                    ? Math.min((pageNum - 1) * 12 + 1, filtered.length)
                    : 0}
                  –{Math.min(pageNum * 12, filtered.length)} / {filtered.length}
                </span>
                <div>
                  <button
                    className="secondary"
                    aria-label="Önceki sayfa"
                    disabled={pageNum === 1}
                    onClick={() => setPageNum(pageNum - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="secondary"
                    aria-label="Sonraki sayfa"
                    disabled={pageNum * 12 >= filtered.length}
                    onClick={() => setPageNum(pageNum + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {page === "channels" && manager && (
            <>
              <MultiplierGuide />
              <details className="channel-connections">
                <summary>Kanal bağlantıları ve senkron</summary>
                <SyncStatus />
              </details>
              <div className="channel-tabs">
                {[
                  "Tümü",
                  ...new Set([
                    ...real.channels.map((c) => c.name),
                    ...CHANNELS,
                  ]),
                ].map((c) => (
                  <button
                    key={c}
                    className={channel === c ? "selected" : ""}
                    onClick={() => {
                      setChannel(c);
                      if (c === "Tümü") setTab("mapping");
                    }}
                  >
                    {c}
                    <small>
                      <span />{" "}
                      {c === "Tümü"
                        ? "Tüm gerçek ilanlar"
                        : real.channels.find((x) => x.name === c)?.status ||
                          "bağlanmayı bekliyor"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="tabs">
                {[
                  ["mapping", "Ürün eşleştirme"],
                  ["pricing", "Fiyat kuralları"],
                  ["queue", "Gönderim kuyruğu"],
                ].map(([id, t]) => (
                  <button
                    className={tab === id ? "selected" : ""}
                    onClick={() => {
                      setTab(id);
                      if (id === "pricing" && channel === "Tümü")
                        setChannel(
                          real.channels.find((c) => c.products > 0)?.name ||
                            CHANNELS[0],
                        );
                    }}
                    key={id}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "mapping" && (
                <Mapping
                  key={channel}
                  s={s}
                  channel={channel}
                  mutate={mutate}
                  operationError={error}
                />
              )}
              {tab === "pricing" && (
                <>
                  <section className="panel price-rule">
                    <div>
                      <h2>{channel} fiyat kuralı</h2>
                      <p>
                        Perakende × çarpan. Yuvarlama yukarı uygulanır; istisna
                        tutarı çarpanın yerini alır.
                      </p>
                    </div>
                    <Field label="Kanal çarpanı">
                      <input
                        aria-label="Kanal çarpanı"
                        type="number"
                        min="0.01"
                        max="10"
                        step="0.01"
                        value={
                          priceDrafts[channel] ?? s.rules[channel].multiplier
                        }
                        onChange={(e) => {
                          setPriceDrafts({
                            ...priceDrafts,
                            [channel]: e.target.value,
                          });
                        }}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (
                            v > 0 &&
                            v <= 10 &&
                            v !== s.rules[channel].multiplier
                          )
                            void mutate((n) => {
                              n.rules[channel].multiplier = v;
                              log(n, `${channel} çarpanı ${v}`, "Fiyat");
                            }, "Fiyat önizlemesi güncellendi.");
                        }}
                      />
                      {priceDrafts[channel] !== undefined &&
                        !(
                          Number(priceDrafts[channel]) > 0 &&
                          Number(priceDrafts[channel]) <= 10
                        ) && (
                          <small role="alert" className="error">
                            Çarpan 0’dan büyük, en çok 10 olmalı.
                          </small>
                        )}
                    </Field>
                    <Field label="Yuvarlama">
                      <select
                        value={s.rules[channel].round}
                        onChange={(e) =>
                          void mutate((n) => {
                            n.rules[channel].round = e.target.value as "90";
                            log(
                              n,
                              `${channel} yuvarlama kuralı güncellendi`,
                              "Fiyat",
                            );
                          })
                        }
                      >
                        <option value="none">Kuruşu koru</option>
                        <option value="90">Yukarı yuvarla (…,90)</option>
                        <option value="integer">Yukarı yuvarla (tam TL)</option>
                      </select>
                    </Field>
                    <button
                      onClick={() =>
                        confirm(
                          `${channel} için ${s.products.length} ürün fiyatı önizleme kuyruğuna alınacak.`,
                          (n) => {
                            n.queue.unshift({
                              id: uid("KY"),
                              channel,
                              count: n.products.length,
                              status: "Tamamlandı",
                              date: now(),
                            });
                            log(
                              n,
                              `${channel}: ${n.products.length} fiyat önizlemesi hazırlandı.`,
                              "Kanal",
                            );
                          },
                          "Fiyat önizlemesi tamamlandı.",
                        )
                      }
                    >
                      Fiyatları hazırla
                    </button>
                  </section>
                  <div className="toolbar">
                    <label className="search">
                      <Search size={18} />
                      <input
                        aria-label="Fiyat listesinde ara"
                        placeholder="Fiyat önizlemesinde ara…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <section className="panel">
                    {filtered.slice(0, 30).map((p) => (
                      <div className="price-row" key={p.id}>
                        <span>
                          <strong>{p.name.replace(/^Demo /, "")}</strong>
                          <small>
                            {p.id}{" "}
                            {s.rules[channel].exceptions[p.id]
                              ? "· Ürün istisnası"
                              : ""}
                          </small>
                        </span>
                        <span>
                          <small>Perakende</small>
                          {money(p.price)}
                        </span>
                        <strong>
                          {money(
                            channelPrice(p, {
                              ...s.rules[channel],
                              multiplier:
                                Number(priceDrafts[channel]) > 0 &&
                                Number(priceDrafts[channel]) <= 10
                                  ? Number(priceDrafts[channel])
                                  : s.rules[channel].multiplier,
                            }),
                          )}
                        </strong>
                        <button
                          className="secondary"
                          onClick={() => open("exception", p.id)}
                        >
                          İstisna
                        </button>
                      </div>
                    ))}
                  </section>
                  <p className="hint">
                    İlk 30 sonuç gösterilir. Her ürün için aramayı
                    kullanabilirsiniz; gönderim tüm kataloğu kapsar.
                  </p>
                </>
              )}
              {tab === "queue" && (
                <section className="panel">
                  {s.queue.length ? (
                    s.queue.map((q) => (
                      <div className="mapping-row" key={q.id}>
                        <span>
                          <strong>
                            {q.channel} · {q.count} ürün
                          </strong>
                          <small>
                            {q.id} · {date(q.date)}
                          </small>
                        </span>
                        <Badge>{q.status.replace(" (demo)", "")}</Badge>
                      </div>
                    ))
                  ) : (
                    <Empty text="Gönderim kuyruğu henüz boş.">
                      <button
                        className="text-btn"
                        onClick={() => {
                          setTab("pricing");
                          if (channel === "Tümü") setChannel(CHANNELS[0]);
                        }}
                      >
                        Fiyatları hazırla
                      </button>
                    </Empty>
                  )}
                  <div className="quiet-note">
                    Tüm gönderimler bu tarayıcıda işlenir. Sonuçlar işlem
                    günlüğüne yazılır.
                  </div>
                </section>
              )}
            </>
          )}
          {page === "kits" && (
            <>
              <SourceRecipes
                onImport={
                  manager
                    ? (k) => {
                        open("kit-edit");
                        setSourceKitDraft(k);
                        setRecipeDraft(k.recipe);
                      }
                    : undefined
                }
              />
              <div className="toolbar">
                <Field label="Beden grubu">
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    {["S", "M", "L", "XL", "2XL", "3XL"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <details className="filter-disclosure kit-filters">
                  <summary>Filtre</summary>
                  <Field label="Ayak numarası">
                    <select
                      value={shoe}
                      onChange={(e) => setShoe(e.target.value)}
                    >
                      {[
                        "36–37",
                        "38–39",
                        "40–41",
                        "42–43",
                        "44–45",
                        "46–47",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Hesaplama lokasyonu">
                    <select
                      value={loc < 0 ? ownLoc : loc}
                      onChange={(e) => setLoc(Number(e.target.value))}
                    >
                      {locOptions()}
                    </select>
                  </Field>
                </details>
              </div>
              <div className="kit-grid">
                {s.kits.map((k) => (
                  <section className="panel kit-card" key={k.id}>
                    <div className="kit-photos">
                      {k.recipe.slice(0, 4).map((r, i) => (
                        <ProductImage
                          key={i}
                          image={pById(r.product).image}
                          name={pName(r.product)}
                        />
                      ))}
                    </div>
                    <Badge tone="gray">{k.id}</Badge>
                    <h2>{k.name}</h2>
                    <p>
                      {k.recipe.length} farklı alt ürün · {group} beden grubu
                    </p>
                    <div className="kit-availability">
                      <span>Satılabilir set</span>
                      <strong>
                        {capacity(s, k, group, loc < 0 ? ownLoc : loc, shoe)}{" "}
                        <small>adet</small>
                      </strong>
                    </div>
                    <div className="kit-bottom">
                      <strong>{money(k.price)}</strong>
                      <button
                        className="secondary"
                        onClick={() => open("kit", k.id)}
                      >
                        Reçeteyi incele <ChevronRight size={14} />
                      </button>
                    </div>
                    {manager && (
                      <button
                        className="text-btn"
                        onClick={() => open("kit-edit", k.id)}
                      >
                        Reçeteyi düzenle
                      </button>
                    )}
                  </section>
                ))}
              </div>
              <p className="hint">
                Giyim bedeni ve çorap numarası eşleşmelidir; eşleşme yoksa satış
                durur. Sabit aksesuarlar standarttır. Kesilebilir tabanlık tek
                tipten 1 adet düşer.
              </p>
            </>
          )}
          {page === "orders" && (
            <>
              {finance && <LiveOrders />}
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Sipariş ara"
                    placeholder="Sipariş no, kanal veya müşteri ara…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Sipariş durum filtresi"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Tüm durumlar</option>
                  {[
                    "Toplanacak",
                    "Stok düşüldü",
                    "Teslim edildi",
                    "Kargolandı",
                    "İptal",
                    "İade",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <section className="panel">
                {visibleOrders
                  .filter(
                    (o) =>
                      (!category || o.status === category) &&
                      `${o.id} ${o.channel} ${accountName(o.customer)}`
                        .toLocaleLowerCase("tr")
                        .includes(query.toLocaleLowerCase("tr")),
                  )
                  .map((o) => (
                    <button
                      className="order-row"
                      key={o.id}
                      onClick={() => open("order", o.id)}
                    >
                      <span className="row-icon">
                        <ShoppingBag size={19} />
                      </span>
                      <span>
                        <strong>{o.id}</strong>
                        <small>
                          {o.channel} · {accountName(o.customer)}
                        </small>
                        <small>
                          {date(o.created)} · {LOCATIONS[o.location]}
                        </small>
                      </span>
                      <Tone status={o.status} />
                      {finance && <strong>{money(orderTotal(o))}</strong>}
                      <ChevronRight size={16} />
                    </button>
                  ))}
                {!visibleOrders.some(
                  (o) =>
                    (!category || o.status === category) &&
                    `${o.id} ${o.channel} ${accountName(o.customer)}`
                      .toLocaleLowerCase("tr")
                      .includes(query.toLocaleLowerCase("tr")),
                ) && (
                  <Empty text="Sipariş bulunamadı.">
                    <button
                      className="text-btn"
                      onClick={() => {
                        setQuery("");
                        setCategory("");
                      }}
                    >
                      Filtreleri temizle
                    </button>
                  </Empty>
                )}
              </section>
            </>
          )}
          {page === "transfers" && (
            <section className="panel">
              {transfers.map((t) => (
                <div className="transfer-row" key={t.id}>
                  <div>
                    <strong>{t.id}</strong>
                    <small>
                      {date(t.created)} ·{" "}
                      {t.lines.reduce((n, l) => n + l.qty, 0)} adet
                    </small>
                    <p>
                      {LOCATIONS[t.from]} <ChevronRight size={14} />{" "}
                      {LOCATIONS[t.to]}
                    </p>
                    <small>
                      {t.lines
                        .map((l) => `${pName(l.product)} (${l.qty})`)
                        .join(", ")}
                    </small>
                    {t.lines.map((l, i) => (
                      <div className="transfer-line" key={i}>
                        <span>
                          {pName(l.product)} · Talep {l.qty} / Sevk{" "}
                          {l.shipped ?? 0} / Teslim {l.received ?? 0}
                        </span>
                        {((t.status === "Talep" &&
                          (manager || ownLoc === t.from)) ||
                          (t.status === "Yolda" &&
                            (manager || ownLoc === t.to))) && (
                          <Field
                            label={
                              t.status === "Talep"
                                ? "Sevk adedi"
                                : "Teslim adedi"
                            }
                          >
                            <input
                              aria-label={`${t.id} ${i} ${t.status === "Talep" ? "sevk" : "teslim"} adedi`}
                              type="number"
                              min="0"
                              max={
                                t.status === "Talep"
                                  ? l.qty
                                  : (l.shipped ?? l.qty)
                              }
                              value={
                                draft[`transfer-${t.id}-${i}`] ??
                                (t.status === "Talep"
                                  ? l.qty
                                  : (l.shipped ?? l.qty))
                              }
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  [`transfer-${t.id}-${i}`]: Number(
                                    e.target.value,
                                  ),
                                })
                              }
                            />
                          </Field>
                        )}
                      </div>
                    ))}
                    {t.note && (
                      <small>
                        Not: {t.note} · {t.user}
                      </small>
                    )}
                  </div>
                  <Tone status={t.status} />
                  <div className="row-actions">
                    {t.status === "Talep" &&
                      (manager || userLocations.includes(t.from)) && (
                        <>
                          <button
                            onClick={() =>
                              confirm(
                                "Gönderen lokasyondan stok düşülecek. Sevkiyatı onaylıyor musunuz?",
                                (n) =>
                                  transferStep(
                                    n,
                                    t.id,
                                    "send",
                                    t.lines.map(
                                      (l, i) =>
                                        draft[`transfer-${t.id}-${i}`] ?? l.qty,
                                    ),
                                  ),
                              )
                            }
                          >
                            Sevkiyatı onayla
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              confirm(
                                "Talep stok değiştirilmeden reddedilecek.",
                                (n) => transferStep(n, t.id, "reject"),
                              )
                            }
                          >
                            Reddet
                          </button>
                        </>
                      )}
                    {t.status === "Yolda" &&
                      (manager || userLocations.includes(t.to)) && (
                        <button
                          onClick={() =>
                            confirm(
                              "Ürünler teslim alan lokasyonun stoğuna eklenecek.",
                              (n) =>
                                transferStep(
                                  n,
                                  t.id,
                                  "receive",
                                  t.lines.map(
                                    (l, i) =>
                                      draft[`transfer-${t.id}-${i}`] ??
                                      l.shipped ??
                                      l.qty,
                                  ),
                                ),
                            )
                          }
                        >
                          Teslim al
                        </button>
                      )}
                  </div>
                </div>
              ))}
              {!transfers.length && (
                <Empty text="Sevkiyat talebi bulunmuyor.">
                  <button className="text-btn" onClick={() => open("transfer")}>
                    Sevkiyat talebi oluştur
                  </button>
                </Empty>
              )}
            </section>
          )}
          {page === "accounts" && finance && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Cari ara"
                    placeholder="Cari adı veya şehir ara…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() => open("statement-filter")}
                >
                  <Download size={16} /> Tarih aralıklı ekstre
                </button>
              </div>
              <section className="panel">
                {s.accounts
                  .filter((a) =>
                    `${a.name} ${a.city}`
                      .toLocaleLowerCase("tr")
                      .includes(query.toLocaleLowerCase("tr")),
                  )
                  .map((a) => (
                    <div className="account-row" key={a.id}>
                      <span className="avatar">
                        {a.type === "Müşteri" ? "M" : "T"}
                      </span>
                      <span>
                        <strong>{a.name}</strong>
                        <small>
                          {a.id} · {a.city} · {a.type}
                        </small>
                        <small>
                          {a.days} gün vade · Risk limiti {money(a.limit)}
                        </small>
                      </span>
                      <span className="balance">
                        <strong>{money(Math.abs(balance(s, a.id)))}</strong>
                        <small>
                          {balance(s, a.id) >= 0
                            ? "Borç bakiyesi"
                            : "Alacak bakiyesi"}
                        </small>
                      </span>
                      <div className="row-actions">
                        <button
                          className="secondary"
                          onClick={() => open("account", a.id)}
                        >
                          Hareketler
                        </button>
                        <button onClick={() => open("payment", a.id)}>
                          {a.type === "Müşteri" ? "Tahsilat al" : "Ödeme yap"}
                        </button>
                      </div>
                    </div>
                  ))}
                {!s.accounts.some((a) =>
                  `${a.name} ${a.city}`
                    .toLocaleLowerCase("tr")
                    .includes(query.toLocaleLowerCase("tr")),
                ) && (
                  <Empty text="Cari bulunamadı.">
                    <button className="text-btn" onClick={() => setQuery("")}>
                      Aramayı temizle
                    </button>
                  </Empty>
                )}
              </section>
            </>
          )}
          {page === "staff" && canStaff && (
            <section className="panel">
              {s.staff.map((p) => (
                <div className="staff-row" key={p.id}>
                  <span className="avatar">
                    {p.name.split(" ").slice(-1)[0].slice(0, 1)}
                  </span>
                  <span>
                    <strong>{p.name.replace(/^Demo /, "")}</strong>
                    <small>
                      {p.id} · {LOCATIONS[p.location]}
                    </small>
                  </span>
                  <Badge tone="gray">{p.role}</Badge>
                  <span className="staff-summary">
                    {p.records
                      .filter((r) => r.type === "İzin")
                      .reduce((n, r) => n + r.value, 0)}{" "}
                    gün izin
                    <br />
                    {money(
                      p.records
                        .filter((r) => r.type === "Avans")
                        .reduce((n, r) => n + r.value, 0),
                    )}{" "}
                    avans
                  </span>
                  <div className="row-actions">
                    <button
                      className="secondary"
                      onClick={() => open("staff-record", p.id)}
                    >
                      İzin / avans
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => open("staff-edit", p.id)}
                    >
                      Düzenle
                    </button>
                  </div>
                </div>
              ))}
              <div className="quiet-note">
                Personel adları kurgusaldır. Rol seçimi bu çalışma alanına
                özeldir; gerçek kimlik doğrulama servisi kullanılmaz.
              </div>
            </section>
          )}
          {page === "settings" && (
            <>
              <section className="panel reset-panel">
                <div>
                  <h2>Çalışma alanı</h2>
                  <p>
                    Değişiklikler bu tarayıcıda saklanır. Sıfırlama tüm yerel
                    işlemleri ilk örnek verilere döndürür.
                  </p>
                </div>
                {manager && (
                  <button
                    className="danger secondary"
                    onClick={() =>
                      confirm(
                        "Tüm yerel işlemler silinecek ve başlangıç verileri yüklenecek. Bu işlem geri alınamaz.",
                        (n) => {
                          Object.assign(n, seed());
                        },
                        "Çalışma alanı sıfırlandı.",
                      )
                    }
                  >
                    <RefreshCw size={16} /> Çalışma alanını sıfırla
                  </button>
                )}
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>İşlem günlüğü</h2>
                  <Badge tone="gray">{s.logs.length} kayıt</Badge>
                </div>
                {s.logs.map((l) => (
                  <div className="log-row" key={l.id}>
                    <span className="log-dot" />
                    <span>
                      <strong>
                        {l.message.replace(
                          /^Demo çalışma alanı/,
                          "Çalışma alanı",
                        )}
                      </strong>
                      <small>
                        {date(l.date)} ·{" "}
                        {new Date(l.date).toLocaleTimeString("tr-TR", {
                          timeZone: "Europe/Istanbul",
                        })}{" "}
                        · {l.kind}
                      </small>
                    </span>
                    <Check size={16} />
                  </div>
                ))}
              </section>
            </>
          )}
          <footer className="app-footer">
            <span>Asker Marketi Yönetim</span>
            <span>Depodan mağazaya. Her şey yerli yerinde.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          {toast}
          <button
            aria-label="Bildirimi kapat"
            className="icon-btn"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <nav className="bottom-nav" aria-label="Alt menü">
        {quick.map((id) => {
          const m = menus.find((x) => x[0] === id)!;
          const Icon = m[2];
          return (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={22} />
              <span>
                {
                  (
                    {
                      dashboard: "Bugün",
                      operations: "Satış",
                      stock: "Stok",
                      transfers: "Sevkiyat",
                      accounts: "Cari",
                      reports: "Raporlar",
                      orders: "Sipariş",
                    } as Record<string, string>
                  )[id]
                }
              </span>
            </button>
          );
        })}
        <button
          className={!quick.includes(page) ? "active" : ""}
          aria-current={!quick.includes(page) ? "page" : undefined}
          onClick={() => navigate("more")}
        >
          <MenuMore />
          <span>Daha fazla</span>
        </button>
      </nav>
      {modal?.kind === "confirm" && (
        <Dialog
          title="İşlemi onaylayın"
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          submit="Onayla"
          onSubmit={() => confirmRef.current?.()}
        >
          <p>{confirmText}</p>
        </Dialog>
      )}
      {modal?.kind === "product" && product && (
        <Dialog title="Ürün kartı" onClose={() => setModal(undefined)}>
          <div className="product-detail">
            <ProductImage image={product.image} name={product.name} />
            <div>
              <Badge tone="gray">{product.id}</Badge>
              <h2>{product.name}</h2>
              <p>{product.category}</p>
              <h3>
                {money(product.price)} <small>perakende</small>
              </h3>
              {finance && (
                <p>
                  Alış {money(product.buy)} · Toptan {money(product.wholesale)}
                </p>
              )}
              <small>
                Fiyat ve ürün bilgisi: halka açık katalog.
                <br />
                Alış/toptan ve stoklar örnek verilerdir.
              </small>
            </div>
          </div>
          <div className="location-balances">
            {LOCATIONS.map(
              (l, i) =>
                (manager || userLocations.includes(i)) && (
                  <div key={l}>
                    <span>{l}</span>
                    <strong>{totalStock(product, i)} adet</strong>
                  </div>
                ),
            )}
          </div>
          <h3>Renk / beden matrisi</h3>
          <p className="hint">
            Varyant kaynağı: {product.variantSource}. Stoklar kurgusaldır.
          </p>
          <div className="matrix-scroll">
            <table
              className="matrix"
              role="table"
              aria-label="Varyant stokları"
            >
              <thead>
                <tr>
                  <th>Beden</th>
                  <th>Renk</th>
                  {LOCATIONS.map(
                    (l, i) =>
                      (manager || userLocations.includes(i)) && (
                        <th key={l}>{l}</th>
                      ),
                  )}
                </tr>
              </thead>
              <tbody>
                {product.variants.map((v, j) => (
                  <tr key={j}>
                    <td data-label="Beden" aria-label={"Beden: " + v.size}>
                      {v.size}
                    </td>
                    <td data-label="Renk" aria-label={"Renk: " + v.color}>
                      {v.color}
                    </td>
                    {v.stock.map(
                      (n, i) =>
                        (manager || userLocations.includes(i)) && (
                          <td
                            key={i}
                            data-label={LOCATIONS[i]}
                            aria-label={LOCATIONS[i] + ": " + n + " adet"}
                          >
                            {n}
                          </td>
                        ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row-actions">
            {canStock && (
              <button type="button" onClick={() => open("bulk", product.id)}>
                Bu üründe stok işlemi
              </button>
            )}
            {manager && (
              <button
                type="button"
                className="secondary"
                onClick={() => open("product-edit", product.id)}
              >
                Ürün kartını düzenle
              </button>
            )}
          </div>
        </Dialog>
      )}
      {modal?.kind === "product-edit" && manager && (
        <Dialog
          title={product ? "Ürün kartını düzenle" : "Yeni merkez ürün"}
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              const price = num(f, "price"),
                buy = num(f, "buy"),
                wholesale = num(f, "wholesale");
              [price, buy, wholesale].forEach(amount);
              const name = value(f, "name").trim(),
                cat = value(f, "category").trim();
              if (!name || !cat) throw Error("Ürün adı ve kategori gerekli.");
              if (product) {
                const p = n.products.find((p) => p.id === product.id)!;
                log(
                  n,
                  `${p.id}: alış ${money(p.buy)} → ${money(buy)}, perakende ${money(p.price)} → ${money(price)} · ${role}`,
                  "Ürün",
                );
                Object.assign(p, {
                  name,
                  category: cat,
                  price,
                  buy,
                  wholesale,
                });
              } else {
                const sizes = value(f, "sizes")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                const colors = value(f, "colors")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                if (
                  !sizes.length ||
                  !colors.length ||
                  sizes.length * colors.length > 100
                )
                  throw Error(
                    "Geçerli beden/renk listesi girin (en çok 100 varyant).",
                  );
                const id = uid("AM");
                n.products.unshift({
                  id,
                  name,
                  category: cat,
                  price,
                  buy,
                  wholesale,
                  image: "icon.svg",
                  imageSource: "",
                  source: "Eklenen ürün",
                  variantSource: "Elle girilen varyantlar",
                  variants: colors.flatMap((color) =>
                    sizes.map((size) => ({ color, size, stock: [0, 0, 0] })),
                  ),
                });
                log(n, `${id} ürün kartı açıldı`, "Ürün");
              }
            })
          }
        >
          <Field label="Ürün adı">
            <input name="name" required defaultValue={product?.name} />
          </Field>
          <Field label="Kategori">
            <input
              name="category"
              required
              list="categories"
              defaultValue={product?.category}
            />
            <datalist id="categories">
              {[...new Set(s.products.map((p) => p.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </Field>
          <div className="form-grid">
            <Field label="Alış (₺)">
              <input
                name="buy"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={product?.buy}
              />
            </Field>
            <Field label="Toptan (₺)">
              <input
                name="wholesale"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={product?.wholesale}
              />
            </Field>
            <Field label="Perakende (₺)">
              <input
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={product?.price}
              />
            </Field>
          </div>
          {!product && (
            <>
              <Field label="Bedenler (virgülle ayırın)">
                <input name="sizes" required defaultValue="S, M, L, XL" />
              </Field>
              <Field label="Renkler (virgülle ayırın)">
                <input name="colors" required defaultValue="Haki, Siyah" />
              </Field>
            </>
          )}
          <p className="hint">
            Fiyat değişiklikleri eski/yeni tutarıyla işlem günlüğüne kaydedilir.
          </p>
        </Dialog>
      )}
      {modal?.kind === "bulk" && canStock && (
        <Dialog
          title="Toplu stok işlemi"
          busy={busy}
          error={error}
          submit="İşlemi onayla"
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              const ls: Line[] = [];
              for (const id of bulkIds) {
                pById(id).variants.forEach((_, i) => {
                  const v = value(f, `qty-${id}-${i}`);
                  if (
                    v !== "" &&
                    (Number(v) !== 0 || value(f, "mode") === "Sayım düzeltme")
                  )
                    ls.push({
                      product: id,
                      variant: i,
                      qty: Number(v),
                      picked: 0,
                      price: 0,
                    });
                });
              }
              if (activeUser)
                authorize(
                  activeUser,
                  value(f, "mode") === "Sayım düzeltme" ||
                    value(f, "mode") === "Fire"
                    ? "count"
                    : "receipt",
                  num(f, "location"),
                );
              bulkStock(n, ls, num(f, "location"), value(f, "mode"));
            })
          }
        >
          <div className="form-grid">
            <Field label="İşlem türü">
              <select name="mode">
                <option>Mal kabulü</option>
                <option>Sayım düzeltme</option>
                <option>Fire</option>
              </select>
            </Field>
            <Field label="Lokasyon">
              <select name="location" defaultValue={ownLoc}>
                {locOptions()}
              </select>
            </Field>
          </div>
          <Field label="İşleme ürün ekle">
            <select
              aria-label="İşleme ürün ekle"
              value=""
              onChange={(e) => {
                if (e.target.value && !bulkIds.includes(e.target.value))
                  setBulkIds([...bulkIds, e.target.value]);
              }}
            >
              <option value="">Ürün seçin…</option>
              {productOptions()}
            </select>
          </Field>
          {!bulkIds.length && (
            <Empty text="Matrisi açmak için ürün seçin.">
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  document
                    .querySelector<HTMLSelectElement>(
                      'dialog[open] [aria-label="İşleme ürün ekle"]',
                    )
                    ?.focus()
                }
              >
                Ürün seç
              </button>
            </Empty>
          )}
          {bulkIds.map((id) => (
            <section className="bulk-product" key={id}>
              <div className="section-heading">
                <h3>{pName(id)}</h3>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${id} ürünü çıkar`}
                  onClick={() => setBulkIds(bulkIds.filter((x) => x !== id))}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="bulk-matrix">
                {pById(id).variants.map((v, i) => (
                  <Field key={i} label={`${v.size} · ${v.color}`}>
                    <input
                      aria-label={`${id} ${v.size} ${v.color} adet`}
                      name={`qty-${id}-${i}`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="—"
                    />
                  </Field>
                ))}
              </div>
            </section>
          ))}
          <p className="hint">
            Boş hücre değişmez. Sayımda girilen değer yeni stoktur; mal kabulü
            ekler, fire düşer. Tek onay tüm dolu hücreleri işler.
          </p>
        </Dialog>
      )}
      {modal?.kind === "mapping" &&
        manager &&
        (() => {
          const l = s.listings.find((l) => l.id === modal.id)!;
          return (
            <Dialog
              title="İlanı Merkez SKU’ya bağla"
              busy={busy}
              error={error}
              onClose={() => setModal(undefined)}
              onSubmit={(f) =>
                void submit(f, (n, f) => {
                  const listing = n.listings.find((x) => x.id === l.id)!;
                  listing.product = value(f, "product");
                  log(
                    n,
                    `${l.id} → ${listing.product || "Eşleşme kaldırıldı"}`,
                    "Eşleştirme",
                  );
                })
              }
            >
              <p>
                <strong>{l.title}</strong>
                <br />
                {l.channel} · Kanal kodu {l.product ? "mevcut" : "bulunmuyor"}
              </p>
              <Field label="Merkez SKU">
                <select name="product" defaultValue={l.product || l.suggested}>
                  <option value="">Eşleşmeyi kaldır</option>
                  {productOptions()}
                </select>
              </Field>
              <div className="quiet-note">
                Öneri: {l.suggested} · {pName(l.suggested)}
                <br />
                Eşleştirme yalnız bu çalışma alanına kaydedilir.
              </div>
            </Dialog>
          );
        })()}
      {modal?.kind === "exception" && manager && product && (
        <Dialog
          title="Ürüne özel kanal fiyatı"
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              if (value(f, "price") === "")
                delete n.rules[channel].exceptions[product.id];
              else {
                amount(num(f, "price"));
                n.rules[channel].exceptions[product.id] = num(f, "price");
              }
              log(
                n,
                `${channel} / ${product.id} fiyat istisnası güncellendi`,
                "Fiyat",
              );
            })
          }
        >
          <p>
            {product.name}
            <br />
            {channel}
          </p>
          <Field label="İstisna tutarı (₺)">
            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={s.rules[channel].exceptions[product.id]}
            />
          </Field>
          <p className="hint">
            Boş bırakırsanız istisna kaldırılır. Kanalın yuvarlama kuralı
            istisna fiyatına da uygulanır.
          </p>
        </Dialog>
      )}
      {modal?.kind === "kit" && kit && (
        <Dialog title={kit.name} onClose={() => setModal(undefined)}>
          <p className="quiet-note">
            Kaynak:{" "}
            {kit.source?.startsWith("Kerim KORDAK")
              ? "Kerim’in Temel Asker Seti reçetesi"
              : kit.source || "Yerel reçete"}
            . Giyim adedi N={kit.clothingCount || 1}; sabit kalemler N ile
            çarpılmaz. Kesilebilir tabanlık tek tipten 1 adettir.
          </p>
          <div className="summary-banner">
            <span>
              {group} beden · {shoe} ayak · {LOCATIONS[loc < 0 ? ownLoc : loc]}
            </span>
            <strong>
              {capacity(s, kit, group, loc < 0 ? ownLoc : loc, shoe)} set
              satılabilir
            </strong>
          </div>
          {kitLines(s, kit, group, 1, shoe).map((l, i) => {
            const p = pById(l.product),
              v = p.variants[l.variant];
            return (
              <div className="recipe-row" key={i}>
                <ProductImage
                  name={p.name.replace(/^Demo /, "")}
                  image={p.image}
                />
                <span>
                  <strong>{p.name.replace(/^Demo /, "")}</strong>
                  <small>
                    {v.size} · {v.color} · {p.id}
                  </small>
                </span>
                <span>
                  {l.qty} adet
                  <small>
                    {kit.recipe[i].mode === "clothing"
                      ? `Giyim: ${kit.clothingCount} × ${kit.recipe[i].qty}`
                      : `Sabit: ${kit.recipe[i].qty}`}
                  </small>
                  <small>{v.stock[loc < 0 ? ownLoc : loc]} stokta</small>
                </span>
              </div>
            );
          })}
          {canStock && (
            <button
              type="button"
              disabled={
                capacity(s, kit, group, loc < 0 ? ownLoc : loc, shoe) < 1
              }
              onClick={() =>
                confirm(
                  `1 adet ${kit.name} satılacak; reçetedeki ${kitLines(s, kit, group, 1, shoe).reduce((a, r) => a + r.qty, 0)} alt ürün ${LOCATIONS[loc < 0 ? ownLoc : loc]} stoğundan düşecek.`,
                  (n) => {
                    const lines = kitLines(n, kit, group, 1, shoe);
                    const sum = lines.reduce((a, l) => a + l.qty, 0);
                    lines.forEach((l) => (l.price = kit.price / sum));
                    addOrder(n, {
                      id: uid("SP"),
                      channel: CHANNELS[0],
                      customer: "Kurgusal set müşterisi",
                      location: loc < 0 ? ownLoc : loc,
                      created: now(),
                      status: "Stok düşüldü",
                      lines,
                      assignee: "",
                      wholesale: false,
                      posted: false,
                      kit: kit.id,
                      kitUnits: 1,
                      kitSize: group,
                    });
                  },
                  "Set satıldı; ortak alt ürünleri kullanan tüm setlerin kapasitesi güncellendi.",
                )
              }
            >
              1 set satışı gir · {money(kit.price)}
            </button>
          )}
        </Dialog>
      )}
      {modal?.kind === "kit-edit" && manager && (
        <Dialog
          title={kit ? "Set reçetesini düzenle" : "Yeni set reçetesi"}
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              if (!recipeDraft.length)
                throw Error("Reçeteye en az bir alt ürün ekleyin.");
              recipeDraft.forEach((r) => positive(r.qty));
              amount(num(f, "price"));
              const next = {
                ...kit,
                ...sourceKitDraft,
                clothingCount: num(f, "clothingCount"),
                id: kit?.id || uid("SET"),
                name: value(f, "name"),
                price: num(f, "price"),
                recipe: recipeDraft,
              };
              if (kit)
                n.kits[n.kits.findIndex((x) => x.id === kit.id)] =
                  structuredClone(next);
              else n.kits.push(structuredClone(next));
              log(
                n,
                `${next.id} reçetesi kaydedildi · ${next.recipe.length} alt ürün`,
                "Set",
              );
            })
          }
        >
          {sourceKitDraft?.source && (
            <p className="quiet-note">
              Kaynak: {sourceKitDraft.source} · Açıklamadan çıkarılan kalemleri
              gözden geçirip kaydedin. Kaynaktaki toplam parça sayısı ile kalem
              sayısı farklı kavramlardır.
            </p>
          )}
          <Field label="Giyim adedi N">
            <select
              name="clothingCount"
              defaultValue={
                kit?.clothingCount || sourceKitDraft?.clothingCount || 6
              }
            >
              {[3, 6, 9, 12, 18, 24, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Set adı">
            <input
              name="name"
              required
              defaultValue={kit?.name || sourceKitDraft?.name}
            />
          </Field>
          <Field label="Set satış fiyatı (₺)">
            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={kit?.price || sourceKitDraft?.price}
            />
          </Field>
          <Field label="Reçeteye alt ürün ekle">
            <select
              value=""
              onChange={(e) => {
                if (
                  e.target.value &&
                  !recipeDraft.some((r) => r.product === e.target.value)
                )
                  setRecipeDraft([
                    ...recipeDraft,
                    { product: e.target.value, qty: 1 },
                  ]);
              }}
            >
              <option value="">Ürün seçin…</option>
              {productOptions()}
            </select>
          </Field>
          <p>
            {recipeDraft.length} alt ürün kalemi. Giyim N ile çarpılır; sabit
            kalemler reçete miktarı kadar düşer. Eksik beden eşleşmesi satışa
            izin vermez.
          </p>
          {recipeDraft.map((r, i) => (
            <div className="recipe-editor" key={r.product}>
              <span>
                {pName(r.product)}
                <select
                  aria-label={`${r.product} adet kuralı`}
                  value={r.mode || "fixed"}
                  onChange={(e) =>
                    setRecipeDraft(
                      recipeDraft.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              mode: e.target.value as "clothing" | "fixed",
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="fixed">Sabit</option>
                  <option value="clothing">Giyim × N</option>
                </select>
              </span>
              <input
                aria-label={`${r.product} reçete adedi`}
                type="number"
                min="1"
                step="1"
                value={r.qty}
                onChange={(e) =>
                  setRecipeDraft(
                    recipeDraft.map((x, j) =>
                      j === i ? { ...x, qty: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`${r.product} reçeteden çıkar`}
                onClick={() =>
                  setRecipeDraft(recipeDraft.filter((_, j) => i !== j))
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </Dialog>
      )}
      {modal &&
        ["online", "wholesale", "transfer"].includes(modal.kind) &&
        canStock && (
          <Dialog
            title={
              modal.kind === "online"
                ? "Kanaldan sipariş simülasyonu"
                : modal.kind === "wholesale"
                  ? "Yeni toptan sipariş"
                  : "Lokasyonlar arası sevkiyat talebi"
            }
            busy={busy}
            error={error}
            submit={
              modal.kind === "transfer" ? "Talep oluştur" : "Siparişi onayla"
            }
            onClose={() => setModal(undefined)}
            onSubmit={(f) =>
              void submit(f, (n, f) => {
                if (!orderDraft.length) throw Error("En az bir ürün ekleyin.");
                if (modal.kind === "transfer") {
                  const from = num(f, "from"),
                    to = num(f, "to");
                  if (from === to)
                    throw Error("Gönderen ve alıcı lokasyon farklı olmalı.");
                  if (
                    !manager &&
                    !userLocations.includes(from) &&
                    !userLocations.includes(to)
                  )
                    throw Error(
                      "Yalnız atandığınız lokasyon için talep açabilirsiniz.",
                    );
                  const id = uid("SV");
                  n.transfers.unshift({
                    id,
                    from,
                    to,
                    created: now(),
                    status: "Talep",
                    lines: structuredClone(orderDraft),
                    note: value(f, "note"),
                    user: activeUser?.name,
                  });
                  log(n, `${id}: sevkiyat talebi açıldı`, "Sevkiyat");
                } else {
                  const wholesale = modal.kind === "wholesale";
                  const selectedChannel = value(f, "channel");
                  const lines = structuredClone(orderDraft);
                  if (!wholesale)
                    for (const l of lines)
                      l.price = channelPrice(
                        n.products.find((p) => p.id === l.product)!,
                        n.rules[selectedChannel],
                      );
                  addOrder(n, {
                    id: uid("SP"),
                    channel: wholesale ? "Toptan" : selectedChannel,
                    note: value(f, "note"),
                    operator: activeUser?.name,
                    customer: wholesale
                      ? value(f, "customer")
                      : "Kurgusal perakende müşteri",
                    location: num(f, "location"),
                    created: now(),
                    status: wholesale ? "Toplanacak" : "Stok düşüldü",
                    lines,
                    assignee: wholesale ? value(f, "assignee") : "",
                    wholesale,
                    posted: false,
                  });
                }
              })
            }
          >
            {modal.kind === "transfer" ? (
              <div className="form-grid">
                <Field label="Gönderen lokasyon">
                  <select name="from" defaultValue={0}>
                    {LOCATIONS.map((l, i) => (
                      <option key={i} value={i}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Teslim alan lokasyon">
                  <select
                    name="to"
                    defaultValue={role === "Mağaza" ? ownLoc : 1}
                  >
                    {LOCATIONS.map((l, i) => (
                      <option key={i} value={i}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <>
                <Field label="Stok lokasyonu">
                  <select name="location" defaultValue={ownLoc}>
                    {locOptions()}
                  </select>
                </Field>
                {modal.kind === "online" ? (
                  <Field label="Sipariş kanalı">
                    <select name="channel" defaultValue={channel}>
                      {CHANNELS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <div className="form-grid">
                    <Field label="Toptan müşteri">
                      <select name="customer">
                        {s.accounts
                          .filter((a) => a.type === "Müşteri")
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Depo personeli">
                      <select name="assignee" required>
                        <option value="">Personel seçin…</option>
                        {s.staff
                          .filter((p) =>
                            p.permissions
                              ? p.permissions.includes("prepare")
                              : p.role === "Depo",
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name.replace(/^Demo /, "")} ·{" "}
                              {LOCATIONS[p.location]}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                )}
              </>
            )}
            <Field label="İşlem / sipariş notu">
              <input name="note" />
            </Field>
            <LinePicker products={s.products} onAdd={addDraftLine} />
            <h3>İşlem listesi · {orderDraft.length} kalem</h3>
            {orderDraft.map((l, i) => (
              <div className="recipe-editor" key={i}>
                <span>
                  {pName(l.product)}
                  <small>
                    {pById(l.product).variants[l.variant].size} · {l.qty} adet
                  </small>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Satırı çıkar"
                  onClick={() =>
                    setOrderDraft(orderDraft.filter((_, j) => i !== j))
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <p className="hint">
              {modal.kind === "online"
                ? "Onay, stokları hemen düşürür. Sipariş ekranından iptal veya iade ile geri alınabilir."
                : modal.kind === "wholesale"
                  ? "Bu aşamada stok ve cari değişmez. Yalnız net teslim onayında işlenir."
                  : "Talep stok değiştirmez. Gönderenin sevk, alıcının teslim onayı gerekir."}
            </p>
          </Dialog>
        )}
      {modal?.kind === "order" && order && (
        <Dialog
          title={order.id}
          className={
            order.status === "Toplanacak" && canStock
              ? "picking-dialog"
              : undefined
          }
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          submit="Kaydet"
          onSubmit={
            order.status === "Toplanacak" && canStock
              ? (f) =>
                  void submit(
                    f,
                    (n, f) => {
                      const o = n.orders.find((x) => x.id === order.id)!;
                      o.assignee = value(f, "assignee");
                      for (let i = 0; i < o.lines.length; i++) {
                        const q = num(f, `picked-${i}`);
                        positive(q, true);
                        if (q > o.lines[i].qty)
                          throw Error("Hazırlanan adet siparişi aşamaz.");
                        o.lines[i].picked = q;
                      }
                      log(n, `${o.id}: toplama kaydedildi`, "Toplama");
                    },
                    "Toplama kaydedildi; henüz stok veya cari değişmedi.",
                  )
              : undefined
          }
        >
          <div className="summary-banner">
            <span>
              {order.channel} · {LOCATIONS[order.location]}
              <small>
                {accountName(order.customer)} · {date(order.created)}
              </small>
            </span>
            <Tone status={order.status} />
          </div>
          {order.status === "Toplanacak" && canStock ? (
            <>
              <div className="pick-progress">
                <strong>
                  Ürün {pickIndex + 1} / {order.lines.length}
                </strong>
                <span>
                  {LOCATIONS[order.location]} · Raf bilgisi kayıtlı değil
                </span>
              </div>
              {order.lines.map((l, i) => {
                const q = draft["pick" + i] ?? l.picked;
                return (
                  <div className="picking-row" key={i} hidden={pickIndex !== i}>
                    <figure className="pick-image">
                      <ProductImage
                        name={pName(l.product)}
                        image={pById(l.product).image}
                      />
                      {!pById(l.product).image && (
                        <figcaption>Temsili katalog görseli</figcaption>
                      )}
                    </figure>
                    <div className="pick-product">
                      <strong>{pName(l.product)}</strong>
                      <div
                        className="pick-demand"
                        aria-label={`İstenen: ${l.qty} adet`}
                      >
                        <strong className="pick-quantity">{l.qty}</strong>
                        <span>adet</span>
                        <span className="pick-variant">
                          {pById(l.product).variants[l.variant].size}
                        </span>
                      </div>
                      <Tone
                        status={
                          q === 0 ? "Yok" : q === l.qty ? "Tamam" : "Eksik"
                        }
                      />
                    </div>
                    <Field label="Hazırlanan adet">
                      <input
                        name={`picked-${i}`}
                        type="number"
                        min="0"
                        max={l.qty}
                        step="1"
                        value={q}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            ["pick" + i]: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Eksik ürün / personel notu">
                      <input
                        value={pickNotes[i] ?? l.note ?? ""}
                        onChange={(e) =>
                          setPickNotes({ ...pickNotes, [i]: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                );
              })}
              <div className="pick-assignee">
                <Field label="Atanan depo personeli">
                  <select
                    name="assignee"
                    defaultValue={order.assignee}
                    required
                  >
                    {s.staff
                      .filter(
                        (p) =>
                          (p.permissions
                            ? p.permissions.includes("prepare")
                            : p.role === "Depo") &&
                          (p.locations || [p.location]).includes(
                            order.location,
                          ),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name.replace(/^Demo /, "")}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <div className="pick-controls">
                <button
                  type="button"
                  className="secondary"
                  disabled={pickIndex === 0}
                  onClick={() => setPickIndex(pickIndex - 1)}
                >
                  Önceki ürün
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={pickIndex === order.lines.length - 1}
                  onClick={() => setPickIndex(pickIndex + 1)}
                >
                  Sonraki ürün
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const l = order.lines[pickIndex];
                    setDraft({ ...draft, ["pick" + pickIndex]: l.qty });
                    if (pickIndex < order.lines.length - 1)
                      setPickIndex(pickIndex + 1);
                  }}
                >
                  Topladım <Check size={22} />
                </button>
              </div>
              <button
                type="button"
                className="deliver-button"
                onClick={() => {
                  const selected =
                    (
                      document.querySelector(
                        "dialog select[name=assignee]",
                      ) as HTMLSelectElement
                    )?.value || order.assignee;
                  confirm(
                    "Hazırlanan net adetler teslim edilecek. Stok ve cari yalnız bu adetler üzerinden işlenecek.",
                    (n) => {
                      const o = n.orders.find((x) => x.id === order.id)!;
                      o.assignee = selected;
                      o.lines.forEach((l, i) => {
                        l.picked = draft["pick" + i] ?? l.picked;
                        l.note = pickNotes[i] ?? l.note;
                      });
                      const st = n.staff.find((p) => p.id === o.assignee);
                      if (!st || st.location !== o.location)
                        throw Error(
                          "Bu lokasyona atanmış depo personeli seçin.",
                        );
                      deliver(n, o.id);
                    },
                    "Net teslimat tamamlandı. Stok ve cari güncellendi.",
                  );
                }}
              >
                Net teslimatı onayla
              </button>
            </>
          ) : (
            lineList(order.lines, order.wholesale)
          )}
          <div className="row-actions">
            {order.status === "Teslim edildi" && (
              <button
                type="button"
                className="secondary"
                onClick={() => open("delivery-doc", order.id)}
              >
                Teslimat fişi / PDF
              </button>
            )}
            {order.status === "Stok düşüldü" && canStock && (
              <button
                type="button"
                onClick={() =>
                  confirm(
                    "Sipariş kargolandı olarak işaretlenecek. Stok ikinci kez düşmez.",
                    (n) => {
                      n.orders.find((x) => x.id === order.id)!.status =
                        "Kargolandı";
                      log(n, `${order.id} kargolandı`, "Sipariş");
                    },
                  )
                }
              >
                Kargolandı olarak işaretle
              </button>
            )}
            {!["İptal", "İade"].includes(order.status) && canStock && (
              <>
                <button
                  type="button"
                  className="secondary danger"
                  onClick={() =>
                    confirm(
                      "Sipariş iptal edilecek; işlenmiş stok ve cari hareketleri geri alınacak.",
                      (n) => reverseOrder(n, order.id, "İptal"),
                    )
                  }
                >
                  Siparişi iptal et
                </button>
                {order.posted && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      confirm(
                        "Siparişin net teslim edilen ürünleri stoğa geri eklenecek; varsa cari borcu geri alınacak.",
                        (n) => reverseOrder(n, order.id, "İade"),
                      )
                    }
                  >
                    İade al
                  </button>
                )}
              </>
            )}
          </div>
        </Dialog>
      )}
      {modal?.kind === "account-edit" && finance && (
        <Dialog
          title={account ? "Cari kartını düzenle" : "Yeni cari kartı"}
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              const limit = num(f, "limit"),
                days = num(f, "days");
              amount(limit);
              positive(days, true);
              const next = {
                id: account?.id || uid("C"),
                name: value(f, "name").trim(),
                city: value(f, "city"),
                type: value(f, "type") as "Müşteri",
                limit,
                days,
              };
              if (!next.name.toLocaleLowerCase("tr").includes("kurgusal"))
                next.name = "Kurgusal " + next.name;
              if (account)
                n.accounts[n.accounts.findIndex((a) => a.id === account.id)] =
                  next;
              else n.accounts.push(next);
              const opening = num(f, "opening");
              if (!Number.isFinite(opening))
                throw Error("Geçerli açılış bakiyesi girin.");
              const openingId = "ACILIS-" + next.id;
              n.entries = n.entries.filter(
                (e) =>
                  e.id !== openingId &&
                  !(
                    account &&
                    e.account === account.id &&
                    /açılış|tedarikçi bakiyesi/i.test(e.memo)
                  ),
              );
              if (opening !== 0)
                n.entries.unshift({
                  id: openingId,
                  account: next.id,
                  date: now(),
                  memo: "Açılış bakiyesi",
                  debit: Math.max(opening, 0),
                  credit: Math.max(-opening, 0),
                  due: now(),
                });
              log(n, `${next.id} cari kartı kaydedildi`, "Cari");
            })
          }
        >
          <Field label="Kurgusal ticari ad">
            <input name="name" required defaultValue={account?.name} />
          </Field>
          <Field label="Kart türü">
            <select name="type" defaultValue={account?.type}>
              <option>Müşteri</option>
              <option>Tedarikçi</option>
            </select>
          </Field>
          <Field label="Şehir">
            <input name="city" required defaultValue={account?.city} />
          </Field>
          <Field label="Açılış bakiyesi (₺; alacak + / borç −)">
            <input
              name="opening"
              type="number"
              step="0.01"
              defaultValue={
                account
                  ? s.entries
                      .filter(
                        (e) =>
                          e.account === account.id &&
                          /açılış|tedarikçi bakiyesi/i.test(e.memo),
                      )
                      .reduce((a, e) => a + e.debit - e.credit, 0)
                  : 0
              }
            />
          </Field>
          <div className="form-grid">
            <Field label="Risk limiti (₺)">
              <input
                name="limit"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={account?.limit || 100000}
              />
            </Field>
            <Field label="Vade (gün)">
              <input
                name="days"
                type="number"
                min="0"
                max="365"
                step="1"
                required
                defaultValue={account?.days ?? 30}
              />
            </Field>
          </div>
          <p className="hint">
            Gerçek kişi, telefon veya banka bilgisi girmeyin.
          </p>
        </Dialog>
      )}
      {modal?.kind === "account" && account && finance && (
        <Dialog title={account.name} onClose={() => setModal(undefined)}>
          <div className="summary-banner">
            <span>
              {account.type} · {account.days} gün vade
              <small>Risk limiti {money(account.limit)}</small>
            </span>
            <strong>{money(balance(s, account.id))}</strong>
          </div>
          <div className="statement">
            {s.entries
              .filter((e) => e.account === account.id)
              .map((e) => (
                <div key={e.id}>
                  <span>
                    {e.memo}
                    <small>
                      {date(e.date)} · Vade {date(e.due)}
                    </small>
                  </span>
                  <span>
                    <small>Borç</small>
                    {money(e.debit)}
                  </span>
                  <span>
                    <small>Alacak</small>
                    {money(e.credit)}
                  </span>
                </div>
              ))}
          </div>
          <div className="row-actions">
            <button type="button" onClick={() => open("payment", account.id)}>
              Tahsilat / ödeme
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => open("account-edit", account.id)}
            >
              Kartı düzenle
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setStatementId(account.id);
                open("statement-filter");
              }}
            >
              Ekstre al
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "payment" && account && finance && (
        <Dialog
          title="Tahsilat / ödeme makbuzu"
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          submit="Makbuzu kaydet"
          onSubmit={async (f) => {
            let id = "";
            if (
              await mutate((n) => {
                const e = payment(
                  n,
                  account.id,
                  num(f, "amount"),
                  value(f, "type"),
                );
                id = e.id;
              })
            ) {
              setModal({ kind: "receipt", id });
            }
          }}
        >
          <p>
            {account.name} · Bakiye {money(balance(s, account.id))}
          </p>
          <Field label="İşlem türü">
            <select
              name="type"
              defaultValue={account.type === "Müşteri" ? "Tahsilat" : "Ödeme"}
            >
              <option>Tahsilat</option>
              <option>Ödeme</option>
            </select>
          </Field>
          <Field label="Tutar (₺)">
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
            />
          </Field>
          <p className="hint">İşlem yalnız cari hareketlere kaydedilir.</p>
        </Dialog>
      )}
      {modal?.kind === "statement-filter" && finance && (
        <Dialog
          title="Tarih aralıklı cari ekstresi"
          error={error}
          onClose={() => setModal(undefined)}
          submit="Ekstreyi görüntüle"
          onSubmit={(f) => {
            const from = value(f, "from"),
              to = value(f, "to");
            if (from && to && from > to) {
              setError("Başlangıç tarihi bitişten sonra olamaz.");
              return;
            }
            setStatementId(value(f, "account"));
            setDateFrom(from);
            setDateTo(to);
            setModal({ kind: "statement" });
          }}
        >
          <Field label="Cari hesap">
            <select name="account" defaultValue={statementId}>
              {s.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Başlangıç tarihi">
              <input type="date" name="from" defaultValue={dateFrom} />
            </Field>
            <Field label="Bitiş tarihi">
              <input type="date" name="to" defaultValue={dateTo} />
            </Field>
          </div>
          <p className="hint">
            Boş tarihler tüm dönemi kapsar. Dönem öncesi devir bakiyesi ayrıca
            gösterilir.
          </p>
        </Dialog>
      )}
      {modal &&
        ["statement", "receipt", "delivery-doc"].includes(modal.kind) && (
          <Dialog title="Belge önizlemesi" onClose={() => setModal(undefined)}>
            {documentContent()}
          </Dialog>
        )}
      {modal?.kind === "staff-edit" && canStaff && (
        <Dialog
          title={staff ? "Personel kartını düzenle" : "Yeni personel kartı"}
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              const name = value(f, "name").trim();
              const next: Staff = {
                id: staff?.id || uid("P"),
                name,
                role: value(f, "role") as Role,
                email: value(f, "email"),
                locations:
                  staff?.location === num(f, "location")
                    ? staff.locations || [num(f, "location")]
                    : [num(f, "location")],
                permissions:
                  staff?.role === value(f, "role")
                    ? staff.permissions || defaultPermissions(value(f, "role"))
                    : defaultPermissions(value(f, "role")),
                location: num(f, "location"),
                records: staff?.records || [],
              };
              if (staff)
                n.staff[n.staff.findIndex((p) => p.id === staff.id)] = next;
              else n.staff.push(next);
              log(
                n,
                `${next.id}: ${next.role} · ${LOCATIONS[next.location]}`,
                "Personel",
              );
            })
          }
        >
          <Field label="Kurgusal personel adı">
            <input
              name="name"
              required
              defaultValue={staff?.name.replace(/^Demo /, "")}
            />
          </Field>
          <Field label="Personel e-postası (isteğe bağlı)">
            <input name="email" type="email" defaultValue={staff?.email} />
          </Field>
          <Field label="Rol / yetki">
            <select name="role" defaultValue={staff?.role}>
              {(["Yönetici", "Depo", "Mağaza", "Muhasebe"] as Role[]).map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Atanmış lokasyon">
            <select name="location" defaultValue={staff?.location || 0}>
              {LOCATIONS.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <div className="quiet-note">
            Yönetici: tüm modüller. Depo: stok/toplama/sevkiyat. Mağaza: kendi
            lokasyon stoğu/sipariş/sevkiyat. Muhasebe: cari ve raporlar.
          </div>
        </Dialog>
      )}
      {modal?.kind === "staff-record" && staff && canStaff && (
        <Dialog
          title={`${staff.name.replace(/^Demo /, "")} · İzin / avans`}
          busy={busy}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={(f) =>
            void submit(f, (n, f) => {
              const v = num(f, "value");
              amount(v);
              if (value(f, "type") === "İzin") positive(v);
              n.staff
                .find((p) => p.id === staff.id)!
                .records.push({
                  type: value(f, "type"),
                  value: v,
                  date: value(f, "date"),
                  note: value(f, "note"),
                });
              log(
                n,
                `${staff.name.replace(/^Demo /, "")}: ${value(f, "type")} kaydedildi`,
                "Personel",
              );
            })
          }
        >
          <div className="form-grid">
            <Field label="Kayıt türü">
              <select name="type">
                <option>İzin</option>
                <option>Avans</option>
              </select>
            </Field>
            <Field label="Gün / tutar (₺)">
              <input
                name="value"
                required
                type="number"
                min="0.01"
                step="0.01"
              />
            </Field>
          </div>
          <Field label="Tarih">
            <input
              name="date"
              required
              type="date"
              defaultValue={dateKey(now())}
            />
          </Field>
          <Field label="Açıklama">
            <input name="note" maxLength={200} required />
          </Field>
          <h3>Geçmiş kayıtlar</h3>
          {staff.records.length ? (
            staff.records.map((r, i) => (
              <div className="log-row" key={i}>
                <span>
                  {date(r.date)} · {r.type} ·{" "}
                  {r.type === "Avans" ? money(r.value) : r.value + " gün"}
                  <small>{r.note}</small>
                </span>
              </div>
            ))
          ) : (
            <p className="hint">Henüz izin veya avans kaydı yok.</p>
          )}
        </Dialog>
      )}
    </div>
  );
}
