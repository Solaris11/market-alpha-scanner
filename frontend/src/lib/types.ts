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
