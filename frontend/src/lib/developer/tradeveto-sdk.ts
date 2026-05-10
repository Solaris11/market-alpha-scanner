export type TradeVetoSdkConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type TradeVetoPortfolioPositionInput = {
  allocationPct?: number;
  costBasis?: number;
  quantity?: number;
  symbol: string;
};

export type TradeVetoPortfolioScenarioInput = {
  accountValue?: number;
  positions: TradeVetoPortfolioPositionInput[];
};

export type TradeVetoReplayInput = {
  symbol: string;
  timestamp?: string;
};

export type TradeVetoFeedOptions = {
  limit?: number;
};

export type TradeVetoApiPayload = Record<string, unknown>;

export class TradeVetoApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(status: number, body: unknown) {
    super(`TradeVeto API request failed with HTTP ${status}.`);
    this.name = "TradeVetoApiError";
    this.body = body;
    this.status = status;
  }
}

export class TradeVetoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: TradeVetoSdkConfig) {
    const apiKey = config.apiKey.trim();
    if (!apiKey) throw new Error("TradeVeto API key is required.");
    this.apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? "https://tradeveto.com");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async opportunities(options: TradeVetoFeedOptions = {}): Promise<TradeVetoApiPayload> {
    return this.request("/api/v1/opportunities", { query: limitQuery(options.limit) });
  }

  async macro(): Promise<TradeVetoApiPayload> {
    return this.request("/api/v1/macro");
  }

  async shocks(options: TradeVetoFeedOptions = {}): Promise<TradeVetoApiPayload> {
    return this.request("/api/v1/shocks", { query: limitQuery(options.limit) });
  }

  async replay(input: TradeVetoReplayInput): Promise<TradeVetoApiPayload> {
    const query: Record<string, string> = { symbol: input.symbol };
    if (input.timestamp) query.timestamp = input.timestamp;
    return this.request("/api/v1/replay", { query });
  }

  async portfolioScenario(input: TradeVetoPortfolioScenarioInput): Promise<TradeVetoApiPayload> {
    return this.request("/api/v1/portfolio/scenario", {
      body: input,
      method: "POST",
    });
  }

  private async request(path: string, options: { body?: unknown; method?: "GET" | "POST"; query?: Record<string, string> } = {}): Promise<TradeVetoApiPayload> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value) url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url.toString(), {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      method: options.method ?? "GET",
    });
    const payload = await parseJson(response);
    if (!response.ok) throw new TradeVetoApiError(response.status, payload);
    return objectPayload(payload);
  }
}

function limitQuery(limit: number | undefined): Record<string, string> {
  if (!Number.isFinite(limit)) return {};
  const normalized = Math.trunc(Number(limit));
  return normalized > 0 ? { limit: String(normalized) } : {};
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text };
  }
}

function objectPayload(value: unknown): TradeVetoApiPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as TradeVetoApiPayload) : { data: value };
}
