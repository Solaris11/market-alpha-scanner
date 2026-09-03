# Phase 36.1 — Stability düzeltmeleri: deploy ve doğrulama raporu

**Tarih:** 2026-09-02
**Deploy penceresi:** 08:13:59Z → 08:16:49Z UTC
**Sonuç:** Deploy başarılı, rollback gerekmedi. Green check 18/18 PASS.

---

## 1. Değişen dosyalar

| Dosya | Değişim | Ne yapar |
|---|---:|---|
| `frontend/src/lib/server/db.ts` | +8 | Her sorguya zaman aşımı (`query_timeout` + `statement_timeout`) |
| `frontend/src/lib/server/monitoring.ts` | +16 / −5 | Deep health'in yedek dizini yürüyüşünü sınırlar (derinlik 4, 5000 giriş) |
| `frontend/src/lib/server/event-loop-monitor.ts` | +88 (yeni) | Event loop gecikmesi + bellek histogramı |
| `frontend/src/lib/server/event-loop-monitor.test.ts` | +48 (yeni) | 4 test, gerçek bir tıkanmayı ölçerek doğruluyor |
| `frontend/src/app/api/health/route.ts` | +4 | `/api/health` artık `process` bloğu döndürüyor |
| `tools/ops/tradeveto-stability-observe.sh` | +67 / −6 | Üç gözlemci kusuru: geçersiz JSON, probe timeout yok, kadans kayması |
| `docs/analysis/entry-score-threshold-holdout-study.md` | +364 (yeni) | Eşik holdout çalışması (yalnızca doküman) |
| `docs/analysis/threshold-holdout-study.json` | +962 (yeni) | Ham çıktı |
| `docs/ops/phase-36-0-stability-observation-and-handoff.md` | +609 (yeni) | 556 örneğin analizi ve devir raporu |
| `tools/analysis/threshold_holdout_study.py` | +357 (yeni) | Çalışmanın kodu |

Toplam: 10 dosya, +2520 / −9.

## 2. Commit'ler

| Hash | Başlık |
|---|---|
| `298aa53` | Bound every database query, not just connection acquisition |
| `409207b` | Bound the deep-health backup directory walk |
| `c7b3efc` | Report event loop delay from /api/health |
| `966a890` | Keep the stability observer alive and sampling on a fixed grid |
| `91b2ac4` | Record the threshold holdout study and the stability observation analysis |

**Push edilen branch:** `main` → `github.com:Solaris11/market-alpha-scanner`, `95d9b099..91b2ac49`
**Deploy edilen prod HEAD:** `91b2ac49d44337f27ad50abf383636862dd6d702` (fast-forward, `git pull --ff-only origin main`)

Eşik kodu (`buy_score_threshold`, setup/veto kapıları, scanner) **değişmedi**. Son commit yalnızca doküman ve bir analiz aracı ekliyor.

---

## 3. Kök neden doğrulaması

556 örneği okuduktan sonra üç şey ayırt edildi:

**Gözlemcinin ölümü — kanıtlandı, düzeltildi.** `curl_timing_json` HTTP kodunu tırnaksız gömüyordu; curl bir isteği tamamlayamadığında `%{http_code}` `000` döner ve `"status":000` geçerli JSON değildir. `observer.log`'daki `column 54 (char 53)` konumu `000`'ın ikinci hanesine birebir denk geliyor. Ağı olmayan bir kabukta gerçek başarısızlık yolunu tetikleyip eski formatın aynı hatayı verdiğini, yeni formatın geçerli JSON ürettiğini doğruladım.

**15 dakikalık veri boşluğu — kanıtlandı, düzeltildi.** Script'te hiç `--max-time` yoktu (`grep` boş döndü). 10:12:21Z'deki 934.5 saniyelik `/api/health` isteği döngüyü bloke etti; 10. saatteki 40 örnek (beklenen ~55) tam olarak bu.

**Kadans kayması — kanıtlandı, düzeltildi.** `collect_sample; sleep 60` toplama süresini telafi etmiyordu; gerçek aralık 68.1 saniyeydi. Duman testi düzeltmeyi doğruladı: 240 saniyede tam 8 örnek, zaman damgaları tam 30 saniye aralıklı.

**934 saniyelik bekleme — kaynak henüz belirlenmedi, ölçülebilir hale getirildi.** Bunu dürüstçe söylemek gerekiyor: neden olduğunu bulmadım. Elenenler var —

- `/api/health` hiç I/O yapmıyor; gövde tamamen senkron kuruluyor, `withRequestMetrics` metriği ateşle-unut kuyruğa atıyor, istek yolunda DB beklemesi yok.
- Sunucu kodunda **hiçbir senkron I/O yok**: `readFileSync`/`writeFileSync`/`execSync`/`scryptSync` ve benzeri hiçbir çağrı yok (grep, testler hariç, sıfır sonuç).
- Container'larda **CPU veya bellek limiti yok** (`NanoCpus=0`, `Memory=0`), yani cgroup throttling değil.
- Gözlem penceresinde **restart 0**, `systemd --failed` 556/556 boş, container sayısı hiç 6'nın altına düşmedi.
- Yavaşlık **scanner yüküyle korele değil** (çalışırken %5.38, boştayken %3.72, Fisher iki yönlü p = 0.414) — talimattaki gibi scanner zamanlamasıyla oyalanmadım.
- Loglar 84 gün eski olduğu için o ana ait kanıt artık yok.

Geriye iki hipotez kalıyor: event loop'un uzun süre bloke olması, ya da sürecin işletim sistemi tarafından zamanlanmaması (bellek baskısı/swap). **Bu ikisi ancak ölçülerek ayrılır ve ölçüm yoktu.** Bu yüzden `/api/health` artık `monitorEventLoopDelay` histogramını ve RSS/heap'i döndürüyor. Aynı olay tekrarlarsa: `eventLoopDelay.maxMs` sıçramışsa JavaScript bloke olmuştur, sıçramamışsa süreç zamanlanmamıştır. 24 saatlik gözlem her örnekte bu bloğu kaydediyor.

**Buna karşılık uzun kuyruğun bir kısmı için gerçek bir kusur bulundu ve düzeltildi.** `pg` havuzunda `connectionTimeoutMillis` vardı ama `statement_timeout`/`query_timeout` yoktu. Yani havuzdan client *almak* 2 saniyeyle sınırlıydı, ama client'ı zaten almış bir istek sorguyu **süresiz** bekleyebiliyordu. `/terminal` 89.5 sn ve `/symbol/AMD` 48.3 sn ölçümleri bu sınıfa uyuyor, ve 06:04:01'deki 502 tam olarak böyle oluştu: sağlık uçları 200 dönerken iki ağır SSR route'u ~7 saniye sonra gateway hatası verdi. Artık her sorgu iki taraftan da 30 saniyeyle sınırlı.

---

## 4. Çalıştırılan testler

Hepsi deploy'dan önce, Mac'teki repo üzerinde.

| Kapı | Komut | Sonuç |
|---|---|---|
| Typecheck | `node node_modules/typescript/lib/tsc.js --noEmit` (= `npm run lint`) | **exit 0**, hata yok |
| Birim testler | `node --experimental-transform-types --test $(find src -name '*.test.ts')` | **579 / 579 pass**, 0 fail, 137 dosya, 54 suite |
| Yeni modül testi | `event-loop-monitor.test.ts` | **4 / 4 pass** — 250 ms'lik gerçek bir tıkanma histogramda ≥100 ms olarak göründü |
| Shell sözdizimi | `bash -n tools/ops/tradeveto-stability-observe.sh` | temiz |
| Gömülü Python | `python -m py_compile` (heredoc bloğu çıkarılarak) | temiz |
| Başarısızlık yolu | Çözülemeyen host'a gerçek `curl` | `"status":"000"` — geçerli JSON |
| Eski format regresyonu | Aynı girdiyle `json.loads` | `Expecting ',' delimiter` — observer.log'daki hatanın aynısı |
| `probe()` toleransı | yeni / eski / boş / bozuk girdi | dördü de `status=0`, serileşebilir, istisna yok |
| `process_snapshot()` | güncel app / eski app / HTML / boş | `{}` veya doğru blok, istisna yok |
| Dosya modu | `git ls-files -s` | `100755` korundu |
| Container build | `docker compose build` (prod) | **başarılı**, 66 sn, iki imaj da Built |
| Ops green check | `tradeveto-ops-green-check.sh` (prod) | **pass=18 warn=0 fail=0 — PRODUCTION OPS GREEN** |

Not: Mac'in `node_modules`'ı macOS-arm64 esbuild ikilisi içerdiği için köprü VM'inde `tsx` çalışmıyor. Testleri Node 22'nin yerel TypeScript dönüştürücüsüyle, `@/` ve uzantısız importları çözen küçük bir loader ile koşturdum. Aynı 137 dosya, aynı testler — bu yüzden 579/579 sayısı projenin kendi runner'ıyla karşılaştırılabilir.

---

## 5. Prod sağlık ve probe sonuçları

**Deploy anı**

```
market-alpha-frontend          img=sha256:572b8527347f...  restarts=0  health=healthy
market-alpha-frontend-hot-api  img=sha256:2099a67f546f...  restarts=0  health=healthy
market-alpha-postgres-1        Up 2 months (healthy)   — dokunulmadı
```

Loglarda `error|unhandled|ECONNREFUSED|timeout` eşleşmesi: **0** (her iki container'da, son 200 satır). Next.js 16.2.6 her iki container'da `Ready in 117ms`.

**Deploy sonrası ilk probe'lar**

```
health   200  ttfb=0.248s  total=0.248s
terminal 200  ttfb=0.169s  total=0.208s
terminal 200  ttfb=0.199s  total=0.228s
symbol   200  ttfb=0.227s  total=0.401s
symbol   200  ttfb=0.142s  total=0.405s
discover 200  ttfb=0.160s  total=0.175s
memory   200  ttfb=0.425s  total=0.537s
```

**Yeni `/api/health` gövdesi** (canlı)

```json
{"ok":true,
 "process":{"eventLoopDelay":{"maxMs":143.3,"meanMs":10.3,"p99Ms":11.4,"windowSeconds":87},
            "heapUsedMb":142.3,"rssMb":281.6},
 "service":"tradeveto-frontend","status":"ok","uptimeSeconds":88}
```

`meanMs` 10.3 histogramın 10 ms çözünürlük tabanıdır, gerçek bir gecikme değil. `maxMs` 143.3 uygulamanın ilk saniyelerindeki başlangıç işidir ve o günden beri hiç artmadı.

---

## 6. Deploy sonrası 20 dakikalık gözlem

`08:23:12Z → 08:42:12Z`, 60 saniye aralık, yeni gözlemciyle.

| Ölçü | Sonuç |
|---|---|
| Örnek | **20 / 20** — tam olarak beklenen sayı |
| Kadans | Zaman damgaları tam 60 saniye aralıklı, **sıfır kayma** |
| HTTP | **80 / 80 probe 200**, tek bir hata yok |
| `parse_error` | **0** |
| Event loop max | 143.3 ms boyunca sabit — 20 dakikada tek bir yeni tıkanma yok |
| RSS | 225.2 → 222.2 MB (düz) |
| Bağlantılar | ortalama 122.8, min 103, max 153 |

Gecikme (saniye):

| Probe | ort | p50 | p95 | max | 2026-06-10 p95 |
|---|---:|---:|---:|---:|---:|
| `/api/health` | 0.304 | 0.325 | 0.457 | 0.496 | 1.871 |
| `/api/health/deep` | 0.233 | 0.204 | 0.386 | 0.397 | 1.772 |
| `/terminal` | 0.260 | 0.208 | 0.418 | 0.435 | 3.282 |
| `/symbol/AMD` | 0.521 | 0.463 | 0.680 | 0.816 | 2.862 |

**Bu sayıları fazla okumayın.** 20 dakikalık, tam taramanın ve yedekleme penceresinin dışında kalan boş bir pencere; 10.5 saatlik bir pencereyle kıyaslanamaz. Söyledikleri şu kadar: deploy bir regresyon getirmedi ve sistem bu koşullarda hızlı. Uzun kuyruğun düzelip düzelmediğini yalnızca 24 saatlik koşu gösterir.

Duman testi ayrıca (240 sn / 30 sn aralık): **8 / 8 örnek, tam 30 saniye aralıklı, 32/32 probe 200.**

---

## 7. Kalan riskler

| Risk | Değerlendirme |
|---|---|
| **934 sn'lik olayın sebebi hâlâ bilinmiyor** | En büyük açık kalem. Ölçüm eklendi ama olay tekrarlanmadan sınıflandırılamaz. 24 saatlik koşu tekrarlanırsa `eventLoopDelay.maxMs` cevabı verecek. |
| **30 sn sorgu zaman aşımı bir sorguyu kesebilir** | Gözlenen en yavaş sayfa 89 sn'ydi, yani sınır gerçek trafiğin çok üstünde. Yine de bir admin/analitik sorgusu 30 sn'yi aşarsa artık hata verir, sessizce beklemez. `TRADEVETO_DB_QUERY_TIMEOUT_MS` ve `TRADEVETO_DB_STATEMENT_TIMEOUT_MS` ile ayarlanabilir; container yeniden başlatmak yeterli. |
| **Probe timeout ölçümü kırpıyor** | 30 sn'yi aşan bir istek artık `status: 0` olarak kaydedilir; 934 sn gibi bir olayın *tam süresi* bir daha ölçülmez. Bilinçli takas: veri sürekliliği tek olayın süresinden değerli. Gerekirse `PROBE_TIMEOUT_SECONDS=300` ile koşulabilir. |
| **Yedek yürüyüşü sınırı** | Derinlik 4 / 5000 giriş. Bugünkü düzen (postgres, scanner_output, legacy-alert-json, alert-file-migration) rahatça sığıyor; ama yedek sayısı 5000'i aşarsa deep health en yeni yedeği kaçırabilir. Bugün ~40 dosya var. |
| **İstemci tarafı yükü değişmedi** | `/terminal` hâlâ 1864 KB JS indiriyor, landing ana iş parçacığını 592 ms bloke ediyor. Bu deploy sunucu tarafına dokundu; kullanıcının "yavaş açılıyor" şikâyetinin istemci payı duruyor. |
| **`/opt/ops/` git'te değil** | Gözlemci script'i artık repo'dan senkronlanıyor ama diğer ops script'leri hâlâ prod'da untracked. Değişmedi, dokunulmadı. |
| **Test koşum yolu farklı** | Testleri Node'un yerel dönüştürücüsüyle koşturdum, projenin `tsx` runner'ıyla değil. Aynı dosyalar ve aynı testler, ama Mac'te `npm test` çalıştırıldığında bir farklılık çıkarsa bu sebeptendir. |

---

## 8. Rollback planı

Hiçbiri gerekmedi; hepsi hazır ve test edilebilir durumda.

**8.1 Uygulama imajı (en hızlı, git gerektirmez).** Deploy öncesi çalışan imajlar etiketlendi:

```
market-alpha-scanner-market-alpha-frontend:rollback-20260902           0ed8c22cfafc
market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260902   569dc8cefe47
```

```bash
ssh sre@100.68.155.121
cd /opt/apps/market-alpha-scanner/app
docker tag market-alpha-scanner-market-alpha-frontend:rollback-20260902 \
          market-alpha-scanner-market-alpha-frontend:latest
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260902 \
          market-alpha-scanner-market-alpha-frontend-hot-api:latest
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps
curl -fsS https://tradeveto.com/api/health
```

**8.2 Gözlemci script'i.** Deploy öncesi kopyası duruyor:

```bash
sudo cp /opt/ops/tradeveto-stability-observe.sh.bak-20260902 \
        /opt/ops/tradeveto-stability-observe.sh
sudo chmod 750 /opt/ops/tradeveto-stability-observe.sh
```

**8.3 Kod (kalıcı geri alma).** Yıkıcı komut yok — revert, reset değil:

```bash
cd /Users/hdtv/dev/market-alpha-scanner
git revert --no-edit 966a890 c7b3efc 409207b 298aa53
git push origin main
# sonra prod'da: git pull --ff-only origin main && docker compose --env-file .env up -d --build \
#   market-alpha-frontend market-alpha-frontend-hot-api
```

`91b2ac4` (dokümanlar) geri alınmaya gerek yok; hiçbir davranışı değiştirmiyor.

**8.4 Sadece zaman aşımlarını devre dışı bırakmak** (kod geri almadan): compose env'ine `TRADEVETO_DB_QUERY_TIMEOUT_MS=300000` ve `TRADEVETO_DB_STATEMENT_TIMEOUT_MS=300000` eklenip container yeniden başlatılabilir. Alt sınır 1000 ms, üst sınır 300000 ms.

---

## 9. 24 saatlik gözlem — SONUÇ

Koşu tamamlandı: **2026-09-02 18:00:01 → 2026-09-03 17:59:01 UTC**, systemd geçici birimi olarak, oturumdan bağımsız. Tam rapor: `docs/ops/phase-36-2-stability-24h-final.md`.

**1440 örnek, tam ızgara** (her saat tam 60, sürüklenme yok). **5.760 probe, 5.760'ı 200** — sıfır 5xx, sıfır gateway timeout, sıfır `status: 0`. Restart 0, `systemd --failed` 1440/1440 boş, DB timeout 0.

Haziran tabanıyla karşılaştırma, **18:00–07:53 UTC müdahalesiz penceresi** üzerinden (07:59–08:14 arasında ölçümü kirleten kendi tanılama yüküm var — final raporun §11'i):

| | 2026-06-10 | Bu koşu (ana pencere) |
|---|---|---|
| Tamamlanma | 556 örnek (%43,8) | **1440 (%100)** |
| Erişilebilirlik | %99,910 | **%100,000** |
| `/terminal` p95 | 3,282 s | **0,608 s** |
| ≥10 sn oranı | %2,0 | **%0,060** |
| `/api/health` p95 | 1,871 s | **0,621 s** |
| 502 | 2 | **0** |

Haziran koşusunun hiç göremediği iki yük penceresi de kapsandı: 21:30 UTC tam taraması (360 probe, hepsi 200) ve gece yedeklemesi (480 probe, hepsi 200; `/terminal` p95 iki katına çıkmak yerine **yarıya indi** — 0,357 s / 0,687 s).

**15 maddelik eşik tablosu: 12 GEÇTİ · 1 KALDI · 2 ÖLÇÜLEMEDİ.**

Kalan madde **#8, frontend belleği**: RSS 631,7 MB → **1.122,8 MB** (+491 MB), eşik ≤+50 MiB idi. Eğri düz bir sızıntı değil — testere dişi, gerçek düşüşlerle — ama uç noktalar yükseliyor ve heap de tabana dönmüyor (347,7 → 686,1 MB). 24 saat, "tavana oturan mandal" ile "yavaş sızıntı" arasını ayırmaya yetmiyor. Aciliyet düşük (bellek sınırı yok, gecikmeye yansımadı) ama eşik açıkça aşıldı.

Ölçülemeyen ikisi gözlemcinin eksiği: **#9 Postgres belleği** ve **#11 çalışan container sayısı** örneklenmiyor. Gözlemciye eklenmeli.

**Phase 35.0c-3 blocker'ı: koşullu kapalı.** Erişilebilirlik ve gecikme boyutu kanıtlandı; bellek boyutu için 48–72 saatlik bir takip gözlemi açık kalıyor.

Çıktı: `docs/ops/artifacts/phase-36-0-stability/observation-24h/samples.jsonl` (1440 satır).

## 10. Prod erişim kanıtı

Bu oturumdaki her prod komutu, Mac üzerinde çalışan relay'den geçti. Salt-okunur varsayılan; deploy modu yalnızca `.tvops/DEPLOY_ENABLED` dosyası varken açık ve o dosya silindiğinde relay anında salt-okunura döner.

| Kanıt | Değer |
|---|---|
| Host / kullanıcı | `onsre-node-01` / `sre` |
| Deploy öncesi HEAD | `95d9b0996134527a3d91bb5ad8b33322adbedf4b` |
| Deploy sonrası HEAD | `91b2ac49d44337f27ad50abf383636862dd6d702` |
| Deploy öncesi imaj | frontend `0ed8c22cfafc`, hot-api `569dc8cefe47` |
| Deploy sonrası imaj | frontend `sha256:572b8527347f…`, hot-api `sha256:2099a67f546f…` |
| Container sağlığı | ikisi de `healthy`, `restarts=0` |
| DB saati | `2026-09-02 07:34:38.083779+00` (canlılık kanıtı) |
| Postgres | `Up 2 months (healthy)` — **dokunulmadı** |
| Green check | `pass=18 warn=0 fail=0` |

Deploy modu açıkken bile yasak kalanlar, 18 komutla test edildi: `git reset/clean/checkout`, `docker compose down/restart`, postgres'e yönelik her `up`, `systemctl start/stop/restart docker`, `pkill wpa_supplicant`, `systemctl stop tailscaled`, `rm -rf`, `.env` veya `/etc/shadow` okuma, `systemd-run` ile keyfi ikili çalıştırma, ve `;` / `&&` ile komut zincirleme. Hiçbir secret okunmadı, yazılmadı veya loglanmadı; relay çıktıdaki sır benzeri satırları diske yazmadan önce maskeliyor.

Prod'da yapılan tek yazma işlemleri: `git pull --ff-only`, iki imaj etiketi, iki container yeniden kurulumu, gözlemci script'inin `/opt/ops/`'a kopyalanması (yedeği alınarak), bir dizin oluşturma ve iki systemd geçici birimi. Veritabanına hiçbir yazma yapılmadı.
