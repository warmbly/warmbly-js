import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "./config";
import { AuthenticationError, WarmblyConnectionError } from "./errors";
import { HttpClient } from "./http";
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
});
