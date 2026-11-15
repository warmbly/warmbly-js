import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Reports } from "./reports";

function clientWith(responses: Array<{ body?: unknown; status?: number }>): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const status = next?.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(next?.body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  const http = new HttpClient(
    resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
  );
  return { http, fetchMock };
}

function callAt(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

function bodyOf(init: RequestInit): unknown {
  return init.body === undefined || init.body === null ? undefined : JSON.parse(String(init.body));
}

const sections = {
  overview: true,
  campaigns: true,
  replies: true,
  positive_replies: true,
  mailboxes: true,
  daily_chart: true,
};

const report = {
  id: "rep_1",
  created_by: "usr_1",
  name: "Acme weekly",
  access: {
    scope: "restricted",
    campaign_folder_ids: [],
    campaign_ids: ["cmp_1"],
    email_account_ids: [],
  },
  sections,
  show_reply_snippets: false,
  date_range: "last_30_days",
  link: null,
  schedule: null,
  created_at: "2026-11-08T10:00:00Z",
  updated_at: "2026-11-08T10:00:00Z",
};

const link = {
  hint: "AbCd",
  created_at: "2026-11-08T11:00:00Z",
  expires_at: "2026-12-08T11:00:00Z",
  expired: false,
};

const schedule = {
  recipients: ["client@acme.com"],
  cadence: "weekly",
  weekday: 1,
  month_day: 1,
  hour: 9,
  timezone: "Europe/London",
  paused: false,
  last_sent_at: null,
  next_run_at: "2026-11-09T09:00:00Z",
};

describe("Reports", () => {
  it("lists reports with limit and follows the cursor when iterating", async () => {
    const { http, fetchMock } = clientWith([
      { body: { data: [report], pagination: { next_cursor: "cur_2", has_more: true } } },
      {
        body: {
          data: [{ ...report, id: "rep_2", created_by: null }],
          pagination: { next_cursor: null, has_more: false },
        },
      },
    ]);
    const ids: string[] = [];
    for await (const r of await new Reports(http).list({ limit: 1 })) ids.push(r.id);
    expect(ids).toEqual(["rep_1", "rep_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(new URL(first.url).pathname).toBe("/v1/reports");
    expect(new URL(first.url).searchParams.get("limit")).toBe("1");
    expect(new URL(callAt(fetchMock, 1).url).searchParams.get("cursor")).toBe("cur_2");
  });

  it("creates a report", async () => {
    const { http, fetchMock } = clientWith([{ body: report, status: 201 }]);
    const r = await new Reports(http).create({
      name: "Acme weekly",
      access: { scope: "restricted", campaign_ids: ["cmp_1"] },
    });
    expect(r.access.campaign_ids).toEqual(["cmp_1"]);
    expect(r.link).toBeNull();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname).toBe("/v1/reports");
    expect(bodyOf(init)).toEqual({
      name: "Acme weekly",
      access: { scope: "restricted", campaign_ids: ["cmp_1"] },
    });
  });

  it("gets a report", async () => {
    const { http, fetchMock } = clientWith([{ body: { ...report, link, schedule } }]);
    const r = await new Reports(http).get("rep_1");
    expect(r.link?.hint).toBe("AbCd");
    expect(r.schedule?.cadence).toBe("weekly");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1");
  });

  it("previews a report for a range", async () => {
    const view = {
      name: "Acme weekly",
      date_range: "this_month",
      from: "2026-11-01",
      to: "2026-11-08",
      generated_at: "2026-11-08T12:00:00Z",
      sections,
      show_reply_snippets: true,
      overview: {
        sent: 1000,
        opened: 400,
        open_tracked_sent: 800,
        open_rate: 50,
        clicked: 30,
        replied: 60,
        reply_rate: 6,
        positive: 20,
        positive_rate: 2,
        bounced: 10,
        bounce_rate: 1,
      },
      daily: [{ date: "2026-11-01", sent: 100, opens: 40, replies: 6 }],
      campaigns: [
        {
          name: "Q4",
          status: "active",
          sent: 1000,
          opens: 400,
          open_tracked_sent: 800,
          open_rate: 50,
          clicks: 30,
          replies: 60,
          reply_rate: 6,
          positive: 20,
          bounces: 10,
          bounce_rate: 1,
        },
      ],
      replies: [
        {
          name: "Jane Doe",
          email: "jane@client.com",
          campaign: "Q4",
          subject: "Re: Quick question",
          replied_at: "2026-11-07T09:00:00Z",
          classification: "interested",
          snippet: "Sounds good",
        },
      ],
      mailboxes: {
        total: 5,
        healthy: 4,
        warning: 1,
        error: 0,
        warmup_sent: 200,
        warmup_received: 190,
        warmup_replied: 60,
      },
    };
    const { http, fetchMock } = clientWith([{ body: view }]);
    const v = await new Reports(http).preview("rep_1", { range: "this_month" });
    expect(v.overview?.reply_rate).toBe(6);
    expect(v.replies?.[0]?.snippet).toBe("Sounds good");
    expect(v.mailboxes?.healthy).toBe(4);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1/preview");
    expect(new URL(url).searchParams.get("range")).toBe("this_month");
  });

  it("updates a report", async () => {
    const { http, fetchMock } = clientWith([{ body: { ...report, show_reply_snippets: true } }]);
    const r = await new Reports(http).update("rep_1", {
      show_reply_snippets: true,
      date_range: "last_7_days",
    });
    expect(r.show_reply_snippets).toBe(true);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1");
    expect(bodyOf(init)).toEqual({ show_reply_snippets: true, date_range: "last_7_days" });
  });

  it("deletes a report and tolerates 204", async () => {
    const { http, fetchMock } = clientWith([{ status: 204 }]);
    await expect(new Reports(http).delete("rep_1")).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1");
  });

  it("mints a share link", async () => {
    const { http, fetchMock } = clientWith([
      {
        status: 201,
        body: {
          url: "https://portal.example.com/r/AbCdEf",
          token: "AbCdEf",
          link,
          report: { ...report, link },
        },
      },
    ]);
    const res = await new Reports(http).createLink("rep_1", { expires_in_days: 30 });
    expect(res.url).toContain("/r/");
    expect(res.link.expires_at).toBe("2026-12-08T11:00:00Z");
    expect(res.report?.link?.hint).toBe("AbCd");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1/link");
    expect(bodyOf(init)).toEqual({ expires_in_days: 30 });
  });

  it("revokes the share link", async () => {
    const { http, fetchMock } = clientWith([{ body: report }]);
    const r = await new Reports(http).revokeLink("rep_1");
    expect(r.link).toBeNull();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1/link");
  });

  it("sets the schedule", async () => {
    const { http, fetchMock } = clientWith([{ body: { ...report, schedule } }]);
    const r = await new Reports(http).setSchedule("rep_1", {
      recipients: ["client@acme.com"],
      cadence: "weekly",
      weekday: 1,
      hour: 9,
      timezone: "Europe/London",
    });
    expect(r.schedule?.next_run_at).toBe("2026-11-09T09:00:00Z");
    expect(r.schedule?.last_sent_at).toBeNull();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PUT");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1/schedule");
    expect(bodyOf(init)).toEqual({
      recipients: ["client@acme.com"],
      cadence: "weekly",
      weekday: 1,
      hour: 9,
      timezone: "Europe/London",
    });
  });

  it("deletes the schedule and returns the report", async () => {
    const { http, fetchMock } = clientWith([{ body: report }]);
    const r = await new Reports(http).deleteSchedule("rep_1");
    expect(r.schedule).toBeNull();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(new URL(url).pathname).toBe("/v1/reports/rep_1/schedule");
  });
});
