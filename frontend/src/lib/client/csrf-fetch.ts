"use client";

type CsrfResponse = {
  csrfToken?: string;
  ok?: boolean;
};

let cachedToken: string | null = null;
let pendingToken: Promise<string> | null = null;

export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-csrf-token", await csrfToken());
  return fetch(input, {
    ...init,
    cache: init.cache ?? "no-store",
    headers,
  });
}

export function clearCsrfToken(): void {
  cachedToken = null;
  pendingToken = null;
}

async function csrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (!pendingToken) {
    pendingToken = fetch("/api/auth/csrf", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as CsrfResponse | null;
        if (!response.ok || !payload?.csrfToken) {
          throw new Error("Security token unavailable.");
        }
        cachedToken = payload.csrfToken;
        return payload.csrfToken;
      })
      .finally(() => {
        pendingToken = null;
      });
  }
  return pendingToken;
}
