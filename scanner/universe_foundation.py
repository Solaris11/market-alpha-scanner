from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterable, Literal, Mapping, Sequence

from .universe import load_expanded_universe_rows

UniverseCategory = Literal[
    "Mega Cap",
    "Large Cap",
    "Mid Cap",
    "Small Cap",
    "AI",
    "Quantum",
    "Crypto",
    "Semiconductor",
    "Cloud",
    "Cybersecurity",
    "Defense",
    "Space",
    "Energy",
    "Biotech",
    "Consumer",
    "Growth",
    "Momentum",
]
UniverseTier = Literal["Tier 1", "Tier 2", "Tier 3"]
ScannerFrequency = Literal["every_scan", "regular", "opportunistic"]
CoverageState = Literal["active", "not_ranked_latest_scan", "provider_error"]
QualityState = Literal["strong", "acceptable", "limited", "unknown"]

CATEGORY_ORDER: tuple[UniverseCategory, ...] = (
    "Mega Cap",
    "Large Cap",
    "Mid Cap",
    "Small Cap",
    "AI",
    "Quantum",
    "Crypto",
    "Semiconductor",
    "Cloud",
    "Cybersecurity",
    "Defense",
    "Space",
    "Energy",
    "Biotech",
    "Consumer",
    "Growth",
    "Momentum",
)

MEGA_CAP_SYMBOLS = {
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "META",
    "GOOGL",
    "AVGO",
    "TSLA",
    "BRK-B",
    "JPM",
    "V",
    "MA",
    "LLY",
    "UNH",
    "XOM",
}

LARGE_CAP_SYMBOLS = {
    "NFLX",
    "AMD",
    "ORCL",
    "CRM",
    "ADBE",
    "INTU",
    "QCOM",
    "MU",
    "PANW",
    "CRWD",
    "SNOW",
    "PLTR",
    "SHOP",
    "NOW",
    "ANET",
    "INTC",
    "ARM",
    "ASML",
    "TSM",
    "AMAT",
    "LRCX",
    "KLAC",
    "MRVL",
    "SNDK",
    "UBER",
    "ABNB",
    "MSTR",
    "COIN",
    "APP",
    "JPM",
    "GS",
    "MS",
    "BAC",
    "WFC",
    "BLK",
    "AXP",
    "CAT",
    "DE",
    "HON",
    "GE",
    "RTX",
    "LMT",
    "BA",
    "UNP",
    "UPS",
    "FDX",
    "WMT",
    "COST",
    "PG",
    "KO",
    "PEP",
    "MCD",
    "HD",
    "LOW",
    "NKE",
    "SBUX",
    "JNJ",
    "MRK",
    "ABBV",
    "PFE",
    "TMO",
    "ISRG",
    "DHR",
    "SYK",
    "CVX",
    "COP",
    "SLB",
    "EOG",
    "MPC",
    "VLO",
    "OXY",
    "DVN",
    "HAL",
}

MID_CAP_SYMBOLS = {
    "DDOG",
    "MDB",
    "ZS",
    "RBLX",
    "HIMS",
    "LITE",
    "RKLB",
    "ASTS",
    "LUNR",
    "TEM",
    "SOUN",
    "IONQ",
    "PL",
    "SMCI",
    "DELL",
    "HPE",
    "AI",
    "PATH",
    "VRT",
    "CEG",
    "OKLO",
    "NBIS",
    "GTLB",
    "ESTC",
    "NET",
    "HUBS",
    "TEAM",
    "DT",
    "TOST",
    "DUOL",
    "TTD",
    "SE",
    "MELI",
    "DASH",
    "ARQQ",
    "COHR",
    "MKSI",
    "MARA",
    "RIOT",
    "CLSK",
    "HUT",
    "HIVE",
    "BTBT",
    "IREN",
    "WULF",
    "CORZ",
    "CIFR",
    "CAN",
    "IRDM",
    "SATS",
    "GSAT",
    "SPCE",
    "BKSY",
    "VSAT",
    "TDY",
    "HEI",
    "GD",
    "HII",
    "LHX",
    "LDOS",
    "KTOS",
    "AVAV",
    "TXT",
    "TDG",
    "CW",
    "BWXT",
    "MRCY",
    "HWM",
    "SAIC",
    "CACI",
    "OSK",
    "AXON",
    "CRSP",
    "NTLA",
    "EDIT",
    "BEAM",
    "ALNY",
    "SRPT",
    "RARE",
    "TGTX",
    "EXEL",
    "VKTX",
    "NTRA",
    "DNA",
    "RXRX",
    "TMDX",
    "IOVA",
    "AXSM",
    "HALO",
    "IMVT",
    "LEGN",
    "ARGX",
    "PCVX",
    "INCY",
    "IONS",
    "TWST",
    "DNLI",
    "BBIO",
    "ACLX",
    "VIR",
    "NVAX",
    "APLS",
    "MDGL",
    "RVMD",
    "FOLD",
}

SMALL_CAP_SYMBOLS = {
    "RGTI",
    "QBTS",
    "QUBT",
    "BBAI",
    "SERV",
    "SPIR",
    "LOAR",
    "SMR",
    "NNE",
    "AEHR",
}

AI_SYMBOLS = {
    "NVDA",
    "AMD",
    "AVGO",
    "ARM",
    "MRVL",
    "MU",
    "TSM",
    "ASML",
    "AMAT",
    "LRCX",
    "KLAC",
    "ANET",
    "SMCI",
    "DELL",
    "HPE",
    "ORCL",
    "MSFT",
    "GOOGL",
    "META",
    "AMZN",
    "SNOW",
    "DDOG",
    "MDB",
    "PLTR",
    "AI",
    "SOUN",
    "APP",
    "PATH",
    "BBAI",
    "RXRX",
    "SERV",
    "TEM",
    "VRT",
    "CEG",
    "OKLO",
    "NBIS",
}

QUANTUM_SYMBOLS = {"RGTI", "QBTS", "QUBT", "IONQ", "ARQQ", "IBM", "LITE", "COHR", "MKSI"}
CRYPTO_SYMBOLS = {"MSTR", "COIN", "HOOD", "MARA", "RIOT", "CLSK", "HUT", "HIVE", "BTBT", "IREN", "WULF", "CORZ", "CIFR", "CAN", "IBIT", "BITB", "FBTC", "ARKB", "GBTC", "ETHA", "ETHE", "BITO", "BLOK", "BKCH", "BTC-USD", "ETH-USD"}
SEMICONDUCTOR_SYMBOLS = {"NVDA", "AMD", "AVGO", "QCOM", "MU", "INTC", "ARM", "ASML", "TSM", "AMAT", "LRCX", "KLAC", "MRVL", "SNDK", "SMCI", "COHR", "MKSI", "ON", "NXPI", "ACLS", "AEHR", "CAMT", "SITM", "LSCC", "MTSI", "POWI", "RMBS", "NVMI", "SYNA", "SMH", "SOXX"}
CLOUD_SYMBOLS = {"MSFT", "AMZN", "GOOGL", "ORCL", "CRM", "ADBE", "SNOW", "DDOG", "MDB", "NOW", "NET", "HUBS", "TEAM", "DT", "GTLB", "ESTC", "SHOP", "SE", "MELI", "DASH"}
CYBERSECURITY_SYMBOLS = {"PANW", "CRWD", "ZS", "NET", "TENB", "S"}
DEFENSE_SYMBOLS = {"LMT", "NOC", "RTX", "GD", "HII", "LHX", "LDOS", "KTOS", "AVAV", "TXT", "HEI", "TDG", "CW", "BWXT", "MRCY", "BA", "GE", "HWM", "TDY", "SAIC", "CACI", "OSK", "AXON", "PLTR", "LOAR"}
SPACE_SYMBOLS = {"RKLB", "ASTS", "LUNR", "PL", "SPIR", "IRDM", "SATS", "GSAT", "LMT", "NOC", "BA", "RTX", "SPCE", "BKSY", "VSAT", "TDY", "HEI"}
ENERGY_SYMBOLS = {"XOM", "CVX", "COP", "SLB", "EOG", "MPC", "VLO", "OXY", "DVN", "HAL", "CEG", "OKLO", "SMR", "NNE", "BE", "FLNC", "ARRY", "RUN", "FSLR", "ENPH", "USO", "XLE"}
BIOTECH_SYMBOLS = {"CRSP", "NTLA", "EDIT", "BEAM", "VRTX", "REGN", "MRNA", "BNTX", "GILD", "BIIB", "ALNY", "SRPT", "RARE", "TGTX", "EXEL", "VKTX", "NTRA", "DNA", "RXRX", "TEM", "TMDX", "IOVA", "AXSM", "HALO", "IMVT", "LEGN", "ARGX", "PCVX", "INCY", "IONS", "TWST", "DNLI", "BBIO", "ACLX", "VIR", "NVAX", "APLS", "MDGL", "RVMD", "FOLD", "JNJ", "LLY", "UNH", "MRK", "ABBV", "PFE", "TMO", "ISRG", "DHR", "SYK", "XLV"}
CONSUMER_SYMBOLS = {"AMZN", "TSLA", "NFLX", "UBER", "ABNB", "WMT", "COST", "PG", "KO", "PEP", "MCD", "HD", "LOW", "NKE", "SBUX", "SHOP", "RBLX", "DASH", "DUOL", "TOST", "CELH", "ELF", "CAVA", "ONON", "GM", "F", "DKNG", "PINS", "SNAP", "RDDT", "MELI"}
GROWTH_SYMBOLS = {"NVDA", "AMD", "TSLA", "SHOP", "NET", "DDOG", "CRWD", "ZS", "SNOW", "MDB", "UBER", "ABNB", "DASH", "RBLX", "DUOL", "TOST", "BILL", "AFRM", "UPST", "ROKU", "SE", "MELI", "HUBS", "TEAM", "TTD", "FROG", "APP", "HIMS", "CELH", "ELF", "CAVA", "ONON", "RIVN", "LCID", "DKNG", "PINS", "SNAP", "RDDT", "SOFI", "NU", "FOUR", "GLOB", "MNDY", "RGTI", "QBTS", "QUBT", "IONQ", "RKLB", "ASTS", "LUNR", "TEM", "SOUN", "SNDK", "PL"}
MOMENTUM_SYMBOLS = {"HIMS", "APP", "PL", "LITE", "SNDK", "RKLB", "ASTS", "LUNR", "TEM", "SOUN", "IONQ", "RGTI", "QBTS", "QUBT", "CELH", "ELF", "CAVA", "TMDX", "FSLR", "ENPH", "WOLF", "ACLS", "AEHR", "CAMT", "SITM", "ON", "NXPI", "MP", "ALB", "PYPL", "DOCN", "ESTC", "TENB", "S", "IOT", "SMR", "OKLO", "NNE", "BE", "FLNC", "ARRY", "RUN", "NXT", "BLDR", "FIX", "ONTO", "LSCC", "MTSI", "POWI", "RMBS", "NVMI", "SYNA", "COHR"}

SYMBOL_CATEGORY_SETS: tuple[tuple[UniverseCategory, set[str]], ...] = (
    ("Mega Cap", MEGA_CAP_SYMBOLS),
    ("Large Cap", LARGE_CAP_SYMBOLS),
    ("Mid Cap", MID_CAP_SYMBOLS),
    ("Small Cap", SMALL_CAP_SYMBOLS),
    ("AI", AI_SYMBOLS),
    ("Quantum", QUANTUM_SYMBOLS),
    ("Crypto", CRYPTO_SYMBOLS),
    ("Semiconductor", SEMICONDUCTOR_SYMBOLS),
    ("Cloud", CLOUD_SYMBOLS),
    ("Cybersecurity", CYBERSECURITY_SYMBOLS),
    ("Defense", DEFENSE_SYMBOLS),
    ("Space", SPACE_SYMBOLS),
    ("Energy", ENERGY_SYMBOLS),
    ("Biotech", BIOTECH_SYMBOLS),
    ("Consumer", CONSUMER_SYMBOLS),
    ("Growth", GROWTH_SYMBOLS),
    ("Momentum", MOMENTUM_SYMBOLS),
)

SOURCE_CATEGORY_DEFAULTS: dict[str, tuple[UniverseCategory, ...]] = {
    "required_opportunity": ("Growth", "Momentum"),
    "ai": ("AI", "Growth"),
    "quantum": ("Quantum", "Growth", "Momentum"),
    "crypto_proxies": ("Crypto", "Momentum"),
    "space": ("Space", "Growth", "Momentum"),
    "defense": ("Defense", "Large Cap"),
    "biotech": ("Biotech", "Growth"),
    "growth": ("Growth",),
    "momentum_midcap": ("Mid Cap", "Momentum"),
    "emerging_leaders": ("Growth", "Momentum"),
    "nasdaqtrader_nasdaq": ("Small Cap",),
    "nasdaqtrader_otherlisted": ("Mid Cap",),
}


@dataclass(frozen=True)
class SymbolClassification:
    symbol: str
    tier: UniverseTier
    source_category: str
    categories: tuple[UniverseCategory, ...]
    scan_priority: int
    scanner_frequency: ScannerFrequency
    classification_basis: str

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["categories"] = list(self.categories)
        return payload


@dataclass(frozen=True)
class SymbolHealth:
    symbol: str
    tier: UniverseTier
    categories: tuple[UniverseCategory, ...]
    scanner_frequency: ScannerFrequency
    provider_coverage: CoverageState
    liquidity_state: QualityState
    market_cap_state: QualityState
    data_quality_state: QualityState
    scan_quality_state: QualityState
    avg_dollar_volume: float | None
    market_cap: float | None
    data_quality_score: float | None
    final_score: float | None

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["categories"] = list(self.categories)
        return payload


def build_symbol_classifications(size: str = "1000") -> list[SymbolClassification]:
    target = _target_size(size)
    rows = load_expanded_universe_rows()[:target]
    return [classify_symbol(row["symbol"], row["source_category"]) for row in rows]


def classify_symbol(symbol: str, source_category: str) -> SymbolClassification:
    normalized = symbol.strip().upper()
    categories = _categories_for_symbol(normalized, source_category)
    tier = _tier_for_source(source_category)
    return SymbolClassification(
        symbol=normalized,
        tier=tier,
        source_category=source_category,
        categories=categories,
        scan_priority=_scan_priority_for_tier(tier),
        scanner_frequency=_scanner_frequency_for_tier(tier),
        classification_basis=_classification_basis(source_category, categories),
    )


def build_symbol_health_dashboard(
    classifications: Sequence[SymbolClassification],
    ranking_rows: Sequence[Mapping[str, object]],
) -> list[SymbolHealth]:
    ranking_by_symbol: dict[str, Mapping[str, object]] = {}
    for row in ranking_rows:
        symbol = _string_or_none(row.get("symbol"))
        if symbol is not None:
            ranking_by_symbol[symbol.upper()] = row

    dashboard: list[SymbolHealth] = []
    for classification in classifications:
        row = ranking_by_symbol.get(classification.symbol)
        provider_error = _string_or_none(row.get("provider_error")) if row is not None else None
        provider_coverage: CoverageState = "not_ranked_latest_scan"
        if row is not None and provider_error is None:
            provider_coverage = "active"
        elif row is not None and provider_error is not None:
            provider_coverage = "provider_error"

        avg_dollar_volume = _float_or_none(row.get("avg_dollar_volume")) if row is not None else None
        market_cap = _float_or_none(row.get("market_cap")) if row is not None else None
        data_quality_score = _float_or_none(row.get("data_quality_score")) if row is not None else None
        final_score = _float_or_none(row.get("final_score")) if row is not None else None
        dashboard.append(
            SymbolHealth(
                symbol=classification.symbol,
                tier=classification.tier,
                categories=classification.categories,
                scanner_frequency=classification.scanner_frequency,
                provider_coverage=provider_coverage,
                liquidity_state=_liquidity_state(avg_dollar_volume),
                market_cap_state=_market_cap_state(market_cap),
                data_quality_state=_score_state(data_quality_score, strong=90.0, acceptable=65.0),
                scan_quality_state="acceptable" if row is not None else "unknown",
                avg_dollar_volume=avg_dollar_volume,
                market_cap=market_cap,
                data_quality_score=data_quality_score,
                final_score=final_score,
            )
        )
    return dashboard


def tier_counts(classifications: Sequence[SymbolClassification]) -> dict[str, int]:
    return _count_values(item.tier for item in classifications)


def category_counts(classifications: Sequence[SymbolClassification]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for classification in classifications:
        for category in classification.categories:
            counts[category] = counts.get(category, 0) + 1
    category_rank = {category: index for index, category in enumerate(CATEGORY_ORDER)}
    return dict(sorted(counts.items(), key=lambda item: category_rank.get(item[0], len(category_rank))))


def health_state_counts(dashboard: Sequence[SymbolHealth]) -> dict[str, dict[str, int]]:
    return {
        "provider_coverage": _count_values(item.provider_coverage for item in dashboard),
        "liquidity_state": _count_values(item.liquidity_state for item in dashboard),
        "market_cap_state": _count_values(item.market_cap_state for item in dashboard),
        "data_quality_state": _count_values(item.data_quality_state for item in dashboard),
        "scan_quality_state": _count_values(item.scan_quality_state for item in dashboard),
    }


def validate_classification_completeness(classifications: Sequence[SymbolClassification]) -> list[str]:
    issues: list[str] = []
    seen: set[str] = set()
    allowed_categories = set(CATEGORY_ORDER)
    for classification in classifications:
        if classification.symbol in seen:
            issues.append(f"duplicate_symbol:{classification.symbol}")
        seen.add(classification.symbol)
        if not classification.categories:
            issues.append(f"missing_categories:{classification.symbol}")
        for category in classification.categories:
            if category not in allowed_categories:
                issues.append(f"unsupported_category:{classification.symbol}:{category}")
        if classification.tier not in {"Tier 1", "Tier 2", "Tier 3"}:
            issues.append(f"unsupported_tier:{classification.symbol}:{classification.tier}")
    return issues


def _categories_for_symbol(symbol: str, source_category: str) -> tuple[UniverseCategory, ...]:
    categories: set[UniverseCategory] = set(SOURCE_CATEGORY_DEFAULTS.get(source_category, ()))
    for category, symbols in SYMBOL_CATEGORY_SETS:
        if symbol in symbols:
            categories.add(category)
    if not categories:
        categories.add("Small Cap")
    return tuple(category for category in CATEGORY_ORDER if category in categories)


def _tier_for_source(source_category: str) -> UniverseTier:
    if source_category == "core":
        return "Tier 1"
    if source_category in {"nasdaqtrader_nasdaq", "nasdaqtrader_otherlisted"}:
        return "Tier 3"
    return "Tier 2"


def _scan_priority_for_tier(tier: UniverseTier) -> int:
    if tier == "Tier 1":
        return 100
    if tier == "Tier 2":
        return 70
    return 35


def _scanner_frequency_for_tier(tier: UniverseTier) -> ScannerFrequency:
    if tier == "Tier 1":
        return "every_scan"
    if tier == "Tier 2":
        return "regular"
    return "opportunistic"


def _classification_basis(source_category: str, categories: Sequence[UniverseCategory]) -> str:
    if source_category == "core":
        return "core scanner universe plus curated symbol category map"
    if source_category in {"nasdaqtrader_nasdaq", "nasdaqtrader_otherlisted"}:
        return "exchange-listed common stock filler; market-cap bucket remains provisional until provider health rows exist"
    return f"curated {source_category} opportunity bucket mapped to {', '.join(categories)}"


def _liquidity_state(avg_dollar_volume: float | None) -> QualityState:
    if avg_dollar_volume is None:
        return "unknown"
    if avg_dollar_volume >= 100_000_000:
        return "strong"
    if avg_dollar_volume >= 20_000_000:
        return "acceptable"
    return "limited"


def _market_cap_state(market_cap: float | None) -> QualityState:
    if market_cap is None:
        return "unknown"
    if market_cap >= 10_000_000_000:
        return "strong"
    if market_cap >= 1_000_000_000:
        return "acceptable"
    return "limited"


def _score_state(value: float | None, *, strong: float, acceptable: float) -> QualityState:
    if value is None:
        return "unknown"
    if value >= strong:
        return "strong"
    if value >= acceptable:
        return "acceptable"
    return "limited"


def _count_values(values: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def _target_size(size: str) -> int:
    normalized = size.strip().lower()
    if normalized == "core":
        return 111
    if normalized in {"500", "1000"}:
        return int(normalized)
    raise ValueError(f"Unsupported universe size: {size}")


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a", "na", "<na>"}:
        return None
    return text


def _float_or_none(value: object) -> float | None:
    text = _string_or_none(value)
    if text is None:
        return None
    try:
        parsed = float(text.replace("$", "").replace(",", "").replace("%", ""))
    except ValueError:
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed
