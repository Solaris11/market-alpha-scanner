# TradeVeto — Çalışma Günlüğü

**Amaç:** Her gün ne yapıldığını, ne bulunduğunu ve ertesi gün ne yapılacağını tek yerde tutmak.
**Kural:** Bir madde ancak kanıtı varsa "yapıldı" sayılır. Ölçülmemiş şey bulgu değildir.

---

## Sabit Gerçekler (son güncelleme: 2026-09-02)

Bu bölüm her gün güncellenir. Sayıların hepsi ölçülmüştür, tahmin değildir.

| Ne | Değer | Kaynak |
|---|---|---|
| Gerçek kullanıcı | 7 (33'ün 26'sı probe/test) | prod DB, 2026-09-01 |
| Ödeyen müşteri | **0** (1 comped, 2 süresi geçmiş Stripe kaydı) | prod DB, 2026-09-01 |
| Scanner aksiyon alınabilir satır | 356'da **2** | prod DB, son tarama |
| Karar dağılımı | EXIT 182 · AVOID 158 · WATCH 14 · WAIT_PULLBACK 2 | prod DB |
| Sunucu yanıtı (TTFB+toplam) | `/feed` 0.51s — en yavaş | ops snapshot |
| Ana iş parçacığı bloklaması (`/`) | **592 ms** (4 uzun görev, en uzunu 283 ms) | tarayıcı, 2026-09-02 |
| En ağır JS (`/terminal`, anonim) | **1864 KB** decoded | tarayıcı, 2026-09-02 |
| En yavaş soğuk render | `/market-memory` **1661 ms** TTFB | tarayıcı, 2026-09-02 |
| `/terminal` istemci yükü | 1589 KB / 123 modül / 39 client bileşeni | modül grafiği |
| `/terminal` sunucu render (premium) | **5.274 ms** (11.806 ms'den) | render timeline, 2026-09-02 |
| `/terminal` DOM interactive (premium) | **6.981 ms** sıcak / 8.161 ms soğuk (13.749 ms'den) | tarayıcı, 2026-09-02 |
| `/terminal` HTML decoded (premium) | 13.719 KB (18.257 KB'den) | tarayıcı, 2026-09-02 |
| Sağlayıcı alanı sızıntısı (client) | **0** (6 alan × 7 kez idi) | flight payload, 2026-09-02 |
| `forward_returns` satır sayısı | 818.013 (`return_pct` dolu) / 915.833 toplam | prod DB, 2026-09-02 |
| `scanner_signals` satır sayısı | 2.930.165 — **19 GB** | prod DB, 2026-09-02 |
| Postgres yedeği | 2026-09-02, 4.10 GB — **düzeltildi** | prod, 2026-09-02 |
| Scanner yedeği | 2026-09-02, 2.06 GB — **düzeltildi** | prod, 2026-09-02 |
| Deep health | **503** — yedek düzelince tekrar bakılacak | ops snapshot |
| R2 offsite | **çalışıyor** (4.1 GB yüklendi) | prod, 2026-09-02 |
| Prod commit | `291d9ea3` | prod, 2026-09-02 13:22 UTC |
| Rollback image etiketi | `rollback-20260902h` | prod |

---

## Gün 1 — 2026-09-01 (Pazartesi)

Başlangıç noktası: "sayfalar yavaş açılıyor, discover araması bozuk."

### Yapıldı ve canlıda

- **Discover ticker araması düzeltildi.** Üç ayrı kusur vardı: sorgu diğer filtrelerle AND'leniyordu (aktif bir quick filter `NVDA`'yı gizleyebiliyordu), tam eşleşme önceliği yoktu, ve normalizasyon paketten habersizdi (`Nvidia`→`NVDA`, `BTC`→`BTC-USD` çözülemiyordu). Artık açık sembol araması tüm filtrelerden muaf ve listenin başında. Codex üstüne `<form>` sarmalayıp görünür bir "aç" butonu ekledi.
- **Bundle bölme, üç route.** `/opportunities`'ten `lightweight-charts` çıktı (1519→1278 KB). `/strategy-labs`'tan üç grafik kütüphanesi birden çıktı (678→602 KB). Ve paylaşılan `TerminalShell` sadece bir yardımcı fonksiyon için 54 KB'lık discovery modelini **her sayfaya** taşıyordu — kendi modülüne çıkarıldı, her route 54 KB düştü.
- **Green check'in yalancı 502'si düzeltildi.** Kontrol container başladıktan 2 saniye sonra koşuyordu, uygulama 4 saniyede hazır oluyor. Artık `/api/health` yanıt verene kadar bekliyor.
- **Ops snapshot yazıldı.** Prod'da tek komut: deploy commit, health, route süreleri, scanner tazeliği ve karar dağılımı, kullanıcı/abonelik, yedek yaşı, container belleği — tek JSON + okunabilir HTML, ve sade dille "dikkat gerektirenler" listesi. Retention/gelir mantığını yeniden yazmıyor, mevcut probe'ları çağırıyor.
- **Kalibrasyon aracı yazıldı** (`tools/analysis/calibration_sweep.py`). Olgunlaşmış sinyalleri forward return'lerle birleştirip eşik gevşetmelerinin gerçekte ne getirdiğini ölçüyor.

### Ölçümle bulunanlar

**Scanner hiçbir zaman ENTER üretmiyor — ve sebebi tek bir bozuk kapı değil.**
356 satırın 340'ı EXIT/AVOID. Huni kademeli çöküyor: 190 satır stale vetosuyla, 135 satır başka setup dallarından, kalan 31'in 15'i severe veto ile (güven 79, skor 77.5 olmasına rağmen). Son kapı `final_score ≥ 80` ve hayatta kalanların tavanı 77.5 — matematiksel olarak ulaşılamaz.

**Skor eşiği her ufukta yanlış yerde.** 158 bin sinyal, üç ufuk, aynı tarih penceresine kontrol edildi:

| Ufuk | Baseline | Tepe decile | En yüksek decile (73+) |
|---|---|---|---|
| 5G | +0.42% | D7 (58–63) **+0.88%** | +0.22% — baseline altı |
| 10G | +0.90% | D6 (53–58) **+1.92%** | +0.47% — baseline altı |
| 20G | +2.77% | D8 (65–70) **+4.82%** (isabet %67) | +3.50% — baseline üstü |

Skorun tahmin gücü var ama ters U şeklinde: kısa vadede orta band kazanıyor, uzun vadede tepe yukarı kayıyor. `≥80` üç ufukta da optimumun ötesinde. **Giriş kapısı taban değil, aralık olmalı.**

**Yedekleme 14 gündür durmuş.** Postgres yedeği 18 Ağustos'ta kalmış, scanner yedeği hiç yok. R2 "senkron" görünüyordu çünkü iki kopya da aynı ölçüde bayat — sadece local/offsite eşleşmesine bakan bir kontrolün göremediği arıza türü.

**33 kullanıcının 26'sı test.** 21 probe hesabı (hiç giriş yapmamış), 3 example.com, 2 test görünümlü. Ve "24 aktif abonelik"in tamamı ya probe hesaplarında ya süresi geçmiş.

**Gelir sıfır.** Dört ayda hiç ödeyen müşteri olmamış. 2 Stripe abonelik kaydı var ama ikisi de süresi geçmiş, ve `stripe_mode` sütunu `DEFAULT 'live'` ile eklendiği için canlı mı test mi olduğunu DB söyleyemiyor — Stripe panosu ayırt eder.

**Sunucu tarafı performans düzelmiş.** `/market-memory` Haziran'da 3.459s'ti, bugün 0.316s.

> **Düzeltme (gün sonu):** Bunu "performans blocker'ı kapandı" diye yazmıştım — yanlıştı.
> `curl` yalnızca sunucunun yanıt süresini ölçer; JavaScript indirme, ayrıştırma ve
> hydration'ı görmez. Kullanıcı sayfaların hâlâ yavaş açıldığını bildiriyor ve bu
> ölçümle çelişmiyor: `/terminal` 1589 KB istemci kaynağı taşıyor. Gerçek metrik
> tarayıcıda ölçülür, sunucuda değil.

### Çürüyen varsayım

Sabah yazdığım denetim "retention bir onboarding sorunu, beş gerçek kullanıcı izleyelim" diyordu. İzlenecek bir şey yokmuş: kullanıcı giriyor ve 356 satırın tamamında "AVOID" görüyor. Ürün hiç gerçek bir testten geçmemiş — çalıştığı hiç görülmedi.

### Süreç dersleri

- Prod'a erişmeden SQL yazmak dört kez hata verdi (`postgres` kullanıcısı, `max(id)` UUID'de, `data_age_minutes` sütun değil payload anahtarı, `GROUP BY 1` toplama ifadesinde). Artık DB'ye giden her şey önce `database/models.py` ve migration'lardan okunuyor.
- Köprü üzerinden dosya düzenlemek executable bitini düşürebiliyor — `tools/` altındaki her script değişikliğinden sonra `git ls-files -s` ile mod kontrol edilecek.
- İki modül-grafiği bulgusu yanlış çıktı (`import type` kenarları sayılmıştı) ve geri çekildi. Ölçüm aracının kendisi de doğrulanmalı.
- **Doğru şeyi ölçmek, doğru ölçmekten önce gelir.** Sunucu yanıt sürelerine bakıp
  "performans iyi" dedim; kullanıcı sayfaların yavaş açıldığını söyleyince fark ettim
  ki hiç istemci tarafını ölçmemişim. Metrik seçimi bulgunun kendisinden önemli.

---

## Gün 2 — 2026-09-02 (Salı)

### Yapıldı

**Sayfa açılış hızı gerçek tarayıcıda ölçüldü.** Dün sunucu yanıt sürelerine bakıp "performans iyi" demiştim; kullanıcı aksini söyledi ve haklıydı. Ölçüm, iki ayrı sorun olduğunu gösterdi.

**1. Soğuk render 1.4–1.7 saniye.** `/discover` ilk açılışta 1412 ms TTFB verdi; hemen ardından yapılan üç istekte 207–268 ms. `/market-memory` soğuk 1661 ms ve 324 KB HTML üretiyor. Bu route'lar `force-dynamic` ve kısa ömürlü bellek içi önbelleklerle çalışıyor (market-memory 120 sn TTL). Ops snapshot bunları 0.18–0.32 sn ölçmüştü çünkü sıcak önbelleğe denk gelmiş. **Gerçek kullanıcı sık sık soğuk yolu vuruyor.**

**2. İstemci tarafı yükü büyük.** Anonim `/terminal` 1864 KB decoded JavaScript indiriyor — ve bu yalnızca "Sign in" gösteren kilitli kabuk. Landing sayfası 1009 KB indiriyor ve ana iş parçacığını **592 ms** bloke ediyor (4 uzun görev, en uzunu 283 ms). Kullanıcının "yavaş açılıyor" dediği şey bu: sunucu hızlı yanıt verse bile sayfa saniyelerce tıklanamıyor.

| Route | TTFB soğuk | TTFB sıcak | HTML | JS decoded | load |
|---|---:|---:|---:|---:|---:|
| `/` | 341 ms | — | — | 1009 KB | 1455 ms |
| `/terminal` (anonim) | 345 ms | 207 ms | 106 KB | **1864 KB** | 1255 ms |
| `/discover` | **1412 ms** | 207–268 ms | 56 KB | 1270 KB | 1775 ms |
| `/opportunities` | — | 192 ms | 81 KB | — | — |
| `/symbol/AMD` | — | 121 ms | 111 KB | — | — |
| `/market-memory` | — | **1661 ms** | **324 KB** | — | — |

**Yedekleme arızası: kök sebep bulundu ve düzeltildi.** 14 gündür yedek alınmıyordu. Sebep, iki script'in birbirini görmemesi:

- `market-alpha-backup.sh` yedeği `<isim>.sql.gz.tmp` olarak yazıp bitince `mv` ile yeniden adlandırıyor
- `tradeveto-backup-lifecycle.sh` her saat `:17`'de koşup `*.tmp` ve `*.partial` dosyalarını **koşulsuz siliyor**
- Yedekleme `:00`'da başlıyor ve postgres dump'ı **19 dakika** sürüyor

Ağustos'ta dump 15 dakikaydı — eşiğin hemen altında. Veritabanı büyüdü, süre 17 dakikayı aştı, ve o günden itibaren her yedekleme tam yazılırken silindi. Ölçümle doğrulandı: dosya adı `18-00`, tamamlanma `18:15` (Ağustos) → `05-18`, `05:37` (bugün).

Düzeltme: lifecycle artık yalnızca **2 saatten eski** geçici dosyaları siliyor (`-mmin +120`). Yazılmakta olan bir yedek asla o yaşta olmaz; gerçekten yetim kalmış bir `.tmp` ise her zaman olur.

Doğrulama: elle koşu 4.10 GB postgres + 2.06 GB scanner üretti, ikisi de R2'ye yüklendi.

**R2 aslında bozuk değildi.** Haziran'dan beri "Critical: R2 current backup unhealthy" olarak duran blocker gerçekte kapanmıştı — R2'de 18 Ağustos'a kadar tüm yedekler mevcut. Yükleyecek yeni dosya olmadığı için bayat görünüyordu. Bugün 4.1 GB sorunsuz yüklendi.

**Ve dünkü teşhisimin düzeltmesi.** Dün "sistem kendini çalıştırıyor ama kendini haber vermiyor" demiştim. Yanlış. Yedekleme log'unda 14 gündür şu satır varmış:

```
[2026-09-02T00:18:43Z] ERROR: Postgres gzip validation failed
```

Deep health de `503` dönüyordu. **Sistem haber veriyordu; kimse bakmıyordu.** Daha keskin ve daha rahatsız edici bir sonuç: eksik olan log değil, üretilen sinyali insanın önüne koyan katman. Ops snapshot'ın asıl değeri bu.

**Ops snapshot düzeltmeleri.** Scanner yedek dizini `scanner/` değil `scanner_output/` — snapshot yanlış yere bakıp "yedek yok" diyordu. Ayrıca artık 2 saatten eski `.tmp` dosyalarını raporluyor: bugünkü arızayı ilk koşuda yakalayacak kontrol.

**Isıtma script'i yazıldı** (`tools/ops/tradeveto-warm-cache.sh`). Ağır route'ların önbellekleri sürekli trafik varsayıyor; 7 gerçek kullanıcıyla site hep boşta ve neredeyse her ziyaret soğuk render'a düşüyor. 10 dakikada bir ısıtma, ilk render maliyetini insandan alıp zamanlayıcıya veriyor. Hiçbir tazelik kuralı değişmiyor.

**Ölçümün sınırı:** Tarayıcı oturumu anonim. `/terminal` ve `/discover` gerçek çalışma alanını değil kilitli kabuğu gösteriyor. **Giriş yapılmış hali daha ağır** — bu sayılar alt sınır.

### Öğleden sonra — prod erişimi, stabilite, ve `/terminal`'in gerçek darboğazı

**Prod'a kalıcı bir komut yolu açıldı.** Her komut için senin terminale girmen hem yorucuydu hem otomasyonu kesiyordu. `.tvops/tvops-relay.py`: bağlı klasörü posta kutusu gibi kullanan, Mac üzerinden prod'a SSH açan, **varsayılan olarak salt-okunur** bir röle. Her satır doğrulayıcıdan geçiyor — kabuk yönlendirmesi (`>`, `<`, `;`, `&`, backtick, `$(`) yasak, ilk-token allowlist'i var, `rm/mv/chmod/kill/git write/docker write/systemctl write/paket yöneticisi/.env/.ssh` reddediliyor, `docker exec` içinde yalnızca `psql` çalışabiliyor ve o da yalnızca SELECT. Yazma yetkisi ayrı bir dosyayla (`DEPLOY_ENABLED`) açılıyor ve o zaman bile yalnızca tam-satır regex'e uyan komutlar geçiyor. Onboarding testi için verdiğin tek `UPDATE` cümlesi bile **hem e-posta hem id ile** sabitlenmiş bir desen olarak duruyor; başka satıra uzanamıyor.

> Röle beş turda yalancı-red verdi ve her biri düzeltildi: `docker compose exec` `exec` deseninden takılıyordu, `du -sh`'deki `-sh` kabuk denylist'ine çarpıyordu, redaksiyon "unexpected token" yakalıyordu. Doğrulayıcının kendisi de test edilmesi gereken bir yazılım.

**Stabilite gözlemcisinin üç kusuru düzeltildi.** Gözlemci 10,5 saattir örnek topluyordu ama: `%{http_code}` tırnaksız olduğu için JSON bozuluyordu, probe'ta zaman aşımı yoktu (asılı bir istek tüm ızgarayı kaydırıyordu), ve `sleep` tabanlı döngü her turda birikimli olarak sürükleniyordu. Üçü de düzeltildi; ayrıca `/api/health`'in process bloğunu kaydeden bir anlık görüntü eklendi.

**Sunucuda ölçülmeyen iki şey ölçülür oldu.** `event-loop-monitor.ts` — `monitorEventLoopDelay` histogramı `/api/health` üzerinden birikimli olarak açıldı (istek başına sıfırlanmıyor). Ve `db.ts`'e `query_timeout`/`statement_timeout` eklendi: `connectionTimeoutMillis` yalnızca **bağlantı almayı** sınırlıyor, sorgunun kendisi sınırsız bekleyebiliyordu.

**Onboarding loop'u kapandı.** Kayıt sonrası "save and start" dedikten sonra ekran geri geliyordu. Sebep: profil güncellemesi DB'ye yazılıyor ama oturum-kullanıcı önbelleği (120 sn TTL, süreç içi) eski `onboarding_completed = false` değerini tutuyordu; iki frontend container'ının her birinde ayrı bir kopya. Düzeltme: önbellek `epoch` ile korunan ayrı bir modüle çıkarıldı (9 test), profil güncellemesi kullanıcının girdisini geçersiz kılıyor, ve gate `refresh()` yerine dönen profili doğrudan uyguluyor.

**Sembol sayfasındaki "tick bulunamadı" düzeltildi.** Scanner çıktısında olmayan bir sembolün kartı açıldığında sayfa, elinde **fiyat geçmişi olduğu halde** boş dönüyordu. 251 sembol için doğrulanmış geçmiş mevcut. Artık `detail.history`'den SVG grafik çiziliyor; gerçekten veri yoksa dürüst bir boş durum yazıyor ("mevcut tarama çıktısında yok ve doğrulanmış fiyat geçmişi mevcut değil"). Aynı sayfada iki `<script>` bloğu `}}catch{}})();` ile bitiyordu — hiç ayrıştırılmamışlar, yani o enstrümantasyon hiçbir zaman çalışmamış.

**`/terminal` payload'ı ikiye bölündü — ve doğru teşhis buradan çıktı.**

| | Önce | Sonra |
|---|---:|---:|
| HTML decoded | 18.257 KB | 13.719 KB (−%25) |
| HTML transfer | 2.304 KB | 1.649 KB (−%28) |
| `raw` anahtar / satır | 199 / 12.439 B | 70 / 3.048 B |
| `preconditions` sayısı | 12.726 | 537 |
| **DOM interactive** | 14.044 ms | **~13.700 ms — değişmedi** |

Payload dörtte bir küçüldü ve **açılış süresi kıpırdamadı.** Bu, kesme işinin boşa olduğunu değil, yavaşlığın sebebinin başka yerde olduğunu söylüyordu.

**Ve sebep ölçüldü.** `render-timeline.ts` ile `/terminal` render'ının 40 adımı sunucuda zamanlandı:

| Adım | Süre | Pay |
|---|---:|---:|
| `getPerformanceData` | 9.144 ms | **%77,5** |
| `getRecentIntradaySignalDriftSummary` | 1.933 ms | **%16,4** |
| `buildUnifiedIntelligenceConsole` | 262 ms | %2,2 |
| `stripForClient` | <120 ms | <%1 |

İki çağrı 11.806 ms'nin **%93,9'u**. Üç tahminim yanlış çıktı: `getShockMovePatternMap` payload'ın %28'i ama sürenin %1'i; `stripForClient` ilk 12 adıma bile giremedi; hiçbir `build*System` darboğaz değil.

**İki SQL kusuru, prod `EXPLAIN (ANALYZE, BUFFERS)` ile:**

1. `forward_returns` sorgusundaki `count(*) OVER ()`. Postgres pencere fonksiyonlarını `LIMIT`'ten **önce** hesapladığı için `LIMIT 1200` hiçbir şey kazandırmıyordu: eşleşen **818.013 satırın tamamı** WindowAgg'den geçiyor, 166.765 geçici tampon (~2 GB disk trafiği) dökülüyordu. 3.652 ms.
2. Drift sorgusundaki CTE'yi planlayıcı 18 yerine **6.048 satır** tahmin ediyor, ve 6.408 satır bulmak için **2,93 milyon satırlık, 19 GB'lık `scanner_signals` tablosunun tamamını** seq scan ediyordu (790 MB okuma). Uygun indeks tabloda vardı, kullanılmıyordu.

**Düzeltmeler (`9199bc59`, `291d9ea3`) — canlıda, ölçülmüş:**

| Sorgu | Önce | Sonra |
|---|---:|---:|
| `forward_returns` (satırlar) | 3.652,7 ms | 1.154,1 ms |
| `forward_returns` (sayım, ayrı) | — | 114,6 ms |
| drift sorgusu | 404,8 ms | **7,6 ms** |
| drift buffer | 101.781 blok | **504 blok** |

`total_count` düşürülmedi — `/paper`'daki "completed evidence samples" sayısını besliyor. Ayrı ve ucuz bir sorguya taşındı, aynı `WHERE` cümlesiyle. Deploy sonrası sayı **818.013**, yani birebir korundu.

Drift sorgusundaki düzeltme tek kelime: `bounded_runs` CTE'sine `LIMIT $1`. Correctness için gereksiz (`rn <= $1` kümeyi zaten kapatıyor) ama planlayıcıya doğru sınırı veriyor.

**Son 7 sağlayıcı sızıntısı kapandı.** `stripRawFields`'ten sonra hâlâ 7 `alpaca_request_id` payload'da duruyordu. Flight payload'ının anahtar yolu çıkarıldı: 7'sinin 7'si de `model > barItems[n] > row`. Her makro proxy grafiğine **305 alanlık tam scanner satırı** iliştirilmişti (80.032 B) ve client o satırdan **tek bir alan** okuyor. Tip daraltıldı: `row: RankingRow | null` → `eventContextSummary: string | null`. Deploy sonrası altı sağlayıcı alanının hepsi **0**.

### Deploy sonrası ölçüm — `291d9ea3`, `perf-test@tradeveto.com`

| Metrik | Önce (`96b3dc6f`) | Sonra (`291d9ea3`) | Δ |
|---|---:|---:|---:|
| render total (sunucu) | 11.806 ms | **5.274 / 5.311 ms** | **−%55** |
| `getPerformanceData` | 9.144 ms | **3.103 / 3.233 ms** | −%65 |
| `getRecentIntradaySignalDriftSummary` | 1.933 ms | 1.509 / 1.487 ms | −%23 |
| `responseStart→responseEnd` | 13.205 ms | 7.515 soğuk / **6.625 sıcak** | −%50 |
| **DOM interactive** | 13.749 ms | 8.161 soğuk / **6.981 sıcak** | **−%49** |
| long task | 9 / 2.083 ms / 939 ms | **5 / 904 ms / 244 ms** | −%57 |
| HTML decoded | 13.691 KB | 13.719 KB | ~sabit |
| sağlayıcı alanı sızıntısı | 6 alan × 7 kez | **0** | −%100 |
| completed evidence samples | 818.013 | **818.013** | değişmedi |
| container restart | — | **0**, ikisi de healthy | — |
| konsol / ağ | — | temiz, 4xx/5xx yok | — |

Test: 612 test, 610 geçti (2 başarısızlık bulut konteynerinde `nodemailer`/`stripe` kurulu olmadığı için, kodla ilgisiz). `tsc --noEmit` temiz. Prod build kapısı yeşil geçtikten sonra deploy edildi.

**Drift çağrısının neden yalnızca %23 düştüğü:** SQL 405 ms → 7,6 ms indi ama kalan sürenin çoğu veri transferi — 18 tarama koşusu × 356 sembol = 6.408 satırın `payload` sütunu **37 MB**. Bunu kesmek için `buildIntradaySignalDrift`'in hangi alanları okuduğunu önce çıkarmak gerekiyor; ölçmeden kesmek tam olarak kaçındığımız sessiz veri kaybı.

### Süreç dersleri (Gün 2)

- **Payload küçültmek açılış süresini düzeltmedi.** %25'lik kesinti DOM interactive'i kıpırdatmadı. Doğru enstrümantasyon (sunucu zaman çizelgesi) kurulana kadar dört stage boyunca yanlış şeyi optimize ettim. **Önce ölç, sonra kes.**
- **`next/dynamic` bir Server Component içinde bundle'ı bölmüyor.** 2.021.005 → 2.020.891 bayt. Kazanç iddiasını geri çektim.
- **Bir "temizlik" sessiz veri kaybı olacaktı.** `shockEvents` örneklerini kesmek typecheck'ten geçiyordu, ama o alanı okuyan dört kütüphane client bileşenlerinden import ediliyor. Gönderilmeden yakalandı; yerine sunucu tarafı hesaplama kondu.
- **Sayımdan byte tahmin etme.** "`preconditions` 15,2 MB" demiştim; gerçek ~1,4 MB'mış.
- **Konsol tamponu sayfalar arası bayat kalabiliyor.** React #418'i "hâlâ var" diye okudum; temiz sekmede sıfır mesaj çıktı. Üretemediğim bir kusur için kök-neden raporu yazmayı reddettim.
- **Allowlist'i elle değil koddan türet.** 70 anahtarlık liste import grafiğinden üretildi ve bir test her koşuda grafiği yeniden yürüyüp listeyi doğruluyor. Envanter bir kerelik tahmin değil, yürütülen bir sözleşme.

### Gün 2 sonunda kapanan / açık kalan

| Gün 1'den devreden | Durum |
|---|---|
| Yedekleri ayağa kaldır | **Kapandı** — kök sebep bulundu, düzeltildi, 4,10 GB + 2,06 GB elle doğrulandı, R2'ye yüklendi |
| Restore drill | Açık — yedek üretimi doğrulandı, geri yükleme denenmedi |
| Giriş yapılmış performans ölçümü | **Kapandı** — `perf-test@tradeveto.com` ile ölçüldü |
| Soğuk render / istemci yükü | **Kısmen** — `/terminal` sunucu süresi %55 düştü; `/discover` ve `/market-memory` ölçülmedi |
| `next build` First Load JS tablosu | Açık |
| Deep health 503 sebebi | Açık — yedek düzeldi, tekrar okunmalı |
| Skor bandı out-of-sample doğrulama | Açık — 23 Temmuz sonrası veri hâlâ kullanılmadı |
| `phase-35-0` belge düzeltmeleri | Açık |

---

## Gün 3 — 2026-09-03 (Çarşamba) — Planlanan

Sıra: gözlem penceresi önce (kendiliğinden koşuyor), sonra ölçülmüş performans işi, sonra temizlik.

### 1. 24 saatlik stabilite gözlemi — izle ve raporla

Pencere **2026-09-02 17:59:54 UTC**'de açıldı. Bugünkü deploy (13:22 UTC) pencereden ~4,6 saat önce, yani **müdahale yok**.

- [ ] Check-in'ler: 22:45Z (tam tarama sonrası), 02:00Z, 07:15Z (yedek sonrası), 12:30Z, 17:59Z
- [ ] Anında eskalasyon: 5xx, container restart, event-loop gecikme sıçraması, DB zaman aşımı
- [ ] Final rapor → `docs/ops/phase-36-2-stability-24h-final.md`, `phase-36-1` güncellensin

### 2. `/terminal` — kalan 5,3 saniye

Sunucu süresi 11,8 s → 5,3 s indi. Kalan ikisi de **ölçülmüş**, tahmin değil.

- [ ] **`getPerformanceData` 3,1 s.** İzole sorgu 1,15 s ve tamamı Parallel Seq Scan (`read=102462` blok). Kapsayıcı indeks:
      `CREATE INDEX CONCURRENTLY idx_forward_returns_signal_date_desc ON forward_returns (signal_date DESC NULLS LAST, created_at DESC, symbol, horizon) WHERE return_pct IS NOT NULL;`
      Kilitlemez, `DROP INDEX` ile geri alınır, ~10–15 MB. Öncesi/sonrası aynı `EXPLAIN ANALYZE` ile ölçülecek.
      Bonus temizlik adayı: `idx_forward_returns_horizon_signal_date` `idx_scan=0` — hiç kullanılmamış.
- [ ] **Drift çağrısı 1,5 s.** SQL artık 7,6 ms; kalan süre 6.408 satırın **37 MB `payload`** transferi. Önce `buildIntradaySignalDrift`'in gerçekten okuduğu alan envanteri çıkarılacak (allowlist deseniyle, koddan türetilmiş), sonra `jsonb` projeksiyonu. **Envanter çıkmadan kesme yok.**
- [ ] 3,1 s ile 1,15 s arasındaki farkı ölç — havuz çekişmesi mi soğuk cache mi? Şu an atfedilmiş değil.

### 3. Stage 2–4 — `shockEvents` (öncelik: düşük)

4.744 KB, payload'ın %28,2'si. Ama **Gün 2'nin dersi:** payload kesmek DOM interactive'i kıpırdatmadı. Bu yüzden önce §2 bitecek; Stage 2–4 ancak byte'ın ölçülebilir bir etkisi kaldığı gösterilirse yapılacak.

- [ ] Üç tüketiciyi sunucuya taşı: `risk-tolerant-opportunities`, `institutional-trust`, `evidence-maturity`
- [ ] Her biri Stage 1 desenini izlesin: sunucuda hesapla, prop olarak geç, çıktının değişmediğini testle kanıtla

### 4. SNDK / scanner kapsama

- [ ] SNDK `REQUIRED_OPPORTUNITY_SYMBOLS`'te ve CSV'de 117. sırada, ama tarama çıktısında yok — nerede düştüğü izlenecek
- [ ] Aynı durumdaki diğer semboller sayılacak

### 5. Test hesabı temizliği — **§1 ve §2 bitmeden yapılmayacak**

Ölçümler için hâlâ lazım.

- [ ] `perf-test@tradeveto.com` → `TRADEVETO_BETA_ALLOWED_EMAILS`'ten çıkar
- [ ] `.env.bak-20260902-beta` geri yüklensin
- [ ] İki frontend container'ı yeniden oluşturulsun, çıktığı doğrulansın

### 6. Ops hijyeni

- [ ] `/opt/ops/` script'leri git'e alınsın (`tradeveto-backup-lifecycle.sh`, `tradeveto-resource-watchdog.py`) — 14 günlük yedek arızasının görülmeme sebebi tam olarak bu
- [ ] `/etc/cron.d` temizliği
- [ ] `frontend/log/` ve kökteki `package.json`: `.gitignore` kararı (ikisi de untracked duruyor)
- [ ] Restore drill

### 7. Devreden

- [ ] Deep health `503` sebebini oku (yedek düzeldi, tekrar bakılmalı)
- [ ] Skor bandı out-of-sample doğrulama — Nisan–Haziran'da belirle, Temmuz–Ağustos'ta sına
- [ ] `phase-35-0` belgesi: "Paid users 2 — Partial positive" yanlış; performans bölümü de güncellensin

---

## Bekleyen / Park Edilmiş

Sırası gelmedi ama unutulmasın:

- **`tools/db/run-migrations.sh` sessizce çalışmıyor** — `psql: command not found`. Bugün zarar vermedi (migration yoktu) ama bir sonraki migration'lı deploy'da şema kodla ayrışır. Runner `psql`i host'ta arıyor, container üzerinden çağırmalı.
- **`scanner_output` git'e commit edilmiş bozuk symlink** — prod yoluna işaret ediyor, başka her makinede scanner açılışta çöküyor. Local çalışma `SCANNER_OUTPUT_DIR` ile aşılıyor. Kalıcı çözüm deploy'a bağlı, planlı yapılmalı.
- **Probe hesaplarının temizliği** — 21 kullanıcı + cascade eden kayıtlar. Yedekler çalışana kadar dokunulmayacak.
- **Haziran'ın 24 saatlik stability örnekleri** — host'ta duruyor olabilir, penceresi 83 gün önce doldu. Toplanırsa bir Critical blocker bedavaya kapanabilir.
- **`BREAKOUT` ve `CONTINUATION` setup tipleri hiç tetiklenmiyor** — üç pozitif tipten yalnızca `PULLBACK` çalışıyor. Ayrı bir kalibrasyon sorusu.
- **`.venv` Python 3.14.3 ama `pyrightconfig.json` 3.12 diyor** — tutarsızlık.
- **Snapshot'a `--dry-run` ekle** — her sorguyu `LIMIT 0` ile sözdizimi doğrulaması. Bugün üç SQL hatası ilk koşuda çıktı, oysa çıkmamalıydı.
- **Yedekleme script'inde kilit yok** — `lifecycle`'da `flock` var, `market-alpha-backup.sh`'de yok. Bugün elle başlatılan koşu ile cron'un 06:00 koşusu aynı anda çalıştı. Bugün zarar vermedi ama iki `pg_dump` çakışabilir.
- **Veri saklama politikası** — `postgres/` 29 GB, `scanner_output/` 15 GB, dump süresi 15→19 dakikaya çıktı. `forward_returns` 915 bin satır, `scanner_signals` 537 bin. `-mmin +120` zaman kazandırdı, büyüme eğrisi başka eşikleri de aşacak.
- **`/opt/ops/` script'leri git'te yok** — `tradeveto-backup-lifecycle.sh` ve `tradeveto-resource-watchdog.py` yalnızca prod'da. Gözden geçirilmemiş, yedeklenmemiş. 14 günlük arıza tam olarak bu yüzden görülmedi.
- **1.4 GB artifact git'te izleniyor**, `.git` 384 MB. Object storage'a taşınmalı.

---

## Yön — faz sırası

Faz sırası, denetim raporundan:

1. **Gerçeği yeniden kur** — prod durumu bilinebilir olsun (Gün 2 bunun çoğunu kapatıyor)
2. **Çekirdeğe indir** — 66 sayfa bir kişi tarafından sürdürülemez; üç yüzey kalsın, gerisi flag arkasına
3. **İkinci oturumu hak et** — ama önce kapıyı aç: kullanıcı aksiyon alınabilir bir şey görmeden retention konuşulamaz
4. **Launch readiness** — mevcut çerçeve iyi, sadece çok erken koşuluyordu

---

## Şablon (yeni gün eklerken kopyala)

```
## Gün N — TARİH

### Yapıldı ve canlıda
-

### Ölçümle bulunanlar
-

### Süreç dersleri
-

### Gün N+1 — Planlanan
- [ ]
```
