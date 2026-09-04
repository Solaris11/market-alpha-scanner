# `/terminal` sunucu zaman çizelgesi — 12 saniye nereye gidiyor

**Tarih:** 2026-09-02 · **Prod HEAD:** `96b3dc6f` · **Ölçüm:** logged-in premium (`perf-test@tradeveto.com`), temiz sekme
**Yöntem:** `createRenderTimeline` (sunucu, 40 adım) + prod Postgres `EXPLAIN (ANALYZE, BUFFERS)` + RSC flight payload'ının anahtar-yolu taraması. Hiçbir sayı tahmin değil; her biri ya log satırından ya da `EXPLAIN` çıktısından geliyor.

---

> ### Bu belgenin timing rakamları eskidi (not eklendi 2026-09-04)
>
> Buradaki 11.806 ms render ve 14.018.917 B HTML, `96b3dc6f` dönemine ait.
> Aradan üç deploy ve `forward_returns` kapsayıcı indeksi geçti. Güncel prod
> (`b177dea8`, 2026-09-04 ölçümü):
>
> | Ölçü | Bu belge | Şimdi |
> |---|---:|---:|
> | render total (sunucu) | 11.806 ms | 1.078 ms (`pending-prod-approvals.md` §2) |
> | DOM interactive | ~13.500 ms | **2.771 ms** |
> | HTML decoded | 14.018.917 B | **13.837.994 B** |
>
> Belgenin teşhisi (yavaşlık payload'da değil, iki sorguda) doğru çıktı ve
> uygulandı. Rakamları tarihsel kayıt olarak okuyun, hedef olarak değil.
>
> Fix 3 (`MarketCommandItem.row` daraltma) bu belgede "yapılmadı" diyor —
> `291d9ea3` ile yapıldı, sağlayıcı sızıntısı prod'da 0.

---

## 1. Ölçülen zaman çizelgesi

```
[render-timing] route=/terminal total=11806ms steps=40 signals=356 symbols=356 |
promiseAll1=9145ms(wall clock) getPerformanceData=9144ms*
promiseAll2=1934ms(wall clock) getRecentIntradaySignalDriftSummary=1933ms*
buildUnifiedIntelligenceConsole=262ms buildOpportunitiesPageModel=144ms
getPersonalizationProfileForUser=130ms* getMarketChartHubData=129ms* getPaperData=129ms*
expr=122ms* expr=121ms* getShockMovePatternMap=120ms*
```

### Yüzde dağılımı

| Adım | Süre | Toplamın payı | Blok |
|---|---:|---:|---|
| **`getPerformanceData({forwardTailRows:1200})`** | **9.144 ms** | **%77,5** | `promiseAll1` |
| **`getRecentIntradaySignalDriftSummary({hours:8,maxRuns:18})`** | **1.933 ms** | **%16,4** | `promiseAll2` |
| `buildUnifiedIntelligenceConsole` | 262 ms | %2,2 | senkron |
| `buildOpportunitiesPageModel` | 144 ms | %1,2 | senkron |
| `getPersonalizationProfileForUser` | 130 ms | %1,1 | `promiseAll1` |
| `getMarketChartHubData(260)` | 129 ms | %1,1 | `promiseAll1` |
| `getPaperData` | 129 ms | %1,1 | `promiseAll1` |
| `getShockMovePatternMap` | 120 ms | %1,0 | `promiseAll2` |
| **`stripForClient`** | **< 120 ms** | **< %1** | senkron |

**İki çağrı toplamın %93,9'u.** Geri kalan 38 adımın hepsi birlikte %6,1.

### Üç düzeltme — önceki tahminlerim yanlıştı

1. **`getShockMovePatternMap` pahalı sanıyordum.** Değil: 120 ms, listenin en altı. Shock event verisi payload'ın %28'i ama render süresinin %1'i.
2. **`stripForClient` ölçülebilir maliyet getirir diye çekinmiştim.** İlk 12 adıma bile giremedi (<120 ms, %1'in altı). Payload kesme işlemi bedava.
3. **`build*System` çağrılarından hiçbiri darboğaz değil.** En pahalısı `buildUnifiedIntelligenceConsole` 262 ms (%2,2). 14 `build*` çağrısının toplamı ~700 ms.

Yani payload küçültme çalışması (Stage 1 + Stage 5) **yavaşlığın sebebine hiç dokunmamıştı** — DOM interactive'in ~13,5 s'te sabit kalması bununla tutarlı. Doğru teşhis buymuş: sorun byte değil, sunucunun cevabı üretmeden önce beklediği süre.

---

## 2. `getPerformanceData` — %77,5 (9.144 ms)

Fonksiyon iki paralel sorgu çalıştırıyor. **Suçlusu ikincisi.**

### 2a. `performance_summary` sorgusu — masum

```
Execution Time: 6.001 ms   Buffers: shared hit=1438 (disk okuması yok)
```

18.320 satırlık tablo, HashAggregate + BitmapAnd. Buraya dokunmaya gerek yok.

### 2b. `forward_returns` sorgusu — `count(*) OVER ()` LIMIT'i iptal ediyor

Mevcut sorgu (`lib/scanner-data.ts:553-576`):

```sql
SELECT (jsonb_build_object(...) || COALESCE(metrics::jsonb,'{}')) AS metrics,
       created_at,
       count(*) OVER () AS total_count      -- <<<<
FROM forward_returns WHERE return_pct IS NOT NULL
ORDER BY signal_date DESC NULLS LAST, created_at DESC, symbol ASC, horizon ASC
LIMIT 1200
```

Prod `EXPLAIN (ANALYZE, BUFFERS)`:

```
Limit  (actual time=3639.982..3640.063 rows=1200)
  Buffers: shared hit=340 read=102290, temp read=166765 written=83589
  ->  Sort (actual time=3635.830..3635.867 rows=1200)  Sort Method: top-N heapsort
      ->  WindowAgg (actual time=675.128..3476.083 rows=818013)     <<< 818 bin satır
          ->  Seq Scan on forward_returns (actual time=0.029..194.282 rows=818013)
Execution Time: 3652.690 ms
```

**Kanıt:** Postgres pencere fonksiyonlarını `LIMIT`'ten **önce** hesaplar. `count(*) OVER ()` bu yüzden `WHERE` koşulunu geçen **818.013 satırın tamamını** WindowAgg'den geçirmek zorunda. `LIMIT 1200` hiçbir şey kazandırmıyor.

Maliyet kalemleri:
- `read=102290` blok = **~800 MB** disk okuması (tablo 876 MB, shared buffers'a sığmıyor)
- `temp read=166765 written=83589` = **~1,3 GB okuma / ~650 MB yazma geçici disk trafiği** — WindowAgg'in materyalizasyon spill'i
- Seq Scan tek başına 194 ms; kalan **3,46 saniyenin tamamı WindowAgg + spill**

### 9.144 ms ile 3.653 ms arasındaki fark hakkında dürüst not

İzole `EXPLAIN` ölçümü 3.653 ms; render sırasında ölçülen 9.144 ms. Farkı **atfetmiyorum** — çünkü ölçmedim. İki makul etken var ve ikisi de bu fix'le ortadan kalkıyor: (a) render sırasında bu sorgu `promiseAll1` içinde 8 sorguyla aynı havuzu (`TRADEVETO_DB_POOL_MAX=20`) ve aynı diski paylaşıyor, (b) `EXPLAIN` çalıştırdığımda OS page cache önceki render'larla kısmen ısınmıştı (`shared hit=340` vs `read=102290`). Fix sonrası aynı `[render-timing]` satırından gerçek değeri okuyacağız; şimdi tahmin yürütmeyeceğim.

### Ölçülmüş çözüm — sorguyu ikiye böl

`total_count` sadece `lineCount`'a besleniyor (`metricRowsToCsvFileData`, satır 515-521) ve o da `/paper` sayfasında **"completed evidence samples"** olarak görünüyor (`app/paper/page.tsx:1412`). Yani **düşürülemez, korunmalı** — ama ayrı ve ucuz bir sorguyla hesaplanabilir.

Prod'da ölçtüm:

| Sorgu | Execution Time | Buffers |
|---|---:|---|
| Mevcut (birleşik, `count(*) OVER ()`) | **3.652,7 ms** | read=102290, **temp read=166765 written=83589** |
| `SELECT count(*) FROM forward_returns WHERE return_pct IS NOT NULL` | **114,6 ms** | read=102558, temp yok |
| Aynı SELECT, `count(*) OVER ()` çıkarılmış, LIMIT 1200 | **1.154,1 ms** | read=102462, temp yok |

İkisi `Promise.all` ile paralel → **~1,15 s**. Sıralı olsa bile 1,27 s.

**Ölçülen DB kazancı: 3.653 ms → ~1.154 ms (−%68,4), artı ~2 GB geçici disk trafiğinin tamamen kalkması.**

### İsteğe bağlı ikinci adım — kapsayıcı indeks

Kalan 1.154 ms'nin tamamı hâlâ Parallel Seq Scan (`read=102462`). Şu indeks onu birkaç ms'e indirir:

```sql
CREATE INDEX CONCURRENTLY idx_forward_returns_signal_date_desc
  ON forward_returns (signal_date DESC NULLS LAST, created_at DESC, symbol, horizon)
  WHERE return_pct IS NOT NULL;
```

Mevcut `idx_forward_returns_horizon_signal_date` bu sıralamayı karşılamıyor (`idx_scan=0`, hiç kullanılmamış — ayrıca temizlik adayı). Bunu **ayrı ve geri alınabilir bir adım** olarak öneriyorum: `CONCURRENTLY` yazma kilitlemez, `DROP INDEX` ile geri alınır, ve `count(*)` sorgusunu değiştirmediği için kazanç bağımsız ölçülebilir.

---

## 3. `getRecentIntradaySignalDriftSummary` — %16,4 (1.933 ms)

Sorgu (`lib/scanner-data.ts:1385-1445`) 18 tarama koşusundan 6.408 sinyal satırı istiyor. Prod planı:

```
Sort (actual time=387.510..387.674 rows=6408)
  Buffers: shared hit=1055 read=100726
  ->  Hash Join (actual rows=6408)
      ->  Seq Scan on scanner_signals (actual time=0.015..232.413 rows=2930165)   <<<
      ->  Hash -> Subquery Scan on ranked_runs (actual rows=18)
Execution Time: 404.753 ms
```

**Kanıt:** 6.408 satır için **2.930.165 satırlık, 19 GB'lık `scanner_signals` tablosunun tamamı seq scan ediliyor** (100.726 blok ≈ 790 MB). Sebep planlayıcının CTE tahminini kaçırması: `bounded_runs` için **6.048 satır tahmin ediyor, gerçek 18**. Bu tahminle Hash Join + Seq Scan seq scan'den ucuz görünüyor. Uygun indeks (`idx_scanner_signals_scan_run_id`, 6.472 kB, 19.087 kez kullanılmış) tabloda **var ama kullanılmıyor**.

### Ölçülmüş çözüm — koşu kimliklerini planlayıcıya küçük bir liste olarak ver

```sql
WHERE ss.scan_run_id = ANY (
  SELECT id FROM (
    SELECT id FROM scan_runs WHERE status = 'success'
    ORDER BY completed_at DESC NULLS LAST, created_at DESC LIMIT 18
  ) q
)
```

Prod'da ölçtüm:

```
->  Limit -> Index Scan using idx_scan_runs_completed_at (actual rows=18)
->  Bitmap Heap Scan on scanner_signals (actual rows=356, loops=18)
    ->  Bitmap Index Scan on idx_scanner_signals_scan_run_id
Execution Time: 2.217 ms      Buffers: shared hit=489   (disk okuması yok)
```

**Ölçülen DB kazancı: 404,8 ms → 2,2 ms (−%99,5); 101.781 blok → 489 blok (790 MB → ~4 MB).**

Kalan yük veri transferi: 18 koşu × 356 sembol = 6.408 satırın `payload` sütunu **37 MB**. Bu, 1.933 ms'nin DB dışı kısmını açıklıyor (37 MB wire + JSON parse + 6.408 kez `dbSignalToRankingRow`). İkinci bir kazanç için `payload`'dan yalnızca drift hesabının okuduğu alanları `jsonb` projeksiyonuyla çekmek gerekir — ama bunu **önce ölçmeden önermiyorum**; `buildIntradaySignalDrift`'in gerçekten hangi alanları okuduğunu çıkarmadan `payload`'ı kırpmak tam olarak kaçındığımız sessiz veri kaybı riski. SQL fix'i tek başına zaten 400 ms alıyor.

---

## 4. Fix önerileri — özet tablo

| # | Fix | Beklenen kazanç | Dokunulan dosya | Risk | Test stratejisi |
|---|---|---:|---|---|---|
| **1** | `forward_returns` sorgusunu ikiye böl: `count(*)` ayrı, veri sorgusundan `count(*) OVER ()` çıkar, `Promise.all` ile paralel | **~2,5 s DB** (3.653→1.154 ms, ölçülmüş) + ~2 GB temp I/O sıfırlanır | `lib/scanner-data.ts` (`getDbPerformanceData`, ~15 satır) | **Düşük** — `total_count` aynı `WHERE` ile aynı sayıyı verir; dönüş sözleşmesi değişmiyor | Birim test: aynı fixture'da `lineCount`'un bölünmüş ve birleşik sorguyla aynı çıktığını iddia et. Prod doğrulaması: `/paper` üzerinde "completed evidence samples" sayısının deploy öncesi/sonrası **aynı** olduğunu ekran görüntüsüyle karşılaştır (`lineCount` regresyonu buradan görünür) |
| **2** | Drift sorgusunda CTE join'i `scan_run_id = ANY (SELECT ... LIMIT 18)` ile değiştir | **~400 ms DB** (404,8→2,2 ms, ölçülmüş) + 790 MB seq scan kalkar | `lib/scanner-data.ts` (`getRecentDbHistoryRows`, ~20 satır) | **Düşük** — aynı koşu kümesi, aynı sıralama; `getRecentScannerHistoryRows` de aynı fonksiyonu kullandığı için /performance sayfası da kazanır (ve regresyon testi orayı da kapsamalı) | Birim test: yeni ve eski sorgunun **aynı `scan_run_id` kümesini** döndürdüğünü iddia et. Prod doğrulaması: `IntradayRegimeDriftPanel`'deki satır sayısı ve ilk 5 sembol/değer deploy öncesi/sonrası **birebir aynı** olmalı |
| **3** | `GlobalMarketCommandCenter`'ın `barItems[].row` alanını daraltıp kalan 7 sağlayıcı sızıntısını kapat (bkz. §5) | 80 KB payload + sağlayıcı alanlarının **tamamen** sıfırlanması | `lib/trading/market-research.ts`, `components/market/GlobalMarketCommandCenter.tsx` | **Düşük** — client `row`'dan tek alan okuyor | Mevcut `raw-field-allowlist.test.ts` desenini `MarketCommandItem` için tekrarla; panelin render'ı deploy öncesi/sonrası karşılaştırılır |
| 4 | *(opsiyonel, ayrı adım)* `idx_forward_returns_signal_date_desc` kapsayıcı indeks | kalan ~1,15 s → birkaç ms (tahmin, ölçülmedi) | migration | **Düşük-orta** — `CREATE INDEX CONCURRENTLY` kilitlemez, `DROP INDEX` ile geri alınır; +~10-15 MB disk | Indeks öncesi/sonrası aynı `EXPLAIN ANALYZE`; `[render-timing]` satırında `getPerformanceData` karşılaştırması |

**Fix 1 + Fix 2 birlikte, yalnızca DB tarafında ölçülmüş kazanç ~2,9 s.** Render'da ölçülen 11.806 ms'nin ne kadarının gideceğini **şimdiden söylemiyorum** — 9.144 ms ile 3.653 ms arasındaki farkı henüz atfetmedim (§2). Deploy sonrası aynı `[render-timing]` satırından okunacak.

### Sıralama önerisi

Fix 1 ve Fix 2 aynı dosyada, birbirinden bağımsız ve ikisi de saf SQL. Tek commit'te gitmeleri makul; ama kazancı ayrı ayrı okuyabilmek için **iki commit, tek deploy** öneriyorum — `[render-timing]` satırı ikisini ayrı adım olarak zaten raporluyor.

---

## 5. Kalan 7 sağlayıcı alanı — kanıt

**Soru:** deploy sonrası sayım 8 → 7 oldu. Kalan 7 nereden geliyor?

**Yöntem (tahmin değil):** prod `/terminal` HTML'i oturumlu olarak çekildi (14.018.917 B), 102 `self.__next_f.push` parçası JSON-unescape edilerek flight payload'ı birleştirildi (11.425.996 B), ve payload bir durum makinesiyle **ileri yönde** taranarak her `alpaca_request_id` anahtarının **tam anahtar yolu** çıkarıldı.

**Sonuç — 7 yolun 7'si de aynı yer:**

```
[3] > model > barItems > barItems[0] > row > alpaca_request_id
[3] > model > barItems > barItems[1] > row > alpaca_request_id
[3] > model > barItems > barItems[2] > row > alpaca_request_id
[3] > model > barItems > barItems[4] > row > alpaca_request_id
[3] > model > barItems > barItems[5] > row > alpaca_request_id
[3] > model > barItems > barItems[6] > row > alpaca_request_id
[3] > model > barItems > barItems[7] > row > alpaca_request_id
```

(`barItems[3]` listede yok — o proxy için scanner satırı `null`.)

**Kaynak kod doğrulaması:**

- `lib/trading/market-research.ts:47` → `MarketCommandModel.barItems: MarketCommandItem[]`
- `lib/trading/market-research.ts:16` → `MarketCommandItem.row: RankingRow | null` — **tam ham scanner satırı**
- `lib/trading/market-research.ts:272` → her makro proxy grafiğine `rowBySymbol.get(...)` ile satır iliştiriliyor
- `components/terminal/TerminalPremiumView.tsx` → `<GlobalMarketCommandCenter model={marketCommandModel} />`
- `components/market/GlobalMarketCommandCenter.tsx:185` → client'ın `row`'dan okuduğu **tek** şey:
  `item.row?.event_context_summary`

**Ölçülen boyut** (payload'da dengeli parantez taramasıyla):

| | Değer |
|---|---:|
| Blok sayısı | 7 |
| Blok başına anahtar | 298–305 |
| Blok başına byte | 11.154 – 11.729 |
| **Toplam** | **80.032 B (payload'ın %0,70'i)** |

Yani `stripRawFields` doğru çalışıyor — bu satırlar `OpportunityViewModel.raw` üzerinden **hiç geçmiyor**, `MarketCommandItem.row` diye ikinci ve bağımsız bir serileştirme yolundan gidiyor. Altı sağlayıcı alanının (`alpaca_request_id`, `data_provider_primary`, `data_timestamp`, `provider_error`, `provider_latency_ms`, `verified_event_recent_events`) **hepsi tam olarak 7 kez** geçiyor; bu da hepsinin aynı 7 bloktan geldiğini doğruluyor.

**Fix:** `MarketCommandItem.row: RankingRow | null` → client'ın okuduğu alandan türetilmiş dar bir alan (`eventContextSummary: string | null`). `row`'un sunucu tarafındaki üç kullanımı (`freshness`, `marketPressure`, `dayChangePct` — `market-research.ts:420-437`) `buildMarketCommandItem` içinde zaten hesaplanıyor, yani satır bileşene hiç girmeden düşürülebilir. 305 alan → 1 alan.

---

## 6. Bu deploy ve 24 saatlik gözlem penceresi

`96b3dc6f` deploy'u **11:09 UTC**'de yapıldı. 24 saatlik gözlem penceresi **17:59:54 UTC**'de başlıyor — yani deploy pencereden ~7 saat **önce**. **Gözlem penceresine müdahale yok.** Deploy sonrası doğrulama: restart 0, `/api/health` 200, container log'unda hata yok.

Fix 1–3 için deploy zamanlaması ayrıca değerlendirilmeli: gözlem penceresi 17:59:54 UTC'de açıldıktan sonra yapılacak her deploy **pencereye müdahale** sayılır ve raporda öyle işaretlenmeli.
