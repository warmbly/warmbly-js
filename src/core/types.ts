/** Any JSON-serializable value. */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** A JSON object. */
export type JsonObject = { [key: string]: Json };

/** HTTP methods used by the REST client. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * The shape of the platform `fetch`. Injecting a custom implementation lets the SDK
 * run in environments without a global `fetch`, or route requests through a proxy.
 */
export type FetchLike = typeof fetch;

/** Resolves the bearer token to send on a request. Returning `undefined` sends no auth. */
export type TokenResolver = () => string | undefined | Promise<string | undefined>;

/** Options accepted by the top-level Warmbly client. */
export interface ClientOptions {
  /** A Warmbly API key (`wmbly_...`). Sent as a bearer token. */
  apiKey?: string;
  /** An OAuth access token (`wmat_...`). Sent as a bearer token, identical to an API key. */
  accessToken?: string;
  /**
   * A dynamic token provider, resolved before every request. Use this to feed
   * auto-refreshing OAuth tokens to the client. Takes precedence over `apiKey`/`accessToken`.
   */
  getToken?: TokenResolver;
  /** REST API base URL. Defaults to `https://api.warmbly.com/v1`. */
  baseUrl?: string;
  /** Dashboard base URL used to build OAuth authorize URLs. Defaults to `https://app.warmbly.com`. */
  appBaseUrl?: string;
  /** Realtime gateway base URL. Defaults to `wss://realtime.warmbly.com`. */
  gatewayUrl?: string;
  /** Default organization id, used as the gateway channel and for convenience. */
  organizationId?: string;
  /** Custom `fetch` implementation. Defaults to the platform global. */
  fetch?: FetchLike;
  /** Per-request timeout in milliseconds. Defaults to 60000. */
  timeout?: number;
  /** Max automatic retries on transient failures (429/5xx/network). Defaults to 2. */
  maxRetries?: number;
  /** Extra headers sent on every request. */
  defaultHeaders?: Record<string, string>;
}

/** Fully resolved client options with all defaults applied. */
export interface ResolvedClientOptions {
  baseUrl: string;
  appBaseUrl: string;
  gatewayUrl: string;
  organizationId?: string;
  fetch: FetchLike;
  timeout: number;
  maxRetries: number;
  defaultHeaders: Record<string, string>;
  getToken: () => Promise<string | undefined>;
}

/** Per-request overrides for a single REST call. */
export interface RequestOptions {
  /** Query string parameters. `undefined`/`null` values are omitted. */
  query?: Record<string, unknown>;
  /** Request body. Serialized as JSON unless `form` is set. */
  body?: unknown;
  /** Extra headers for this request. */
  headers?: Record<string, string>;
  /** Idempotency key for safe retries of a mutation. Auto-generated for retried mutations if omitted. */
  idempotencyKey?: string;
  /** Caller-provided abort signal. */
  signal?: AbortSignal;
  /** Override the client timeout (ms) for this request. */
  timeout?: number;
  /** Override the client retry count for this request. */
  maxRetries?: number;
  /** Encode the body as `application/x-www-form-urlencoded` (used by OAuth endpoints). */
  form?: boolean;
}

/** Cursor pagination metadata returned by every list endpoint. */
export interface PaginationMeta {
  /** Total number of matching records, or `null` when not computed. */
  total: number | null;
  /** Opaque cursor for the next page, or `null` on the last page. */
  next_cursor: string | null;
  /** Whether another page is available. */
  has_more: boolean;
}

/** The `data` + `pagination` envelope returned by list endpoints. */
export interface ListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** The standard Warmbly REST error body. */
export interface ApiErrorBody {
  /** Short status text, e.g. `"Bad Request"`. */
  error?: string;
  /** Human-readable description. */
  message?: string;
  /** Stable machine-readable code, e.g. `"rate_limit_exceeded"`. */
  code?: string;
  /** Request id for support and tracing. */
  request_id?: string;
  /** Seconds to wait before retrying, present on rate-limit errors. */
  retry_after?: number;
  [key: string]: unknown;
}
