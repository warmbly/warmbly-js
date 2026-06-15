/**
 * Custom transport and the request() escape hatch.
 * Injects a logging/proxy `fetch` wrapper and default headers, tunes the base
 * URL / timeout / retry budget, and calls an unmodeled endpoint directly with
 * the low-level `warmbly.request()` escape hatch.
 *
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/custom-fetch.ts
 */
import { Warmbly } from "warmbly";

// ---------------------------------------------------------------------------
// A custom fetch wrapper.
// `fetch` is injectable so you can log every call, route through a proxy, add
// instrumentation, or run in an environment without a global fetch. The wrapper
// must match the platform `fetch` signature; here it logs timing then delegates
// to the global fetch (swap in a proxy agent or your own transport as needed).
// ---------------------------------------------------------------------------
const loggingFetch: typeof fetch = async (input, init) => {
  const method = init?.method ?? "GET";
  // `input` may be a string, URL, or Request; normalize for logging only.
  const url = typeof input === "string" ? input : input.toString();
  const startedAt = Date.now();
  console.log(`-> ${method} ${url}`);

  // Delegate to the real fetch. Replace this line to route through a proxy.
  const response = await fetch(input, init);

  console.log(`<- ${response.status} ${method} ${url} (${Date.now() - startedAt}ms)`);
  return response;
};

// ---------------------------------------------------------------------------
// Build a client with the custom transport, default headers, and tuned limits.
// defaultHeaders are merged into every request. baseUrl/timeout/maxRetries
// override the SDK defaults (https://api.warmbly.com/v1, 60000ms, 2 retries).
// ---------------------------------------------------------------------------
const warmbly = new Warmbly({
  apiKey: process.env.WARMBLY_API_KEY,
  fetch: loggingFetch, // every request now flows through our wrapper
  defaultHeaders: { "X-App": "examples-custom-fetch" }, // sent on every request
  baseUrl: process.env.WARMBLY_BASE_URL ?? "https://api.warmbly.com/v1",
  timeout: 15_000, // 15s per-request timeout
  maxRetries: 3, // retry transient failures up to 3 times
});

// A normal typed call now logs both sides through loggingFetch.
const campaigns = await warmbly.campaigns.list({ limit: 10 });
console.log("first page size:", campaigns.data.length);

// ---------------------------------------------------------------------------
// The request() escape hatch.
// Any endpoint not yet modeled as a typed method is reachable with a single
// call. You pass the method and path (relative to baseUrl) plus optional query,
// body, headers, and per-request overrides. It returns the decoded body in
// `data`, the raw Response, and the request id for tracing/support.
// ---------------------------------------------------------------------------
const { data, requestId } = await warmbly.request<{ timezones: string[] }>("GET", "/timezones");
console.log("timezones (request id", requestId, "):", data.timezones);

// The escape hatch accepts the same per-request options as typed methods, for
// example a query string and an idempotency key on a write.
const search = await warmbly.request<{ data: unknown[] }>("POST", "/contacts/search", {
  body: { query: "acme.com", limit: 25 },
  headers: { "X-Trace": "custom-fetch-example" },
});
console.log("search returned", search.data.data.length, "contacts");
