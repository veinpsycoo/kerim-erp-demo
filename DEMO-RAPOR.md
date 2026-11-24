# Kerim ERP demo — 4. tur: son gizlilik kontrolü sürüyor

Arayüzün 60 yayın öncesi + 60 canlı senaryosu geçti. Genişletilmiş UTF-8/UTF-16 ve kısa yapılandırma değeri kontrolü, SECRETS dosyasındaki altı haneli tanımlayıcının Trendyol ürün URL'lerinin merchantId parametresinde bulunduğunu saptadı. API erişim anahtarı değildir; ancak hiçbir dosya değeri yayımlanmaması koşulu için bu parametre kaldırılıyor.

2.832 ürün bağlantısında yalnız merchantId/sellerId sorgu parametreleri kaldırıldı. Diğer bütün snapshot alanlarının hash'i aynıdır; ürün, stok, fiyat, sipariş, reçete ve eşleştirme değişmedi. Güncelleme aynı değeri sonraki senkronlarda dışarı aktarmayı da önler; HTTP/API davranışı değişmez ve API çağrısı yapılmadı.

Yeni orphan yayın ile eski referans geçmişi temizlenecek; son snapshot için 7 senkron testi ve 60+60 tarayıcı turu yeniden tamamlanmadan teslim geçti denmeyecek. Sayısal son rapor bu kontrollerin ardından yazılacak. Müşteriye mesaj gönderilmedi.
