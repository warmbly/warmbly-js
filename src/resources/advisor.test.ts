import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Advisor } from "./advisor";

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

describe("Advisor", () => {
  it("recommendations() unwraps the data envelope and forwards filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "rec_1", severity: "critical", title: "SPF is missing" }],
    });
    const findings = await new Advisor(http).recommendations({
      surface: "emails",
      status: "open",
      limit: 10,
    });
    expect(findings.map((f) => f.id)).toEqual(["rec_1"]);

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/advisor/recommendations");
    expect(url).toContain("surface=emails");
    expect(url).toContain("status=open");
    expect(url).toContain("limit=10");
  });

  it("recommendations() returns an empty array when the envelope has no data", async () => {
    const { http } = clientWith({});
    await expect(new Advisor(http).recommendations()).resolves.toEqual([]);
  });

  it("summary() GETs advisor/summary", async () => {
    const { http, fetchMock } = clientWith({ score: 82, total: 4, critical: 1 });
    const summary = await new Advisor(http).summary();
    expect(summary.score).toBe(82);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/advisor/summary");
  });

  it("settings() GETs advisor/settings", async () => {
    const { http, fetchMock } = clientWith({ enabled: true });
    await new Advisor(http).settings();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/advisor/settings");
  });

  it("refresh() POSTs advisor/refresh and returns the fresh summary", async () => {
    const { http, fetchMock } = clientWith({ score: 90 });
    const summary = await new Advisor(http).refresh();
    expect(summary.score).toBe(90);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/advisor/refresh");
  });

  it("apply() POSTs the apply path and returns the updated finding", async () => {
    const { http, fetchMock } = clientWith({ id: "rec_1", status: "applied" });
    const finding = await new Advisor(http).apply("rec_1");
    expect(finding.status).toBe("applied");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/advisor/recommendations/rec_1/apply");
  });

  it("undo() POSTs the undo path", async () => {
    const { http, fetchMock } = clientWith({ id: "rec_1", status: "open" });
    await new Advisor(http).undo("rec_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/advisor/recommendations/rec_1/undo");
  });

  it("snooze() POSTs the day count", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Advisor(http).snooze("rec_1", { days: 7 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/advisor/recommendations/rec_1/snooze");
    expect(JSON.parse(String(init.body))).toEqual({ days: 7 });
  });

  it("dismiss() POSTs the dismiss path with an optional reason", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Advisor(http).dismiss("rec_1", { reason: "intentional" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/advisor/recommendations/rec_1/dismiss");
    expect(JSON.parse(String(init.body))).toEqual({ reason: "intentional" });
  });

  it("feedback() POSTs the helpful verdict", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Advisor(http).feedback("rec_1", { helpful: false, reason: "already handled" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/advisor/recommendations/rec_1/feedback");
    expect(JSON.parse(String(init.body))).toEqual({ helpful: false, reason: "already handled" });
  });

  it("encodes ids with reserved characters into the path", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Advisor(http).dismiss("rec/1");
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/advisor/recommendations/rec%2F1/dismiss");
  });
});
