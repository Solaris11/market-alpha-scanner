# Gün 3 — 2026-09-03 (Perşembe) — Yapıldı

> Bu, `claude/tradeveto-gunluk.md` dosyasının Gün 3 kaydıdır. Günlükteki
> "Gün 3 — Planlanan" bölümünün altına eklenmek üzere yazıldı; ayrı dosya
> olmasının tek sebebi günlüğün tamamını yeniden yazmadan kayıt tutmak.

## Yapıldı ve commit'lendi — ama canlıda değil

**Hiçbiri prod'da değil.** Push her iki ortamdan da reddediliyor (aşağıda).
Prod hâlâ `b177dea8`. On commit yerelde bekliyor: sekizi
`work/autonomous-after-b177`, ikisi `work/ux-polish`.

### `/terminal` actionability regresyonu — düzeltildi, deploy edilmedi

Stage 1 `ShockMoveEvent.preconditions`'ı payload'dan çıkarıyor, ama iki client
bileşeni actionability'yi aldıkları satırlardan **yeniden hesaplıyor**.
Preconditions gitmiş olduğu için sunucununkinden farklı bir cevap üretiyorlar.
80 şoklu fixture'da beş render edilen string'in **üçü değişiyor**. Bunu Stage 1
deploy'unda ben gönderdim.

`98afc6c6` beş string'i sunucuda hesaplayıp aşağı geçiriyor;
`terminal-actionability.test.ts` sunucu kartının client'ın eskiden ürettiğiyle
**bayt bayt aynı** olduğunu doğruluyor. Dokuz test. `857af454` ardından 4,7 MB'lık
`shockEvents` dizisini payload'dan düşürüyor — ki bu ancak kartlar yolculuk
ettiğinde güvenli.

### Watchlist çift POST — kök sebep bulundu ve düzeltildi (`345997e0`)

`/terminal` yükleme başına hâlâ iki `POST /api/user/watchlist` atıyordu. Daha
önce eklenen in-flight guard yanlış fikir değildi, **sorunun yarısıydı**.

`useLocalWatchlist` bir hook, yani her tüketici kendi mount effect'ini koşuyor —
`/terminal`'de root layout'tan activation nudge, first-run kartı, watchlist
widget'ı ve butonları. Guard **hem çakışan hem aynı body'yi taşıyan** senkleri
birleştiriyor. Geriye kalan çift ikisini de yapmıyor: ilk senk birleşmiş listeyi
storage'a geri yazıyor, dolayısıyla o cevaptan sonra mount olan bileşen farklı
bir yerel liste okuyup **farklı bir body** kuruyor ve in-flight anahtarını
ıskalıyor.

Birleştirme idempotent ve sonucu zaten storage'da olduğu için sonraki mount'un
katacağı bir şey yok. Koordinatör artık bu sayfa oturumunda hangi hesabı
uzlaştırdığını hatırlıyor.

**Dikkat edilen nokta:** kısa devre boş payload değil `null` dönüyor. Hook
storage'ı payload'dan yazıyor; boş bir payload okuyucunun watchlist'ini
**silerdi**. Çift istekten çok daha kötü bir hata olurdu, ve `null` sözleşmesinin
kendi testi bu yüzden var.

Test edilebilmesi için `src/lib/client/watchlist-sync.ts`'e taşındı (enjekte
edilebilir fetcher + memo reset). Beş test: sıralı durum, `null` sözleşmesi,
hesap değişimi, ve başarısız senkin hatırlanmaması.

### Bugün fark ettiğim, benim yol açtığım regresyon

`61366d3b` `ShockMovePattern.shockEvents`'i opsiyonel yaptı ki payload onu
düşürebilsin. Bu, pattern'leri **yazan** script'i —
`scripts/shock-pattern-refresh.ts` — üç yerde bozdu ve o zaman yakalamadım.
`tsc --noEmit -p tsconfig.json` bugün üçünü de bildirdi; `345997e0`'de
düzeltildi. Örneklem boyutu artık `shockEventCount` okuyor.

Neden o zaman yakalanmadığını bilmiyorum. En olası açıklama, o commit'te
koşturduğum typecheck'in `scripts/` kapsamaması ya da hiç koşmamış olması.
**Bu branch'teki daha önceki "typecheck yeşil" ifadelerini yalnızca `src/` için
geçerli sayın.**

### UX/UI polish — ayrı branch `work/ux-polish`, iki commit

Ölçülen kusur: `/discover` compare matrisi 375px'te bugün **kırpıyor**. Üç
sembolle bile container 346px'te bitiyor, EOG sütunu 362px'e uzanıyor —
scrollbar yok, eksik bir şey olduğuna dair hiçbir işaret yok. Preset sekiz
sembol yükleyebiliyor; orada 42rem'lik sabit track ile beş tam sütun
erişilemez olurdu.

Uygulananlar: compare matrisi ve scanner tablosu artık yatay kayıyor (yeni
`tv-scroll-x` yardımcısı, `overscroll-behavior-x: contain` ile tarayıcının geri
hareketini de engelliyor); mobil terminal başlığındaki hesap butonu artık
gerçekten daralabiliyor (plan rozeti `shrink-0` yerine truncate — `word-break:
normal` kuralı `text-wrapping.test.ts` ile sabitlenmiş olduğu için sarma
seçenek değil); activation nudge alt navigasyonun 4px altında duruyordu, artık
`--tv-mobile-nav-clearance` token'ını okuyor; sembol sayfasındaki `ShellMetric`
değerini etiketinden daha ağır gösteriyor; iki fallback fiyat grafiği artık
eksen taşıyor (aynı `candles` dizisinden, yani başlık çizgiyle çelişemez);
`/pricing` plan rozetleri blok `div` olduğu için tam genişliğe yayılıyordu;
premium CTA `shrink-0 whitespace-nowrap` ile 271px'lik kutuda ~250px'lik etiketi
taşırıyordu; `/account`'un dokuz kardeş route'un aksine `loading.tsx`'i yoktu.

**Geri çektiğim bir denetim bulgusu:** ısı haritası için önerilen high/mid/low
renk açıklaması. `PosterHeatmapChart` `cell.tone ?? scoreTone(cell.value)`
yapıyor, yani sunucudan gelen ton cyan veya violet olabilir — sabit üç renkli
bir anahtar, kodun garanti etmediği bir eşleme iddia ederdi. Hücreler zaten
sayıyı basıyor; eksik olan birimdi, başlık artık "Discovery score 0-100" diyor.

**Ölçemediğim bir düzeltme:** scanner tablosunun kırpması. 375px'te mobil düzen
grid'i hiç render etmiyor, masaüstü ölçümü de alınamadı (tarayıcı paneli
kapalıydı, tüm genişlikler 0 döndü). Değişiklik sabit rem track'ler ve sahipsiz
`sticky left-0`'dan **çıkarım**, gözlemden değil. Buradaki en zayıf madde bu.

## Bloklar

**Push her iki ortamdan da imkânsız.** Köprü VM'inde SSH `Forbidden`, köprüde
HTTPS `403 from proxy`, bulut konteynerinde depo `not in this session's
authorized repository set`. Bu pencerede değişmedi. Prod
`git pull --ff-only origin main` ile deploy ettiği için, actionability düzeltmesi
ancak sen push ettikten sonra kullanıcıya ulaşır.

**`npm test` ve `next build` köprü VM'inde koşmuyor.** Mount edilen
`node_modules` macOS'ta kurulmuş: `@esbuild/darwin-arm64` ve
`@next/swc-darwin-arm64` var, linux-arm64 paketleri yok, ve VM'de npm egress yok
(403) — bulut konteynerinde de yok (registry'ye genel 403). Yani `tsx`, dolayısıyla
`npm test`, ve `next build`, burada **kod sebebiyle değil platform sebebiyle**
başarısız.

Test tarafını rapor edip geçmek yerine çözdüm: TypeScript'in kendisi saf JS ve
zaten kurulu, dolayısıyla `.ts` dosyalarını `ts.transpileModule` ile çeviren bir
Node module hook'u `tsx`'in işini görüyor. `frontend/.next/tv-scratch/` altında
duruyor — gitignore'lu, izlenen ağacın dışında, atılabilir. **142 test dosyasının
tamamı** her iki branch'te geçiyor, `tsc --noEmit` her ikisinde temiz.

`next build`'in eşdeğeri yok: native SWC binary'sine ihtiyaç duyuyor. **Build
kapısı koşulmadı.** Her iki branch'i deploy etmeden önce Mac'te
`npm --prefix frontend run build` koşman gerekiyor. `tsc` + tüm test suite'i
onun yerine sunabileceğim şey, ve RSC sınır hatalarını kapsamıyor.

## Açık kalanlar

- **Frontend belleği** 24 saatlik gözlemde eşiğini geçti: +50 MiB bütçeye karşı
  **+491 MB**. 48–72 saatlik takip penceresi gerekiyor. Bu pencerede
  incelenmedi.
- **SNDK scanner-job rebuild** — runbook hazır, onayın bekliyor.
- **Her iki branch'in deploy'u** — push ve build kapısına bağlı.

## Senden sırayla ihtiyacım olanlar

1. `work/autonomous-after-b177` ve sonra `work/ux-polish` üzerinde Mac'te
   `npm --prefix frontend run build`. Biri patlarsa altındakiler durmalı.
2. Actionability düzeltmesi tek başına mı `main`'e gitsin, yoksa branch'in
   geri kalanıyla mı? Öncelik 1 ve **canlıda yanlış değer gösteriyor**;
   geri kalanı bekleyebilecek performans işi.
3. `git push`.
4. SNDK scanner-job rebuild: onay ya da ret.

## Süreç dersleri (Gün 3)

- **Denetim bulgusu kanıt değildir.** Alt-ajanların çıkardığı üç sayfalık
  listeden ikisini uygulamadan önce prod'da ölçtüm; biri doğrulandı (compare
  matrisi, 16px kayıp), biri doğrulanamadı (scanner tablosu), biri de yanlıştı
  (ısı haritası renk anahtarı). Ölçmeden uygulasaydım üçü de "düzeltildi"
  diye yazılacaktı.
- **Bir aracın çalışmaması, işin yapılamayacağı anlamına gelmiyor.** `npm test`
  platform yüzünden çöktü; TypeScript zaten kuruluydu. Yine de bunun bir
  workaround olduğunu ve build kapısının **koşulmadığını** raporda saklamamak
  gerekiyor.
- **Kendi geçmiş iddialarımı denetlemek zorundayım.** `scripts/` içindeki üç tip
  hatası dün "typecheck yeşil" dediğim bir commit'ten geliyor. Kapsamı
  belirtmeden yeşil demek, yanlış demekle aynı kapıya çıkıyor.
