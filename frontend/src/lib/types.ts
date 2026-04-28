export type ScannerScalar = string | number | boolean | null | undefined;

export type RankingRow = {
  symbol: string;
  company_name?: string;
  asset_type?: string;
  sector?: string;
  price?: number;
  return_1d?: number;
  final_score?: number;
  final_score_adjusted?: number;
  recommendation_quality?: string;
  quality_score?: number;
  quality_reason?: string;
  final_decision?: string;
  decision_reason?: string;
  suggested_entry?: string | number;
  entry_distance_pct?: number;
  regime_adjustment?: number;
  market_regime?: string;
  rating?: string;
  action?: string;
  setup_type?: string;
  entry_zone?: string | number;
  invalidation_level?: string | number;
  buy_zone?: string | number;
  stop_loss?: string | number;
  take_profit_zone?: string | number;
  buy_zone_reason?: string;
  stop_loss_reason?: string;
  take_profit_reason?: string;
  risk_reward_reason?: string;
  take_profit_low?: number;
  take_profit_high?: number;
  conservative_target?: string | number;
  balanced_target?: string | number;
  aggressive_target?: string | number;
  conservative_target_reason?: string;
  balanced_target_reason?: string;
  aggressive_target_reason?: string;
  risk_reward?: number;
  risk_reward_low?: number;
  risk_reward_high?: number;
  risk_reward_label?: string;
  conservative_risk_reward?: number;
  balanced_risk_reward_low?: number;
  balanced_risk_reward_high?: number;
  aggressive_risk_reward_low?: number;
  aggressive_risk_reward_high?: number;
  target_risk_reward_label?: string;
  trade_quality?: string;
  trade_quality_note?: string;
  target_warning?: string;
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
  lifecycle: CsvFileData;
  lifecycleSummary: CsvFileData;
  autoCalibration: CsvFileData;
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
