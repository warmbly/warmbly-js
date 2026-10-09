import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Placement } from "./placement";

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

const counts = {
  total: 12,
  pending: 0,
  inbox: 8,
  promotions: 2,
  other: 0,
  spam: 1,
  missing: 1,
  failed: 0,
  cancelled: 0,
  delivered: 12,
  inbox_rate: 0.6667,
  tabs_rate: 0.1667,
  spam_rate: 0.0833,
  missing_rate: 0.0833,
};

const test = {
  id: "t1",
  sender_account_id: "mb1",
  sender_email: "a@x.com",
  created_by: null,
  campaign_id: null,
  sequence_id: null,
  contact_id: null,
  monitor_id: null,
  batch_id: "b1",
  subject: "Hi",
  open_tracking: true,
  link_tracking: false,
  compare_group_id: null,
  origin: "batch",
  panel: "instance",
  status: "running",
  pace: "spaced",
  credits_charged: 0,
  credits_refunded: 0,
  credits_settled_at: null,
  created_at: "2026-09-01T10:00:00Z",
  finished_at: null,
  summary: counts,
  families: [{ family: "gmail", label: "Gmail", counts }],
};

const batch = {
  id: "b1",
  created_by: "u1",
  campaign_id: null,
  sequence_id: null,
  contact_id: null,
  subject: "Hi",
  tracking: "compare",
  panel: "instance",
  pace: "quick",
  families: [],
  seed_ids: [],
  on_unavailable: "defer",
  selection: { sample: { mode: "all" }, matched: 40, sender_scope: { type: "workspace" } },
  sender_count: 40,
  max_credits: 0,
  credits_spent: 0,
  status: "queued",
  retry_until: "2026-09-02T10:00:00Z",
  created_at: "2026-09-01T10:00:00Z",
  started_at: null,
  finished_at: null,
  progress: {
    total: 40,
    queued: 40,
    deferred: 0,
    running: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
  },
  summary: counts,
};

const emptyPage = { data: [], pagination: { total: 0, next_cursor: null, has_more: false } };

describe("Placement", () => {
  it("overview GETs /placement/overview and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        panels: [
          {
            panel: "instance",
            available: true,
            seeds: 20,
            families: [{ family: "gmail", label: "Gmail", seeds: 10 }],
            metered: true,
          },
        ],
        usage: {
          used: 1,
          limit: 5,
          credits_per_test: 2,
          credit_balance: null,
          period_start: "2026-09-01T00:00:00Z",
          period_end: "2026-10-01T00:00:00Z",
        },
        workspace_seeds: 0,
        seeds_per_test: 20,
        spacing_seconds: 60,
      },
    });
    const out = await new Placement(http).overview();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/overview");
    expect(out.panels[0]?.metered).toBe(true);
    expect(out.usage.limit).toBe(5);
    expect(out.usage.credit_balance).toBeNull();
  });

  it("listTests GETs /placement/tests with query and returns a Page", async () => {
    const { http, fetchMock } = clientWith({
      data: [test],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Placement(http).listTests({ campaign_id: "c1", limit: 10, cursor: "x" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/tests");
    expect(url).toContain("campaign_id=c1");
    expect(url).toContain("limit=10");
    expect(url).toContain("cursor=x");
    expect(page.data[0]?.summary.inbox_rate).toBeCloseTo(0.6667);
  });

  it("listTests auto-pages through the cursor", async () => {
    const pages = [
      {
        data: [{ ...test, id: "t1" }],
        pagination: { total: 2, next_cursor: "n1", has_more: true },
      },
      {
        data: [{ ...test, id: "t2" }],
        pagination: { total: 2, next_cursor: null, has_more: false },
      },
    ];
    let i = 0;
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(pages[i++]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    const ids: string[] = [];
    for await (const t of await new Placement(http).listTests()) ids.push(t.id);
    expect(ids).toEqual(["t1", "t2"]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=n1");
  });

  it("getTest GETs /placement/tests/:id and decodes results, content and compare", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        ...test,
        results: [
          {
            seed: "s***@gmail.com",
            family: "gmail",
            family_label: "Gmail",
            folder: "promotions",
            scheduled_at: "2026-09-01T10:00:00Z",
            sent_at: "2026-09-01T10:01:00Z",
            detected_at: "2026-09-01T10:03:00Z",
          },
        ],
        content: {
          score: 80,
          issues: [
            {
              severity: "warn",
              code: "all_caps",
              message: "Too many capitals",
              field: "subject",
              spans: [{ field: "subject", text: "FREE", line: 1 }],
              suggestion: "Use sentence case",
            },
          ],
        },
        compare: { ...test, id: "t2", open_tracking: false },
      },
    });
    const out = await new Placement(http).getTest("t/1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/tests/t%2F1");
    expect(out.results[0]?.folder).toBe("promotions");
    expect(out.content.issues[0]?.spans?.[0]?.text).toBe("FREE");
    expect(out.compare?.id).toBe("t2");
  });

  it("getTest decodes observed receipts, metrics and received evidence", async () => {
    const metric = {
      version: "observed-v2",
      population: "seed_panel",
      denominator_kind: "classified_observed_receipts",
      unit: "fraction",
      source: "mailbox_observation",
      classification_policy: "first_folder_v2_with_legacy_classifications",
      numerator: 8,
      denominator: 10,
      unresolved: 2,
      window_basis: "placement_test_classification_window",
      missingness_basis: "pending_missing_and_unclassified_copies",
      value: 0.8,
      wilson_95_independence_interval: { lower: 0.49, upper: 0.94 },
    };
    const { http } = clientWith({
      data: {
        ...test,
        summary: {
          ...counts,
          unknown: 1,
          archive: 1,
          custom: 0,
          observed_receipts: 12,
          classified_receipts: 10,
          unresolved: 0,
          primary_metric: metric,
          non_spam_metric: { ...metric, value: null, wilson_95_independence_interval: null },
        },
        results: [
          {
            seed: "s***@outlook.com",
            family: "outlook",
            family_label: "Outlook",
            folder: "custom",
            first_folder: "inbox",
            observed_at: "2026-09-01T10:02:00Z",
            scheduled_at: null,
            sent_at: "2026-09-01T10:01:00Z",
            detected_at: "2026-09-01T10:03:00Z",
            evidence: {
              version: "received-v1",
              source: "headers",
              trust: "receiver",
              observed_at: "2026-09-01T10:02:00Z",
              spf: "pass",
              dkim: "pass",
              dmarc: "pass",
              alignment: "aligned",
              tls: "tls",
              authentication_results_present: true,
              one_click_headers_present: true,
              one_click_signing_claim: true,
              one_click_compliance: "compliant",
            },
          },
        ],
        content: { score: 100, issues: [] },
      },
    });
    const out = await new Placement(http).getTest("t1");
    expect(out.summary.primary_metric?.value).toBe(0.8);
    expect(out.summary.non_spam_metric?.value).toBeNull();
    expect(out.summary.archive).toBe(1);
    expect(out.results[0]?.folder).toBe("custom");
    expect(out.results[0]?.first_folder).toBe("inbox");
    expect(out.results[0]?.evidence?.dmarc).toBe("pass");
  });

  it("createTest POSTs the body, sends an Idempotency-Key and returns the tests array", async () => {
    const { http, fetchMock } = clientWith(
      { data: [test, { ...test, id: "t2" }] },
      { status: 201 },
    );
    const out = await new Placement(http).createTest(
      {
        sender_account_id: "mb1",
        subject: "Hi",
        body_plain: "Hello",
        tracking: "compare",
        seed_ids: ["s1"],
        max_credits: 4,
      },
      { idempotencyKey: "idem-1" },
    );
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/placement/tests");
    expect(JSON.parse(String(init.body))).toEqual({
      sender_account_id: "mb1",
      subject: "Hi",
      body_plain: "Hello",
      tracking: "compare",
      seed_ids: ["s1"],
      max_credits: 4,
    });
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
    expect(out).toHaveLength(2);
  });

  it("cancelTest POSTs /placement/tests/:id/cancel", async () => {
    const { http, fetchMock } = clientWith({ data: { ...test, status: "cancelled" } });
    const out = await new Placement(http).cancelTest("t1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/placement/tests/t1/cancel");
    expect(init.body).toBeUndefined();
    expect(out.status).toBe("cancelled");
  });

  it("listBatches GETs /placement/batches", async () => {
    const { http, fetchMock } = clientWith({
      data: [batch],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Placement(http).listBatches({ limit: 5 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/batches");
    expect(url).toContain("limit=5");
    expect(page.data[0]?.progress.total).toBe(40);
  });

  it("getBatch GETs /placement/batches/:id and decodes the groupings", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        ...batch,
        untracked: counts,
        domains: [{ key: "x.com", label: "x.com", senders: 3, tested: 3, counts }],
        providers: [{ key: "gmail", label: "Gmail", senders: 3, tested: 3, counts }],
        recipients: [{ family: "outlook", label: "Outlook", counts }],
        matrix: [
          { domain: "x.com", recipients: [{ family: "outlook", label: "Outlook", counts }] },
        ],
        content: { score: 90, issues: [] },
      },
    });
    const out = await new Placement(http).getBatch("b1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/batches/b1");
    expect(out.domains[0]?.key).toBe("x.com");
    expect(out.matrix[0]?.recipients[0]?.family).toBe("outlook");
    expect(out.untracked?.inbox).toBe(8);
  });

  it("listBatchSenders GETs /placement/batches/:id/senders with filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "bs1",
          batch_id: "b1",
          email_account_id: "mb1",
          sender_email: "a@x.com",
          sender_domain: "x.com",
          sender_family: "gmail",
          sender_family_label: "Gmail",
          status: "deferred",
          reason: "no_headroom",
          attempts: 2,
          next_attempt_at: "2026-09-01T12:00:00Z",
          started_at: null,
          finished_at: null,
          summary: counts,
          test_ids: ["t1", "t2"],
        },
      ],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Placement(http).listBatchSenders("b1", {
      status: "deferred",
      q: "a@",
      sort: "best",
      limit: 50,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/batches/b1/senders");
    expect(url).toContain("status=deferred");
    expect(url).toContain("q=a%40");
    expect(url).toContain("sort=best");
    expect(url).toContain("limit=50");
    expect(page.data[0]?.test_ids).toEqual(["t1", "t2"]);
  });

  it("previewBatch POSTs /placement/batches/preview with the scope body", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        matched: 100,
        selected: 10,
        inactive: 2,
        domains: 4,
        providers: [{ key: "gmail", label: "Gmail", senders: 6 }],
        variants: 2,
        tests: 20,
        seeds_per_test: 20,
        max_sends: 400,
        metered: true,
        free_tests: 5,
        paid_tests: 15,
        credits: 30,
        usage: {
          used: 5,
          limit: 5,
          credits_per_test: 2,
          credit_balance: 100,
          period_start: "2026-09-01T00:00:00Z",
          period_end: "2026-10-01T00:00:00Z",
        },
        senders_max: 500,
        concurrency: 3,
      },
    });
    const out = await new Placement(http).previewBatch({
      sender_scope: { type: "campaign", campaign_id: "c1", untested_days: 7 },
      sample: { mode: "percent", percent: 10, stratify: "domain" },
      tracking: "compare",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/placement/batches/preview");
    expect(JSON.parse(String(init.body))).toEqual({
      sender_scope: { type: "campaign", campaign_id: "c1", untested_days: 7 },
      sample: { mode: "percent", percent: 10, stratify: "domain" },
      tracking: "compare",
    });
    expect(out.credits).toBe(30);
    expect(out.providers[0]?.senders).toBe(6);
  });

  it("createBatch POSTs /placement/batches with an Idempotency-Key", async () => {
    const { http, fetchMock } = clientWith({ data: batch }, { status: 201 });
    const out = await new Placement(http).createBatch(
      { sender_account_ids: ["mb1", "mb2"], subject: "Hi", on_unavailable: "skip" },
      { idempotencyKey: "idem-2" },
    );
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/placement\/batches$/);
    expect(JSON.parse(String(init.body))).toEqual({
      sender_account_ids: ["mb1", "mb2"],
      subject: "Hi",
      on_unavailable: "skip",
    });
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-2");
    expect(out.status).toBe("queued");
  });

  it("cancelBatch POSTs /placement/batches/:id/cancel", async () => {
    const { http, fetchMock } = clientWith({ data: { ...batch, status: "cancelled" } });
    const out = await new Placement(http).cancelBatch("b1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/placement/batches/b1/cancel");
    expect(out.status).toBe("cancelled");
  });

  it("coverage GETs /placement/coverage", async () => {
    const { http, fetchMock } = clientWith({
      data: { mailboxes: 50, tested_7d: 10, tested_30d: 30, never_tested: 20 },
    });
    const out = await new Placement(http).coverage();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/coverage");
    expect(out).toEqual({ mailboxes: 50, tested_7d: 10, tested_30d: 30, never_tested: 20 });
  });

  it("listSeeds GETs /placement/seeds and unwraps the array", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          email_account_id: "mb1",
          email: "a@x.com",
          family: "gmail",
          label: "Gmail",
          status: "active",
          seed: false,
          blocker: "mailbox is in a campaign",
        },
      ],
    });
    const out = await new Placement(http).listSeeds();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/seeds");
    expect(out[0]?.blocker).toBe("mailbox is in a campaign");
  });

  it("setSeed PUTs /placement/seeds/:id with { seed }", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        email_account_id: "mb1",
        email: "a@x.com",
        family: "gmail",
        label: "Gmail",
        status: "active",
        seed: true,
      },
    });
    const out = await new Placement(http).setSeed("mb1", true);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/placement/seeds/mb1");
    expect(JSON.parse(String(init.body))).toEqual({ seed: true });
    expect(out.seed).toBe(true);
  });

  it("tolerates unknown folders, statuses and fields", async () => {
    const { http } = clientWith({
      data: {
        ...test,
        status: "paused_by_future",
        brand_new: 1,
        results: [{ seed: "s", family: "f", family_label: "F", folder: "quarantine" }],
        content: { score: 1, issues: [] },
      },
    });
    const out = await new Placement(http).getTest("t1");
    expect(out.status).toBe("paused_by_future");
    expect(out.results[0]?.folder).toBe("quarantine");
  });

  it("pages empty lists", async () => {
    const { http } = clientWith(emptyPage);
    const page = await new Placement(http).listBatches();
    expect(page.data).toEqual([]);
  });
});
