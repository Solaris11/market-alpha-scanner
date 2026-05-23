export type ScannerScalar = string | number | boolean | Record<string, unknown> | unknown[] | null | undefined;

export type RankingRow = {
  symbol: string;
  company_name?: string;
  asset_type?: string;
  sector?: string;
  price?: number;
  return_1d?: number;
  last_updated?: string;
  last_updated_utc?: string;
  base_score?: number;
  final_score?: number;
  final_score_adjusted?: number;
  macro_adjusted_score?: number;
  recommendation_quality?: string;
  quality_score?: number;
  quality_reason?: string;
  final_decision?: string;
  decision_reason?: string;
  suggested_entry?: string | number;
  entry_distance_pct?: number;
  correction_price?: number;
  correction_zone_low?: number;
  correction_zone_high?: number;
  correction_trigger_price?: number;
  correction_trigger_reason?: string;
  correction_distance_pct?: number;
  correction_confidence?: string;
  regime_adjustment?: number;
  market_regime?: string;
  rating?: string;
  action?: string;
  setup_type?: string;
  entry_zone?: string | number;
  entry_zone_low?: number;
  entry_zone_high?: number;
  invalidation_level?: string | number;
  buy_zone?: string | number;
  buy_zone_low?: number;
  buy_zone_high?: number;
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
  avwap?: number;
  recent_swing_low?: number;
  swing_low?: number;
  recent_resistance?: number;
  resistance?: number;
  atr?: number;
  fundamental_score?: number;
  macro_score?: number;
  macro_alignment_score?: number;
  macro_alignment_adjustment?: number;
  exchange_health_score?: number;
  exchange_context_adjustment?: number;
  sector_alignment_score?: number;
  sector_alignment_adjustment?: number;
  macro_pressure_score?: number;
  risk_on_score?: number;
  volatility_pressure?: number;
  volatility_pressure_adjustment?: number;
  liquidity_pressure?: number;
  liquidity_pressure_adjustment?: number;
  macro_conflict_penalty?: number;
  macro_context_adjustment_total?: number;
  macro_context_label?: string;
  macro_context_summary?: string;
  exchange_context_label?: string;
  sector_context_label?: string;
  event_context_available?: boolean;
  event_context_label?: string;
  event_context_summary?: string;
  event_confidence?: number;
  event_conviction_adjustment?: number;
  event_decay?: number;
  event_fragility_adjustment?: number;
  event_impact_scope?: string;
  event_macro_pressure_adjustment?: number;
  event_risk_score?: number;
  event_shock_pressure_score?: number;
  event_source_weight?: number;
  analog_quality_score?: number;
  confidence_reliability?: number;
  evidence_maturity?: string;
  evidence_sample_size?: number;
  event_similarity_score?: number;
  forward_return_coverage?: number;
  forward_return_sample_size?: number;
  historical_depth_days?: number;
  historical_sample_size?: number;
  market_memory_sample_size?: number;
  outcome_coverage?: number;
  regime_similarity_score?: number;
  score_reliability?: number;
  signal_history_days?: number;
  macro_event_regime_signature?: string;
  verified_event_feed_disclosure?: string;
  verified_event_feed_status?: string;
  verified_event_pressure_score?: number;
  verified_event_signature?: string;
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
