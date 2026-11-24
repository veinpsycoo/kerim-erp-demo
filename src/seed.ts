import raw from "./catalog.json";
import { enrich } from "./enrich";
import { CHANNELS, now, type State, type Product, type Line } from "./domain";
export function seed(): State {
  const products: Product[] = raw.map((p, i) => ({
    ...p,
    buy: Math.round(p.price * 0.54 * 100) / 100,
    wholesale: Math.round(p.price * 0.76 * 100) / 100,
    variants: p.variants.map((v, j) => ({
      ...v,
      stock: [
        i % 19 === 0 ? 3 : 24 + ((i * 7 + j * 3) % 65),
        3 + ((i + j) % 19),
        2 + ((i * 3 + j) % 15),
      ],
    })),
  }));
  const partIds = products
    .filter((p) => !p.name.toLocaleLowerCase("tr").includes("set"))
    .slice(0, 22)
    .map((p) => p.id);
  const kits = [
    ["Er Teçhizat Seti", 18],
    ["Denizci Kombin Seti", 15],
    ["Kışlık Bedelli Seti", 20],
    ["Jandarma Hazırlık Seti", 17],
  ].map(([name, n], i) => ({
    id: `SET-00${i + 1}`,
    name: `${name} · ${n} parça`,
    price: [2490, 2190, 3290, 2790][i],
    recipe: Array.from({ length: Number(n) }, (_, j) => ({
      product: partIds[(j + i * 2) % partIds.length],
      qty: 1,
    })),
  }));
  const line = (i: number, qty: number): Line => ({
    product: products[i].id,
    variant: 0,
    qty,
    picked: qty,
    price: products[i].wholesale,
  });
  const today = now();
  const yesterday = new Date(Date.now() - 28 * 3600000).toISOString();
  return enrich({
    version: 1,
    products,
    kits,
    accounts: [
      {
        id: "C-001",
        name: "Kurgusal Anadolu Toptan",
        type: "Müşteri",
        limit: 250000,
        days: 30,
        city: "Ankara",
      },
      {
        id: "C-002",
        name: "Kurgusal Ege Askeri Giyim",
        type: "Müşteri",
        limit: 150000,
        days: 15,
        city: "İzmir",
      },
      {
        id: "C-003",
        name: "Kurgusal Marmara Tekstil",
        type: "Tedarikçi",
        limit: 300000,
        days: 45,
        city: "İstanbul",
      },
    ],
    entries: [
      {
        id: "CR-DEMO-1",
        account: "C-001",
        date: yesterday,
        memo: "Demo açılış bakiyesi",
        debit: 18450,
        credit: 0,
        due: new Date(Date.now() + 15 * 86400000).toISOString(),
      },
      {
        id: "CR-DEMO-2",
        account: "C-002",
        date: yesterday,
        memo: "Demo açılış bakiyesi",
        debit: 7200,
        credit: 0,
        due: today,
      },
      {
        id: "CR-DEMO-3",
        account: "C-003",
        date: yesterday,
        memo: "Demo tedarikçi bakiyesi",
        debit: 0,
        credit: 32600,
        due: today,
      },
    ],
    staff: [
      {
        id: "P-001",
        name: "Demo Yönetici",
        role: "Yönetici",
        location: 0,
        records: [],
      },
      {
        id: "P-002",
        name: "Demo Depocu",
        role: "Depo",
        location: 0,
        records: [],
      },
      {
        id: "P-003",
        name: "Demo Mağazacı",
        role: "Mağaza",
        location: 1,
        records: [],
      },
      {
        id: "P-004",
        name: "Demo Muhasebeci",
        role: "Muhasebe",
        location: 0,
        records: [],
      },
    ],
    orders: [
      {
        id: "SP-DEMO-001",
        channel: "Toptan",
        customer: "C-001",
        location: 0,
        created: today,
        status: "Toplanacak",
        lines: [line(0, 5), line(1, 3), line(2, 4)],
        assignee: "P-002",
        wholesale: true,
        posted: false,
      },
      {
        id: "SP-DEMO-002",
        channel: "Trendyol",
        customer: "Kurgusal perakende müşteri",
        location: 0,
        created: yesterday,
        status: "Stok düşüldü",
        lines: [{ ...line(4, 2), price: products[4].price }],
        assignee: "",
        wholesale: false,
        posted: true,
      },
      {
        id: "SP-DEMO-003",
        channel: CHANNELS[0],
        customer: "Kurgusal perakende müşteri",
        location: 1,
        created: today,
        status: "Kargolandı",
        lines: [{ ...line(5, 1), price: products[5].price }],
        assignee: "",
        wholesale: false,
        posted: true,
      },
    ],
    transfers: [
      {
        id: "SV-DEMO-001",
        from: 0,
        to: 1,
        lines: [line(3, 4)],
        status: "Talep",
        created: yesterday,
      },
    ],
    rules: Object.fromEntries(
      CHANNELS.map((c, i) => [
        c,
        {
          multiplier: [1, 1.05, 1.1, 1.35, 1.3, 1.25][i],
          round: i > 2 ? "90" : "none",
          exceptions: {},
        },
      ]),
    ),
    listings: CHANNELS.flatMap((c, i) =>
      products
        .slice(0, 18)
        .map((p, j) => ({
          id: `IL-${i}-${j}`,
          channel: c,
          title: p.name,
          product: j % 5 === 0 ? "" : p.id,
          suggested: p.id,
        })),
    ),
    logs: [
      {
        id: "LOG-DEMO",
        date: today,
        message:
          "Demo çalışma alanı hazırlandı. Tüm operasyon kayıtları kurgusaldır.",
        kind: "Sistem",
      },
    ],
    queue: [],
  });
}
