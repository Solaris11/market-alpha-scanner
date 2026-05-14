"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type { DeveloperApiKeyRecord, DeveloperApiUsageSummary, DeveloperWebhookDelivery, DeveloperWebhookEndpoint } from "@/lib/server/developer-platform";
import type { DeveloperApiScope, DeveloperWebhookEventType } from "@/lib/security/developer-platform";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type DeveloperPlatformCatalog = {
  apiScopes: DeveloperApiScope[];
  apiVersion?: string;
  deprecationPolicy?: string;
  endpoints?: Array<{
    description: string;
    method: "GET" | "POST";
    path: string;
    requiredScope: DeveloperApiScope;
  }>;
  quotaPolicy?: {
    apiKeyPerMinute: number;
    ipPerMinute: number;
  };
  sdkExamples: {
    curl: string;
    javascript: string;
    typescript: string;
  };
  webhookPolicy?: {
    retryDelaysMs: number[];
    timeoutMs: number;
  };
  webhookEvents: DeveloperWebhookEventType[];
};

type ApiKeyResponse = {
  apiKey?: DeveloperApiKeyRecord;
  apiKeys?: DeveloperApiKeyRecord[];
  key?: string;
  message?: string;
  ok?: boolean;
};

type WebhookResponse = {
  deliveries?: DeveloperWebhookDelivery[];
  delivery?: DeveloperWebhookDelivery;
  message?: string;
  ok?: boolean;
  signingSecret?: string;
  webhook?: DeveloperWebhookEndpoint;
  webhooks?: DeveloperWebhookEndpoint[];
};

export function DeveloperPlatformWorkspace({
  apiKeys: initialApiKeys,
  catalog,
  deliveries: initialDeliveries,
  usage,
  webhooks: initialWebhooks,
}: {
  apiKeys: DeveloperApiKeyRecord[];
  catalog: DeveloperPlatformCatalog;
  deliveries: DeveloperWebhookDelivery[];
  usage: DeveloperApiUsageSummary[];
  webhooks: DeveloperWebhookEndpoint[];
}) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [apiKeyName, setApiKeyName] = useState("Production integration");
  const [apiScopes, setApiScopes] = useState<DeveloperApiScope[]>(["read:opportunities", "read:macro", "read:shocks"]);
  const [webhookName, setWebhookName] = useState("Slack or Discord bridge");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<DeveloperWebhookEventType[]>(["opportunity.created", "shock.detected"]);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [oneTimeKey, setOneTimeKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createApiKey() {
    setPending(true);
    setStatus(null);
    setOneTimeKey(null);
    try {
      const response = await csrfFetch("/api/developer/api-keys", {
        body: JSON.stringify({ name: apiKeyName, scopes: apiScopes }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ApiKeyResponse | null;
      if (!response.ok || !payload?.apiKey || !payload.key) throw new Error(payload?.message ?? "Failed to create API key.");
      setApiKeys((items) => [payload.apiKey!, ...items]);
      setOneTimeKey(payload.key);
      setStatus(payload.message ?? "API key created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create API key.");
    } finally {
      setPending(false);
    }
  }

  async function revokeApiKey(id: string) {
    setPending(true);
    try {
      const response = await csrfFetch(`/api/developer/api-keys/${encodeURIComponent(id)}/revoke`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as ApiKeyResponse | null;
      if (!response.ok || !payload?.apiKey) throw new Error(payload?.message ?? "Failed to revoke API key.");
      setApiKeys((items) => items.map((item) => (item.id === id ? payload.apiKey! : item)));
      setStatus(payload.message ?? "API key revoked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to revoke API key.");
    } finally {
      setPending(false);
    }
  }

  async function createWebhook() {
    setPending(true);
    setStatus(null);
    setOneTimeSecret(null);
    try {
      const response = await csrfFetch("/api/developer/webhooks", {
        body: JSON.stringify({ eventTypes: webhookEvents, name: webhookName, url: webhookUrl }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as WebhookResponse | null;
      if (!response.ok || !payload?.webhook || !payload.signingSecret) throw new Error(payload?.message ?? "Failed to create webhook.");
      setWebhooks((items) => [payload.webhook!, ...items]);
      setOneTimeSecret(payload.signingSecret);
      setStatus(payload.message ?? "Webhook endpoint created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create webhook.");
    } finally {
      setPending(false);
    }
  }

  async function testWebhook(id: string) {
    setPending(true);
    try {
      const response = await csrfFetch(`/api/developer/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as WebhookResponse | null;
      if (!response.ok || !payload?.delivery) throw new Error(payload?.message ?? "Webhook test failed.");
      setDeliveries((items) => [payload.delivery!, ...items]);
      setStatus(payload.message ?? "Webhook test completed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Webhook test failed.");
    } finally {
      setPending(false);
    }
  }

  async function deactivateWebhook(id: string) {
    setPending(true);
    try {
      const response = await csrfFetch(`/api/developer/webhooks/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as WebhookResponse | null;
      if (!response.ok || !payload?.webhook) throw new Error(payload?.message ?? "Failed to deactivate webhook.");
      setWebhooks((items) => items.map((item) => (item.id === id ? payload.webhook! : item)));
      setStatus(payload.message ?? "Webhook deactivated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to deactivate webhook.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassPanel className="p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Developer Platform</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">API, Webhooks, and Integration Feeds</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          Build external dashboards, Slack or Discord bots, and custom workflows from scoped TradeVeto intelligence feeds. API outputs stay research-only and exclude broker execution.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <HeaderMetric label="API Keys" value={String(apiKeys.length)} />
          <HeaderMetric label="Webhooks" value={String(webhooks.filter((item) => item.active).length)} />
          <HeaderMetric label="Requests 7D" value={String(totalUsage(usage))} />
        </div>
      </GlassPanel>

      {oneTimeKey ? <SecretPanel title="Copy API key now" value={oneTimeKey} /> : null}
      {oneTimeSecret ? <SecretPanel title="Copy webhook signing secret now" value={oneTimeSecret} /> : null}
      {status ? <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">{status}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="API Access" title="Scoped API Keys" meta="hashed at rest" />
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setApiKeyName(event.target.value)} value={apiKeyName} />
            <ScopePicker<DeveloperApiScope> options={catalog.apiScopes} selected={apiScopes} setSelected={setApiScopes} />
            <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !apiKeyName.trim()} onClick={() => void createApiKey()} type="button">
              Create API Key
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {apiKeys.length ? apiKeys.map((key) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={key.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-50">{key.name}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{key.keyPrefix}</div>
                  </div>
                  <button className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50" disabled={pending || Boolean(key.revokedAt)} onClick={() => void revokeApiKey(key.id)} type="button">
                    {key.revokedAt ? "Revoked" : "Revoke"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{key.scopes.map((scope) => <Chip key={scope}>{scope}</Chip>)}</div>
                <div className="mt-3 text-xs text-slate-500">Last used: {key.lastUsedAt ? shortDate(key.lastUsedAt) : "Never"}</div>
              </div>
            )) : <EmptyState text="No API keys yet." />}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Feeds" title="External Endpoints" meta="Bearer API key" />
          <div className="mt-4 space-y-3">
            {(catalog.endpoints ?? []).map((endpoint) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={endpoint.path}>
                <div className="text-sm font-bold text-slate-100">{endpoint.description}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{endpoint.method} {endpoint.path}</div>
                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-200/80">{endpoint.requiredScope}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
            <div className="font-black uppercase tracking-[0.16em] text-slate-300">Version {catalog.apiVersion ?? "v1"}</div>
            <p className="mt-2">{catalog.deprecationPolicy ?? "Breaking changes use a new version path."}</p>
            <p className="mt-2">Quota: {catalog.quotaPolicy?.apiKeyPerMinute ?? 600} requests/minute per key and {catalog.quotaPolicy?.ipPerMinute ?? 120} requests/minute per IP.</p>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">{catalog.sdkExamples.curl}</pre>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">{catalog.sdkExamples.typescript}</pre>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Webhooks" title="Alert Delivery Endpoints" meta="signed payloads" />
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setWebhookName(event.target.value)} value={webhookName} />
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/tradeveto-webhook" value={webhookUrl} />
            <ScopePicker<DeveloperWebhookEventType> options={catalog.webhookEvents} selected={webhookEvents} setSelected={setWebhookEvents} />
            <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !webhookUrl.trim()} onClick={() => void createWebhook()} type="button">
              Create Webhook
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {webhooks.length ? webhooks.map((webhook) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={webhook.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-50">{webhook.name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{webhook.url}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50" disabled={pending || !webhook.active} onClick={() => void testWebhook(webhook.id)} type="button">Test</button>
                    <button className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50" disabled={pending || !webhook.active} onClick={() => void deactivateWebhook(webhook.id)} type="button">{webhook.active ? "Disable" : "Disabled"}</button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{webhook.eventTypes.map((eventType) => <Chip key={eventType}>{eventType}</Chip>)}</div>
                <div className="mt-3 text-xs text-slate-500">Deliveries {webhook.deliveryCount} · failures {webhook.failureCount} · last {webhook.lastDeliveryStatus ?? "none"}</div>
              </div>
            )) : <EmptyState text="No webhook endpoints yet." />}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Deliveries" title="Recent Webhook Activity" meta={`${deliveries.length} records`} />
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
            Timeout {catalog.webhookPolicy?.timeoutMs ?? 8000}ms. Retries use bounded backoff: {(catalog.webhookPolicy?.retryDelaysMs ?? [0, 750, 2000]).join("ms, ")}ms.
          </div>
          <div className="mt-4 space-y-2">
            {deliveries.length ? deliveries.slice(0, 12).map((delivery) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={delivery.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-100">{delivery.eventType}</div>
                  <span className={`text-xs font-black uppercase tracking-[0.14em] ${delivery.status === "delivered" ? "text-emerald-300" : "text-amber-300"}`}>{delivery.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {delivery.httpStatus ?? "no status"} · attempts {delivery.attemptCount} · {delivery.durationMs ?? 0}ms · {shortDate(delivery.createdAt)}
                </div>
              </div>
            )) : <EmptyState text="No webhook deliveries yet." />}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Usage" title="API Usage Summary" meta="last 7 days" />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {usage.length ? usage.slice(0, 10).map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={`${item.apiKeyId}-${item.endpoint}-${item.method}-${item.statusBucket}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-slate-400">{item.method} {item.endpoint}</div>
                  <div className="mt-2 text-sm font-black text-slate-50">{item.requestCount} requests</div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-100">{item.statusBucket}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">Last status {item.lastStatus ?? "unknown"} · {shortDate(item.lastUsedAt)}</div>
            </div>
          )) : <EmptyState text="No API usage recorded yet." />}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Trust Boundary" title="Developer Platform Limits" meta="research only" />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {[
            "API outputs are scoped, authenticated, and rate-limit ready; they do not expose broker execution.",
            "Webhook payloads are signed with TradeVeto signatures so receivers can verify origin.",
            "Feeds are market intelligence research context, not financial advice or prediction claims.",
          ].map((item) => <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-400" key={item}>{item}</div>)}
        </div>
      </GlassPanel>
    </div>
  );
}

function ScopePicker<T extends string>({ options, selected, setSelected }: { options: T[]; selected: T[]; setSelected: (next: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const enabled = selected.includes(option);
        return (
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${enabled ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400"}`}
            key={option}
            onClick={() => setSelected(enabled ? selected.filter((item) => item !== option) : [...selected, option])}
            type="button"
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-black text-slate-50">{value}</div>
    </div>
  );
}

function SecretPanel({ title, value }: { title: string; value: string }) {
  return (
    <GlassPanel className="border-amber-300/20 bg-amber-400/[0.035] p-5">
      <div className="text-sm font-black text-amber-100">{title}</div>
      <pre className="mt-3 overflow-x-auto rounded-2xl border border-amber-300/15 bg-slate-950/70 p-4 text-xs text-amber-50">{value}</pre>
      <p className="mt-2 text-xs leading-5 text-amber-100/70">This value is shown once. Store it in your secret manager.</p>
    </GlassPanel>
  );
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[11px] font-bold text-cyan-100">{children}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">{text}</p>;
}

function totalUsage(rows: DeveloperApiUsageSummary[]): number {
  return rows.reduce((total, row) => total + row.requestCount, 0);
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
