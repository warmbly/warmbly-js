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
  it("lists keys as a paginated Page with query params", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "k1", name: "ci" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new ApiKeys(http).list({ limit: 10, cursor: "c0" });
    expect(page.data[0]?.id).toBe("k1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys");
    expect(url).toContain("limit=10");
    expect(url).toContain("cursor=c0");
  });

  it("lists keys without params", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    const page = await new ApiKeys(http).list();
    expect(page.data).toEqual([]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys");
  });

  it("creates a key, sends the body including the numeric permissions, and exposes the one-time secret", async () => {
    const { http, fetchMock } = clientWith({ id: "k1", name: "ci", secret: "wmbly_secret" });
    const created = await new ApiKeys(http).create({
      name: "ci",
      description: "build robot",
      permissions: 7,
      allowed_email_accounts: ["bot@warmbly.com"],
      rate_limit_per_minute: 60,
    });
    expect(created.secret).toBe("wmbly_secret");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/api-keys");
    const parsed = JSON.parse(String(init.body));
    expect(parsed).toEqual({
      name: "ci",
      description: "build robot",
      permissions: 7,
      allowed_email_accounts: ["bot@warmbly.com"],
      rate_limit_per_minute: 60,
    });
    expect(typeof parsed.permissions).toBe("number");
  });

  it("fetches the permissions catalog", async () => {
    const { http, fetchMock } = clientWith({
      permissions: [
        { name: "READ_EMAILS", value: 1, description: "read emails", category: "read" },
      ],
      presets: { read_only: 1, full_access: 2 },
    });
    const catalog = await new ApiKeys(http).permissions();
    expect(catalog.presets.read_only).toBe(1);
    expect(catalog.permissions[0]?.value).toBe(1);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/permissions");
  });

  it("gets a key by id", async () => {
    const { http, fetchMock } = clientWith({ id: "k1", name: "ci" });
    const key = await new ApiKeys(http).get("k1");
    expect(key.id).toBe("k1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/k1");
  });

  it("updates a key with PATCH and the JSON body", async () => {
    const { http, fetchMock } = clientWith({ id: "k1", rate_limit_per_minute: 120 });
    const key = await new ApiKeys(http).update("k1", {
      rate_limit_per_minute: 120,
      permissions: 3,
    });
    expect(key.id).toBe("k1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/api-keys/k1");
    expect(JSON.parse(String(init.body))).toEqual({ rate_limit_per_minute: 120, permissions: 3 });
  });

  it("revokes a key with a reason in the query and returns the status acknowledgement", async () => {
    const { http, fetchMock } = clientWith({ status: "revoked" });
    const result = await new ApiKeys(http).revoke("k 1", "leaked in a public repo");
    expect(result.status).toBe("revoked");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    // Path segment is encoded and reason is passed through the query string.
    expect(url).toContain("/api-keys/k%201");
    expect(url).toContain("reason=leaked");
  });

  it("revokes a key without a reason and omits the reason query param", async () => {
    const { http, fetchMock } = clientWith({ status: "revoked" });
    const result = await new ApiKeys(http).revoke("k1");
    expect(result.status).toBe("revoked");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/api-keys/k1");
    expect(url).not.toContain("reason=");
  });

  it("returns the aggregate usage summary", async () => {
    const { http, fetchMock } = clientWith({ total_requests: 42 });
    const summary = await new ApiKeys(http).usageSummary();
    expect(summary.total_requests).toBe(42);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/usage/summary");
  });

  it("returns time-series usage analytics with query params", async () => {
    const { http, fetchMock } = clientWith({ series: [] });
    const usage = await new ApiKeys(http).usageAnalytics({ interval: "day", from: "2026-01-01" });
    expect(usage.series).toEqual([]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/usage/analytics");
    expect(url).toContain("interval=day");
    expect(url).toContain("from=2026-01-01");
  });

  it("returns usage analytics across all keys without params", async () => {
    const { http, fetchMock } = clientWith({ series: [] });
    await new ApiKeys(http).usageAnalytics();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/usage/analytics");
  });

  it("returns analytics for a single key under the nested path with query params", async () => {
    const { http, fetchMock } = clientWith({ requests: 5 });
    const stats = await new ApiKeys(http).keyAnalytics("k1", { interval: "hour" });
    expect(stats.requests).toBe(5);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/k1/analytics");
    expect(url).toContain("interval=hour");
  });

  it("returns single key analytics without params", async () => {
    const { http, fetchMock } = clientWith({ requests: 0 });
    await new ApiKeys(http).keyAnalytics("k1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/k1/analytics");
  });

  it("requests logs with the id path and returns a Page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ method: "GET" }],
      pagination: { total: null, next_cursor: null, has_more: false },
    });
    const page = await new ApiKeys(http).logs("k1", { limit: 200 });
    expect(page.data).toHaveLength(1);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/k1/logs");
    expect(url).toContain("limit=200");
  });

  it("requests logs without params", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    const page = await new ApiKeys(http).logs("k1");
    expect(page.data).toEqual([]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/api-keys/k1/logs");
  });

  it("maps a 404 to NotFoundError", async () => {
    const { http } = clientWith(
      { error: "Not Found", message: "missing", code: "not_found" },
      { status: 404 },
    );
    await expect(new ApiKeys(http).get("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
