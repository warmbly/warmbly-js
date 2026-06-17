import { VERSION } from "../version";
import { HEADER } from "./constants";
import { WarmblyAPIError, WarmblyConnectionError } from "./errors";
import {
  buildQuery,
  encodeForm,
  fullJitterBackoff,
  generateIdempotencyKey,
  getRuntimeLabel,
  joinUrl,
  sleep,
} from "./fetch";
import { Page } from "./pagination";
import type {
  ApiErrorBody,
  FetchLike,
  HttpMethod,
  ListResponse,
  RequestOptions,
  ResolvedClientOptions,
} from "./types";

/** Statuses that are safe to retry; transient on the server or rate limited. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** The result of a successful request: the decoded body plus low-level details. */
export interface HttpResponse<T> {
  data: T;
  response: Response;
  requestId: string | undefined;
}

/**
 * The single component that talks to the REST API. It handles auth, headers, JSON/form
 * encoding, timeouts, idempotency keys, error mapping, and retries with backoff. Every
 * resource is built on top of this.
 */
export class HttpClient {
  readonly options: ResolvedClientOptions;
  private readonly fetchImpl: FetchLike;
  private readonly userAgent: string;

  constructor(options: ResolvedClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetch;
    this.userAgent = `warmbly-js/${VERSION} (${getRuntimeLabel()})`;
  }

  /** Performs a request, returning the decoded body and response metadata. */
  async request<T>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const url = joinUrl(this.options.baseUrl, path) + buildQuery(opts.query);
    const maxRetries = opts.maxRetries ?? this.options.maxRetries;
    const timeout = opts.timeout ?? this.options.timeout;
    const { body, contentType } = this.encodeBody(opts);

    // Generate an idempotency key so retried mutations cannot double-execute.
    const isMutation = method !== "GET";
    let idempotencyKey = opts.idempotencyKey;
    if (isMutation && maxRetries > 0 && idempotencyKey === undefined) {
      idempotencyKey = generateIdempotencyKey();
    }

    let attempt = 0;
    // Retry loop. Each pass re-resolves the token so rotating credentials are picked up.
    for (;;) {
      // A signal already aborted before dispatch never fires its "abort" event, so check up front.
      if (opts.signal?.aborted) {
        throw new WarmblyConnectionError("Request was aborted by the caller.", {
          cause: opts.signal.reason,
        });
      }
      const headers = await this.buildHeaders(opts, idempotencyKey, contentType);

      let timedOut = false;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
      const onAbort = () => controller.abort();
      opts.signal?.addEventListener("abort", onAbort, { once: true });

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
      } catch (cause) {
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onAbort);
        if (opts.signal?.aborted) {
          throw new WarmblyConnectionError("Request was aborted by the caller.", { cause });
        }
        const message = timedOut
          ? `Request timed out after ${timeout}ms.`
          : "Network request to Warmbly failed.";
        if (attempt < maxRetries) {
          await sleep(fullJitterBackoff(attempt));
          attempt += 1;
          continue;
        }
        throw new WarmblyConnectionError(message, { cause });
      }
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);

      const requestId = response.headers.get(HEADER.requestId) ?? undefined;

      if (response.ok) {
        const data = await parseBody<T>(response);
        return { data, response, requestId };
      }

      if (attempt < maxRetries && RETRYABLE_STATUS.has(response.status)) {
        const retryAfter = parseRetryAfter(response.headers.get(HEADER.retryAfter));
        const delayMs = retryAfter !== undefined ? retryAfter * 1000 : fullJitterBackoff(attempt);
        await cancelBody(response);
        await sleep(delayMs);
        attempt += 1;
        continue;
      }

      const errorBody = await parseBody<ApiErrorBody>(response).catch(() => undefined);
      throw WarmblyAPIError.from(response.status, errorBody, response.headers, requestId);
    }
  }

  /** GET request returning the decoded body. */
  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return (await this.request<T>("GET", path, opts)).data;
  }

  /** POST request returning the decoded body. */
  async post<T>(path: string, opts?: RequestOptions): Promise<T> {
    return (await this.request<T>("POST", path, opts)).data;
  }

  /** PUT request returning the decoded body. */
  async put<T>(path: string, opts?: RequestOptions): Promise<T> {
    return (await this.request<T>("PUT", path, opts)).data;
  }

  /** PATCH request returning the decoded body. */
  async patch<T>(path: string, opts?: RequestOptions): Promise<T> {
    return (await this.request<T>("PATCH", path, opts)).data;
  }

  /** DELETE request returning the decoded body. */
  async delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return (await this.request<T>("DELETE", path, opts)).data;
  }

  /**
   * Performs a list request and wraps the `data`/`pagination` envelope in a {@link Page}
   * that auto-fetches subsequent pages when iterated.
   */
  async getPage<T>(path: string, opts: RequestOptions = {}): Promise<Page<T>> {
    const response = await this.get<ListResponse<T>>(path, opts);
    const fetchNext = (cursor: string): Promise<Page<T>> =>
      this.getPage<T>(path, { ...opts, query: { ...opts.query, cursor } });
    return new Page<T>(response, fetchNext);
  }

  private async buildHeaders(
    opts: RequestOptions,
    idempotencyKey: string | undefined,
    contentType: string | undefined,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      [HEADER.accept]: "application/json",
      [HEADER.userAgent]: this.userAgent,
      ...this.options.defaultHeaders,
      ...opts.headers,
    };
    if (contentType && !hasHeader(headers, HEADER.contentType)) {
      headers[HEADER.contentType] = contentType;
    }
    const token = await this.options.getToken();
    if (token) headers[HEADER.authorization] = `Bearer ${token}`;
    if (idempotencyKey) headers[HEADER.idempotencyKey] = idempotencyKey;
    return headers;
  }

  private encodeBody(opts: RequestOptions): {
    body: string | FormData | undefined;
    contentType: string | undefined;
  } {
    if (opts.body === undefined || opts.body === null) {
      return { body: undefined, contentType: undefined };
    }
    // Multipart uploads: pass FormData straight through so the runtime sets the
    // multipart/form-data Content-Type with its boundary. Never JSON-encode it.
    if (typeof FormData !== "undefined" && opts.body instanceof FormData) {
      return { body: opts.body, contentType: undefined };
    }
    if (opts.form === true) {
      return {
        body: encodeForm(opts.body as Record<string, unknown>),
        contentType: "application/x-www-form-urlencoded",
      };
    }
    if (typeof opts.body === "string") {
      return { body: opts.body, contentType: undefined };
    }
    return { body: JSON.stringify(opts.body), contentType: "application/json" };
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

/** Parses a `Retry-After` header value (delta-seconds or HTTP-date) into seconds. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return Math.max(0, asNumber);
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) return Math.max(0, Math.round((asDate - Date.now()) / 1000));
  return undefined;
}

/** Decodes a response body as JSON when applicable, falling back to text or `undefined`. */
async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || looksLikeJson(text)) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
  return text as unknown as T;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/** Drains a response body we are about to discard before retrying, ignoring errors. */
async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // ignore: the body may already be locked or unsupported
  }
}
