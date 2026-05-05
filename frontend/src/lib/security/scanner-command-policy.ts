export const FAST_SCAN_SYMBOLS = ["AVGO", "TSM", "NVDA", "IBIT", "AMD", "BTC-USD", "GLD", "MSFT", "ASML", "ANET", "SPY", "QQQ", "OXY"] as const;

export type ScannerCommandStatus = "already_running" | "completed" | "failed" | "unavailable";

export function scannerCommandStatusFromOutput(stdout: string, stderr: string): ScannerCommandStatus | null {
  const output = `${stdout}\n${stderr}`.toLowerCase();
  if (output.includes("another run in progress") || output.includes("already running") || output.includes("run in progress")) {
    return "already_running";
  }
  return null;
}

export function fastScanSymbolArg(): string {
  return FAST_SCAN_SYMBOLS.join(",");
}
