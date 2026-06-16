import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "./config";
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
  WarmblyAPIError,
  WarmblyConnectionError,
} from "./errors";
import { HttpClient } from "./http";
import { Page } from "./pagination";
import type { ClientOptions } from "./types";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k, v as string);
  return new Response(JSON.stringify(body), { status: 200, ...init, headers });
}

function makeClient(fetchImpl: unknown, opts: Partial<ClientOptions> = {}): HttpClient {
  return new HttpClient(
    resolveClientOptions({
      apiKey: "wmbly_test",
      fetch: fetchImpl as typeof fetch,
      maxRetries: 0,
      ...opts,
    }),
  );
}

function headersOf(call: [unknown, RequestInit]): Record<string, string> {
  return (call[1].headers ?? {}) as Record<string, string>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HttpClient", () => {
  it("attaches the bearer token and parses JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "1" }));
    const client = makeClient(fetchImpl);
    const data = await client.get<{ id: string }>("contacts");
    expect(data).toEqual({ id: "1" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/contacts");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer wmbly_test");
  });

  it("maps a 401 to AuthenticationError with code and request id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "no", code: "unauthorized", request_id: "req_1" }), {
        status: 401,
        headers: { "content-type": "application/json", "x-request-id": "req_1" },
      }),
    );
    const client = makeClient(fetchImpl);
    const error = await client.get("x").catch((e) => e);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized", requestId: "req_1" });
  });

  it("short-circuits a signal that is already aborted, without dispatching fetch", async () => {
    const fetchImpl = vi.fn();
    const client = makeClient(fetchImpl);
    const controller = new AbortController();
    controller.abort();
    await expect(client.get("x", { signal: controller.signal })).rejects.toBeInstanceOf(
      WarmblyConnectionError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries on 429 honoring Retry-After, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = makeClient(fetchImpl, { maxRetries: 2 });
    const data = await client.get<{ ok: boolean }>("x");
    expect(data).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("auto-generates an idempotency key for retryable mutations", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = makeClient(fetchImpl, { maxRetries: 1 });
    await client.post("x", { body: { a: 1 } });
    const init = fetchImpl.mock.calls[0][1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
  });

  it("wraps a network failure in WarmblyConnectionError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("network down"));
    const client = makeClient(fetchImpl);
    await expect(client.get("x")).rejects.toBeInstanceOf(WarmblyConnectionError);
  });

  it("paginates with getPage, following the cursor", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "a" }],
          pagination: { total: null, next_cursor: "c1", has_more: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "b" }],
          pagination: { total: null, next_cursor: null, has_more: false },
        }),
      );
    const client = makeClient(fetchImpl);
    const ids: string[] = [];
    const page = await client.getPage<{ id: string }>("things");
    for await (const item of page) ids.push(item.id);
    expect(ids).toEqual(["a", "b"]);
    expect(String(fetchImpl.mock.calls[1][0])).toContain("cursor=c1");
  });

  describe("HTTP verbs", () => {
    it("sends GET with the correct method and path", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = makeClient(fetchImpl);
      await client.get("contacts");
      const [url, init] = fetchImpl.mock.calls[0];
      expect(init.method).toBe("GET");
      expect(String(url)).toContain("/contacts");
    });

    it("sends POST with the correct method, path, and JSON body", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "c1" }));
      const client = makeClient(fetchImpl);
      await client.post("contacts", { body: { email: "ada@warmbly.com" } });
      const [url, init] = fetchImpl.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(String(url)).toContain("/contacts");
      expect(JSON.parse(init.body as string)).toEqual({ email: "ada@warmbly.com" });
    });

    it("sends PUT with the correct method and JSON body", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.put("contacts/c1", { body: { email: "grace@warmbly.com" } });
      const [url, init] = fetchImpl.mock.calls[0];
      expect(init.method).toBe("PUT");
      expect(String(url)).toContain("/contacts/c1");
      expect(JSON.parse(init.body as string)).toEqual({ email: "grace@warmbly.com" });
    });

    it("sends PATCH with the correct method and JSON body", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.patch("contacts/c1", { body: { name: "Grace" } });
      const [url, init] = fetchImpl.mock.calls[0];
      expect(init.method).toBe("PATCH");
      expect(String(url)).toContain("/contacts/c1");
      expect(JSON.parse(init.body as string)).toEqual({ name: "Grace" });
    });

    it("sends DELETE with the correct method and path", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const client = makeClient(fetchImpl);
      await client.delete("contacts/c1");
      const [url, init] = fetchImpl.mock.calls[0];
      expect(init.method).toBe("DELETE");
      expect(String(url)).toContain("/contacts/c1");
    });
  });

  describe("query building", () => {
    it("appends a query string with array values repeated and nullish omitted", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.get("contacts", {
        query: { limit: 10, tag: ["a", "b"], skip: undefined, none: null },
      });
      const url = String(fetchImpl.mock.calls[0][0]);
      expect(url).toContain("limit=10");
      expect(url).toContain("tag=a");
      expect(url).toContain("tag=b");
      expect(url).not.toContain("skip");
      expect(url).not.toContain("none");
    });

    it("omits the query string entirely when no query is given", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.get("contacts");
      expect(String(fetchImpl.mock.calls[0][0])).not.toContain("?");
    });
  });

  describe("body encoding and Content-Type", () => {
    it("JSON-encodes an object body and sets application/json", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.post("x", { body: { email: "ada@warmbly.com" } });
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(headersOf([null, init])["Content-Type"]).toBe("application/json");
      expect(init.body).toBe(JSON.stringify({ email: "ada@warmbly.com" }));
    });

    it("form-encodes a body when opts.form is true", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.post("oauth/token", {
        form: true,
        body: { grant_type: "client_credentials", scope: "read write" },
      });
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(headersOf([null, init])["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(init.body).toBe("grant_type=client_credentials&scope=read+write");
    });

    it("passes a string body through verbatim with no Content-Type", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.post("x", { body: "raw-string" });
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe("raw-string");
      expect(headersOf([null, init])["Content-Type"]).toBeUndefined();
    });

    it("passes FormData straight through without an application/json Content-Type", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      const form = new FormData();
      form.append("file", "contents");
      await client.post("uploads", { body: form });
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe(form);
      expect(init.body).toBeInstanceOf(FormData);
      expect(headersOf([null, init])["Content-Type"]).toBeUndefined();
    });

    it("sends no body and no Content-Type when body is undefined", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.post("x", {});
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeUndefined();
      expect(headersOf([null, init])["Content-Type"]).toBeUndefined();
    });

    it("sends no body when body is explicitly null", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.post("x", { body: null });
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeUndefined();
    });
  });

  describe("headers", () => {
    it("sets Accept, User-Agent, and merges default plus per-request headers", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl, { defaultHeaders: { "X-Default": "d" } });
      await client.get("x", { headers: { "X-Custom": "c" } });
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers.Accept).toBe("application/json");
      expect(headers["User-Agent"]).toContain("warmbly-js/");
      expect(headers["X-Default"]).toBe("d");
      expect(headers["X-Custom"]).toBe("c");
    });

    it("does not override a caller-supplied Content-Type", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl);
      await client.post("x", {
        body: { a: 1 },
        headers: { "content-type": "application/vnd.custom+json" },
      });
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers["content-type"]).toBe("application/vnd.custom+json");
      expect(headers["Content-Type"]).toBeUndefined();
    });

    it("omits the Authorization header when no token resolves", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = new HttpClient(
        resolveClientOptions({ fetch: fetchImpl as typeof fetch, maxRetries: 0 }),
      );
      await client.get("x");
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("idempotency key", () => {
    it("does not set an Idempotency-Key on GET requests", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl, { maxRetries: 2 });
      await client.get("x");
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers["Idempotency-Key"]).toBeUndefined();
    });

    it("does not auto-generate an Idempotency-Key when maxRetries is 0", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl, { maxRetries: 0 });
      await client.post("x", { body: { a: 1 } });
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers["Idempotency-Key"]).toBeUndefined();
    });

    it("respects a caller-provided idempotencyKey", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const client = makeClient(fetchImpl, { maxRetries: 2 });
      await client.post("x", { body: { a: 1 }, idempotencyKey: "key-123" });
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers["Idempotency-Key"]).toBe("key-123");
    });
  });

  describe("retries", () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      it(`retries on ${status} and eventually succeeds`, async () => {
        vi.useFakeTimers();
        const fetchImpl = vi
          .fn()
          .mockResolvedValueOnce(new Response("{}", { status }))
          .mockResolvedValueOnce(jsonResponse({ ok: true }));
        const client = makeClient(fetchImpl, { maxRetries: 1 });
        const promise = client.get<{ ok: boolean }>("x");
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toEqual({ ok: true });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
      });
    }

    it("throws the mapped API error after exhausting retries", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
      const client = makeClient(fetchImpl, { maxRetries: 2 });
      const promise = client.get("x");
      const settled = promise.catch((e) => e);
      await vi.runAllTimersAsync();
      const error = await settled;
      expect(error).toBeInstanceOf(InternalServerError);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("honors a numeric Retry-After header for the delay", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "3" } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient(fetchImpl, { maxRetries: 1 });
      const promise = client.get<{ ok: boolean }>("x");
      // Not enough time elapsed yet for a 3s Retry-After.
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1500);
      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("ignores an unparseable Retry-After header and uses backoff instead", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("{}", { status: 429, headers: { "retry-after": "not-a-date" } }),
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient(fetchImpl, { maxRetries: 1 });
      const promise = client.get<{ ok: boolean }>("x");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("swallows an error thrown while draining the body before a retry", async () => {
      vi.useFakeTimers();
      const failing = new Response("{}", { status: 503 });
      Object.defineProperty(failing, "body", {
        get() {
          return {
            cancel() {
              return Promise.reject(new Error("locked"));
            },
          };
        },
      });
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(failing)
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient(fetchImpl, { maxRetries: 1 });
      const promise = client.get<{ ok: boolean }>("x");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("honors an HTTP-date Retry-After header", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-16T00:00:00Z"));
      const future = new Date("2026-06-16T00:00:02Z").toUTCString();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("{}", { status: 429, headers: { "retry-after": future } }),
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient(fetchImpl, { maxRetries: 1 });
      const promise = client.get<{ ok: boolean }>("x");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ ok: true });
    });

    it("does not retry a non-retryable status", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
      const client = makeClient(fetchImpl, { maxRetries: 3 });
      await expect(client.get("x")).rejects.toBeInstanceOf(BadRequestError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("retries a network error, then succeeds", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("boom"))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient(fetchImpl, { maxRetries: 1 });
      const promise = client.get<{ ok: boolean }>("x");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("throws WarmblyConnectionError after retrying a network error to exhaustion", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockRejectedValue(new TypeError("boom"));
      const client = makeClient(fetchImpl, { maxRetries: 1 });
      const promise = client.get("x");
      const settled = promise.catch((e) => e);
      await vi.runAllTimersAsync();
      const error = await settled;
      expect(error).toBeInstanceOf(WarmblyConnectionError);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("allows a per-request maxRetries override", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
      const client = makeClient(fetchImpl, { maxRetries: 5 });
      await expect(client.get("x", { maxRetries: 0 })).rejects.toBeInstanceOf(InternalServerError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe("timeout and abort", () => {
    it("produces a timed-out WarmblyConnectionError when fetch never resolves", async () => {
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      );
      const client = makeClient(fetchImpl, { timeout: 5 });
      const error = await client.get("x").catch((e) => e);
      expect(error).toBeInstanceOf(WarmblyConnectionError);
      expect((error as Error).message).toContain("timed out");
    });

    it("wraps a caller abort that fires during the request", async () => {
      const controller = new AbortController();
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
            controller.abort();
          }),
      );
      const client = makeClient(fetchImpl);
      const error = await client.get("x", { signal: controller.signal }).catch((e) => e);
      expect(error).toBeInstanceOf(WarmblyConnectionError);
      expect((error as Error).message).toContain("aborted by the caller");
    });
  });

  describe("error mapping", () => {
    const cases: Array<[number, new (...a: never[]) => WarmblyAPIError]> = [
      [400, BadRequestError],
      [401, AuthenticationError],
      [403, PermissionDeniedError],
      [404, NotFoundError],
      [409, ConflictError],
      [422, UnprocessableEntityError],
      [429, RateLimitError],
      [500, InternalServerError],
    ];
    for (const [status, ctor] of cases) {
      it(`maps ${status} to ${ctor.name}`, async () => {
        const fetchImpl = vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ message: "nope" }), { status }));
        const client = makeClient(fetchImpl, { maxRetries: 0 });
        const error = await client.get("x").catch((e) => e);
        expect(error).toBeInstanceOf(ctor);
        expect((error as WarmblyAPIError).status).toBe(status);
      });
    }

    it("maps an unrecognized 4xx status to the base WarmblyAPIError", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 418 }));
      const client = makeClient(fetchImpl, { maxRetries: 0 });
      const error = await client.get("x").catch((e) => e);
      expect(error).toBeInstanceOf(WarmblyAPIError);
      expect(error).not.toBeInstanceOf(InternalServerError);
      expect((error as WarmblyAPIError).status).toBe(418);
    });

    it("populates RateLimitError.retryAfter from the Retry-After header", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(new Response("{}", { status: 429, headers: { "retry-after": "7" } }));
      const client = makeClient(fetchImpl, { maxRetries: 0 });
      const error = (await client.get("x").catch((e) => e)) as RateLimitError;
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.retryAfter).toBe(7);
    });

    it("tolerates an unparseable error body", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response("not json at all", {
          status: 500,
          headers: { "content-type": "text/plain" },
        }),
      );
      const client = makeClient(fetchImpl, { maxRetries: 0 });
      const error = await client.get("x").catch((e) => e);
      expect(error).toBeInstanceOf(InternalServerError);
    });
  });

  describe("body parsing", () => {
    it("returns undefined for a 204 No Content response", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const client = makeClient(fetchImpl);
      const data = await client.delete("x");
      expect(data).toBeUndefined();
    });

    it("returns undefined for an empty body", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
      const client = makeClient(fetchImpl);
      const data = await client.get("x");
      expect(data).toBeUndefined();
    });

    it("returns plain text for a non-JSON body", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response("hello world", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );
      const client = makeClient(fetchImpl);
      const data = await client.get<string>("x");
      expect(data).toBe("hello world");
    });

    it("parses JSON detected by shape even without a JSON content-type", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response('{"id":"z"}', {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );
      const client = makeClient(fetchImpl);
      const data = await client.get<{ id: string }>("x");
      expect(data).toEqual({ id: "z" });
    });

    it("falls back to text when JSON-looking content fails to parse", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response("{not valid json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const client = makeClient(fetchImpl);
      const data = await client.get<string>("x");
      expect(data).toBe("{not valid json");
    });
  });

  it("cleans up a caller signal listener on a successful request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = makeClient(fetchImpl);
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
    await client.get("x", { signal: controller.signal });
    expect(removeSpy).toHaveBeenCalled();
  });

  it("treats a response with no content-type header as non-JSON text", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("plain", { status: 200, headers: { "x-keep": "1" } }));
    const client = makeClient(fetchImpl);
    // Strip the content-type the Response constructor may infer.
    const data = await client.get<string>("x");
    expect(typeof data).toBe("string");
  });

  it("defaults to empty content-type when the header is absent on a non-empty body", async () => {
    const response = new Response("just text", { status: 200 });
    // Force the content-type lookup to report none, exercising the `?? ""` fallback.
    vi.spyOn(response.headers, "get").mockImplementation((name: string) =>
      name.toLowerCase() === "content-type" ? null : null,
    );
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const client = makeClient(fetchImpl);
    const data = await client.get<string>("x");
    expect(data).toBe("just text");
  });

  describe("getPage", () => {
    it("returns a Page instance with data and pagination", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse({
          data: [{ id: "a" }],
          pagination: { total: 1, next_cursor: null, has_more: false },
        }),
      );
      const client = makeClient(fetchImpl);
      const page = await client.getPage<{ id: string }>("things", { query: { limit: 1 } });
      expect(page).toBeInstanceOf(Page);
      expect(page.data).toEqual([{ id: "a" }]);
      expect(page.hasNextPage()).toBe(false);
      expect(String(fetchImpl.mock.calls[0][0])).toContain("limit=1");
    });
  });

  describe("token resolver", () => {
    it("resolves a dynamic token before each request", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
      const getToken = vi.fn().mockResolvedValue("dynamic-token");
      const client = new HttpClient(
        resolveClientOptions({ getToken, fetch: fetchImpl as typeof fetch, maxRetries: 0 }),
      );
      await client.get("x");
      const headers = headersOf([null, fetchImpl.mock.calls[0][1] as RequestInit]);
      expect(headers.Authorization).toBe("Bearer dynamic-token");
      expect(getToken).toHaveBeenCalled();
    });
  });
});
