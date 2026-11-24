import {
  useEffect,
  useRef,
  useState,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { X, PackageSearch, Printer } from "lucide-react";
import { money, positive, type Product, type Line } from "./domain";
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  text = "Bu görünümde kayıt yok.",
  children,
}: {
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <PackageSearch size={32} />
      <h3>{text}</h3>
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea"].includes(String(child.type))
          ? cloneElement(child as ReactElement<{ id?: string }>, { id })
          : child,
      )}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  onSubmit,
  busy,
  submit = "Kaydet",
  error,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit?: (f: HTMLFormElement) => void;
  busy?: boolean;
  submit?: string;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e.currentTarget);
        }}
      >
        <header className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Pencereyi kapat"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="dialog-body">
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {children}
        </div>
        <footer className="dialog-foot">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Kapat
          </button>
          {onSubmit && (
            <button disabled={busy} type="submit">
              {busy ? "Kaydediliyor…" : submit}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
export function Doc({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="print-document">
        <div className="doc-brand">Asker Marketi Yönetim</div>
        <h2>{title}</h2>
        <p>
          ÖRNEK BELGE · Mali belge değildir · Tüm kişi ve işlem verileri
          kurgusaldır.
        </p>
        {children}
      </div>
      <button
        type="button"
        className="print-trigger"
        onClick={() => window.print()}
      >
        <Printer size={16} /> Yazdır / PDF olarak kaydet
      </button>
    </>
  );
}
export function ProductImage({ image, name }: { image: string; name: string }) {
  const example = /fanila|tişört/i.test(name)
    ? "products/6.webp"
    : /don|boxer/i.test(name)
      ? "products/10.webp"
      : /çorap/i.test(name)
        ? "products/9.webp"
        : /defter/i.test(name)
          ? "products/108.webp"
          : "icon.svg";
  const source = image || example;
  return (
    <img
      className="product-image"
      src={
        source.startsWith("http") ? source : import.meta.env.BASE_URL + source
      }
      alt={
        name +
        (!image && example !== "icon.svg" ? " · Temsili katalog görseli" : "")
      }
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = import.meta.env.BASE_URL + "icon.svg";
      }}
    />
  );
}
export function LinePicker({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (l: Line) => void;
}) {
  const [id, setId] = useState(products[0].id);
  const [vi, setVi] = useState(0);
  const [q, setQ] = useState(1);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const p = products.find((p) => p.id === id)!;
  return (
    <div className="line-picker">
      <Field label="Ürünleri filtrele">
        <input
          placeholder="Ad / SKU / kategori"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <Field label="Ürün">
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setVi(0);
          }}
        >
          {products
            .filter(
              (p) =>
                p.id === id ||
                `${p.id} ${p.name} ${p.category}`
                  .toLocaleLowerCase("tr")
                  .includes(search.toLocaleLowerCase("tr")),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Varyant">
          <select value={vi} onChange={(e) => setVi(Number(e.target.value))}>
            {p.variants.map((v, i) => (
              <option key={i} value={i}>
                {v.size} · {v.color}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Adet">
          <input
            type="number"
            min="1"
            step="1"
            value={q}
            onChange={(e) => setQ(Number(e.target.value))}
          />
        </Field>
      </div>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      <button
        type="button"
        className="secondary"
        onClick={() => {
          try {
            positive(q);
            onAdd({
              product: id,
              variant: vi,
              qty: q,
              picked: q,
              price: p.wholesale,
            });
            setErr("");
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        Listeye ekle · {money(p.wholesale * q || 0)}
      </button>
    </div>
  );
}
