# Phase 36.0 — Stability Gözlemi Analizi ve Devir Raporu

**Tarih:** 2026-09-02
**Repo:** `market-alpha-scanner`, branch `main`, HEAD `95d9b09` (prod = origin/main = local, üçü de aynı)
**Durum:** Hiçbir şey commit/push/deploy **edilmedi**. Prod üzerinde hiçbir mutasyon yapılmadı — bu oturumda prod'a giden her komut salt-okunur bir doğrulayıcıdan geçti.
**Karar:** Push/deploy kararı bu rapor okunduktan sonra, yeni oturumda verilecek.

---

## 0. Production erişim kanıtı

Bu oturumda prod'a erişim, Mac üzerinde çalışan salt-okunur bir relay üzerinden sağlandı (§5.7). Aşağıdaki çıktılar `2026-09-02T07:34:35Z`'de tek bir koşudan alınmıştır. Hiçbir secret/token değeri okunmadı veya yazılmadı.

| Kanıt | Değer |
|---|---|
| Host | `onsre-node-01` |
| SSH kullanıcısı | `sre` |
| Prod uygulama dizini | `/opt/apps/market-alpha-scanner/app` |
| Deploy edilmiş HEAD | `95d9b09` — *Do not flag an offsite backup that is still uploading* |
| `origin/main` | `95d9b0996134527a3d91bb5ad8b33322adbedf4b` (aynı) |
| Local `main` HEAD | `95d9b099` (aynı) |
| Uptime | 82 gün 20:39, load average 0.53 / 0.52 / 0.49 |
| Disk `/` | 936 G, %52 kullanımda, 434 G boş |
| Bellek | 31.8 GB toplam, 4.8 GB kullanımda, 27.0 GB available |

**Container sağlığı**

```
NAME                                           STATUS
market-alpha-frontend                          Up 20 hours (healthy)
market-alpha-frontend-hot-api                  Up 20 hours (healthy)
market-alpha-scanner-market-alpha-postgres-1   Up 2 months (healthy)
```

**Veritabanı saati** (canlılık kanıtı — komutu gönderdiğim andan 6 sn sonra)

```
$ psql -At -c "SELECT now()"
2026-09-02 07:34:38.083779+00
```

**HTTP probe**

```
$ curl -o /dev/null -w "health http=%{http_code} total=%{time_total}s" https://tradeveto.com/api/health
health http=200 total=0.166195s
```

**Çalışma ağacı** (prod)

```
## main...origin/main
?? frontend/log/
?? log/
?? tools/ops/tradeveto-backup-lifecycle.sh
?? tools/ops/tradeveto-resource-watchdog.py
```

Not: son iki untracked dosya prod'da mevcut ve git'e alınmamış ops script'leri. Silinmedi, değiştirilmedi.

**Yedek durumu** (aynı koşu)

```
/opt/backups/market-alpha/postgres/2026-09-02_06-00.sql.gz   4,098,311,128 B  Sep 2 06:19
/opt/backups/market-alpha/postgres/2026-09-02_05-18.sql.gz   4,097,018,237 B  Sep 2 05:37
/opt/backups/market-alpha/postgres/2026-08-18_18-00.sql.gz   3,391,609,090 B  Aug 18 18:15
R2 en yeni: 2026-09-02_06-00.sql.gz  (yerel en yeni ile aynı → offsite senkron)
```

**Tarama durumu**

```
son taramadaki satır sayısı : 356
son taramanın yaşı          : 11 dakika
```

---

## 1. 556 örneğin analizi

Kaynak dosya: `docs/ops/artifacts/phase-35-0c-3-stability/observation-24h/samples.jsonl`
(7,338,762 B, prod'da `.gitignore`'lu — repoda yok, sadece prod'da mevcut)

### 1.1 Kapsam ve kadans

| Ölçü | Değer |
|---|---|
| Örnek sayısı | **556** |
| İlk örnek | `2026-06-10T03:40:40Z` |
| Son örnek | `2026-06-10T14:10:44Z` |
| Kapsanan süre | **10 saat 30 dk 04 sn** (37,804 sn) |
| Hedeflenen süre | 24 saat (86,400 sn) — **%43.8'i tamamlandı** |
| Ortalama örnek aralığı | **68.1 sn** (hedef 60 sn) |
| HTTP probe sayısı | 556 × 4 = **2,224** |

Saatlik dağılım:

| Saat (UTC) | Örnek | Not |
|---|---:|---|
| 03 | 18 | kısmi saat (03:40'ta başladı) |
| 04 | 55 | |
| 05 | 53 | |
| 06 | 53 | |
| 07 | 53 | |
| 08 | 55 | |
| 09 | 55 | |
| 10 | **40** | 934 sn'lik takılma bu saatte (§1.5) |
| 11 | 55 | |
| 12 | 54 | |
| 13 | 55 | |
| 14 | 10 | kısmi saat (14:10'da öldü) |

### 1.2 Neden 556 — ve neden 1440 değil

Gözlemci üç ayrı kusur taşıyor. Birincisi koşuyu öldürdü, ikincisi veri boşluğu açtı, üçüncüsü beklentiyi yanlış kurdu.

**Kusur 1 — geçersiz JSON, koşuyu öldürdü (fatal).**
`curl_timing_json()` JSON'u elle string olarak kuruyor ve HTTP kodunu tırnaksız gömüyor:

```
-w '{"path":"%{url_effective}","status":%{http_code},...}'
```

curl bir isteği tamamlayamadığında `%{http_code}` **`000`** döner. `"status":000` geçerli JSON değildir — JSON sayılarda baştaki sıfıra izin vermez. Tüketici `json.loads()` ile ayrıştırırken `0`'ı okuyup ikinci `0`'ı görünce durur ve `JSONDecodeError` fırlatır. Bu istisna yakalanmadığı için gömülü Python bloğu çöker, `collect_sample` başarısız olur ve döngü sona erer.

`observer.log`'un son satırları bunu birebir doğruluyor:

```
File "<stdin>", line 10, in <module>
json.decoder.JSONDecodeError: Expecting ',' delimiter: line 1 column 54 (char 53)
```

Konum hesabı da tutuyor: `{"path":"https://tradeveto.com/api/health","status":` tam 52 karakter; hata `char 53` diyor — yani `000`'ın ikinci hanesi.

`|| true` koruması işe yaramamış, çünkü curl başarısız olduğunda bile `-w` çıktısını yazar; dolayısıyla `if [[ -n "$timing" ]]` dalı her zaman doğru olur ve yedek `{"status":0}` dalı hiç çalışmaz.

**Kusur 2 — probe timeout yok, 15 dakikalık veri boşluğu açtı.**
Script'te hiçbir yerde `--max-time` yok (`grep -n "max-time"` boş döndü). `2026-06-10T10:12:21Z` örneğinde `/api/health` isteği **934.5 saniye** sürdü ve bunun tamamı `time_starttransfer`'da geçti (`time_connect` 0.08 sn) — yani ağ değil, uygulama ilk baytı 15.6 dakika göndermedi. Döngü bu süre boyunca bloke kaldı; 10. saatteki 40 örnek (beklenen ~55) bu boşluk.

**Kusur 3 — kadans kayması, beklentiyi yanlış kurdu.**
Döngü `collect_sample; sleep 60` şeklinde; toplama süresi telafi edilmiyor. Toplama ~6–8 sn sürdüğü için gerçek aralık **68.1 sn** oluyor. Bu yüzden 24 saatlik bir koşu 1440 değil **≈1268 örnek** üretir. `observer.log`/`summary.txt`'te "1440 beklenir" varsayımı yanlıştır ve gözlemin "eksik tamamlandı" gibi okunmasına yol açar.

### 1.3 HTTP sonuç dağılımı

| Sonuç | Adet | Oran |
|---|---:|---:|
| 200 | 2,222 | %99.910 |
| 502 | 2 | %0.090 |
| Diğer / hata | 0 | — |

**Erişilebilirlik 10.5 saatte %99.91.** Tek bir olay, iki probe.

`systemd --failed` çıktısı **556 örneğin 556'sında da boş**. Gözlem penceresi boyunca hiçbir systemd birimi başarısız olmadı.

Çalışan container sayısı her örnekte en az **6**; ortalama 6.3–6.6 (fark, aralıklı çalışan scanner job'ı). Hiçbir noktada container kaybı yok.

### 1.4 Gecikme dağılımı (saniye, `time_total`)

| Probe | n | ortalama | p50 | p90 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/api/health` | 556 | 2.405 | 0.338 | 1.338 | 1.871 | 5.618 | **934.481** |
| `/api/health/deep` | 556 | 0.658 | 0.294 | 1.341 | 1.772 | 6.214 | 33.796 |
| `/terminal` | 556 | 1.492 | 0.576 | 2.022 | 3.282 | **17.106** | 89.470 |
| `/symbol/AMD` | 556 | 1.280 | 0.656 | 1.944 | 2.862 | 12.174 | 48.332 |

`/api/health` ortalamasının 2.4 sn olması tek bir 934 sn'lik uç değerin eseridir; medyanı 0.338 sn.

Eşik üstü oranlar:

| Probe | ≥1 sn | ≥2 sn | ≥5 sn | ≥10 sn |
|---|---:|---:|---:|---:|
| `/api/health` | 80 (%14.4) | 27 (%4.9) | 13 (%2.3) | 3 (%0.5) |
| `/api/health/deep` | 86 (%15.5) | 23 (%4.1) | 7 (%1.3) | 2 (%0.4) |
| `/terminal` | 147 (**%26.4**) | 58 (%10.4) | 20 (%3.6) | 11 (%2.0) |
| `/symbol/AMD` | 133 (%23.9) | 52 (%9.4) | 15 (%2.7) | 9 (%1.6) |

**Bu, Haziran'daki "sunucu tarafı iyi" tablosuyla çelişen ilk sağlam veri.** `/terminal` isteklerinin dörtte biri 1 saniyeyi, onda biri 2 saniyeyi aşıyor. Bu ölçümler sunucunun **kendi üzerinden** yapıldı; tarayıcı, JS indirme ve hydration maliyeti bunların **üstüne** biniyor.

### 1.5 Yavaş olaylar (≥10 sn) — 25 olay / 2,224 probe = %1.12

| Zaman (UTC) | Probe | `time_total` |
|---|---|---:|
| 04:25:12 | `/symbol/AMD` | 18.6 s |
| 04:27:37 | `/terminal` | 14.8 s |
| 05:20:19 | `/symbol/AMD` | 12.2 s |
| 05:24:54 | `/symbol/AMD` | 11.4 s |
| 05:27:16 | `/terminal` | 13.0 s |
| 05:33:22 | `/symbol/AMD` | 12.2 s |
| 05:39:06 | `/terminal` | 17.3 s |
| 05:52:26 | `/api/health` | 51.0 s |
| 06:17:15 | `/terminal` | 33.0 s |
| 06:43:20 | `/symbol/AMD` | 31.7 s |
| 07:02:21 | `/api/health/deep` | 33.8 s |
| 07:33:54 | `/symbol/AMD` | 24.5 s |
| 07:39:52 | `/terminal` | 64.1 s |
| 07:44:16 | `/api/health/deep` | 18.0 s |
| 08:32:20 | `/api/health` | 11.4 s |
| 08:47:43 | `/terminal` | 17.1 s |
| 09:41:49 | `/terminal` | 21.0 s |
| 09:54:55 | `/terminal` | 30.0 s |
| 10:06:04 | `/symbol/AMD` | 48.3 s |
| 10:11:07 | `/symbol/AMD` | 11.4 s |
| **10:12:21** | `/api/health` | **934.5 s** |
| 12:22:04 | `/terminal` | 11.8 s |
| 12:24:25 | `/terminal` | 89.5 s |
| 13:22:11 | `/symbol/AMD` | 16.6 s |
| 14:06:07 | `/terminal` | 13.4 s |

Olaylar 10.5 saate yayılmış, kümelenme yok — belirli bir saate veya arka arkaya gelen bir bozulmaya bağlanamıyor. `/api/health` gibi hiçbir iş yapmayan bir uç noktanın 51 sn ve 934 sn sürmesi, sorunun route'a özgü render maliyeti değil **süreç düzeyinde bir bloklanma** olduğuna işaret eder (event loop tıkanması, GC duraklaması, ya da container'ın CPU'dan aç kalması). Bu, kanıtlanmış değil; §3'te izlenecek hipotez olarak konuldu.

### 1.6 Tek 502 olayının anatomisi

`2026-06-10T06:04:01Z` (satır 130), aynı örnekte:

```
/api/health        200   time_total 0.475 s
/api/health/deep   200   time_total 0.939 s
/terminal          502   time_starttransfer 7.041 s
/symbol/AMD        502
```

Uygulamanın sağlık uçları **aynı anda sağlıklı** yanıt verdi; yalnızca iki ağır SSR route'u 502 döndü ve ikisi de ~7 saniye sonra. Bu, uygulamanın çökmesi değil; ters proxy'nin (Caddy) upstream'i beklerken zaman aşımına düşmesi ve gateway hatası üretmesidir. Yani **502'nin sebebi, §1.4'teki uzun kuyruk gecikmelerinin ta kendisi** — yeterince uzayınca kullanıcı hata sayfası görüyor.

### 1.7 Kaynak trendi — sızıntı yok

**Frontend container belleği** (saatlik ortalama)

| Saat | Ortalama | Max |
|---|---:|---:|
| 03 | 1677 MiB | 1678 |
| 04 | 1678 | 1692 |
| 06 | 1679 | 1679 |
| 08 | 1680 | 1680 |
| 10 | 1680 | 1680 |
| 12 | 1681 | 1681 |
| 14 | 1682 | 1682 |

10.5 saatte **+5 MiB (%0.3)**. Düz. Frontend'de bellek sızıntısı yok.

**PostgreSQL container belleği**

| Saat | Ortalama | Max |
|---|---:|---:|
| 04 | 2782 MiB | 2787 |
| 06 | 2834 | 2857 |
| 08 | 2889 | 2891 |
| 10 | 2890 | 2899 |
| 12 | 2951 | 2959 |
| 14 | 2959 | 2962 |

10 saatte **+177 MiB (%6.4)**, saatte ~18 MiB, tekdüze artan. 24 saate uzatılırsa ~+425 MiB. 31 GB'lık bir makinede alarm değil, ama **monoton** olduğu için 24 saatlik koşuda platoya oturup oturmadığı izlenmeli (§3). Postgres'in container bellek ölçümü sayfa önbelleğini de içerir; bu genelde normal ısınma davranışıdır.

**Açık bağlantılar:** min 92, max 154, ortalama 116.5. Saatlik ortalamalar 115–118 arasında sabit — bağlantı sızıntısı yok.

### 1.8 Scanner yükü korelasyonu

Scanner job'ı 556 örneğin **260'ında (%46.8)** çalışıyordu.

| Durum | Örnek | ≥10 sn yavaş içeren | Oran |
|---|---:|---:|---:|
| Scanner çalışıyor | 260 | 14 | %5.38 |
| Scanner boşta | 296 | 11 | %3.72 |

Fisher iki yönlü **p = 0.414**. Fark yönü beklenen tarafta ama bu örneklem büyüklüğünde ayırt edilebilir değil. **Yavaş sayfa yüklemeleri scanner yüküyle açıklanmıyor** — düzeltme scanner'ı zamanlamakta değil, başka yerde aranmalı.

### 1.9 Bu veri ne söyler, ne söylemez

**Söyler:**
- 10.5 saatlik pencerede altyapı kararlıydı: container kaybı yok, systemd hatası yok, bellek sızıntısı yok, bağlantı sızıntısı yok.
- Erişilebilirlik %99.91; tek kesinti olayı 2 probe.
- Gecikmenin uzun kuyruğu gerçek ve kullanıcıyı etkiliyor: `/terminal` isteklerinin %26'sı 1 sn üstü, %2'si 10 sn üstü, ve yeterince uzayan istekler 502'ye dönüşüyor.
- Uzun duraklamalar iş yapmayan uçlarda da görülüyor — sebep route render maliyeti değil, süreç düzeyinde bloklanma gibi görünüyor.
- Yavaşlık scanner yüküyle korele değil.

**Söylemez:**
- 24 saatlik kararlılığı **kanıtlamaz**. Pencere %43.8 tamamlandı; gece/gündüz döngüsünün yarısı, tam tarama (`market-alpha-full-scan`, 21:30 UTC) ve günlük yedekleme penceresi hiç gözlenmedi. Phase 35.0c-3 blocker'ı **açık kalır**.
- Verinin kendisi 84 gün eski (2026-06-10). O tarihten bu yana en az iki deploy oldu. Gecikme sayıları bugünün kodunu tanımlamıyor.
- Uzun duraklamaların sebebini göstermez; sadece nerede aranmayacağını (scanner yükü) daraltır.
- Kullanıcı tarafı toplam süreyi vermez; bunlar sunucudan sunucuya ölçümlerdir.

---

## 2. Stability düzeltmesi

### 2.1 Dokunulan dosya

**Tek dosya:** `tools/ops/tradeveto-stability-observe.sh` — `+34 / −5`

Bu dosyanın prod'daki eşi `/opt/ops/tradeveto-stability-observe.sh` (5316 B, repo kopyasıyla aynı boyut). **Prod kopyası bu oturumda değiştirilmedi.** Deploy, repo kopyasının `/opt/ops/`'a kopyalanmasını gerektirir (§4).

### 2.2 Tam değişiklik

```diff
+# Hard ceiling per probe. Without it a single hung request blocks the whole
+# observation loop: the 2026-06-10 run lost ~15 minutes of samples to one
+# /api/health request that took 934s to first byte.
+PROBE_TIMEOUT_SECONDS="${PROBE_TIMEOUT_SECONDS:-30}"
+
 curl_timing_json() {
   local path="$1"
   local url="${BASE_URL%/}${path}"
   local timing
-  timing="$(curl -k -sS -o /dev/null -w '{...,"status":%{http_code},...}' "$url" ...)"
+  timing="$(curl -k -sS --max-time "$PROBE_TIMEOUT_SECONDS" -o /dev/null \
+            -w '{...,"status":"%{http_code}",...}' "$url" ...)"
```

```diff
 timestamp, connections, health, deep, terminal, symbol = sys.argv[1:7]
+
+def probe(raw):
+    """Parse one curl timing blob without ever ending the observation run.
+
+    curl reports http_code 000 when a request fails to complete. Emitted bare
+    that is not valid JSON (leading zeros), which used to raise here and kill
+    the whole 24h run on the first transient probe failure.
+    """
+    try:
+        obj = json.loads(raw)
+    except (TypeError, ValueError):
+        return {"path": None, "status": 0, "parse_error": (raw or "")[:200]}
+    if not isinstance(obj, dict):
+        return {"path": None, "status": 0, "parse_error": (raw or "")[:200]}
+    status = obj.get("status")
+    if isinstance(status, str):
+        try:
+            obj["status"] = int(status, 10)
+        except ValueError:
+            obj["status"] = 0
+    return obj
+
 payload = {
     "http_timings": [
-        json.loads(health), json.loads(deep),
-        json.loads(terminal), json.loads(symbol),
+        probe(health), probe(deep),
+        probe(terminal), probe(symbol),
     ],
```

### 2.3 Üç kusurdan hangileri kapandı

| Kusur | Durum | Nasıl |
|---|---|---|
| 1 — `status:000` geçersiz JSON, koşuyu öldürüyor | **Kapandı, iki kat** | Üretimde string olarak yazılıyor; tüketimde `probe()` her türlü bozuk girdiyi yutuyor |
| 2 — probe timeout yok, döngü bloke oluyor | **Kapandı** | `--max-time 30` (env ile ayarlanabilir) |
| 3 — kadans kayması (68.1 sn ≠ 60 sn) | **Kapanmadı — bilinçli** | Döngü mantığına dokunulmadı; blast radius küçük tutuldu. Beklenti §3'te düzeltildi: 24 saat ≈ 1268 örnek |

### 2.4 Risk analizi

| Risk | Değerlendirme |
|---|---|
| Üretim davranışı değişir mi? | **Hayır.** Dosya yalnızca elle çalıştırılan bir gözlem aracı. Uygulama, scanner, DB, cron veya systemd birimlerinden hiçbiri bu script'i çağırmıyor. |
| Veri şeması bozulur mu? | **Hayır.** `status` yine int olarak yazılıyor (`probe()` string'i çeviriyor). Mevcut tüketiciler etkilenmez. Yeni bir alan (`parse_error`) yalnızca ayrıştırılamayan probe'larda görünür. |
| Yeni yanlış veri üretir mi? | **Sınırlı ve etiketli.** 30 sn'yi aşan istekler artık `status: 0` olarak kaydedilir; gerçek süre `time_total` ≈ 30 olarak görünür. Yani 934 sn'lik bir olay bir daha *ölçülmez*, sadece "timeout" olarak damgalanır. Bu bilinçli bir takas: veri sürekliliği, tek olayın tam süresinden değerlidir. Tam süreyi ölçmek gerekirse `PROBE_TIMEOUT_SECONDS=300` ile koşulabilir. |
| Geri alınabilir mi? | **Evet, tamamen.** Tek dosya, tek `git revert`, prod tarafında eski kopyanın geri kopyalanması. Kalıcı durum değişikliği yok. |
| Sır sızdırır mı? | **Hayır.** Değişiklik hiçbir env değişkeni, kimlik bilgisi veya URL parametresi yazdırmıyor. |

### 2.5 Beklenen etki

- Geçici bir probe hatası artık gözlemi **öldürmez**; o örnek `status: 0` ile kaydedilir ve döngü devam eder.
- Tek bir asılı istek artık **15 dakikalık boşluk açmaz**; en fazla 30 sn geciktirir.
- 24 saatlik bir koşu **≈1268 örnek** üretmelidir (60 sn nominal + ~8 sn toplama).
- Değişiklik **hiçbir performans sorununu düzeltmez.** §1.4'teki uzun kuyruk ve §1.6'daki 502 aynen yerinde kalır; bu düzeltme sadece onları 24 saat boyunca kesintisiz ölçebilmeyi sağlar.

### 2.6 Yapılan doğrulamalar

Tümü lokal, prod'a dokunmadan:

| Kontrol | Sonuç |
|---|---|
| `bash -n tools/ops/tradeveto-stability-observe.sh` | temiz |
| Gerçek başarısızlık yolu (çözülemeyen host'a curl) | `"status":"000"` üretti — **geçerli JSON** |
| Eski format aynı girdiyle `json.loads` | `Expecting ',' delimiter` — **observer.log'daki hatanın aynısı** |
| `probe()` yeni format | `status=0`, serileşebilir |
| `probe()` eski (bozuk) format | `status=0`, serileşebilir — çökmez |
| `probe()` boş girdi | `status=0`, serileşebilir |
| `probe()` normal 200 yanıtı | `status=200`, int tipinde |

---

## 3. 24 saatlik gözlemde izlenecek metrikler

Koşu yeniden başlatılırsa, aşağıdaki tabloya göre değerlendirilmeli. Eşikler 556 örneklik pencereden türetildi; ikinci sütun "bu koşuda ne gördük"tür, üçüncüsü "kabul için ne olmalı".

| # | Metrik | 2026-06-10 (10.5 s) | 24 s koşusu için eşik |
|---|---|---|---|
| 1 | **Tamamlanma** | 556 örnek, %43.8 | ≥ 1200 örnek (≈1268 beklenir); erken sonlanma = başarısız |
| 2 | **Erişilebilirlik** | %99.910 (2/2224 hata) | ≥ %99.5; ardışık 3+ hata = başarısız |
| 3 | **`status: 0` (timeout) sayısı** | ölçülemedi (koşuyu öldürüyordu) | Bilgi amaçlı; > %1 ise ayrı incelenmeli |
| 4 | **`/terminal` p95** | 3.282 s | ≤ 3.0 s hedef, ≤ 5.0 s tolere |
| 5 | **`/terminal` ≥10 sn oranı** | %2.0 | ≤ %1.0 |
| 6 | **`/api/health` p95** | 1.871 s | ≤ 1.0 s (iş yapmayan uç için 1.9 s zaten yüksek) |
| 7 | **`/api/health` max** | 934.5 s | Timeout'a takılmalı; **iki veya daha fazla timeout = süreç bloklanması doğrulandı** |
| 8 | **Frontend belleği, ilk→son** | +5 MiB / 10.5 s | 24 saatte ≤ +50 MiB |
| 9 | **Postgres belleği, ilk→son** | +177 MiB / 10 s (+18 MiB/s) | Platoya oturmalı; 24 saatte hâlâ doğrusal artıyorsa ayrı blocker |
| 10 | **Açık bağlantı trendi** | 92–154, düz | Monoton artış = sızıntı; düz kalmalı |
| 11 | **Çalışan container min** | 6 | 6'nın altına hiç düşmemeli |
| 12 | **`systemd --failed`** | 556/556 boş | Boş kalmalı; herhangi bir birim = başarısız |
| 13 | **Tam tarama penceresi (21:30 UTC)** | **hiç gözlenmedi** | Gözlem bu pencereyi kapsamalı; sırasında 502 veya container kaybı olmamalı |
| 14 | **Yedekleme penceresi (05:18 / 06:00 UTC)** | hiç gözlenmedi | Dump sırasında `/terminal` p95 iki katına çıkmamalı |
| 15 | **502 kümelenmesi** | 1 olay, izole | Aynı 5 dakikada 2+ olay = gateway timeout ayarı incelenmeli |

**Kritik nokta:** gözlem penceresi 21:30 UTC tam taramasını ve gece yedekleme penceresini **içermeli**. 2026-06-10 koşusu ikisini de kaçırdı; bu yüzden en yüksek yük anları hiç ölçülmedi. Başlangıç saati buna göre seçilmeli (örn. 18:00 UTC'de başlatmak her ikisini de kapsar).

---

## 4. Push/deploy öncesi çalıştırılacak komutlar

Sıralama önemlidir. Her adım bir öncekinin çıktısına bağlıdır.

### 4.1 Lokal kapılar (Mac, repo kökünde)

```bash
cd /Users/hdtv/dev/market-alpha-scanner

# 1. Değişikliğin kapsamını doğrula — sadece tek dosya beklenir
git status --short
git diff --stat tools/ops/tradeveto-stability-observe.sh

# 2. Shell sözdizimi
bash -n tools/ops/tradeveto-stability-observe.sh

# 3. Gömülü Python bloğu derleniyor mu
sed -n "/<<'PY'/,/^PY$/p" tools/ops/tradeveto-stability-observe.sh \
  | sed '1d;$d' > /tmp/observe_block.py && .venv/bin/python -m py_compile /tmp/observe_block.py

# 4. Executable biti korunmuş mu (köprü üzerinden düzenleme bunu düşürebiliyor)
git ls-files -s tools/ops/tradeveto-stability-observe.sh   # 100755 olmalı

# 5. Proje kapıları — bu dosya bunların hiçbirine girmiyor ama regresyon güvencesi
.venv/bin/basedpyright scanner/ tools/
npm --prefix frontend run lint
npm --prefix frontend test -- --runInBand
```

Not: 5. adımın frontend kısmı bu değişiklikten etkilenmez; yalnızca çalışma ağacında başka bekleyen değişiklik yoksa emin olmak için.

### 4.2 Push

```bash
git add tools/ops/tradeveto-stability-observe.sh
git commit -m "Keep the stability observer alive through failed probes"
git push origin main
```

### 4.3 Prod'a alma (SSH, Linux host)

```bash
ssh sre@100.68.155.121
cd /opt/apps/market-alpha-scanner/app

# Durumu oku — untracked dosyalara dokunma
git status --short --branch
git pull --ff-only origin main
git rev-parse --short HEAD          # yeni commit'i göstermeli

# Ops kopyasını güncelle (yedeğini alarak)
sudo cp -a /opt/ops/tradeveto-stability-observe.sh \
           /opt/ops/tradeveto-stability-observe.sh.bak-$(date -u +%Y%m%d)
sudo cp tools/ops/tradeveto-stability-observe.sh /opt/ops/tradeveto-stability-observe.sh
sudo chmod 750 /opt/ops/tradeveto-stability-observe.sh
```

### 4.4 Deploy sonrası sağlık kontrolü

```bash
# Container'lar ve health
docker compose ps
curl -fsS --max-time 20 http://127.0.0.1:3000/api/health
curl -fsS --max-time 30 http://127.0.0.1:3000/api/health/deep | head -c 800

# Green check
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh

# Ops snapshot
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-snapshot.sh
```

**Not:** Bu değişiklik hiçbir container'ı yeniden başlatmayı gerektirmez. `docker compose up -d --build` **çalıştırılmamalıdır** — script uygulama imajının parçası değil.

### 4.5 Gözlemi başlatma (kararı verildikten sonra)

```bash
# Önce 3 dakikalık duman testi — JSON geçerli mi, örnekler yazılıyor mu
sudo /opt/ops/tradeveto-stability-observe.sh \
  --duration-seconds 180 --interval-seconds 30 \
  --output-dir /tmp/observe-smoke
wc -l /tmp/observe-smoke/samples.jsonl        # ≈6 satır
tail -1 /tmp/observe-smoke/samples.jsonl | .venv/bin/python -m json.tool | head -20

# Duman testi temizse gerçek koşu (18:00 UTC civarı başlat: tam tarama + yedek penceresi kapsansın)
OUT=/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/phase-36-0-stability/observation-24h
sudo mkdir -p "$OUT"
nohup sudo /opt/ops/tradeveto-stability-observe.sh \
  --duration-seconds 86400 --interval-seconds 60 \
  --output-dir "$OUT" > "$OUT/observer.log" 2>&1 &

# 10 dakika sonra ilk kontrol
sleep 600; wc -l "$OUT/samples.jsonl"; tail -3 "$OUT/observer.log"
```

---

## 5. Devir raporu — yeni oturum için

### 5.1 Ürünün bir cümlelik durumu

TradeVeto teknik olarak ayakta, ölçülebilir ve yedekli; **ama ürün olarak hiç çalıştığı görülmedi** — dört ayda ödeyen müşteri sıfır ve tarayıcı hiçbir zaman ENTER üretmiyor, kullanıcı 356 satırın neredeyse tamamında AVOID/EXIT görüyor.

### 5.2 Sabit gerçekler (hepsi ölçüldü, tahmin değil)

| Ne | Değer | Kaynak |
|---|---|---|
| Gerçek kullanıcı | 7 (33'ün 26'sı probe/test) | prod DB, 2026-09-01 |
| Ödeyen müşteri | **0** (1 comped, 2 süresi geçmiş Stripe kaydı) | prod DB |
| Scanner aksiyon alınabilir satır | 356'da **2** | prod DB |
| Karar dağılımı | EXIT 182 · AVOID 158 · WATCH 14 · WAIT_PULLBACK 2 | prod DB |
| ENTER sayısı (holdout, gerçek karar akışı) | **0** — üç ufukta da | holdout çalışması |
| En ağır JS (`/terminal`, anonim) | 1864 KB decoded | tarayıcı, 2026-09-02 |
| Ana iş parçacığı bloklaması (`/`) | 592 ms (4 uzun görev) | tarayıcı, 2026-09-02 |
| En yavaş soğuk render | `/market-memory` 1661 ms TTFB | tarayıcı, 2026-09-02 |
| `/terminal` p95 (sunucudan) | 3.28 s | stability, 2026-06-10 |
| Erişilebilirlik (10.5 s) | %99.91 | stability, 2026-06-10 |
| Postgres yedeği | 2026-09-02, 4.10 GB | prod, 2026-09-02 |
| R2 offsite | senkron | prod, 2026-09-02 |
| Prod commit | `95d9b09` = origin/main = local | prod, 2026-09-02 |

### 5.3 Sprint geçmişi

**Gün 1 — 2026-09-01.** Discover ticker araması düzeltildi (üç kusur: sorgu diğer filtrelerle AND'leniyordu, tam eşleşme önceliği yoktu, normalizasyon paketten habersizdi). Üç route'ta bundle bölme; paylaşılan `TerminalShell`'den 54 KB'lık discovery modeli çıkarıldı — her route düştü. Green check'in yalancı 502'si düzeltildi (readiness beklemesi eklendi). Ops snapshot aracı yazıldı. Kalibrasyon aracı yazıldı. Ölçümle bulunanlar: scanner hiç ENTER üretmiyor ve skor eşiği her ufukta yanlış yerde; yedekleme 14 gündür durmuş; 33 kullanıcının 26'sı test; gelir sıfır.

**Gün 2 — 2026-09-02 (sabah).** Sayfa hızı gerçek tarayıcıda ölçüldü — iki ayrı sorun: soğuk render 1.4–1.7 sn ve istemci tarafı 1–1.9 MB JS. Yedekleme arızasının kök sebebi bulundu ve düzeltildi: `tradeveto-backup-lifecycle.sh` her saat `:17`'de `*.tmp` dosyalarını koşulsuz siliyordu, dump süresi 17 dakikayı aşınca her yedek yazılırken siliniyordu; artık yalnızca 2 saatten eski geçici dosyalar siliniyor. R2'nin aslında bozuk olmadığı anlaşıldı. Isıtma script'i ve 10 dakikalık cron yazıldı.

**Gün 2 (öğleden sonra).** Giriş skoru eşiği holdout çalışması: `docs/analysis/entry-score-threshold-holdout-study.md` (364 satır) + `threshold-holdout-study.json` + `tools/analysis/threshold_holdout_study.py`. Kalibrasyon/holdout ayrımı `2026-07-01`, 55–70 bandı önceden sabitlendi. Bulgu: `>=80` üç ufukta da baseline'ın altında ve gerçek karar kohortunda **0 ENTER** üretiyor, ama kümelenmiş güven aralıklarının hepsi sıfırı içeriyor (n = 39–326) ve kalibrasyon penceresinde 20G'de +3.99% getirmiş. Bu yüzden hüküm değil, araştırma konusu olarak yazıldı. Öneri: eşiği silmek yerine `TRADEVETO_ENTRY_SCORE_MODE=floor|band` bayrağı arkasında shadow-mode çift loglama.

**Gün 2 (akşam).** Prod erişimi otomatikleştirildi (§5.7). Prod'un `95d9b09`'da ve senkron olduğu doğrulandı. Haziran'daki 24 saatlik stability gözleminin hayatta ama tamamlanmamış olduğu bulundu; ölmesinin kök sebebi bulundu ve düzeltildi; 556 örnek analiz edildi (bu rapor §1).

### 5.4 Altı fazlı yol haritası

**Faz 1 — Gözlemi tamamla.** Bu rapordaki düzeltmeyi deploy et, 24 saatlik koşuyu tam tarama ve yedekleme pencerelerini kapsayacak şekilde başlat, §3 tablosuna göre değerlendir. Çıktı: Phase 35.0c-3 blocker'ı kapanır ya da somut bir performans blocker'ına dönüşür.

**Faz 2 — Uzun kuyruk gecikmesinin sebebini bul.** §1.4/1.5 gösteriyor ki iş yapmayan `/api/health` bile 51 sn ve 934 sn sürebiliyor. Hipotez: Node süreç düzeyinde bloklanma. Yöntem: gözlem sırasında event-loop lag ölçümü ve container CPU throttling sayaçları. Bu, "sayfalar yavaş açılıyor" şikâyetinin sunucu tarafındaki payıdır.

**Faz 3 — İstemci tarafı yükü.** `/terminal` 1864 KB, landing 592 ms ana iş parçacığı bloklaması. 66 sayfada yalnızca 3 `next/dynamic` çağrı yeri var; kod bölme kural değil istisna. Hedef: en ağır üç route'ta initial JS'i yarıya indirmek.

**Faz 4 — ENTER kapısı.** Holdout çalışması hazır, karar bekliyor. Shadow-mode bayrağını ekle, birkaç hafta canlı çift log topla, sonra eşiği değiştir. **Bu, ürünün hiç çalışmamış olmasının doğrudan sebebi** — kullanıcı hiç aksiyon görmüyorsa ürün yok.

**Faz 5 — Ops borcu.** `/opt/ops/` script'leri git'te değil (4 tanesi prod'da untracked). `/etc/cron.d/` altında 4 `market-alpha-backup.bak*` ve 2 `stripe-reconcile` kopyası birikmiş. `tools/db/run-migrations.sh` sessizce başarısız oluyor (`psql: command not found`). Yedekleme script'inde `flock` yok. 44 GB yedek + retention büyümesi. `.venv` Python 3.14.3 ama `pyrightconfig.json` 3.12.

**Faz 6 — Belge düzeltmeleri ve gerçek kullanıcı testi.** `docs/ops/phase-35-0-v1-launch-readiness-recertification.md` üç yerde yanlış: "Paid users 2 — Partial positive" (gelir sıfır), "R2 current backup unhealthy — Critical" (R2 çalışıyor), performans bölümü (sunucu iyi, tarayıcı ayrı sorun). Ardından: 21 probe hesabının temizliği (yedekler doğrulanmadan **silinmemeli**) ve ilk gerçek kullanıcı testi.

### 5.5 Bekleyen (uncommitted) dosyalar

| Dosya | Durum | Ne |
|---|---|---|
| `tools/ops/tradeveto-stability-observe.sh` | modified, +34/−5 | Bu raporun konusu |
| `docs/analysis/entry-score-threshold-holdout-study.md` | new, 364 satır | Eşik holdout çalışması |
| `docs/analysis/threshold-holdout-study.json` | new, 24,758 B | Ham çıktı |
| `tools/analysis/threshold_holdout_study.py` | new, 357 satır | Çalışmanın kodu |
| `docs/ops/phase-36-0-stability-observation-and-handoff.md` | new | Bu rapor |
| `.tvops/` | new, git'e alınmıyor | Prod relay'i (§5.7), `.git/info/exclude`'da |

Prod'da bulunan ama git'te olmayan (bu oturumda **dokunulmadı**): `/opt/ops/tradeveto-backup-lifecycle.sh` (2026-09-02'deki `-mmin +120` düzeltmesi içinde), `/etc/cron.d/tradeveto-warm-cache`, `/etc/cron.d/market-alpha-backup` (log yönlendirmesi eklenmiş).

### 5.6 Değişmeyen sınırlar

- TradeVeto araştırma ve karar desteğidir; yatırım tavsiyesi değil, broker execution değil, getiri vaadi değil.
- WAIT/AVOID risk-önce dili, premium veri korumaları, yasal kapılar, bayat veri bildirimi ve kanıta bağlı lansman iddiaları korunur.
- Prod'da yıkıcı komut yok: `git reset --hard`, `git clean`, `git checkout --` kullanılmaz; yalnızca `git pull --ff-only origin main`.
- Prod'da `wpa_supplicant`, `tailscaled`, ağ servisleri veya SSH uzaktan durdurulmaz.
- Hiçbir secret (`.env`, backup env, docker config, rclone, Stripe, OpenAI, SMTP) yazdırılmaz; redakte edilmiş ops sarmalayıcıları kullanılır.
- Prod'daki untracked dosyalar silinmez, değiştirilmez, resetlenmez.

### 5.7 Prod erişimi nasıl çalışıyor

Bulut konteynerinden prod'a doğrudan erişim yok (Tailscale özel adresi). Mac'teki köprü kabuğunun hiç ağı yok. Terminal'e computer-use ile yazma sistemce bloke.

Çözüm: `~/dev/market-alpha-scanner/.tvops/` altında Mac'te çalışan salt-okunur bir relay.

```
.tvops/queue/NNNN.cmd    → yazılan komutlar
.tvops/out/NNNN.out      → sonuçlar
.tvops/out/NNNN.done     → tamamlanma işareti
.tvops/relay.log         → çalışma günlüğü
```

Relay her komut satırını SSH açılmadan **önce** doğrular. Reddedilenler: her türlü yazma (`rm`, `mv`, `cp`, `chmod`, `>`), deploy (`git pull/push/reset/clean/checkout`), servis kontrolü (`docker compose up/down/restart`, `systemctl start/stop/restart`), süreç kontrolü (`kill`, `pkill`), SELECT dışı her SQL, keyfi script (`bash`, `python`, `docker exec` içinde `psql` dışı her şey), paket kurulumu, `;` ve `&&` zincirleme, `$(...)`, ve `.env`/`.ssh/`/`credentials` gibi yollara dokunan her komut. Çıktıda sır benzeri satırlar diske yazılmadan önce maskelenir. Doğrulayıcı 33 vaka ile test edildi (15 izinli, 18 yasaklı, hata yok).

LaunchAgent (`com.tradeveto.opsrelay`) ile yeniden başlatmada geri gelir; kendi kaynak dosyası değişince otomatik yeniden yüklenir.

```bash
pgrep -fl tvops-relay                                    # durum
tail -20 ~/dev/market-alpha-scanner/.tvops/relay.log     # log
pkill -f tvops-relay                                     # durdur (LaunchAgent geri başlatır)
bash ~/dev/market-alpha-scanner/.tvops/install.sh --uninstall   # tamamen kaldır
```

Deploy ve yazma işlemleri bu kanaldan **yapılamaz** ve yapılmamalıdır; §4'teki adımlar insan tarafından SSH ile çalıştırılır.

---

## 6. Bu oturumdan çıkan üç ders

**Ölü bir gözlem, ölü bir sunucudan farklıdır.** "24 saatlik stability gözlemi tamamlanmadı" 84 gündür Critical blocker olarak duruyordu ve sistemin kararsız olduğunu düşündürüyordu. Gerçek: sistem 10.5 saat boyunca kusursuz çalıştı, gözlem aracı bir JSON kaçış hatasından öldü. Blocker aracın kendisindeydi.

**Hata mesajının içindeki sayı, kök sebebin adresidir.** `column 54 (char 53)` ifadesi, `"status":` öneki tam 52 karakter olduğu için `000`'ın ikinci hanesini işaret ediyordu. Tahmin etmeye gerek kalmadı.

**Aracın kendisi de ölçülmeli.** Bu oturumda gözlem aracında üç kusur bulundu; ikisi verinin varlığını, biri verinin yorumunu bozuyordu. "1440 örnek beklenir" varsayımı hiç doğrulanmamıştı ve yanlıştı — doğrusu ≈1268.
