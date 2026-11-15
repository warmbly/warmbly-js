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

  it("dashboard sends period and scope ids as repeated query keys", async () => {
    const { http, fetchMock } = clientWith({ totals: {} });
    await new Analytics(http).dashboard({
      period: "30d",
      campaign_ids: ["c1", "c2"],
      folder_ids: "f1",
    });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("period=30d");
    expect(url).toContain("campaign_ids=c1&campaign_ids=c2");
    expect(url).toContain("folder_ids=f1");
  });

  it("direct() GETs /analytics/direct and decodes the overview", async () => {
    const { http, fetchMock } = clientWith({
      period: "30d",
      volume: {
        sent: 120,
        received: 40,
        threads_started: 90,
        replied: 30,
        reply_rate: 33.3,
        bounced: 2,
        median_reply_minutes: 95,
      },
      tracking: {
        mailboxes_opted_in: 1,
        mailboxes_total: 3,
        tracked_sent: 50,
        opened: 20,
        machine_opened: 5,
        clicked: 4,
        open_rate: 40,
        click_rate: 8,
      },
      daily_trend: [{ date: "2026-11-07T00:00:00Z", sent: 5, received: 2 }],
      mailboxes: [
        {
          email_account_id: "a1",
          email: "me@x.io",
          track_direct_mail: true,
          sent: 100,
          received: 30,
        },
      ],
      top_contacts: [{ email: "lead@y.io", sent: 6, received: 3, last_at: "2026-11-07T10:00:00Z" }],
    });
    const res = await new Analytics(http).direct({ period: "30d" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/direct");
    expect(url).toContain("period=30d");
    expect(res.volume.median_reply_minutes).toBe(95);
    expect(res.tracking.machine_opened).toBe(5);
    expect(res.top_contacts[0]?.email).toBe("lead@y.io");
  });

  it("inboxTagging() GETs with limit, cursor and needs_review and keeps the full envelope", async () => {
    const { http, fetchMock } = clientWith({
      enabled: true,
      data: [
        {
          id: "v1",
          message_id: "m1",
          thread_id: "t1",
          kind: "reply",
          kind_confidence: 0.98,
          kind_source: "model",
          intent: "interested",
          intent_confidence: 0.71,
          relevance: 80,
          priority: "high",
          needs_review: true,
          review_reason: "low confidence",
          labels: ["interested"],
          answers: { budget: "yes" },
          model: "m",
          input_tokens: 321,
          actions: [],
          return_date: null,
          created_at: "2026-11-08T10:00:00Z",
        },
      ],
      total: 41,
      summary: { total: 100, needs_review: 7, from_offline: 1, acted: 12 },
      pagination: { next_cursor: "off_50", has_more: true },
    });
    const res = await new Analytics(http).inboxTagging({
      limit: 50,
      cursor: "off_0",
      needs_review: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/inbox-tagging");
    expect(url).toContain("limit=50");
    expect(url).toContain("cursor=off_0");
    expect(url).toContain("needs_review=true");
    expect(res.enabled).toBe(true);
    expect(res.summary.needs_review).toBe(7);
    expect(res.data[0]?.return_date).toBeNull();
    expect(res.pagination.next_cursor).toBe("off_50");
  });

  it("warmupPlacement() GETs /analytics/warmup/placement and decodes the report", async () => {
    const counts = {
      sent: 10,
      delivered: 8,
      inbox: 6,
      tabs: 1,
      spam: 1,
      unknown: 0,
      archived: 0,
      custom: 0,
      instrumented_receipts: 8,
      observed_receipts: 8,
      legacy_uninstrumented_receipts: 0,
      rescue_requested: 1,
      rescued: 1,
      rescue_confirmed: 1,
      rescue_missing: 0,
      rescue_failed: 0,
      rescue_unreported: 0,
      unconfirmed: 2,
      inbox_rate: 87.5,
      spam_rate: 12.5,
      non_spam_metric: null,
    };
    const rate = {
      window_days: 14,
      min_sample: 20,
      scope: "major",
      delivered: 8,
      inbox: 6,
      tabs: 1,
      spam: 1,
      inbox_rate: null,
      band: "collecting",
      metric: null,
      other_delivered: 0,
      other_inbox_rate: null,
    };
    const { http, fetchMock } = clientWith({
      email_account_id: "a1",
      date_range: { from: "2026-11-01T00:00:00Z", to: "2026-11-08T00:00:00Z" },
      summary: counts,
      rate,
      daily: [
        {
          date: "2026-11-08",
          ...counts,
          rolling_inbox_rate: null,
          groups: [{ group: "google", ...counts }],
        },
      ],
      providers: [{ group: "google", ...counts, hosts: [{ host: "google_workspace", ...counts }] }],
    });
    const res = await new Analytics(http).warmupPlacement({
      email_id: "a1",
      from: "2026-11-01",
      to: "2026-11-08",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/warmup/placement");
    expect(url).toContain("email_id=a1");
    expect(url).toContain("from=2026-11-01");
    expect(url).toContain("to=2026-11-08");
    expect(res.rate.band).toBe("collecting");
    expect(res.rate.inbox_rate).toBeNull();
    expect(res.daily[0]?.groups[0]?.group).toBe("google");
    expect(res.providers[0]?.hosts[0]?.host).toBe("google_workspace");
    expect(res.mailboxes).toBeUndefined();
  });

  it("warmupPlacement() works with no params", async () => {
    const { http, fetchMock } = clientWith({ daily: [], providers: [] });
    await new Analytics(http).warmupPlacement();
    expect(lastCall(fetchMock).url).not.toContain("?");
  });
});
