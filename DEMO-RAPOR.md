# Kerim ERP demo — 4. tur arayüz yenilemesi

Talep: 24 Kasım 2026 · Son doğrulama: 25 Kasım 2026 (İstanbul).
Canlı: https://veinpsycoo.github.io/kerim-erp-demo/
Test edilen ve yayımlanan uygulama commit’i: `c160457bfee7285124e65528f53cc195e40a4ba7`.
CI ve canlı turu: https://github.com/veinpsycoo/kerim-erp-demo/actions/runs/45503160772

## Sonuç ve kullanım

- İlk girişte **Kimsiniz?**: Yönetici, Depo, Mağaza, Muhasebe. Seçim hatırlanır; profil çipinden **Rol değiştir** açılır. Çalışan seçimi profil sayfasındadır.
- Mobilde beşli alt menü ve Daha fazla listesi; masaüstünde koyu zeytin menü. Breadcrumb, hamburger ve üst bardaki kullanıcı seçici kaldırıldı.
- Depo toplamayla; Mağaza fotoğraflı satışla; Muhasebe tahsilatla; Yönetici dört adet göstergesi, dikkat listesi ve tek satır kanal özetiyle açılır.
- Stok, ürün kartı, eşleştirme, set, sipariş/sevkiyat, cari, personel, rapor, günlük ve belgeler aynı yazı/boşluk/yüzey sistemiyle yenilendi. Mobil ürün matrisi etiketli satırlar halinde, yatay kaydırmasızdır.
- Toplama tek ürün gösterir; fotoğraf, lokasyon, istenen/hazırlanan adet, Topladım, kısmi miktar ve personel notu korunur. Raf verisi olmadığında açıkça belirtilir.
- Bot Vatkası 1/12/3 kartı Kanallar’ın başındadır. Eşleştirme dolu tüm-kanal görünümüyle açılır; onay/ret, başka SKU ve toplu onay korunur.
- Teknik demo açıklaması profil/ayarlarda toplanmıştır. Özgün SP-DEMO/SV-DEMO kayıt kodları veri bütünlüğü için korunur; kullanıcı arayüzünde Demo: öneki yoktur.

## Ölçülmüş kabul sonuçları

- **51/51** birim testi; **7/7** salt okuma senkron testi.
- **60/60** yayın öncesi E2E; **60/60** canlı E2E; atlanan ve kararsız test **0**.
- Her aşamada dört rol ve tüm yetkili menüler: **56** rol/menü/ekran ölçümü; iki aşamada **112**. Genişlikler **390 ve 1366 px**.
- Konsol hatası **0**, yatay sayfa taşması **0**, 44 px altı dokunma hedefi **0**, 13 px altı metin **0**, hesaplanan AA metin kontrast hatası **0**.
- Ürün matrisinin kendi kaydırma genişliği ve lokasyon/adet aralığı ayrıca ölçüldü; tablo adı Türkçe ve erişilebilir. Klavye odak halkası ve azaltılmış hareket tercihi test edildi.
- Lint ve typecheck hatasız; build ve yüksek önem seviyeli bağımlılık denetimi başarılı. Yeni npm bağımlılığı eklenmedi. Önceden kalan veri paketi/font yolu derleme uyarıları aşağıda belirtilmiştir.
- Beş yerel Manrope dosyasında Türkçe karakter kapsamı doğrulandı. Token kontrastları `design-checks.json` içinde.
- Görünür metin dökümü ve Türkçe kontrolü `gorunen-metinler.txt`, `turkce-kontrol.json` içinde; bozuk kodlama karakteri ve Demo: öneki **0**. Kaynak ürün adları korunur. NIM denemesi geçerli son çıktı üretmedi; döküm elle denetlendi.

## Veri, güvenlik ve önbellek

- Domain, seed, katalog, eşleştirme/set kuralları, İkas okuma kodu ve diğer çekirdeklerden **8 dosya** hash düzeyinde aynıdır. Zorunlu gizlilik istisnasıyla `gercek.json` ve `sync-gercek.py` yalnız ürün URL’lerindeki merchantId/sellerId sorgu parametresini kaldırmak için değişti. **2.832 bağlantı** temizlendi; URL dışındaki bütün snapshot alanları aynı iş verisi hash’indedir (`protected-files.json`, `url-privacy-fix.json`). API çağrısı yapılmadı.
- Yapılandırmadaki kısa tanımlayıcı dahil bütün değerler UTF-8/UTF-16 ve kısa tam-token karşılaştırmasıyla tarandı. Bulunan public merchantId URL parametresi kaldırıldı; yeni orphan commit eski referans zincirini temizledi.
- İkas, Trendyol ve WooCommerce salt okuma düzeni değişmedi; mutation ve gerçek stok/fiyat gönderimi eklenmedi. Gerçek ciro veya sipariş tutarı yayımlanmaz; ekranda görülen cari/işlem tutarları örnektir.
- Ayrıca 5.122 gerçek siparişin JSON alanları denetlendi: parasal alan **0**. Önceki ifşa örneği kaynak/build/uzak geçmişte bulunmuyor (`financial-scan.json`); ürünlerin halka açık satış fiyatları izin verilen istisnadır.
- Yayın öncesi ve sonrası tam değer, token, WooCommerce ve Basic Auth kodlama taraması: **0 eşleşme**. Kaynak, build, kayıtlar, Git nesneleri ve erişilebilir uzak geçmiş tarandı. Sonuçlar: `security-before.json`, `security-scan.json`.
- Önceki yayın geçmişi orphan yöntemle temizlendi. Sonraki belgeleme commit’leri aynı doğrulanmış uygulama dosyalarını taşır.
- Service worker: `am-79142891c106-4`. Eski önbellekler aktivasyonda temizlenir; skipWaiting/clientsClaim korunur. Canlı HTML/JS/CSS/SW/robots dosyaları yerel build ile hash düzeyinde aynı ve sır içermiyor (`../live-release-check.json`).
- Noindex ve robots Disallow korunmuştur. Satış formu, rapor ayı, ekstre testi ve saat gösterimleri İstanbul takvimine bağlandı; UTC gece yarısı satışının Bugün listesine girdiği regresyon testi vardır.

## Kanıtlar

- Ana klasör: `demo-kanit/round4/`; yayın öncesi `local/`, canlı `live/` altında tüm rol turları, ürün/matris, kanallar, toplama, cari, belgeler ve işlem kanıtları.
- Sunum için **6 adet gerçek 390×844 canlı ekran görüntüsü**, kırpma veya görsel düzenleme yapılmadan `secme/` içine alındı:
  `01-rol-secimi.png`, `02-yonetici.png`, `03-depo.png`, `04-magaza.png`, `05-muhasebe.png`, `06-merkez-stok.png`.
- `mobile-card/geometry.json` ve iki 390×844 görüntü, ürün kartının sabit başlık/alt eylemlerinin ekran içinde kaldığını ayrıca doğrular.
- `secme/manifest.json` çekim zamanını ve canlı/build eşleşmesini kaydeder. Sayısal kabul özeti `acceptance.json` içindedir.

## Üretim öncesinde Kerim’in kararlaştıracağı konular

Bot Vatkası için parça/çift birimi; kanallara Ümraniye stoğu mu ortak havuz mu gönderileceği ve güvenlik stoğu; setlerde giyim/ayakkabı varyant eşleşmeleri; paket çarpanlarını kimin onaylayacağı üretim kurulumu öncesinde netleştirilmelidir. Bunlar mevcut demo akışını durdurmaz.

## Bilinen sınırlar ve ortam notları

Statik PWA’dır; gerçek oturum/sunucu yetkilendirmesi ve cihazlar arası veri paylaşımı yoktur. Stok ve cari işlemleri örnektir; fatura ve satış botu kapsam dışıdır. N11 anahtarı beklenir; kaynakta yönetilmeyen WooCommerce stokları bilinmiyor olarak kalır. Eksik örnek ürün fotoğraflarında temsili katalog görseli açıkça etiketlenir. Fiziksel telefon, Safari ve Firefox testi yapılmadı; doğrulama Chromium 390/1366 emülasyonudur.

Vite, korunmuş katalog veri paketinin yaklaşık 8,7 MB ham boyutu ve public font yolları için uyarı verir; derleme hatası yoktur. Runtime font yüklemesi, Türkçe karakterler ve canlı asset hash’leri doğrulandı.

Yerel Windows IPC engeli Playwright işçilerini başlatamadı; gerçek tarayıcı testleri GitHub Actions’ta yürütüldü. Yerel önizleme ve açılan iki test tarayıcısı durduruldu; kullanıcı Chrome sekmelerine dokunulmadı. Oluşturulan geçici metin dosyaları/loglar temizlendi. Otomatik izin denetimi iki boş test profili klasörünün (toplam yaklaşık 3,8 MB) ve eski UTF-16 logların silinmesini reddetti; bunlar .gitignore kapsamındadır ve yayına dahil değildir. Müşteriye mesaj gönderilmedi.

---
Önceki tur raporu yerel kanıt klasöründe tarihsel kayıt olarak saklanmıştır.

