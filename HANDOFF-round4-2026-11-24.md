# Round 4 denetim düzeltmeleri — 25 Kasım 2026 — Codex
Canlı: https://veinpsycoo.github.io/kerim-erp-demo/
Test edilen uygulama commit’i: bbe1df98de98539677d5d9b22ba3cc475430af7c
CI/yayın/canlı: https://github.com/veinpsycoo/kerim-erp-demo/actions/runs/45508783833 — başarılı.
Değişen: App.tsx, style.css; SW, test/kanıt/yayın yardımcıları; rapor.
Sonuç: mobil alt butonlar tam; üst başlık/profil tekrarı yok; 0 dikkat satırları gizli; sakin eşleştirme planı.
Stok: ortak hesap; Yönetici tüm lokasyonlar; 390/1366 kaynak kontrolü 5/5. 32 sayısı eski attempt1 görüntüsünden.
Doğrulama: 51 birim + 7 senkron; 62 yayın öncesi + 62 canlı E2E; lint/typecheck/build/audit geçti.
Ölçüm: 112 rol/menü/genişlik; 116 alt buton raporu; konsol/taşma/hedef/yazı/kontrast/kırpılma hatası 0.
SW: am-58c7b30d2d79-5; canlı 5 dosyanın hash’i build ile aynı; 10 çekirdek dosya değişmedi.
Güvenlik: yayın öncesi/sonrası anahtar ve özel tutar taramaları temiz; sonuçlar demo-kanit/round4/ içinde.
Kanıt: secme/ ilk 6 yenilendi; 07-toplama-390.png + 08-yonetici-1366.png eklendi; acceptance.json geçti.
Sınır: statik/tarayıcıya özel örnek stok-cari; N11 bekliyor; fiziksel cihaz/Safari/Firefox ölçülmedi.
Sahip: Codex. Kalan uygulama işi yok. Müşteriye mesaj gönderilmedi. Ayrıntı: DEMO-RAPOR.md.
Temizlik: küçük yerel CI logları/test-results silme komutu otomatik denetimce reddedildi; yayına dahil değil.
