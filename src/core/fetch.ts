import { WarmblyError } from "./errors";
import type { FetchLike } from "./types";

/**
 * Resolves the `fetch` implementation to use: the injected one, otherwise the platform
 * global. Throws a helpful error when neither is available.
 */
export function resolveFetch(injected?: FetchLike): FetchLike {
  if (injected) return injected;
  const platform = globalThis.fetch;
  if (typeof platform === "function") return platform.bind(globalThis);
  throw new WarmblyError(
    "No global `fetch` was found. Use Node 18+, Bun, Deno, or a browser, or pass a `fetch` implementation in the client options.",
  );
}

/** Joins a base URL and a path, leaving absolute URLs untouched. */
export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  // Trim slashes with index math; a /\/+$/-style regex is a polynomial-ReDoS risk on long input.
  let end = base.length;
  while (end > 0 && base.charCodeAt(end - 1) === 47) end -= 1;
  let start = 0;
  while (start < path.length && path.charCodeAt(start) === 47) start += 1;
  return `${base.slice(0, end)}/${path.slice(start)}`;
}

/** Serializes a query object into a `?a=1&b=2` string, repeating array values and skipping nullish ones. */
export function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const encodedKey = encodeURIComponent(key);
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        parts.push(`${encodedKey}=${encodeURIComponent(String(item))}`);
      }
    } else {
      parts.push(`${encodedKey}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** Encodes a record as `application/x-www-form-urlencoded`. */
export function encodeForm(record: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

/** Resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Full-jitter exponential backoff: a random delay in `[0, min(cap, base * 2^attempt))`.
 * Spreading retries with jitter avoids synchronized retry storms.
 */
export function fullJitterBackoff(attempt: number, baseMs = 500, capMs = 8_000): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.random() * ceiling;
}

/** A short label identifying the current runtime, used in the User-Agent header. */
export function getRuntimeLabel(): string {
  const g = globalThis as Record<string, unknown> & {
    Bun?: { version?: string };
    Deno?: { version?: { deno?: string } };
    process?: { versions?: { node?: string } };
    EdgeRuntime?: unknown;
    document?: unknown;
  };
  if (g.Bun?.version) return `bun/${g.Bun.version}`;
  if (g.Deno?.version?.deno) return `deno/${g.Deno.version.deno}`;
  if (g.process?.versions?.node) return `node/${g.process.versions.node}`;
  if (g.EdgeRuntime !== undefined) return "edge";
  if (g.document !== undefined) return "browser";
  return "unknown";
}

/** Generates a unique idempotency key, preferring `crypto.randomUUID`. */
export function generateIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `idem_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
