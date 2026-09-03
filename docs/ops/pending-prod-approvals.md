# Onay bekleyen iki prod işlemi

**Tarih:** 2026-09-03 · **Branch:** `work/autonomous-after-b177` · **Durum:** ikisi de **UYGULANMADI**, onay bekliyor

Bu belge iki ayrı prod işlemi için tam komut, risk ve geri alma yolu veriyor. İkisi de 18:20 deploy sırasının **dışında** ve birbirinden bağımsız. Onay verirken ayrı ayrı düşün.

---

# İşlem 1 — `scanner-job` imajının yeniden build edilmesi

## Neden

Prod'un tarama işi 2026-06-10 tarihli bir Docker imajından koşuyor. Hem `market-alpha-fast-scan` hem `market-alpha-full-scan` systemd drop-in'leri `ExecStart`'ı şununla değiştiriyor:

```
/usr/bin/docker compose --env-file .../.env -f .../compose.yaml --profile scanner-job run --rm market-alpha-scanner-job python investment_scanner_mvp.py ...
```

Kök `Dockerfile` `COPY . /app` yaptığı için imaj, kodu **ve** `scanner/data/opportunity_universe_1000.csv`'yi Haziran halinde taşıyor. SNDK evrene 2026-08-06'da eklendiği için prod taramalarında hiç görünmedi; drop-reason defteri `…IONQ, LITE, RKLB, ASTS…` diye gidiyor, yani 6 Ağustos öncesi sıralama.

**Kod tarafında fark küçük:** 10 Haziran'dan bu yana `scanner/` ve `investment_scanner_mvp.py`'ye dokunan **2 commit** var (`f283d5c` 2026-08-06, `3215db8` 2026-09-01), artı bu branch'teki `c472bbc4`. Asıl risk kodda değil, aşağıda.

## Komutlar — sırayla

```bash
cd /opt/apps/market-alpha-scanner/app

# 1. GERİ DÖNÜŞ NOKTASI — build'den ÖNCE. `build` :latest etiketini üzerine yazar,
#    önce etiketlemezsen geri dönecek imaj kalmaz.
docker tag market-alpha-scanner-market-alpha-scanner-job:latest \
           market-alpha-scanner-market-alpha-scanner-job:rollback-20260610

# 2. Mevcut çıktıyı referans olarak sakla (karşılaştırma için)
cp /opt/apps/market-alpha-scanner/runtime/scanner_output/scanner_drop_reasons.csv \
   /tmp/drop_reasons_before_rebuild.csv
cp /opt/apps/market-alpha-scanner/runtime/scanner_output/full_ranking.csv \
   /tmp/full_ranking_before_rebuild.csv

# 3. Build (henüz hiçbir tarama bu imajı kullanmıyor)
docker compose --env-file .env --profile scanner-job build market-alpha-scanner-job

# 4. Tek bir taramayı ELLE, ayrı bir çıktı dizinine koştur — prod verisine dokunmadan
docker compose --env-file .env --profile scanner-job run --rm \
  -e SCANNER_OUTPUT_DIR=/app/scanner_output_trial \
  market-alpha-scanner-job python investment_scanner_mvp.py --fast --timing --outdir /app/scanner_output_trial
```

**4. adım kritik.** İmaj build edilir edilmez bir sonraki zamanlanmış tarama (15 dakikada bir) onu kullanmaya başlar ve **DB'ye yazar**. Deneme koşusu, o olmadan önce çıktıyı görme şansı.

## Doğrulama — deneme koşusundan sonra

```bash
# SNDK artık defterde mi
grep -n "SNDK" /app/scanner_output_trial/scanner_drop_reasons.csv

# Uyarı satırı YOK olmalı (c472bbc4 deploy edildiyse)
# "[universe] WARNING required symbols missing" görürsen evren hâlâ eksik

# Satır sayıları karşılaştır — beklenen: 500 aday, ~356 sıralanan
wc -l /app/scanner_output_trial/scanner_drop_reasons.csv /tmp/drop_reasons_before_rebuild.csv
wc -l /app/scanner_output_trial/full_ranking.csv /tmp/full_ranking_before_rebuild.csv

# Karar dağılımı çakılmamış olmalı
cut -d, -f<final_decision sütunu> /app/scanner_output_trial/full_ranking.csv | sort | uniq -c
```

**Kabul kriteri:** SNDK defterde görünüyor, aday sayısı 500 civarı, sıralanan sayı 356'dan dramatik sapmıyor, karar dağılımı tanınabilir. Bunlardan biri tutmazsa 5. adıma geçme.

## Riskler — kod değil, bağımlılıklar

| Risk | Neden | Azaltma |
|---|---|---|
| **Bağımlılık kayması** | `requirements.txt` çoğunlukla sabitlenmiş (`numpy==2.4.4`, `pandas==3.0.2`, `yfinance==1.3.0`) ama üçü değil: `streamlit>=1.37`, `fastapi`, `uvicorn[standard]` **hiç sınırlanmamış**. Ayrıca `python:3.12-slim` taban imajı ve `pip install --upgrade pip` her build'de yenilenir. Haziran'dan bu yana transitif bağımlılıklarda ne değiştiğini bilmiyoruz. | Deneme koşusu (4. adım). Tarama `streamlit`/`fastapi` kullanmıyor, ama transitif paylaşılan paketler olabilir. |
| **DB'ye kötü veri yazma** | Yeni imaj otomatik olarak bir sonraki taramada devreye girer ve `scan_runs` + `scanner_signals`'a yazar. Bozuk bir tarama prod veri geçmişini kirletir. | Deneme koşusunu ayrı `--outdir` ile yap; sonuç kabul edilmezse hemen 5. adım. |
| **Evren genişlemesi** | SNDK dahil, Haziran'dan sonra eklenen her şey ilk kez taranacak. Sembol sayısı 500'de sabit (`expanded[:500]`), yani yeni semboller listeye girerken sondakiler düşer. | Deneme çıktısında hangi sembollerin girip çıktığını karşılaştır. |
| **Tarama süresi** | Yeni semboller için fundamentals ve fiyat geçmişi önbelleği boş; ilk koşu belirgin daha uzun sürebilir. | 15 dakikalık tarama aralığını aşarsa üst üste binme olur — `scanner_run_lock` var, ama süreyi ölç. |

## Geri alma

```bash
docker tag market-alpha-scanner-market-alpha-scanner-job:rollback-20260610 \
           market-alpha-scanner-market-alpha-scanner-job:latest
```

Bir sonraki tarama eski imajı kullanır. Container kalıcı değil (`run --rm`), yani restart gerekmiyor. **DB'ye yazılmış kötü tarama verisi bu şekilde geri alınmaz** — deneme koşusunun sebebi bu.

## Röle engeli

`.tvops/tvops-relay.py` içindeki `DEPLOY_ALLOW_RE` sadece iki frontend servisini build etmeye izin veriyor. Bu işlem için yeni desen gerekiyor:

```python
r"docker compose (--env-file \.env )?--profile scanner-job build market-alpha-scanner-job",
```

Deneme koşusu için de ayrı bir desen gerekir; `run --rm ... python ...` şu an tamamen reddediliyor.

## Yapısal kusur — asıl mesele

Deploy runbook'u yalnızca `market-alpha-frontend` ve `market-alpha-frontend-hot-api` build ediyor. `scanner-job` hiçbir zaman build edilmiyor. Bu yüzden bir imaj üç ay checkout'un gerisinde kalabildi ve kimse görmedi. **Rebuild tek seferlik onarım; kalıcı çözüm deploy sırasına bu servisi eklemek.** Aksi halde aynı sapma sessizce yeniden birikir.

---

# İşlem 2 — `forward_returns` kapsayıcı indeksi — **UYGULANDI 2026-09-03 20:15 UTC**

> **Durum: uygulandı ve ölçüldü.** Kullanıcı 2026-09-03'te açıkça yetkilendirdi ("düşük riskli ve kilitlemeyen indeks ise bakım penceresi uygunsa uygulayabilirsin"). Pencere uygundu: 18:00 yedeklemesi bitmiş, 21:30 tam taramasına 75 dakika vardı.
>
> | | Öncesi | Sonrası |
> |---|---:|---:|
> | Sorgu süresi | 1.091 ms | **8,5 ms** |
> | Okunan blok | 103.274 | **818** |
> | Plan | Parallel Seq Scan + top-N sort | **Index Scan** |
> | `getPerformanceData` (render içinde) | 3.089 ms | **234 ms** |
> | `/terminal` render toplam | 3.951 ms | **1.078 ms** |
> | DOM interactive (sıcak) | 6.293 ms | **2.671 ms** |
>
> Geçersiz indeks kontrolü: `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid` → 0 satır. Container restart 0, health 200, ağ 4xx/5xx yok.
>
> **Boyut tahminim yanlıştı:** ~10–15 MB demiştim, gerçek **33 MB**. Tablo 876 MB olduğu için sorun değil ama tahmin ölçüm değildi.
>
> **Geri alma:** `docker compose exec -T market-alpha-postgres psql -U market_alpha -d market_alpha -c "DROP INDEX CONCURRENTLY IF EXISTS idx_forward_returns_signal_date_desc"` — röleye bu desen de eklendi.
>
> Alembic sürüm tablosu bu migration'ı uygulanmış saymıyor (runner kırık, aşağıda). Sonraki `alembic upgrade` aynı `CREATE INDEX ... IF NOT EXISTS`'i çalıştırıp zararsızca geçecek.

---

## Özgün öneri (kayıt için)

## Neden

`getPerformanceData`, `forward_returns`'ten en yeni 1200 satırı `signal_date DESC NULLS LAST, created_at DESC, symbol, horizon` sırasıyla istiyor. Bu sıralamayı karşılayan indeks yok; prod paralel seq scan + top-N sort yapıyor: **1.154 ms, 102.462 buffer**, 1200 satır döndürmek için 818.013 satır tarayarak.

Mevcut `idx_forward_returns_horizon_signal_date` `horizon` ile başlıyor, bu sıralamayı karşılayamıyor (`idx_scan = 0` — hiç kullanılmamış).

## Tam SQL

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forward_returns_signal_date_desc
  ON forward_returns (signal_date DESC NULLS LAST, created_at DESC, symbol, horizon)
  WHERE return_pct IS NOT NULL;
```

Migration olarak `alembic/versions/20260903_000100_forward_returns_signal_date_index.py` içinde hazır (branch `main`, commit `3613d458`), `autocommit_block()` ile — `CONCURRENTLY` transaction içinde çalışmaz.

## Uygulama yolu — iki seçenek

**A. Alembic (tercih edilen, ama engelli):** `tools/db/run-migrations.sh` **sessizce çalışmıyor** — `psql: command not found`, host'ta arıyor, container üzerinden çağırması gerek. Bu ayrı bir kusur ve park listesinde. Bu haliyle migration alembic üzerinden uygulanamaz.

**B. Doğrudan psql:**
```bash
docker compose exec -T market-alpha-postgres psql -U market_alpha -d market_alpha \
  -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forward_returns_signal_date_desc ON forward_returns (signal_date DESC NULLS LAST, created_at DESC, symbol, horizon) WHERE return_pct IS NOT NULL"
```
Bu durumda alembic sürüm tablosu migration'ı uygulanmış saymaz; sonraki `alembic upgrade` aynı `CREATE INDEX ... IF NOT EXISTS`'i çalıştırır ve zararsızca geçer. Yine de **A yolunu düzeltmek B'den iyidir**; migration runner'ın kırık olması ayrıca ele alınmalı.

Röle şu an ikisine de izin vermiyor (`CREATE INDEX` SELECT değil).

## Riskler

| Risk | Değerlendirme |
|---|---|
| Yazma kilidi | **Yok.** `CONCURRENTLY` yazmaları kilitlemez. Karşılığı: tabloyu iki kez tarar, daha uzun sürer. |
| Süre ve I/O | Tablo 876 MB / 915.833 satır. Kısmi indeks 818.013 satırı kapsıyor. Tahmini **birkaç dakika** ve belirgin disk I/O. **Ölçmedim.** Tarama penceresine (15 dakikada bir) ve yedekleme penceresine (00/06/12/18:00 UTC, ~19 dakika) denk getirme. |
| Disk | +~10–15 MB tahmini. Mevcut indeksler 36 MB (pkey) + ~30 MB diğerleri. Sorun değil. |
| Başarısız kalma | `CONCURRENTLY` başarısız olursa **INVALID** durumda bir indeks bırakır; sorgular kullanmaz ama disk tutar. Kontrol: `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;` Temizlik: `DROP INDEX CONCURRENTLY`. |
| Sonuç değişimi | **Yok.** İndeks hiçbir sorgunun sonucunu değiştirmez, yalnızca planını. |

## Doğrulama

```sql
-- Öncesi ve sonrası aynı EXPLAIN
EXPLAIN (ANALYZE, BUFFERS)
SELECT (jsonb_build_object('scan_run_id', scan_run_id::text, 'symbol', symbol) || COALESCE(metrics::jsonb,'{}'::jsonb)) AS metrics, created_at
FROM forward_returns WHERE return_pct IS NOT NULL
ORDER BY signal_date DESC NULLS LAST, created_at DESC, symbol ASC, horizon ASC LIMIT 1200;
```

**Beklenen:** Parallel Seq Scan + Sort yerine Index Scan; 102.462 buffer'dan birkaç yüze düşüş; süre 1.154 ms'den birkaç ms'e. Ayrıca `[perf-timing]` satırında `forwardQuery` alt adımının düşüşü görünmeli.

**Beklenen kazanç tahmindir, ölçüm değil.** İndeks oluşturulmadan planı doğrulamanın yolu yok (`hypopg` kurulu değil).

## Geri alma

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_forward_returns_signal_date_desc;
```

Plan eski haline döner, hiçbir veri etkilenmez. Migration'ın `downgrade()`'i tam olarak bunu yapıyor.

## Kapsam dışı bıraktığım

`idx_forward_returns_horizon_signal_date`'in `idx_scan` değeri 0 — hiç kullanılmamış görünüyor ve 7.424 kB tutuyor. **Silmiyorum ve silinmesini önermiyorum.** `pg_stat_user_indexes` istatistikleri son sıfırlanmadan bu yana; ne zaman sıfırlandığını bilmiyorum. Bir indeksi kaldırmak kendi kanıtını hak eder, performans düzeltmesine iliştirilmeyi değil.
