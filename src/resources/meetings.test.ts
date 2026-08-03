import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Meetings } from "./meetings";

function clientWith(body: unknown): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
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

describe("Meetings", () => {
  it("list() returns a Page and forwards the timeframe and search", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "mtg_1", invitee_email: "jordan@acme.com", status: "booked" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Meetings(http).list({ timeframe: "upcoming", q: "acme" });
    expect(page.data.map((m) => m.id)).toEqual(["mtg_1"]);

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/meetings");
    expect(url).toContain("timeframe=upcoming");
    expect(url).toContain("q=acme");
  });

  it("summary() GETs meetings/summary", async () => {
    const { http, fetchMock } = clientWith({ upcoming: 3, past: 12 });
    const summary = await new Meetings(http).summary();
    expect(summary).toEqual({ upcoming: 3, past: 12 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/meetings/summary");
  });

  it("create() POSTs a manually logged meeting", async () => {
    const { http, fetchMock } = clientWith({ id: "mtg_2", source: "manual" });
    const meeting = await new Meetings(http).create({
      invitee_email: "jordan@acme.com",
      scheduled_for: "2026-08-10T15:00:00Z",
      duration_minutes: 30,
    });
    expect(meeting.source).toBe("manual");

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/meetings");
    expect(JSON.parse(String(init.body))).toEqual({
      invitee_email: "jordan@acme.com",
      scheduled_for: "2026-08-10T15:00:00Z",
      duration_minutes: 30,
    });
  });

  it("delete() DELETEs meetings/:id", async () => {
    const { http, fetchMock } = clientWith({ deleted: true });
    await expect(new Meetings(http).delete("mtg_1")).resolves.toEqual({ deleted: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/meetings/mtg_1");
  });
});
