# `shockEvents`'i client payload'ından düşürme planı (Stage 2–4)

**Tarih:** 2026-09-03 · **Kod:** `04c62083` · **Durum:** plan — kod yazılmadı, deploy yok

**Yöntem:** `raw-field-allowlist.test.ts`'teki import-grafiği yürüyüşü yeniden çalıştırıldı (148 `"use client"` kökü, geçişli kapanış 247 modül, `import type` kenarları hariç), ardından her eşleşme **gerçek çağrı noktasına kadar** izlendi. Modül erişilebilirliği ile client'ta çalışma aynı şey değil; fark bu planın yarısını oluşturuyor.

---

## 1. Önceki envanter yanlıştı — üç noktada

`docs/analysis/terminal-payload-inventory.md` §5 şu üçlüyü listeliyordu: `risk-tolerant-opportunities`, `institutional-trust`, `evidence-maturity`. Doğrusu:

| Modül | `/terminal`'de client'ta çalışıyor mu? | Kanıt |
|---|---|---|
| **`execution-intelligence`** | **EVET — listede hiç yoktu** | `ShockMoveRadar.tsx:42` ve `RiskTolerantOpportunityRadar.tsx:319` → `buildOpportunityActionability(row)` → `opportunity-actionability.ts:34` → `buildExecutionIntelligence(row)`. İkisi de `TerminalPremiumView.tsx:346–347`'de `clientRows` ile render ediliyor. |
| **`institutional-trust`** | **EVET** | `MyWatchlistWidget.tsx:42` → `buildOpportunityTrustModel(row)`; `TerminalPremiumView.tsx:403`. |
| `evidence-maturity` | **Hayır** | Tek client çağrısı `EvidenceMaturityCard.tsx:25`, o da yalnızca `SymbolTerminalWorkspace.tsx:332` üzerinden `/symbol/[symbol]`'de. `/terminal`'de `row.evidence` zaten sunucuda hesaplanıyor (`opportunity-view-model.ts:132`). |
| `risk-tolerant-opportunities` | **Hayır — sunucu tarafı** | `shockEvents` okuyan fonksiyon `buildRiskTolerantOpportunityPacket` (satır 375); tek çağrısı `app/api/opportunities/risk-tolerant-analysis/route.ts:70`. Bileşen o modülden yalnızca `riskRewardProfile` ve tipleri import ediyor. |

Elenen yanlış pozitifler: `TerminalRightRail.tsx:96` (`buildEvidenceMaturityFromSignal(row)` **context argümanı olmadan** çağrılıyor, `context.shockPattern` undefined; ayrıca `row` bir `RankingRow`, `shockPattern` alanı yok) ve `AICopilotPanel` → `AIExplainabilityCard.tsx:17` (`buildExplainabilityTrustModel` bir model alıyor, satır değil).

`ExecutionIntelligencePanel` `/terminal`'de `system={executionTimingSystem}` alıyor ve `focusSymbol`/`focusModel` geçilmediği için `focusModel` `null`'a kısa devre yapıyor (`ExecutionIntelligencePanel.tsx:43–48`) — Stage 1'in sunucu geçişi tutuyor, client'ta yeniden hesap yok.

---

## 2. Gerçek tüketiciler ne hesaplıyor, yerine ne geçecek

### 2a. `execution-intelligence` → `opportunity-actionability`

`buildOpportunityActionability(row)` 16 alan döndürüyor, **beşi** render ediliyor:

- `ShockMoveRadar.tsx:85` → `primaryActionLabel`, `whatToWaitFor`
- `RiskTolerantOpportunityRadar.tsx:345–347` → `primaryActionLabel`, `earlyOrLate`, `actionContext`, `invalidationExplanation`

Bağımlılık zinciri: `buildExecutionCalibration` (`execution-intelligence.ts:223`) → `calibration.scoreAdjustment` → `calibratedEntryQuality`/`calibratedChaseRisk` → `timingQualityScore` → `executionState` → render edilen beş alan.

```ts
type TerminalActionabilityCard = {
  actionContext: string;
  earlyOrLate: string;
  invalidationExplanation: string;
  primaryActionLabel: string;
  whatToWaitFor: string;
};
// prop: actionability?: Record<string /* row.symbol.toUpperCase() */, TerminalActionabilityCard>
```

**Harita `clientRows`'un tamamını kapsamalı, görünen alt kümeyi değil.** `ShockMoveRadar` client'ta sıralayıp kesiyor (satır 15–19); `RiskTolerantOpportunityRadar` kullanıcı risk profilini değiştirdikçe adaylarını yeniden türetiyor (satır 88–89). Sunucu hangi satırların yüzeye çıkacağını bilemez.

Her iki bileşen `/opportunities`'te de kesilmemiş satırlarla render ediliyor (`OpportunitiesWorkspace.tsx:518–519`), o yüzden prop **opsiyonel + `rows` fallback** olmalı — `ExecutionIntelligencePanel.tsx:39–42`'deki `system ?? buildExecutionTimingSystem(rows ?? [])` deseni.

### 2b. `institutional-trust`

`institutional-trust.ts:55` tek bir sayı istiyor: replay örnek sayısı. `timingValidation.validationSampleSize` tercih ediliyor, `shockEvents.length` fallback — ve bu fallback ölü değil: `parseTimingValidation` DB `metrics` sütununda `timingValidation` anahtarı yoksa `null` dönüyor (`shock-move.ts:966–969`).

Çözüm prop değil, **pattern üzerinde skaler**: `ShockMovePattern.shockEventCount`, iki kurucuda da set edilecek (`shock-move.ts:265` `buildShockMovePattern`, `:312` `shockPatternFromDbRow`). Prop olsaydı `MyWatchlistWidget`'ın `localStorage`'dan seçtiği alt küme yüzünden harita yine tüm satırları kapsamak zorunda kalırdı — tek tamsayı için.

---

## 3. Dokunulacak dosyalar

| Dosya | Satır | Değişiklik |
|---|---|---|
| `components/terminal/TerminalPremiumView.tsx` | ~272 | actionability haritasını `opportunityModel.rows` (kesilmemiş) üzerinden hesapla |
| ” | 346, 347 | iki radar'a prop geç |
| `components/opportunities/ShockMoveRadar.tsx` | 13, 42 | opsiyonel `actionability`, `row.symbol` ile lookup, `rows` fallback |
| `components/opportunities/RiskTolerantOpportunityRadar.tsx` | 55–62, 307–319 | aynı; prop `RiskCandidateCard`'a geçirilecek |
| `lib/trading/shock-move.ts` | 85–124, 265, 312 | `shockEventCount` |
| `lib/trading/institutional-trust.ts` | 55 | skaleri oku |
| `lib/trading/opportunity-view-model.ts` | 92–105 | strip fonksiyonu |

**Etkilenmeyenler** (yalnızca `shockPattern` skalerleri okuyorlar): `UnifiedIntelligenceConsole`, `IntradayRegimeDriftPanel`, `RegimeShiftIntelligencePanel`, `InstitutionalIntelligencePanel`, `TerminalMonitoringBrief`, `WorkspacePersonalizationPanel`.

---

## 4. Dizi tamamen düşer mi? Evet — bir tamsayı kalmak zorunda

**`shockEvents` gidebilir. `institutional-trust.ts:55`'in okuduğu sayı kalmalı** — ve türetilebilir *görünüp* türetilemediği için bunu sabitlemek gerekiyor:

1. `detectShockEvents` (`shock-move.ts:349–360`) `|return1d| >= 5` **veya** `(|return1d| >= 2 && |z| >= 2.5)` **veya** `(|return1d| >= 2 && atrNormalized >= 1.8)` **veya** `(gap >= 4 && volumeSpike >= 1.6)` koşullarında olay kabul ediyor ve ortadakileri `moveType: "two_sided"` etiketliyor. Ama `upsideShockCount` `return1d >= 5`, `downsideShockCount` `return1d <= -5` (satır 181–182). **İki taraflı olaylar hiçbir sayımda yok.**
2. `shockEvents: events.slice(-80)` (satır 265) 80'de kesiliyor; iki sayım kesilmemiş dizi üzerinden (satır 247, 270).

Yani `shockEvents.length = min(events.length, 80)` ve `upside + downside ≤ events.length` — iki yönde de sapıyorlar.

**Tarih kalmasına gerek yok.** `latestEvent`, `shockEvents`'in *kardeşi* (`shock-move.ts:108` vs `:118`), diziden bağımsız.

**Aynı geçişte bedava kazanç:** `stripShockEventPreconditions` (`opportunity-view-model.ts:92–105`) yalnızca `pattern.shockEvents`'i geziyor, `pattern.latestEvent`'e hiç dokunmuyor — satır başına tam bir `preconditions` nesnesi hâlâ gidiyor. Envanterdeki "kalan `preconditions` 102 KB" tam olarak bu (349 × ~290 B).

---

## 5. Test stratejisi

`execution-payload-boundary.test.ts`'in fixture'larını (`barsWithShock()`, `rowWithShockPattern()`) kullanan altı iddia:

1. **Fixture gerçek** — `shockEvents.length > 0`.
2. **Actionability değişmiyor** — sunucuda üretilen kart, `buildOpportunityActionability(fullRow)`'un beş alanıyla `deepEqual`.
3. **Trust değişmiyor** — `timingValidation` **yok** olan bir fixture'da (fallback dalı çalışsın diye) `buildOpportunityTrustModel` sonucu aynı.
4. **Skaler sadakati** — `shockEventCount === shockEvents.length` her iki kurucuda; **ve** `two_sided` olay + >80 olay içeren fixture'da `assert.notEqual(shockEventCount, upsideShockCount + downsideShockCount)`. İkinci iddia, skaleri "sadeleştirip" türetmeye kalkan birini durduran şey.
5. **Strip eksiksiz** — `shockEvents` undefined, `latestEvent.preconditions` undefined, `latestEvent.eventDate` sağ, diğer tüm pattern alanları `deepEqual`.
6. **Asıl koruma** — mevcut testin son iddiasının deseni:
   ```ts
   assert.notDeepEqual(buildOpportunityActionability(strippedRow), buildOpportunityActionability(fullRow),
     "bu geçerse strip bedava -- o zamana kadar /terminal sunucuda hesaplanmış actionability geçmeli");
   ```
   ve skalersiz stripped satır için aynısı `buildOpportunityTrustModel` ile.

Ek olarak `raw-field-allowlist.test.ts` desenli bir **envanter koruması**: client grafiğini yürüyüp `shockEvents` metinsel erişimi olan modül kümesinin sabitlenmiş listeye eşit olduğunu iddia et. Yorumunda granülaritesi dürüstçe yazılmalı: modül düzeyinde ve metinsel — bu planın §1'indeki dört yanlış pozitifi üreten şey tam olarak bu. Test "yeni bir modül okumaya başlamadı" kanıtlar, "bu modüller `/terminal`'de okuyor" kanıtlamaz.

---

## 6. Aşamalar

| Aşama | İş | Payload etkisi | Risk |
|---|---|---|---|
| **0** | `shockEventCount` ekle (tip + iki kurucu, test 4) | yok | **çok düşük** — kimse okumuyor |
| **1** | `institutional-trust:55` skaleri okusun (test 3) | yok | **düşük** — tek satır |
| **2** | Sunucu actionability geçişi + iki radar prop'u (test 2, 6) | yok | **orta** — iki client prop sözleşmesi; haritanın her `clientRows` sembolünü kapsadığını iddia eden test bu aşamaya ait |
| **3** | Diziyi düşür: `shockEvents?: ShockMoveEvent[]` **opsiyonel** yap (test 5, 6) | **−4.744 KB** | **orta** |
| 4 | Envanter koruma testi + `terminal-payload-inventory.md` §5 düzeltmesi | yok | düşük |

**Stage 3'te `[]` atamak yerine opsiyonel yapmak kritik.** `[]` her yerde derlenir ve sessizce `sampleSize 0` / `outcomeCoverage null` üretir — tam olarak bu refaktörün önlemek için var olduğu sessiz bozulma. Opsiyonel yapmak derleyiciyi kalan dört okuyucuyu saymaya zorluyor: `evidence-maturity.ts:103, 220, 228–230` ve `risk-tolerant-opportunities.ts:439` (ikisi de `/symbol` ve API rotasında hâlâ dolu dizi alıyor → `?? []` koruması yeter), `institutional-trust.ts:55` (Stage 1'de çözülmüş), `execution-intelligence.ts:223` (zaten `?? []`).

---

## 7. Ölçülmemiş olanlar — dürüst sınır

- **4.744 KB / %28,2 yeniden ölçülmedi**; envanter belgesinden alındı.
- **Yerine geçen actionability prop'unun boyutu tahmin**: ~349 satır × 5 cümle ≈ 200–350 KB. Stage 2'de ölçülecek, varsayılmayacak.
- **`timingValidation` prod'da her pattern'de var mı bilinmiyor.** Varsa `shockEvents.length` fallback'i pratikte ölü ve skaler sadece emniyet. `shock_move_patterns.metrics` içeriğine bakmadan söylenemez.
- Ayrıca (payload değil, bundle): `RiskTolerantOpportunityRadar`, `risk-tolerant-opportunities.ts`'ten `riskRewardProfile` değer-import ediyor ve modülün tamamını — sunucuya ait `buildRiskTolerantOpportunityPacket` dahil — client bundle'ına çekiyor. Yardımcıyı yaprak modüle taşımak bunu düşürür.
