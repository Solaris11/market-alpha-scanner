# `/terminal` payload envanteri ve Stage 5 planı

**Tarih:** 2026-09-02 · **Prod:** `3bb7f0a` · **Ölçüm:** logged-in premium (`perf-test@tradeveto.com`), temiz sekme

---

> ### Bu belgenin sayıları eskidi (not eklendi 2026-09-04)
>
> Buradaki ölçümler `3bb7f0a` tarihine ait ve **`forward_returns` kapsayıcı
> indeksinden önce** alındı. Güncel prod (`b177dea8`) rakamları:
>
> | Ölçü | Bu belge | 2026-09-04 ölçümü |
> |---|---:|---:|
> | HTML decoded | 16.864 KB | **13.838 KB** |
> | DOM interactive | 11.791 ms | **2.771 ms** |
> | payload toplamı | 16.845 KB | 12.180 K karakter (flight) |
>
> Belgedeki byte tahminleri (Stage 5 ≈3,2 MB, Stage 2–4 ≈4,7 MB) **aritmetik,
> ölçüm değil** — belgenin kendisi de bunu söylüyor. Yeni bir kazanç iddiasından
> önce baseline yeniden alınmalı.
>
> §5'teki tüketici listesi de yanlıştı; aşağıda düzeltildi.

---

## 1. Stage 1'in dürüst kaydı

Fayda var, ama **dramatik değil** ve tahminimin bir kısmı yanlıştı.

| Ölçü | Önce | Sonra | Δ |
|---|---:|---:|---:|
| HTML decoded | 18.257 KB | 16.864 KB | −1.393 KB (−%7,6) |
| HTML transfer | 2.304 KB | 1.840 KB | −464 KB (−%20) |
| DOM interactive | 14.044 ms | 11.791 ms | −2.253 ms (−%16) |
| load | 14.063 ms | 12.099 ms | −1.964 ms |
| script | 35 / 3.054 KB | 25 / 2.224 KB | −10 dosya, −830 KB |
| long task | 9 / 2.607 ms / 899 ms | 10 / 2.382 ms / 986 ms | ~sabit |
| `preconditions` sayısı | 12.726 | 537 | −%96 |
| konsol | temiz | temiz | SyntaxError yok, #418 yok |
| render satır / sayı | 4.863 / 2.227 | 4.868 / 2.226 | ±5 / ±1 (zaman damgaları) |

**Düzeltme:** "`preconditions` 15,2 MB" demiştim. Yanlıştı — sayım üzerinden byte tahmin etmiştim, ölçmemiştim. Gerçek değeri ~1,4 MB (12.726 × ~110 B) ve ölçülen kazancın tamamını o açıklıyor. Kabul kriterindeki "dramatik düşüş" bu stage'de karşılanmadı.

Prefetch 33 MB → 192 KB görünüyor ama **karşılaştırma geçersiz**: önceki sekme birkaç route gezmişti, yenisi sadece `/terminal` açtı. A tamamlanınca aynı gezinme deseniyle yeniden ölçülecek.

---

## 2. Payload'ın gerçek haritası (dengeli parantez taramasıyla ölçüldü)

Toplam 16.845 KB:

| Blok | Adet | Boyut | Pay |
|---|---:|---:|---:|
| `shockEvents` | 356 dizi | **4.744 KB** | **%28,2** |
| `raw` (tam scanner satırı) | 349 blok | **4.239 KB** | **%25,2** |
| doğrulanmış olay bağlamı | — | 860 KB | %5,1 |
| skor/etiket nesneleri | — | 506 KB | %3,0 |
| OHLC mumları | — | 304 KB | %1,8 |
| kalan `preconditions` | — | 102 KB | %0,6 |

İki blok payload'ın **%53,4'ü**.

---

## 3. `row.raw.*` envanteri

Yöntem: 148 client component'ten başlayıp `import type` kenarlarını atarak import grafiğinin geçişli kapanışı alındı (283 modül), o kapanış içindeki her `raw.<key>` ve `raw["<key>"]` erişimi toplandı. Anahtar boyutları prod payload'ındaki ilk 40 `raw` bloğunun ortalamasından ölçüldü.

**Sonuç:**

| | Anahtar | Satır başına | Pay |
|---|---:|---:|---:|
| `raw` bloğu toplam | 199 | 11.618 B | %100 |
| **Client'tan erişilebilen** | **70** | **2.871 B** | **%24,7** |
| **Hiç okunmayan** | **129** | **8.747 B** | **%75,3** |

349 satır boyunca okunmayan kısım **2,91 MB** (kaçışsız), payload içinde ~3,2 MB.

### Hiç okunmayan anahtarların en pahalıları

| Byte/satır | Anahtar | Not |
|---:|---|---|
| **2.918** | `verified_event_recent_events` | Tek başına `raw` bloğunun **%25'i**; sayfa genelinde ~1 MB. İçinde kaynak URL'leri, başlıklar, kanıt cümleleri. |
| 434 | `decision_reason_codes` | |
| 209 | `factor_scores` | |
| 162 | `setup_thresholds` | |
| 134 | `setup_reason_codes` | |
| **121** | `alpaca_request_id` | **Sağlayıcı istek kimlikleri — client'a hiç gitmemeli.** |
| 112 | `verified_event_feed_disclosure` | |
| 110 | `correction_trigger_reason` | |
| 108 | `adjusted_weights` | |
| 95 | `long_reason` / `regime_impact` | |
| 94 | `mid_reason` | |
| 88 | `macro_proxy_coverage_used` | |
| 87 | `short_reason` | |
| 80 | `decision_reason` | `raw` içindeki kopya; view model'de ayrı alan var |
| 72 | `adjusted_thresholds`, `regime_reason_codes` | |
| 69 | `risk_reward_reason`, `verified_event_sources_used` | |

Ayrıca sızmaması gereken/işe yaramayan diğer sağlayıcı alanları: `provider_error` (30 B), `provider_latency_ms` (32 B), `data_provider_primary` (33 B), `data_provider` (26 B), `data_timestamp` (45 B).

### Sınıflandırma hakkında dürüst bir sınır

İstediğin dört kova arasında "ilk ekran" ile "detay/expanded panel" ayrımını **yapmadım**. Yapabilmek için her panelin hangi satır alt kümesini hangi koşulda render ettiğini çıkarmam gerekir; bu tahmine açık ve sessiz veri kaybı riski taşıyan tam olarak o iş. Bunun yerine daha katı ve daha güvenli bir ölçüt kullandım: **kod tarafından erişilebilirlik**. Bir alan client grafiğinden hiç okunmuyorsa, hangi ekranda olduğu fark etmez — gönderilmesi gereksizdir. %75,3 zaten bu ölçütle çıkıyor; daha ince kesim marjinal kazanç için risk ekler.

---

## 4. Stage 5 tasarımı — türetilmiş allowlist

**Fikir:** `raw`'ı elle seçilmiş bir DTO'ya indirmek yerine, **allowlist'i koddan türet** ve testle bağla.

1. `src/lib/trading/raw-field-allowlist.ts` — client grafiğinden okunan 70 anahtarın açık listesi, her biri okuyan modülüyle birlikte yorumlanmış.
2. `stripRawFields(rows)` — serileştirme sınırında `raw`'ı yalnızca bu anahtarlara indirger. Stage 1'deki `stripShockEventPreconditions` ile aynı yerde, aynı desende.
3. **Test — sessiz kayıp koruması:** import grafiğini test içinde yeniden yürüyüp client'tan erişilebilen her `raw.<key>` erişimini toplar ve **hepsinin allowlist'te olduğunu** iddia eder. Biri yeni bir alan okumaya başlarsa test kırılır; kod yazan kişi allowlist'e eklemek zorunda kalır. Envanter böylece bir kerelik tahmin değil, **yürütülen bir sözleşme** olur.
4. İkinci test: allowlist'te olup gerçekte okunmayan anahtar kalmadığını raporlar (uyarı seviyesinde, kırıcı değil — geçici olarak fazladan alan tutmak meşru olabilir).

**Beklenen kazanç:** ~3,2 MB (payload'ın ~%19'u), artı sağlayıcı istek kimliklerinin client'tan tamamen çıkması.

**Risk:** düşük. Tek choke point, tek yardımcı fonksiyon, ve allowlist'in doğruluğunu koddan doğrulayan bir test. Okuma noktalarının 70 modüle dağılmış olması **fix'i dağıtmıyor** — sadece listeyi uzatıyor, ve listeyi zaten makine üretiyor.

---

## 5. Stage 2–4 planı — düzeltilmiş tüketici listesi

> **Düzeltme (2026-09-04).** Bu bölümün ilk hali dört tüketicinin üçünde
> yanlıştı ve migration planının §1'i bunu 2026-09-03'te tespit etmişti; bu,
> planın Stage 4'ünde söz verilen düzeltme. Yanlışlığın yönü önemli: liste
> **eksik** olduğu için Stage 3'e "hiçbir client tüketici kalmadı" denilerek
> girildi, oysa `evidence-maturity` kalmıştı ve sessizce bozuldu (bkz.
> `docs/ops/stage3-silent-regression-audit.md`).

`shockEvents` (4.744 KB, %28,2) client'tan düşürülebilsin diye taşınması
gereken tüketiciler, kodun kendisinden yeniden çıkarılmış hali:

| Modül | `/terminal`'de client'ta koşuyor mu? | Okuduğu | Durum |
|---|---|---|---|
| `opportunity-actionability` (iki radar) | **evet** | olay başına `preconditions`, excursion, return | `98afc6c6` — sunucuda hesaplanıyor |
| `evidence-maturity` | **evet, üç bileşenden** | olay başına `eventDate`, `outcomeStatus`, dizi uzunluğu | `af8ebf24` — `shockEventCount`, `shockEventSpanDays`, `shockCompletedEventCount` |
| `institutional-trust` | evet | dizi uzunluğu | `61366d3b` — `shockEventCount` |
| `risk-tolerant-opportunities` | evet | dizi uzunluğu, `latestEvent.eventDate` | `857af454` — `shockEventCount` |
| `execution-intelligence` | **hayır** | olay başına return/excursion | listede hiç yoktu; `/terminal` bu panele `rows` geçirmediği için client'ta çalışmıyor — ama bu üç çağrı yerinin özelliği, modülün değil |

İlk listedeki "Stage 2/3/4" numaralandırması da gerçekleşen sırayı tutmuyor;
uygulanan sıra yukarıdaki commit'lerde.

Ders, plandaki numaralardan daha kalıcı: **tüketici listesi elle yazıldığı
sürece eksik olabilir.** `?? []` ile korumak derlemeyi geçirir ve değeri
korumaz; tek güvenilir test, deseni gerçekten uygulayıp iki çıktıyı
karşılaştırmaktır (`evidence-maturity-strip.test.ts` bunu yapıyor).

---

## 6. Öncelik önerisi — ve kuralın öncülünün neden kaydığı

Verdiğin karar kuralı: *"`raw` erişimi dağınık/riskliyse önce Stage 2–4."*

Envanter, erişimin **dağınık ama fix'in merkezî** olduğunu gösteriyor. 70 anahtar 283 modüle yayılmış, ama hiçbirine dokunmam gerekmiyor: alanları okuyan kod aynen kalıyor, sadece serileştirme sınırında hangi anahtarların gönderildiği değişiyor. Dağınıklık listeyi uzatıyor, riski artırmıyor — çünkü listeyi elle değil koddan türetiyorum ve bir test onu bağlıyor.

Bu yüzden **Stage 5'i öne almayı öneriyorum**:

| | Kazanç | Dokunulan yer | Risk |
|---|---:|---|---|
| **Stage 5** (`raw` DTO) | ~3,2 MB | 1 yardımcı + 1 allowlist + 2 test | Düşük; test envanteri zorunlu kılıyor |
| Stage 2–4 (`shockEvents`) | ~4,7 MB | 3 kütüphane + ~6 client bileşeni, üç ayrı deploy | Orta; her biri prop sözleşmesi değiştiriyor |

Ayrıca Stage 5, `alpaca_request_id` ve diğer sağlayıcı alanlarını client'tan **ilk fırsatta** çıkarma isteğini de karşılıyor — Stage 2–4 bunu yapmıyor.

İkisi tamamlanınca 16,8 MB'ın ~8 MB'ı gider. "Dramatik düşüş" ancak o zaman gelir; Stage 5 tek başına da payload'ın beşte birini alır.
