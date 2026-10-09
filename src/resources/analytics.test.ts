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

describe("Analytics placement and direct mail", () => {
  it("direct GETs /analytics/direct with the period", async () => {
    const body = {
      period: "30d",
      volume: {
        sent: 10,
        received: 4,
        threads_started: 6,
        replied: 2,
        reply_rate: 33.3,
        bounced: 1,
        median_reply_minutes: 42,
      },
      tracking: {
        mailboxes_opted_in: 1,
        mailboxes_total: 3,
        tracked_sent: 5,
        opened: 3,
        machine_opened: 1,
        clicked: 1,
        open_rate: 60,
        click_rate: 20,
      },
      daily_trend: [{ date: "2026-09-01T00:00:00Z", sent: 2, received: 1 }],
      mailboxes: [
        {
          email_account_id: "mb1",
          email: "a@x.com",
          track_direct_mail: true,
          sent: 5,
          received: 2,
        },
      ],
      top_contacts: [{ email: "p@y.com", sent: 3, received: 1, last_at: "2026-09-01T09:00:00Z" }],
    };
    const { http, fetchMock } = clientWith(body);
    const out = await new Analytics(http).direct({ period: "30d" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/direct");
    expect(url).toContain("period=30d");
    expect(out.volume.median_reply_minutes).toBe(42);
    expect(out.top_contacts[0]?.email).toBe("p@y.com");
  });

  it("inboxTagging GETs /analytics/inbox-tagging and exposes enabled and summary", async () => {
    const row = {
      id: "r1",
      message_id: "m1",
      thread_id: "t1",
      kind: "reply",
      kind_confidence: 0.9,
      kind_source: "model",
      intent: "interested",
      intent_confidence: 0.8,
      relevance: 7,
      priority: "high",
      needs_review: true,
      review_reason: "low confidence",
      labels: ["interested"],
      answers: {},
      model: "m",
      input_tokens: 120,
      actions: [],
      return_date: null,
      created_at: "2026-09-01T10:00:00Z",
    };
    const { http, fetchMock } = clientWith({
      enabled: true,
      data: [row],
      total: 1,
      summary: { total: 5, needs_review: 1, from_offline: 0, acted: 2 },
      pagination: { next_cursor: null, has_more: false },
    });
    const page = await new Analytics(http).inboxTagging({ needs_review: true, limit: 20 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/inbox-tagging");
    expect(url).toContain("needs_review=true");
    expect(url).toContain("limit=20");
    expect(page.enabled).toBe(true);
    expect(page.summary.acted).toBe(2);
    expect(page.total).toBe(1);
    expect(page.data[0]?.review_reason).toBe("low confidence");
  });

  it("inboxTagging auto-pages and keeps the filters", async () => {
    const mk = (id: string, next: string | null) => ({
      enabled: false,
      data: [{ id }],
      total: 2,
      summary: { total: 2, needs_review: 0, from_offline: 0, acted: 0 },
      pagination: { next_cursor: next, has_more: next !== null },
    });
    const bodies = [mk("a", "c2"), mk("b", null)];
    let i = 0;
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(bodies[i++]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    const ids: string[] = [];
    for await (const r of await new Analytics(http).inboxTagging({ needs_review: true })) {
      ids.push(r.id);
    }
    expect(ids).toEqual(["a", "b"]);
    const second = String(fetchMock.mock.calls[1]?.[0]);
    expect(second).toContain("cursor=c2");
    expect(second).toContain("needs_review=true");
  });

  it("warmupPlacement GETs /analytics/warmup/placement with window and mailbox", async () => {
    const counts = {
      sent: 20,
      delivered: 18,
      inbox: 14,
      tabs: 2,
      spam: 2,
      rescued: 1,
      unconfirmed: 1,
      inbox_rate: 88.89,
      spam_rate: 11.11,
    };
    const rate = {
      window_days: 7,
      min_sample: 20,
      scope: "major",
      delivered: 18,
      inbox: 14,
      tabs: 2,
      spam: 2,
      inbox_rate: null,
      band: "collecting",
      other_delivered: 0,
      other_inbox_rate: null,
    };
    const { http, fetchMock } = clientWith({
      email_account_id: "mb1",
      date_range: { from: "2026-08-03T00:00:00Z", to: "2026-09-01T00:00:00Z" },
      summary: counts,
      rate,
      daily: [
        {
          date: "2026-09-01",
          ...counts,
          rolling_inbox_rate: null,
          groups: [{ group: "google", inbox: 5, tabs: 1, spam: 0, rescued: 0 }],
        },
      ],
      providers: [{ group: "google", ...counts, hosts: [{ host: "gmail", ...counts }] }],
    });
    const out = await new Analytics(http).warmupPlacement({
      email_id: "mb1",
      from: "2026-08-03",
      to: "2026-09-01",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/analytics/warmup/placement");
    expect(url).toContain("email_id=mb1");
    expect(url).toContain("from=2026-08-03");
    expect(url).toContain("to=2026-09-01");
    expect(out.rate.band).toBe("collecting");
    expect(out.rate.inbox_rate).toBeNull();
    expect(out.daily[0]?.groups[0]?.group).toBe("google");
    expect(out.providers[0]?.hosts[0]?.host).toBe("gmail");
    expect(out.mailboxes).toBeUndefined();
  });

  it("warmupPlacement decodes the observation counts and metrics", async () => {
    const metric = {
      version: "observed-v2",
      population: "warmup_pool_major_providers",
      denominator_kind: "classified_observed_receipts",
      unit: "percent",
      source: "mailbox_observation",
      classification_policy: "first_folder_v2_with_legacy_classifications",
      numerator: 16,
      denominator: 18,
      unresolved: 0,
      window_days: 7,
      window_basis: "trailing_utc_days",
      missingness_basis: "not_instrumented_in_legacy_window_counters",
      value: 88.9,
      wilson_95_independence_interval: { lower: 67.2, upper: 96.9 },
    };
    const counts = {
      sent: 20,
      delivered: 18,
      inbox: 14,
      tabs: 2,
      spam: 2,
      rescued: 1,
      unconfirmed: 1,
      inbox_rate: 88.89,
      spam_rate: 11.11,
      unknown: 1,
      archived: 0,
      custom: 1,
      instrumented_receipts: 15,
      observed_receipts: 20,
      legacy_uninstrumented_receipts: 5,
      rescue_requested: 1,
      rescue_confirmed: null,
      non_spam_metric: { ...metric, population: "warmup_pool" },
    };
    const { http } = clientWith({
      email_account_id: "mb1",
      summary: counts,
      rate: {
        window_days: 7,
        min_sample: 20,
        scope: "major",
        delivered: 18,
        inbox: 14,
        tabs: 2,
        spam: 2,
        inbox_rate: 88.9,
        band: "good",
        other_delivered: 0,
        other_inbox_rate: null,
        metric,
      },
      daily: [
        {
          date: "2026-09-01",
          ...counts,
          rolling_inbox_rate: 88.9,
          groups: [
            {
              group: "google",
              inbox: 5,
              tabs: 1,
              spam: 0,
              rescued: 0,
              unknown: 1,
              archived: 0,
              custom: 0,
            },
          ],
        },
      ],
      providers: [],
    });
    const out = await new Analytics(http).warmupPlacement({ email_id: "mb1" });
    expect(out.summary.observed_receipts).toBe(20);
    expect(out.summary.rescue_confirmed).toBeNull();
    expect(out.summary.non_spam_metric?.population).toBe("warmup_pool");
    expect(out.rate.metric?.wilson_95_independence_interval?.lower).toBe(67.2);
    expect(out.daily[0]?.groups[0]?.unknown).toBe(1);
  });
});
