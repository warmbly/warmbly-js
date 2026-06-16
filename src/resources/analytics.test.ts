import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Analytics } from "./analytics";

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

describe("Analytics", () => {
  it("dashboard without params", async () => {
    const { http, fetchMock } = clientWith({ visits: 10 });
    const report = await new Analytics(http).dashboard();
    expect(report).toEqual({ visits: 10 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/dashboard");
  });

  it("dashboard with params", async () => {
    const { http, fetchMock } = clientWith({ visits: 10 });
    await new Analytics(http).dashboard({ from: "2026-06-01", to: "2026-06-15" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/dashboard");
    expect(url).toContain("from=2026-06-01");
    expect(url).toContain("to=2026-06-15");
  });

  it("deliverability without params", async () => {
    const { http, fetchMock } = clientWith({ delivered: 99 });
    const report = await new Analytics(http).deliverability();
    expect(report).toEqual({ delivered: 99 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/deliverability");
  });

  it("deliverability with params", async () => {
    const { http, fetchMock } = clientWith({ delivered: 99 });
    await new Analytics(http).deliverability({ interval: "day" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/deliverability");
    expect(url).toContain("interval=day");
  });

  it("warmup with required from/to window", async () => {
    const { http, fetchMock } = clientWith({ score: 5 });
    const report = await new Analytics(http).warmup({ from: "2026-06-01", to: "2026-06-15" });
    expect(report).toEqual({ score: 5 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/warmup");
    expect(url).toContain("from=2026-06-01");
    expect(url).toContain("to=2026-06-15");
  });

  it("usage without params", async () => {
    const { http, fetchMock } = clientWith({ sent: 42 });
    const report = await new Analytics(http).usage();
    expect(report).toEqual({ sent: 42 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/usage");
  });

  it("usage with params", async () => {
    const { http, fetchMock } = clientWith({ sent: 42 });
    await new Analytics(http).usage({ from: "2026-06-01" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/usage");
    expect(url).toContain("from=2026-06-01");
  });

  it("accounts without params", async () => {
    const { http, fetchMock } = clientWith({ accounts: [] });
    const report = await new Analytics(http).accounts();
    expect(report).toEqual({ accounts: [] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/accounts");
  });

  it("accounts with params", async () => {
    const { http, fetchMock } = clientWith({ accounts: [] });
    await new Analytics(http).accounts({ to: "2026-06-15" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/accounts");
    expect(url).toContain("to=2026-06-15");
  });

  it("account by id without params", async () => {
    const { http, fetchMock } = clientWith({ id: "acc_1" });
    const report = await new Analytics(http).account("acc_1");
    expect(report).toEqual({ id: "acc_1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/accounts/acc_1");
  });

  it("account by id with params and encodes the id", async () => {
    const { http, fetchMock } = clientWith({ id: "acc/1" });
    await new Analytics(http).account("acc/1", { from: "2026-06-01" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/accounts/acc%2F1");
    expect(url).toContain("from=2026-06-01");
  });

  it("compareCampaigns joins an array of ids into a single comma-separated query param", async () => {
    const { http, fetchMock } = clientWith({ compared: 2 });
    const report = await new Analytics(http).compareCampaigns({
      ids: ["c1", "c2"],
      from: "2026-06-01",
      to: "2026-06-15",
    });
    expect(report).toEqual({ compared: 2 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/campaigns/compare");
    expect(url).toContain("ids=c1%2Cc2");
    expect(url).toContain("from=2026-06-01");
    expect(url).toContain("to=2026-06-15");
  });

  it("compareCampaigns passes a string ids value through unchanged", async () => {
    const { http, fetchMock } = clientWith({ compared: 2 });
    await new Analytics(http).compareCampaigns({
      ids: "c1,c2",
      from: "2026-06-01",
      to: "2026-06-15",
    });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/campaigns/compare");
    expect(url).toContain("ids=c1%2Cc2");
  });

  it("campaign by id without params", async () => {
    const { http, fetchMock } = clientWith({ id: "c1" });
    const report = await new Analytics(http).campaign("c1");
    expect(report).toEqual({ id: "c1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/campaigns/c1");
  });

  it("campaign by id with params", async () => {
    const { http, fetchMock } = clientWith({ id: "c1" });
    await new Analytics(http).campaign("c1", { interval: "week" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/campaigns/c1");
    expect(url).toContain("interval=week");
  });

  it("campaignDaily with required from/to window", async () => {
    const { http, fetchMock } = clientWith({ days: [] });
    const report = await new Analytics(http).campaignDaily("c1", {
      from: "2026-06-01",
      to: "2026-06-15",
    });
    expect(report).toEqual({ days: [] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/campaigns/c1/daily");
    expect(url).toContain("from=2026-06-01");
    expect(url).toContain("to=2026-06-15");
  });

  it("campaignHourly without params", async () => {
    const { http, fetchMock } = clientWith({ hours: [] });
    const report = await new Analytics(http).campaignHourly("c1");
    expect(report).toEqual({ hours: [] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/campaigns/c1/hourly");
  });

  it("campaignHourly with params", async () => {
    const { http, fetchMock } = clientWith({ hours: [] });
    await new Analytics(http).campaignHourly("c1", { from: "2026-06-01", to: "2026-06-15" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/analytics/campaigns/c1/hourly");
    expect(url).toContain("from=2026-06-01");
    expect(url).toContain("to=2026-06-15");
  });
});
