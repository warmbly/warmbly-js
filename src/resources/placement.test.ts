import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Placement } from "./placement";

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

const counts = {
  total: 4,
  pending: 0,
  inbox: 3,
  promotions: 0,
  other: 0,
  spam: 1,
  missing: 0,
  delivered: 4,
  inbox_rate: 0.75,
  spam_rate: 0.25,
  missing_rate: 0,
  tabs_rate: 0,
};
const test = {
  id: "t1",
  sender_account_id: "acc1",
  sender_email: "me@example.com",
  campaign_id: null,
  status: "running",
  panel: "instance",
  origin: "manual",
  charged_usd: 0,
  summary: counts,
  families: [{ family: "gmail", label: "Gmail", counts }],
};
const batch = {
  id: "b1",
  status: "running",
  sender_count: 3,
  max_usd: 1.5,
  spent_usd: 0,
  progress: { total: 3, queued: 2, running: 1 },
  summary: counts,
};

describe("Placement", () => {
  it("overview GETs /placement/overview and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        panels: [{ panel: "instance", available: true, seeds: 8, families: [], metered: true }],
        usage: { used: 1, limit: 5, price_per_test_usd: 0.5, balance_usd: null },
        workspace_seeds: 0,
        seeds_per_test: 8,
        spacing_seconds: 60,
      },
    });
    const out = await new Placement(http).overview();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/placement\/overview$/);
    expect(out.usage.limit).toBe(5);
    expect(out.panels[0]?.seeds).toBe(8);
  });

  it("listTests GETs /placement/tests with query and pages", async () => {
    const { http, fetchMock } = clientWith({
      data: [test],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Placement(http).listTests({ campaign_id: "camp1", limit: 10 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/tests?");
    expect(new URL(url).searchParams.get("campaign_id")).toBe("camp1");
    expect(new URL(url).searchParams.get("limit")).toBe("10");
    expect(page.data[0]?.summary.inbox_rate).toBe(0.75);
  });

  it("getTest GETs /placement/tests/:id and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        ...test,
        results: [{ seed: "a***@gmail.com", family: "gmail", folder: "inbox", evidence: null }],
        content: { score: 92, issues: [] },
      },
    });
    const out = await new Placement(http).getTest("t1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/placement\/tests\/t1$/);
    expect(out.results[0]?.folder).toBe("inbox");
    expect(out.content.score).toBe(92);
  });

  it("createTest POSTs /placement/tests and returns the tests array", async () => {
    const { http, fetchMock } = clientWith({ data: [test] }, { status: 201 });
    const body = { sender_account_id: "acc1", subject: "Hi", body_plain: "Hello", max_usd: 1 };
    const out = await new Placement(http).createTest(body);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/placement\/tests$/);
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("t1");
  });

  it("cancelTest POSTs /placement/tests/:id/cancel", async () => {
    const { http, fetchMock } = clientWith({ data: { ...test, status: "cancelled" } });
    const out = await new Placement(http).cancelTest("t1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/placement\/tests\/t1\/cancel$/);
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
    expect(url).toMatch(/\/placement\/batches\?limit=5$/);
    expect(page.data[0]?.progress.running).toBe(1);
  });

  it("getBatch GETs /placement/batches/:id and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        ...batch,
        domains: [{ key: "example.com", label: "example.com", senders: 3, tested: 3, counts }],
        providers: [],
        recipients: [],
        matrix: [],
        content: { score: 80, issues: [] },
      },
    });
    const out = await new Placement(http).getBatch("b1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/placement\/batches\/b1$/);
    expect(out.domains[0]?.key).toBe("example.com");
  });

  it("batchSenders GETs /placement/batches/:id/senders with filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "s1",
          batch_id: "b1",
          sender_email: "me@example.com",
          status: "completed",
          summary: counts,
          test_ids: ["t1"],
        },
      ],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Placement(http).batchSenders("b1", {
      status: "completed",
      q: "me",
      sort: "worst",
      limit: 20,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/placement/batches/b1/senders?");
    const qs = new URL(url).searchParams;
    expect(qs.get("status")).toBe("completed");
    expect(qs.get("q")).toBe("me");
    expect(qs.get("sort")).toBe("worst");
    expect(qs.get("limit")).toBe("20");
    expect(page.data[0]?.test_ids).toEqual(["t1"]);
  });

  it("previewBatch POSTs /placement/batches/preview and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: { matched: 10, selected: 3, tests: 3, max_sends: 24, cost_usd: 1.5, metered: true },
    });
    const body = {
      sender_scope: { type: "workspace" },
      sample: { mode: "random", count: 3 },
    };
    const out = await new Placement(http).previewBatch(body);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/placement\/batches\/preview$/);
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(out.selected).toBe(3);
  });

  it("createBatch POSTs /placement/batches and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: batch }, { status: 201 });
    const body = {
      sender_account_ids: ["acc1", "acc2"],
      campaign_id: "camp1",
      on_unavailable: "skip",
    };
    const out = await new Placement(http).createBatch(body);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/placement\/batches$/);
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(out.id).toBe("b1");
  });

  it("cancelBatch POSTs /placement/batches/:id/cancel", async () => {
    const { http, fetchMock } = clientWith({ data: { ...batch, status: "cancelled" } });
    const out = await new Placement(http).cancelBatch("b1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/placement\/batches\/b1\/cancel$/);
    expect(out.status).toBe("cancelled");
  });

  it("coverage GETs /placement/coverage and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: { mailboxes: 20, tested_7d: 5, tested_30d: 12, never_tested: 8 },
    });
    const out = await new Placement(http).coverage();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/placement\/coverage$/);
    expect(out.never_tested).toBe(8);
  });

  it("listSeeds GETs /placement/seeds and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          email_account_id: "acc1",
          email: "a@x.com",
          family: "gmail",
          seed: true,
          status: "active",
        },
      ],
    });
    const out = await new Placement(http).listSeeds();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/placement\/seeds$/);
    expect(out[0]?.seed).toBe(true);
  });

  it("listSeeds tolerates a missing data array", async () => {
    const { http } = clientWith({});
    expect(await new Placement(http).listSeeds()).toEqual([]);
  });

  it("setSeed PUTs /placement/seeds/:id with the seed flag", async () => {
    const { http, fetchMock } = clientWith({
      data: { email_account_id: "acc1", email: "a@x.com", seed: false, blocker: "" },
    });
    const out = await new Placement(http).setSeed("acc1", false);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/placement\/seeds\/acc1$/);
    expect(JSON.parse(String(init.body))).toEqual({ seed: false });
    expect(out.seed).toBe(false);
  });
});
