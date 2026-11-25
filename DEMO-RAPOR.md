# Kerim ERP demo — 4. tur denetim düzeltmeleri

Doğrulama: 25 Kasım 2026 (İstanbul).
Canlı: https://veinpsycoo.github.io/kerim-erp-demo/
Test edilen uygulama commit’i: `bbe1df98de98539677d5d9b22ba3cc475430af7c`.
CI, yayın ve canlı tur: https://github.com/veinpsycoo/kerim-erp-demo/actions/runs/45508783833
Canlı ürün kartı ölçümü: https://github.com/veinpsycoo/kerim-erp-demo/actions/runs/45509745571

## Talep bazında sonuç

1. Mobil toplamada ana eylem **Kaydet** oldu. Ortak çekmece alt eylemleri mobilde tam genişlikte üst üste; alt alan küçülmüyor. Kaydırma boyutları, metin sınırları ve ekran içindeki konum betikle ölçüldü. Yerel ve canlı aşamanın her birinde **58 alt buton raporu**, toplam **116 rapor**, **0 hata**. Kaydet, Kapat, Kaydediliyor…, Onayla, İşlemi onayla, Siparişi onayla, Talep oluştur, Makbuzu kaydet ve Ekstreyi görüntüle durumları kapsandı.
2. Üst bardaki tekrar eden sayfa adı kaldırıldı. Masaüstünde sağda Demo ve profil; mobilde solda küçük Asker Marketi markası var. Sayfa adı yalnız büyük içerik başlığında.
3. Profil çipi avatar harfi ve tek satır rol adı gösteriyor. Çalışan seçimi profil sayfasında.
4. Dikkat isteyenlerde 0 değerli satırlar gizleniyor. Hepsi 0 olduğunda **Şu an dikkat isteyen iş yok** durumu iki genişlikte test edildi. Eşleştirme satırı **Eşleştirilecek ilan**, alt yazı **1 Ocak’a kadar eşleştirme planı**; alarm/amber rengi yok.
5. Kritik stok ve stok listesi ortak `isCritical` hesabını kullanıyor: ürünün toplam stoğu <20; Yönetici için tüm lokasyonlar. Yönetici açıklaması kapsamı belirtiyor. Yeni bağımsız 390/1366 kontrolleri IndexedDB kaynak verisiyle karşılaştırıldı: **5 / 5**. Eski **32**, `attempt1/desktop-1366-Yönetici-dashboard.png` ara tur görüntüsünde; önceki nihai masaüstü ve mobil görüntülerde **5** vardı. Farklı aşamalara ait kanıtlar karıştırılmış. Eski görüntülerin hash ve sayıları `demo-kanit/round4/stock-discrepancy.json` içinde. Mevcut kullanıcı verisi sıfırlanmadı.
6. Yayın ve canlı denetim tamamlandı; sekiz seçme görüntü aynı canlı build’den yeniden alınıp görsel olarak kontrol edildi.

## Ölçülmüş doğrulama

- **51/51** birim testi, **7/7** salt okuma senkron testi.
- **62/62** yayın öncesi E2E, **62/62** canlı E2E; atlanan/kararsız test **0**.
- Dört rolün tüm yetkili menüleri, 390 ve 1366 px: aşama başına **56**, toplam **112** ekran ölçümü.
- Konsol hatası, yatay taşma, 44 px altı hedef, 13 px altı yazı, hesaplanan AA metin kontrast hatası: **0**.
- Sıfır dikkat boş durumu, stok sayısı/liste eşitliği, rol değişimi, odak, azaltılmış hareket, İstanbul gece yarısı, çevrimdışı açılış ve tarayıcıda gerçek SW cache adı test edildi.
- Lint, typecheck, build ve bağımlılık denetimi geçti; **0 güvenlik açığı**. Yeni paket eklenmedi.
- Tam sayfa ekran görüntüsü sırasında Chromium geçici **1×1 / 4×4** görünüm oluşturuyor. Alt buton ölçümü hedef cihaz boyutuna sabitlendi; geçici boyutlar ayrıca JSON’da kaydediliyor. Önceki sabit `-4` test beklentisi gerçek build cache adına bağlandı.
- Kabul özeti: `demo-kanit/round4/acceptance.json` → **passed: true**. Görünür metinlerde Demo: öneki ve bozuk kodlama karakteri **0**; değişen Türkçe metinler gözden geçirildi.

## Yayın, veri ve güvenlik

- SW: **am-58c7b30d2d79-5**. Yerel ve canlı tarayıcı cache kontrolü geçti.
- Canlı HTML, JS, CSS, SW ve robots dosyaları yerel build ile aynı hash’te: `demo-kanit/live-release-check.json`.
- Yapılandırmadaki anahtarların gerçek değerleri, kısa tanımlayıcıları, UTF-8/UTF-16 karşılıkları, WooCommerce/token desenleri ve Basic auth kodlamaları tarandı. Yayın öncesi ve sonrası **0 eşleşme**. Son kapsam yerel kaynak/build/kanıt/loglar ve tüm uzak main geçmişi; sonuç `demo-kanit/round4/security-scan.json`. Yayın öncesi kayıt `security-before-audit.json`.
- Özel ciro/tutar taraması temiz; 5.122 siparişin izinli alanları doğrulandı: `financial-scan.json`.
- Önceki nihai turdaki **10 çekirdek/veri/senkron dosyası aynı hash’te**: `audit-protected-files.json`. İş kuralları, seed ve gerçek snapshot değişmedi. İkas veya diğer iş kanallarına yazma/API mutation yapılmadı.
- Yayın betiği, kimlik doğrulama hatasını eksik repo sanıp başlatma denememesi için yalnız HTTP 404’te başlatma yoluna giriyor.
- Müşteriye mesaj gönderilmedi. Kullanıcının tarayıcı sekmelerine dokunulmadı; otomatik test bağlamları kapatıldı.

## Canlı seçme görüntüler

`demo-kanit/round4/secme/` içinde:

1. `01-rol-secimi.png`
2. `02-yonetici.png`
3. `03-depo.png`
4. `04-magaza.png`
5. `05-muhasebe.png`
6. `06-merkez-stok.png`
7. `07-toplama-390.png`
8. `08-yonetici-1366.png`

İlk yedi görüntü 390×844, son görüntü 1366×900. `manifest.json` canlı kaynak ve çekim zamanını içerir. Rol/menü ve diğer iş akışı kanıtları `local/` ve `live/` altındadır.

## Bilinen sınırlar

### 4c metin rötuşu — 25 Kasım 2026

Görünen örnek kimlikler SP/SV/CR-2026-0001 biçimine, çalışan adları sade adlara çevrildi. Eski tarayıcı kayıtları stok, tutar ve işlem ilişkileri korunarak aynı metinlere dönüştürülür. Tek Demo rozeti korunur. Sevkiyat, fiyat yuvarlama, güncelleme, ürün açıklaması, eşleştirme tarihi ve kayıt bildirimi sadeleştirildi; profil düğmesinin erişilebilir adı görünen rolü içerir. SW sürüm son eki 6 oldu.

Son uygulama commit’i `2408215f8960e3cde372bb534fe72d42a53de520`; yayın ve canlı doğrulama: https://github.com/veinpsycoo/kerim-erp-demo/actions/runs/45513003200 (başarılı). 53 birim + 7 senkron testi, lint, tip kontrolü, build ve bağımlılık taraması geçti. Yerel tarayıcı süreci `spawn EPERM` ile engellendi; GitHub Actions üzerinde 390/1366 yayın öncesi 62/62 ve canlı 62/62 test geçti. 112 rol/menü/genişlik kontrolünde konsol, taşma, hedef, yazı ve kontrast hatası sıfır. Canlı mobil ürün kartı geometrisi de doğrulandı.

Sekiz `secme/` görüntüsü canlıdan yenilendi ve tek tek incelendi. Canlı beş dosyanın hash’i build ile aynı; SW `am-a05743eaf002-6`. Son uygulama commit’i dahil 10 uzak commit ve 2.290 uzak dosya ile yerel dosyaların anahtar taraması temiz. 5.122 anonim siparişin finansal alan taraması temiz. Güncel `demo-kanit/round4/acceptance.json` başarılı; 4c özeti `demo-kanit/round4c/` ve `HANDOFF-round4c-2026-11-25.md` içinde. Müşteriye mesaj gönderilmedi.

Bu statik demo; stok, cari tutarlar ve işlemler tarayıcıya özeldir. Farklı tarayıcılarda ayrı işlemler yapılırsa stoklar farklılaşabilir; gerçek cihazlar arası işlem senkronizasyonu eklenmedi. N11 bekliyor; görsellerin temsili olanları etiketli. Fiziksel cihaz, Safari ve Firefox bu turda ölçülmedi. Önceden bulunan büyük veri paketi ve statik font yolu build uyarıları sürüyor; canlı dosya ve font yüklemesi testlerde doğrulandı. Önceki turlardan kalan tarayıcı profilleri bu çalışmada kullanılmadı veya silinmedi.

Geçici `.ci-audit-watch.log` (yaklaşık 27 KB), boş `.ci-audit-failed.log` ve `test-results/.last-run.json` silme komutu otomatik güvenlik denetimince reddedildi; bu yerel çıktılar tutuldu. Yayın dosyalarına dahil değiller. Silme kısıtı başka araçla aşılmadı.
