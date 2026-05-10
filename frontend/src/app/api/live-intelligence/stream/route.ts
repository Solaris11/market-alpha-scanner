import { requirePremium } from "@/lib/server/access-control";
import { loadLiveIntelligenceSystem } from "@/lib/server/live-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requirePremium();
  if (!access.ok) return access.response;

  const refreshIntervalMs = refreshIntervalFromRequest(request);
  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let sequence = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      async function send(): Promise<void> {
        if (closed) return;
        try {
          sequence += 1;
          const system = await loadLiveIntelligenceSystem({ refreshIntervalMs, sequence, streamMode: "sse" });
          controller.enqueue(encoder.encode(`event: live-intelligence\ndata: ${JSON.stringify(system)}\n\n`));
        } catch {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(`event: live-error\ndata: ${JSON.stringify({ message: "Live intelligence is temporarily unavailable." })}\n\n`));
            } catch {
              closed = true;
            }
          }
        }
      }

      await send();
      timer = setInterval(() => {
        void send();
      }, refreshIntervalMs);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Connection may already be closed by the client.
        }
      }, { once: true });
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

function refreshIntervalFromRequest(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("intervalMs") ?? process.env.TRADEVETO_LIVE_STREAM_INTERVAL_MS;
  const parsed = raw ? Number(raw) : 30_000;
  if (!Number.isFinite(parsed)) return 30_000;
  return Math.max(10_000, Math.min(120_000, Math.trunc(parsed)));
}
