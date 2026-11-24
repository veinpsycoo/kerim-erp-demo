# Asker Marketi Yönetim

Türkçe, tarayıcıda çalışan birinci aşama ERP demosu.

Canlı: https://veinpsycoo.github.io/kerim-erp-demo/

Giriş ekranında rolü seçin; üstteki Aktif kullanıcı alanından personel ve lokasyon değiştirin. Cephetoptan ve Askerkolisi WooCommerce ile Trendyol GET API'lerinden gerçek ürün ve anonim sipariş anlık görüntüsü alınır. İkas token ve GraphQL sorguları üzerinden salt okuma ile bağlıdır; N11 anahtar bekler. Gerçek sipariş tutarları yayımlanmaz. Merkez lokasyon stokları, personel ve yerel mali işlemler demo verisidir. Kanallara yazma yapılmaz.

## Çalıştırma ve doğrulama

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run e2e
```

Playwright, üretim derlemesini 390 × 844 ve 1366 × 900 boyutlarında doğrular. `LIVE_URL` ile aynı testler canlı adrese yönlendirilir. `EVIDENCE_DIR` ekran görüntüsü, PDF ve JSON raporlarının klasörünü belirler. GitHub Actions önce tüm kontrolleri ve yerel üretim testini çalıştırır, sonra Pages’e yayınlar ve aynı testleri canlıda tekrarlar.

## Veri ve sınırlar

IndexedDB tek tarayıcıda kalıcıdır. Yönetim ve raporlar → İşlem günlüğü → Demo verisini sıfırla ile başlangıca dönülür. PWA kabuğu, ilk katalog fotoğrafları ve fontlar yereldir; canlı kanal görselleri uzaktaki kaynakları kullanır. PDF düğmeleri tarayıcının Yazdır → PDF olarak kaydet akışını açar.

Rol seçimi demoya özeldir, gerçek kimlik doğrulama veya güvenlik sınırı değildir. Demo için gerçek kişi, telefon, kimlik, IBAN veya gizli bilgi girilmemelidir. Kanal gönderimleri simülasyondur; kuyruk ve işlem günlüğünden izlenir.

`src/domain.ts`: stok/set/fiyat/sipariş/sevkiyat/cari kuralları. `src/catalog.json`: kaynak URL ve zaman bilgisiyle gerçek katalog. `scripts/collection-log.json`: veri toplama sonucu. `tests/flows.spec.ts`: modül ve yetki akışları.

## Elle salt okuma senkronu

```sh
python scripts/sync-gercek.py
python scripts/enrich-images.py
node scripts/data-metrics.mjs
npm run build
python scripts/scan-secrets.py
python scripts/publish.py
```

Anahtarlar yalnız kullanıcının özel yapılandırma dosyasından belleğe okunur; CI anahtar kullanmaz. WooCommerce ve Trendyol senkronu en çok 2 GET/sn uygular. İkas yalnız token değişimi ve GraphQL query için POST kullanır; mutation reddedilir. Ham müşteri yanıtları diske yazılmaz. Pillow yerelde görsellerin 64 bit dHash değerlerini hesaplar; ücretli/yabancı AI servisi yoktur. `.private/` yerel çalışma ve hash önbelleği dizinidir, yayımlanmaz. Yayın betiği sızıntı taramasını zorunlu çalıştırır.

Stok çarpanı ilan başına pozitif tam sayıdır; fiyat kuralı çarpanından ayrıdır. Merkez SKU tekli birim, kanal stok önizlemesi `floor(lokasyon varyant stoğu / paket çarpanı)`. Online demo siparişinde adet × çarpan düşer ve iadede aynısı geri gelir. Toptan siparişte stok/cari yalnız net teslimat onayında işlenir. Set giyim kalemleri N ile, sabit kalemler reçete miktarıyla düşer. Gerçek reçete bağlantıları ve doğrulama kanıtları için [DEMO-RAPOR.md](DEMO-RAPOR.md).
