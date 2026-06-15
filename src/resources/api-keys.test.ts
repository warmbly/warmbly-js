import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { NotFoundError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { ApiKeys } from "./api-keys";

// Builds an HttpClient whose fetch is a vi.fn returning a single canned JSON response.
function clientWith(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...init.headers },
      }),
  );
  const http = new HttpClient(
    resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
  );
  return { http, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

describe("ApiKeys", () => {
  it("lists keys as a paginated page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "k1", name: "ci" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new ApiKeys(http).list({ limit: 10 });
    expect(page.data[0]?.id).toBe("k1");
    expect(lastCall(fetchMock).url).toContain("/api-keys?limit=10");
  });

  it("creates a key and exposes the one-time secret", async () => {
    const { http, fetchMock } = clientWith({ id: "k1", name: "ci", secret: "wmbly_secret" });
    const created = await new ApiKeys(http).create({ name: "ci", permissions: 7 });
    expect(created.secret).toBe("wmbly_secret");
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/api-keys");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ name: "ci", permissions: 7 });
  });

  it("fetches the permissions catalog", async () => {
    const { http, fetchMock } = clientWith({
      permissions: [{ name: "READ_EMAILS", value: 1, description: "", category: "read" }],
      presets: { read_only: 1, full_access: 2 },
    });
    const catalog = await new ApiKeys(http).permissions();
    expect(catalog.presets.read_only).toBe(1);
    expect(lastCall(fetchMock).url).toContain("/api-keys/permissions");
  });

  it("sends the revoke reason as a query param", async () => {
    const { http, fetchMock } = clientWith({ id: "k1", status: "revoked" });
    await new ApiKeys(http).revoke("k 1", "leaked");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    // Path segment is encoded and reason is passed through.
    expect(url).toContain("/api-keys/k%201?reason=leaked");
  });

  it("requests logs with the id path and returns a page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ method: "GET" }],
      pagination: { total: null, next_cursor: null, has_more: false },
    });
    const page = await new ApiKeys(http).logs("k1", { limit: 200 });
    expect(page.data).toHaveLength(1);
    expect(lastCall(fetchMock).url).toContain("/api-keys/k1/logs?limit=200");
  });

  it("maps a 404 to NotFoundError", async () => {
    const { http } = clientWith(
      { error: "Not Found", message: "missing", code: "not_found" },
      { status: 404 },
    );
    await expect(new ApiKeys(http).get("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
