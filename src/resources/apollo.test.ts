import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Apollo } from "./apollo";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const status = init.status ?? 200;
  const fetchMock = vi.fn(
    async () =>
      new Response(status === 204 || body === undefined ? null : JSON.stringify(body), {
        status,
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

const T0 = "2026-10-01T09:30:00Z";

const overview = {
  connection_id: "conn_1",
  label: "Apollo",
  status: "connected",
  health: "healthy",
  account_name: "Warmbly Inc",
  account_email: "ops@warmbly.com",
  sources: 2,
  total_imported: 340,
  last_run_at: T0,
};

const source = {
  id: "src_1",
  organization_id: "org_1",
  connection_id: "conn_1",
  name: "Series A fintech",
  list_id: "lst_1",
  list_name: "Series A fintech",
  category_ids: [],
  verified_only: true,
  recurring: false,
  enabled: true,
  status: "idle",
  last_result: {
    read: 100,
    imported: 80,
    updated: 5,
    skipped: 3,
    failed: 0,
    no_email: 4,
    unverified: 6,
    suppressed: 2,
    already_seen: 0,
    truncated: true,
    next_page: 2,
  },
  total_imported: 80,
  created_at: T0,
  updated_at: T0,
};

const run = {
  id: "run_1",
  organization_id: "org_1",
  connection_id: "conn_1",
  overwrite: false,
  status: "running",
  total: 200,
  processed: 50,
  enriched: 40,
  not_found: 8,
  failed: 2,
  credits_consumed: 40,
  started_at: T0,
  created_at: T0,
  updated_at: T0,
};

describe("Apollo", () => {
  it("overview() GETs /integrations/apollo/:id", async () => {
    const { http, fetchMock } = clientWith(overview);
    const out = await new Apollo(http).overview("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/integrations\/apollo\/conn_1$/);
    expect(out.account_email).toBe("ops@warmbly.com");
  });

  it("replaceKey() PUTs the key and returns the overview", async () => {
    const { http, fetchMock } = clientWith(overview);
    const out = await new Apollo(http).replaceKey("conn_1", { api_key: "apollo_k" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/integrations/apollo/conn_1/key");
    expect(JSON.parse(String(init.body))).toEqual({ api_key: "apollo_k" });
    expect(out.sources).toBe(2);
  });

  it("surfaces a rejected key as a 422", async () => {
    const { http } = clientWith(
      { code: "apollo_key_rejected", message: "Apollo rejected the key" },
      { status: 422 },
    );
    await expect(new Apollo(http).replaceKey("conn_1", { api_key: "bad" })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("lists() unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "lst_1", name: "Fintech", count: 412 }],
    });
    const out = await new Apollo(http).lists("conn_1");
    expect(lastCall(fetchMock).url).toContain("/integrations/apollo/conn_1/lists");
    expect(out[0]?.count).toBe(412);
  });

  it("lists() and importSources() tolerate a missing data array", async () => {
    const { http } = clientWith({});
    const apollo = new Apollo(http);
    expect(await apollo.lists("c")).toEqual([]);
    expect(await apollo.importSources("c")).toEqual([]);
    expect(await apollo.enrichments("c")).toEqual([]);
  });

  it("previewImport() POSTs the list id", async () => {
    const { http, fetchMock } = clientWith({
      total: 412,
      sample: [
        {
          apollo_id: "ap_1",
          name: "Jane Doe",
          email: "jane@acme.com",
          email_status: "verified",
          title: "CTO",
          company: "Acme",
          already_in_warmbly: false,
          will_import: true,
        },
      ],
    });
    const out = await new Apollo(http).previewImport("conn_1", {
      list_id: "lst_1",
      verified_only: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/apollo/conn_1/import/preview");
    expect(JSON.parse(String(init.body))).toEqual({ list_id: "lst_1", verified_only: false });
    expect(out.sample[0]?.will_import).toBe(true);
  });

  it("importSources() unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [source] });
    const out = await new Apollo(http).importSources("conn_1");
    expect(lastCall(fetchMock).url).toContain("/integrations/apollo/conn_1/import-sources");
    expect(out[0]?.last_result?.next_page).toBe(2);
  });

  it("createImportSource() POSTs and decodes the 201 source", async () => {
    const { http, fetchMock } = clientWith(source, { status: 201 });
    const out = await new Apollo(http).createImportSource("conn_1", {
      list_id: "lst_1",
      list_name: "Series A fintech",
      verified_only: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/integrations\/apollo\/conn_1\/import-sources$/);
    expect(JSON.parse(String(init.body))).toEqual({
      list_id: "lst_1",
      list_name: "Series A fintech",
      verified_only: true,
    });
    expect(out.verified_only).toBe(true);
  });

  it("createImportSource() forwards a caller idempotency key", async () => {
    const { http, fetchMock } = clientWith(source, { status: 201 });
    await new Apollo(http).createImportSource(
      "conn_1",
      { list_id: "lst_1" },
      { idempotencyKey: "apollo-src-1" },
    );
    const { init } = lastCall(fetchMock);
    expect(new Headers(init.headers).get("idempotency-key")).toBe("apollo-src-1");
  });

  it("updateImportSource() PATCHes and can clear the campaign", async () => {
    const { http, fetchMock } = clientWith(source);
    await new Apollo(http).updateImportSource("conn_1", "src_1", {
      campaign_id: null,
      verified_only: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/integrations/apollo/conn_1/import-sources/src_1");
    expect(JSON.parse(String(init.body))).toEqual({ campaign_id: null, verified_only: false });
  });

  it("runImportSource() POSTs to /run", async () => {
    const { http, fetchMock } = clientWith({ ...source, status: "running" });
    const out = await new Apollo(http).runImportSource("conn_1", "src_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/apollo/conn_1/import-sources/src_1/run");
    expect(out.status).toBe("running");
  });

  it("deleteImportSource() DELETEs and expects 204", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Apollo(http).deleteImportSource("conn_1", "src_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/integrations/apollo/conn_1/import-sources/src_1");
  });

  it("enrichments() unwraps data and sends limit", async () => {
    const { http, fetchMock } = clientWith({ data: [run] });
    const out = await new Apollo(http).enrichments("conn_1", { limit: 5 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/apollo/conn_1/enrichments?limit=5");
    expect(out[0]?.credits_consumed).toBe(40);
  });

  it("startEnrichment() POSTs the selection and decodes the 202 run", async () => {
    const { http, fetchMock } = clientWith(run, { status: 202 });
    const out = await new Apollo(http).startEnrichment("conn_1", {
      contacts: ["c_1", "c_2"],
      overwrite: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/integrations\/apollo\/conn_1\/enrichments$/);
    expect(JSON.parse(String(init.body))).toEqual({ contacts: ["c_1", "c_2"], overwrite: true });
    expect(out.status).toBe("running");
    expect(out.not_found).toBe(8);
  });

  it("startEnrichment() accepts a filter selection and an idempotency key", async () => {
    const { http, fetchMock } = clientWith(run, { status: 202 });
    await new Apollo(http).startEnrichment(
      "conn_1",
      { all: true, filters: { query: "acme" }, exclude: ["c_9"] },
      { idempotencyKey: "enrich-1" },
    );
    const { init } = lastCall(fetchMock);
    expect(JSON.parse(String(init.body))).toEqual({
      all: true,
      filters: { query: "acme" },
      exclude: ["c_9"],
    });
    expect(new Headers(init.headers).get("idempotency-key")).toBe("enrich-1");
  });

  it("getEnrichment() GETs one run", async () => {
    const { http, fetchMock } = clientWith({ ...run, status: "done", finished_at: T0 });
    const out = await new Apollo(http).getEnrichment("conn_1", "run_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/apollo/conn_1/enrichments/run_1");
    expect(out.status).toBe("done");
  });
});
