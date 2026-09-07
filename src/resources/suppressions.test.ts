import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Suppressions } from "./suppressions";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json" },
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

describe("Suppressions", () => {
  it("list GETs /suppressions and returns a Page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "s1", email: "dana@acme.com", kind: "email" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Suppressions(http).list({ q: "acme", limit: 25 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/suppressions");
    expect(url).toContain("q=acme");
    expect(url).toContain("limit=25");
    expect(page.data[0]?.kind).toBe("email");
  });

  it("add POSTs entries and reason to /suppressions", async () => {
    const { http, fetchMock } = clientWith({ added: 2, skipped: ["nope"] });
    const out = await new Suppressions(http).add({
      entries: [{ value: "dana@acme.com" }, { value: "competitor.io", reason: "Competitor" }],
      reason: "Existing customers",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/suppressions$/);
    expect(JSON.parse(String(init.body))).toEqual({
      entries: [{ value: "dana@acme.com" }, { value: "competitor.io", reason: "Competitor" }],
      reason: "Existing customers",
    });
    expect(out.added).toBe(2);
    expect(out.skipped).toEqual(["nope"]);
  });

  it("remove DELETEs /suppressions/:id", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 200 });
    await new Suppressions(http).remove("s1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/suppressions/s1");
  });
});
