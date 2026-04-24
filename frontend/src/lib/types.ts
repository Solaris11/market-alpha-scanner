export type ScannerScalar = string | number | boolean | null | undefined;

export type RankingRow = {
  symbol: string;
  company_name?: string;
  asset_type?: string;
  sector?: string;
  price?: number;
  final_score?: number;
  rating?: string;
  action?: string;
  setup_type?: string;
  entry_zone?: string | number;
  invalidation_level?: string | number;
  upside_driver?: string;
  key_risk?: string;
  selection_reason?: string;
  technical_score?: number;
  fundamental_score?: number;
  macro_score?: number;
  news_score?: number;
  risk_penalty?: number;
  [key: string]: ScannerScalar;
};

export type SymbolDetail = {
  row: RankingRow | null;
  summary: Record<string, unknown> | null;
  history: Record<string, ScannerScalar>[];
};

export type CsvRow = Record<string, ScannerScalar>;

export type CsvFileState = "missing" | "header-only" | "data";

export type CsvFileData = {
  rows: CsvRow[];
  state: CsvFileState;
  columns: string[];
  lineCount: number;
};

export type HistorySnapshot = {
  name: string;
  modifiedAt: string;
  timestamp: string | null;
};

export type HistorySummary = {
  snapshots: HistorySnapshot[];
  count: number;
  earliest: string | null;
  latest: string | null;
  uniqueDates: string[];
};

export type PerformanceData = {
  summary: CsvFileData;
  forwardReturns: CsvFileData;
};

export type SymbolHistoryRow = RankingRow & {
  timestamp_utc: string;
  source_file: string;
};

export type SymbolHistoryData = {
  symbols: string[];
  rows: SymbolHistoryRow[];
};

export type IntradayDriftRow = {
  symbol: string;
  company_name?: string;
  first_price?: number;
  latest_price?: number;
  price_change?: number;
  price_change_pct?: number;
  first_score?: number;
  latest_score?: number;
  score_change?: number;
  first_rating?: string;
  latest_rating?: string;
  first_action?: string;
  latest_action?: string;
  setup_type?: string;
  snapshot_count: number;
};
