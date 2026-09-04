# Phase 36.2 — 24 saatlik stabilite gözlemi, final rapor

**Pencere:** 2026-09-02 18:00:01 → 2026-09-03 17:59:01 UTC
**Prod kodu gözlem boyunca:** `291d9ea3` (deploy 2026-09-02 13:22 UTC, pencereden 4,6 saat önce)
**Karşılaştırma tabanı:** 2026-06-10 koşusu (556 örnek, 10,5 saat, %43,8 tamamlanma)

---

> ### Item 8 (memory) ve iki UNMEASURABLE madde güncellendi — 2026-09-04
>
> **Item 8, bellek.** Bu rapor 24 saatin "tavana oturma" ile "yavaş sızıntı"yı
> ayıramadığını söylüyor ve 48–72 saatlik pasif gözlem öneriyordu. O deney
> yanlış deney olurdu: 2026-09-04'te ölçülen şey, boştayken **hiç** büyüme
> olmadığı (7s11d boyunca 1.117 GiB sabit), ama 8 `/terminal` render'ının
> +105 MB eklediği ve 7 dakika sonra da geri vermediği. Yani büyüme
> **render sayısıyla** orantılı, zamanla değil; +491 MB ≈ 38 sayfa yüklemesi.
>
> Doğru takip deneyi pasif örnekleme değil, render sayısına bağlı olan:
> `docs/ops/memory-follow-up-plan.md`.
>
> Bu raporun "urgency low" çerçevesi de bu ışıkta yeniden okunmalı — trafikle
> ölçekleniyor.
>
> **Item 9 (Postgres memory) ve Item 11 (running container ≥ 6).** İkisi de
> "observer'a eklenmeli" diye açık bırakılmıştı. `febd94e5` ile eklendi ve
> sebep de kayda değer: veri zaten toplanıyordu — observer her örnekte
> `docker ps` ve `docker stats` çalıştırıp ikisini de ham string olarak
> saklıyordu. Eksik olan komut değil, o string'i alanlara ayıran satırlardı.
> Artık her örnek `running_containers`, `running_container_names`,
> `container_memory_mb` ve `postgres_memory_mb` taşıyor. Host'ta ek maliyet
> yok.

---

## 1. Tamamlanma — GEÇTİ

**1440 örnek, tam.** 24 saatin her saati **tam 60 örnek**; ızgara sürüklenmesi yok, her örnek dakikanın `:01` saniyesinde. Erken sonlanma yok, `parse_error` 0, `systemd_failed` 1440/1440 boş.

Haziran koşusu 556 örnekte (%43,8) ölmüştü. Eşik ≥1200'dü.

## 2. Erişilebilirlik — GEÇTİ

**5.760 probe, 5.760'ı 200.** Sıfır 5xx, sıfır gateway timeout, sıfır `status: 0`.

| | 2026-06-10 | Bu koşu |
|---|---|---|
| Erişilebilirlik | %99,910 (2/2224 hata) | **%100,000** (0/5760) |
| 502 | 2 | **0** |

## 3. Yavaş probe oranı — GEÇTİ

**Ana karşılaştırma penceresi 18:00–07:53 UTC** (müdahalesiz 14 saat — gerekçe §11).

| | 2026-06-10 | Ana pencere (833 tick / 3.332 probe) | Tüm 24 saat |
|---|---|---|---|
| ≥10 sn oranı | %2,0 | **%0,060** (2 probe) | %0,087 (5 probe) |
| `/terminal` p95 | 3,282 s | **0,608 s** | 1,016 s |
| `/terminal` p99 | — | 1,224 s | 1,228 s |
| `/terminal` max | — | 7,855 s | 8,203 s |

Eşik `/terminal` p95 ≤3,0 s hedef / ≤5,0 s tolere idi; **0,608 s** hedefin beşte biri. ≥10 sn eşiği ≤%1,0 idi; **%0,060** onun on altıda biri.

Ana pencere, dört probe için:

| Probe | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|
| `/api/health` | 0,331 s | **0,621 s** | 1,214 s | 3,269 s |
| `/api/health/deep` | 0,243 s | 0,652 s | 1,219 s | 16,128 s |
| `/terminal` | 0,235 s | 0,608 s | 1,224 s | 7,855 s |
| `/symbol/AMD` | 0,257 s | 0,572 s | 1,165 s | 17,351 s |

`/api/health` p95 eşiği ≤1,0 s idi (Haziran'da 1,871 s): **0,621 s — GEÇTİ**.

**Beş yavaş probe, tamamı tekil:** 22:04:01 (`/symbol/AMD` 17,9 s), 22:52:01 (`/api/health/deep` 16,1 s), 14:05:01 (`/api/health` 11,2 s), 15:00:01 (`/terminal` 10,5 s), 15:06:01 (`/api/health` 18,2 s). Hiçbirinde aynı tick'teki diğer probe'lar etkilenmedi; kümelenme yok.

## 4. DB timeout — GEÇTİ

Her iki container'ın 26 saatlik log'unda `statement timeout` / `query_timeout` / `ETIMEDOUT` / `ECONNRESET` / `unhandled` / `FATAL` → **0 eşleşme**.

Bu, 2026-09-02'de eklenen `query_timeout`/`statement_timeout` sınırlarının ilk tam gün testiydi; hiçbiri tetiklenmedi.

## 5. Container durumu — GEÇTİ

`restarts=0` her ikisinde, `healthy` boyunca, 24 saat kesintisiz (başlangıç 2026-09-02 13:22). Haziran'ın "container kaybı" senaryosu tekrarlanmadı.

> **Not:** `running_containers` alanı örneklerde yok, yani eşik tablosunun 11. maddesi (≥6 container) bu veriden doğrudan değerlendirilemedi. Restart sayısı 0 ve `docker compose ps` çıktısı tüm servisleri ayakta gösteriyor; ama bu, o maddenin ölçülmüş hali değil. Gözlemciye eklenmeli.

## 6. Event loop ve bellek — BİRİ KALDI

### Event loop: GEÇTİ

```
2026-09-02T18:00:01Z  maxMs=1820.3   ← pencere ÖNCESİ değer (windowSeconds=16679)
2026-09-03T07:54:01Z  maxMs=1822.4
2026-09-03T08:10:01Z  maxMs=2812.3
… 17:59'a kadar sabit
```

`maxMs` birikimli; pencere açıldığında zaten 1820,3'tü ve o tepe 13:22 deploy'u ile 18:00 arasında oluşmuştu. **Ana pencerede tek bir yeni sıçrama yok.** 07:54 ve 08:10'daki iki artış için §11.

Kapanışta `meanMs` 10,3 / `p99Ms` 11,5 — yani tipik davranış tamamen sağlıklı, tepe değerler nadir olaylar.

### Bellek: **KALDI (eşik 8)**

| | İlk örnek (18:00:01) | Son örnek (17:59:01) | Δ |
|---|---:|---:|---:|
| RSS | 631,7 MB | **1.122,8 MB** | **+491,1 MB** |
| Heap | 347,7 MB | 686,1 MB | +338,4 MB |

Eşik **24 saatte ≤ +50 MiB** idi. **On kat aşıldı.**

Saatlik ortalama RSS, düz bir sızıntı eğrisi değil — testere dişi, ama yukarı doğru mandallı:

```
639 659 647 646 671 662 679 | 891 905 905 905 906 885 884 | 1051 928 836 837 817 812 825 825 825 | 1059
```

İki gözlem:
- **Düşüşler gerçek.** 1051 → 836 ve 906 → 812 gibi inişler var, yani salt birikim değil; V8 belleği bırakabiliyor.
- **Ama uç noktalar yükseliyor** ve son saatte 1059'a, kapanış anında 1.122,8 MB'a çıkmış. Heap de tabana dönmemiş: başlangıçta 347,7, sonda 686,1.

**Dürüst sonuç: 24 saat, "bir tavana oturan mandal" ile "yavaş sızıntı" arasını ayırmaya yetmiyor.** İkisi de bu eğriyi üretebilir. Eşik açıkça aşıldığı için bu madde KALDI olarak işaretlenmeli ve ayrı bir takip gerekiyor:
- 48–72 saatlik ikinci bir gözlem (yalnızca bellek örneklemesi, ucuz), veya
- Başlangıç ve bitişte heap snapshot alıp diff'lemek — hangi nesne sınıfının büyüdüğünü söyler.

Aciliyet düşük: container'ın bellek sınırı yok, 1,1 GB host'un %3,5'i, ve gecikmeye yansımadı. Ama eşik eşiktir.

**Postgres belleği (eşik 9) ölçülemedi** — gözlemci postgres bellek örneği toplamıyor. Bu da eklenmeli.

### Açık bağlantılar (eşik 10): GEÇTİ

İlk örnek 139, son örnek 121. Saatlik ortalama 121–137 bandında düz. Monoton artış yok. Tepe değerler 149–293 arasında dalgalanıyor; son saatte 293 en yüksek tepe ama ortalama düz kaldığı için sızıntı imzası değil.

## 7. Yük pencereleri — İKİSİ DE GEÇTİ

### Tam tarama (21:30 UTC, eşik 13)

**Haziran koşusu bu pencereyi hiç görmemişti.** 21:00–22:30 arası 90 tick / 360 probe: **hepsi 200**, yavaş probe yok, container kaybı yok, 502 yok.

### Gece yedekleme (05:00–07:00 UTC, eşik 14)

Eşik "`/terminal` p95 dump sırasında iki katına çıkmamalı" idi. **Yarıya indi:**

| Probe | Yedekleme penceresi p95 | Pencere dışı p95 |
|---|---:|---:|
| `/terminal` | **0,357 s** | 0,687 s |
| `/symbol/AMD` | 0,372 s | 0,592 s |
| `/api/health` | 0,429 s | 0,648 s |
| `/api/health/deep` | 0,340 s | 0,704 s |

120 tick, 480 probe, **0 adet non-200**. 19 dakikalık `pg_dump` + R2 yüklemesi servisin gecikmesinde ölçülebilir iz bırakmıyor.

Yedeklerin gerçekten alındığı da doğrulandı — beş ardışık döngü, hiçbirine el değmeden: `2026-09-02_06-00` (4,098 GB) → `12-00` (4,111) → `18-00` (4,123) → `2026-09-03_00-00` (4,136) → `06-00` (4,148). 14 günlük yedekleme arızası pratikte kapandı.

### 502 kümelenmesi (eşik 15): GEÇTİ — hiç 502 yok.

## 8. Değerlendirme — 15 maddelik tablo

| # | Metrik | Eşik | Sonuç | |
|---|---|---|---|---|
| 1 | Tamamlanma | ≥1200 örnek | 1440, tam ızgara | **GEÇTİ** |
| 2 | Erişilebilirlik | ≥%99,5 | %100,000 | **GEÇTİ** |
| 3 | `status: 0` sayısı | bilgi amaçlı | 0 | **GEÇTİ** |
| 4 | `/terminal` p95 | ≤3,0 s | 0,608 s | **GEÇTİ** |
| 5 | `/terminal` ≥10 sn | ≤%1,0 | %0,060 | **GEÇTİ** |
| 6 | `/api/health` p95 | ≤1,0 s | 0,621 s | **GEÇTİ** |
| 7 | `/api/health` max / timeout | <2 timeout | 0 timeout | **GEÇTİ** |
| 8 | **Frontend belleği** | **≤ +50 MiB** | **+491 MB** | **KALDI** |
| 9 | Postgres belleği | platoya oturmalı | örneklenmedi | **ÖLÇÜLEMEDİ** |
| 10 | Açık bağlantı trendi | düz | 139 → 121, düz | **GEÇTİ** |
| 11 | Çalışan container min | ≥6 | alan yok; restart 0 | **ÖLÇÜLEMEDİ** |
| 12 | `systemd --failed` | boş | 1440/1440 boş | **GEÇTİ** |
| 13 | Tam tarama penceresi | 502/kayıp yok | 360 probe, hepsi 200 | **GEÇTİ** |
| 14 | Yedekleme penceresi | p95 iki katına çıkmasın | yarıya indi | **GEÇTİ** |
| 15 | 502 kümelenmesi | 5 dk'da <2 | hiç 502 yok | **GEÇTİ** |

**12 GEÇTİ · 1 KALDI · 2 ÖLÇÜLEMEDİ.**

## 9. Phase 35.0c-3 blocker'ı

Blocker "24 saatlik stabilite kanıtı yok; 2026-06-10 koşusu %43,8'de öldü, tam tarama ve yedekleme pencereleri hiç gözlenmedi" diyordu.

**Kanıt tarafı kapandı:** 1440 örnek, %100 erişilebilirlik, her iki yük penceresi kapsandı, gözlemcinin kendisi 24 saat hayatta kaldı.

**Ama tam kapalı diyemem.** Bellek eşiği açıkça aşıldı ve iki metrik hiç ölçülmedi. Blocker'ı "kapandı" yazmak, ölçülmemiş iki maddeyi ve düşen bir eşiği görmezden gelmek olur. Önerim: blocker **koşullu kapalı** — erişilebilirlik ve gecikme boyutu kanıtlandı, bellek boyutu için 48–72 saatlik bir takip gözlemi açık kalsın.

## 10. SNDK / `c472bbc4` — üç ayrı şey

"SNDK düzeltildi" diye okunmaması için:

1. **Commit `c472bbc4` bu deploy ile prod checkout'una gidiyor.** İçeriği: bir taramada zorunlu sembol eksikse yüksek sesle uyaran kod.
2. **Ama uyarı prod taramalarında henüz çalışmayacak.** Taramalar `market-alpha-scanner-job` imajından koşuyor (fast ve full scan systemd drop-in'leri `ExecStart`'ı `docker compose --profile scanner-job run` ile değiştiriyor), o imaj **2026-06-10** tarihli ve kök `Dockerfile` `COPY . /app` yapıyor. Yani imaj Haziran kodunu ve Haziran evrenini taşıyor.
3. **SNDK'nın gerçek prod etkisi ayrı bir onay gerektiriyor:** `scanner-job` imajının yeniden build edilmesi. Bu onay alınmadı, işlem yapılmadı. Tam komut, risk ve geri alma `docs/ops/pending-prod-approvals.md` §1'de.

## 11. Observer contamination — kendi yüklediğim yük

**Bu bölüm ölçümün güvenilirliğini sınırlıyor ve saklanmıyor.**

07:59–08:14 UTC arasında, gözlem penceresi hâlâ açıkken, SNDK araştırması için prod'da salt-okunur tanılama çalıştırdım: iki adet ~292.000 buffer okuyan `EXPLAIN (ANALYZE, BUFFERS)`, prod dosya sisteminde `grep`/`find` taramaları, `docker inspect`, `systemctl`. Hepsi izinliydi ve hiçbiri yazma yapmadı — ama hepsi taramanın ve frontend'in paylaştığı host'ta çalıştı.

Zaman çizelgesi bunu açıkça gösteriyor:

```
18:00 – 07:53   maxMs 1820.3'te sabit, 14 saat, müdahalesiz
07:54           maxMs 1822.4        ← ilk artış
07:59 – 08:14   [Claude'un tanılama yükü]
08:10           maxMs 2812.3        ← ikinci artış, sonra 10 saat sabit
08:00 – 08:59   RSS saatlik ortalama 1051 MB — tüm pencerenin en yükseği
```

Taramalar bütün gece 15 dakikada bir koştu ve maksimumu hiç oynatmadı. İki artış arasında değişen tek şey benim yüklemem. **Nedenselliği kanıtlamıyorum** — ikisini bu veriden ayıramam — ama en güçlü aday benim.

Bu yüzden:
- **08:10'daki `maxMs=2812,3` normal prod davranışı olarak yorumlanmıyor.**
- **Haziran tabanıyla tüm karşılaştırma 18:00–07:53 penceresine dayandırıldı** (§3). 07:53 sonrası ayrıca ve çekinceli sunuldu.
- 07:59–08:14 aralığı ölçümü kirleten dış müdahale olarak işaretlendi.

**Kullanıcıya yansımadı:** o pencerede en yavaş probe 0,36–0,43 s, tüm probe'lar 200, DB timeout 0, restart 0. Yani ölçüm kirlendi, servis kirlenmedi.

> **Ders:** bir gözlem penceresi sürerken aynı host'ta ağır tanılama çalıştırmak, ölçülen şeyi kirletir. Bu tür araştırmalar pencere dışına alınmalı. SNDK araştırması 18:00 sonrasına bırakılmalıydı.

**Ayrıca not:** 14:05, 15:00 ve 15:06'daki üç yavaş probe **benim yüküm değil** — o saatlerde prod'a hiç dokunmadım. Onlar gerçek, açıklanmamış tekil olaylar.

## 12. Pencere sonrası yapılacaklar ayrıdır

Gözlem 17:59:54 UTC'de kapandı. Bu saatten sonra yapılan deploy ve ölçümler **bu veri kümesinin parçası değil** ve pencereye müdahale sayılmaz. Deploy sonrası ölçümler ayrı raporlanıyor.

Bir uyarı: deploy container'ları yeniden yaratıyor, yani **§6'daki bellek durumu sıfırlanıyor.** +491 MB'lık büyüme kapanış anında ölçüldü; deploy sonrası sayaç yeni bir tabandan başlayacak. Takip gözlemi bunu hesaba katmalı.
