import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { ConflictError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Integrations } from "./integrations";
import { Salesforce, type SalesforceSettings } from "./salesforce";

function clientWithSequence(responses: Array<{ body: unknown; status?: number }>): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const status = next?.status ?? 200;
    const payload = status === 204 ? null : JSON.stringify(next?.body);
    return new Response(payload, { status, headers: { "content-type": "application/json" } });
  });
  const http = new HttpClient(
    resolveClientOptions({
      apiKey: "wmbly_test",
      fetch: fetchMock as unknown as FetchLike,
      maxRetries: 0,
    }),
  );
  return { http, fetchMock };
}

function sf(responses: Array<{ body: unknown; status?: number }>) {
  const { http, fetchMock } = clientWithSequence(responses);
  return { client: new Salesforce(http), fetchMock };
}

function callAt(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const call = fetchMock.mock.calls[index];
  const init = (call?.[1] ?? {}) as RequestInit;
  const url = new URL(String(call?.[0]));
  return {
    url,
    init,
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    headers: (init.headers ?? {}) as Record<string, string>,
  };
}

const BASE = "/v1/integrations/salesforce/conn_1";

const settings: SalesforceSettings = {
  enabled: true,
  matching: {
    prefer: "contact",
    create_when: "reply",
    create_as: "lead",
    lead_source: "Warmbly",
    lead_status: "",
    owner: "connected_user",
    run_assignment_rules: false,
  },
  activity: {
    sent: true,
    replied: true,
    opened: false,
    clicked: false,
    bounced: true,
    unsubscribed: true,
    meeting_booked: true,
    include_body: true,
    assign_to: "record_owner",
    relate_to_opportunity: true,
  },
  writeback: {
    lead_status_on_sent: "",
    lead_status_on_reply: { positive: "Working - Contacted" },
    lead_status_on_meeting: "",
    never_move_backwards: true,
  },
  inbound: {
    opt_out: "both",
    pause_on_converted: false,
    pause_on_statuses: [],
    pause_on_open_opportunity: false,
  },
  field_map: [
    {
      object: "Lead",
      warmbly: "first_name",
      salesforce: "FirstName",
      direction: "both",
      policy: "if_empty",
    },
  ],
  daily_api_budget: 0,
};

const source = {
  id: "src_1",
  organization_id: "org_1",
  connection_id: "conn_1",
  created_by_user_id: "user_1",
  name: "Webinar attendees",
  source_kind: "campaign",
  object: "CampaignMember",
  source_id: "7015g000000AbCdAAK",
  source_label: "Q3 webinar",
  campaign_id: "camp_1",
  category_ids: [],
  recurring: true,
  enabled: true,
  status: "running",
  last_run_at: "2026-10-08T09:00:00Z",
  last_result: {
    read: 120,
    imported: 100,
    updated: 5,
    linked: 110,
    skipped: 3,
    failed: 0,
    no_email: 2,
    opted_out: 10,
  },
  total_imported: 100,
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-08T09:00:00Z",
};

const activity = {
  id: "act_1",
  organization_id: "org_1",
  connection_id: "conn_1",
  contact_id: "c_1",
  contact_email: "ana@example.com",
  kind: "replied",
  payload: { campaign_id: "camp_1" },
  status: "failed",
  attempts: 3,
  next_attempt_at: "2026-10-08T10:00:00Z",
  record_id: "00Q5g00000AbCdE",
  detail: "Salesforce: INVALID_FIELD",
  occurred_at: "2026-10-08T09:00:00Z",
  created_at: "2026-10-08T09:00:01Z",
};

describe("Salesforce", () => {
  it("is reachable as integrations.salesforce", () => {
    const { http } = clientWithSequence([{ body: {} }]);
    expect(new Integrations(http).salesforce).toBeInstanceOf(Salesforce);
  });

  it("overview GETs the connection health and sends checks=1 only when asked", async () => {
    const overview = {
      connection_id: "conn_1",
      label: "Acme Salesforce",
      status: "active",
      health: "healthy",
      org: {
        id: "00D5g000000AbCd",
        instance_url: "https://acme.my.salesforce.com",
        environment: "production",
        login_host: "login.salesforce.com",
        user_id: "0055g000000AbCd",
      },
      api: { used: 1200, max: 100000, calls_today: 340, budget: 20000 },
      counts: { pending: 4, synced_24h: 210, failed: 1, skipped_24h: 3, linked_records: 980 },
      last_pull_at: "2026-10-08T09:00:00Z",
      settings_enabled: true,
      checks: [{ key: "task_subtype", label: "Email Tasks", ok: false, detail: "not writable" }],
      brand_new_field: 1,
    };
    const { client, fetchMock } = sf([{ body: overview }, { body: overview }]);
    const out = await client.overview("conn_1", { checks: true });
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(first.url.pathname).toBe(`${BASE}/overview`);
    expect(first.url.searchParams.get("checks")).toBe("1");
    expect(out.api.used).toBe(1200);
    expect(out.counts.linked_records).toBe(980);
    expect(out.checks?.[0]?.ok).toBe(false);
    await client.overview("conn_1");
    expect(callAt(fetchMock, 1).url.search).toBe("");
  });

  it("getSettings returns the settings with the field list and defaults", async () => {
    const { client, fetchMock } = sf([
      {
        body: {
          settings,
          warmbly_fields: [{ key: "first_name", label: "First name" }],
          defaults: settings,
        },
      },
    ]);
    const out = await client.getSettings("conn_1");
    const { url, init } = callAt(fetchMock);
    expect(init.method).toBe("GET");
    expect(url.pathname).toBe(`${BASE}/settings`);
    expect(out.settings.matching.prefer).toBe("contact");
    expect(out.warmbly_fields[0]?.key).toBe("first_name");
  });

  it("updateSettings PUTs the whole document and unwraps settings", async () => {
    const { client, fetchMock } = sf([{ body: { settings: { ...settings, enabled: false } } }]);
    const out = await client.updateSettings("conn_1", { ...settings, enabled: false });
    const { url, init, body } = callAt(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url.pathname).toBe(`${BASE}/settings`);
    expect(body.enabled).toBe(false);
    expect(body.field_map[0].salesforce).toBe("FirstName");
    expect(out.enabled).toBe(false);
  });

  it("metadata GETs fields and picklists", async () => {
    const { client, fetchMock } = sf([
      {
        body: {
          lead_fields: [
            {
              name: "Status",
              label: "Lead Status",
              type: "picklist",
              createable: true,
              updateable: true,
              calculated: false,
              custom: false,
              picklist: [{ value: "Open", label: "Open" }],
            },
          ],
          contact_fields: [],
          lead_statuses: [{ value: "Open", label: "Open" }],
          lead_sources: [],
        },
      },
    ]);
    const out = await client.metadata("conn_1");
    expect(callAt(fetchMock).url.pathname).toBe(`${BASE}/metadata`);
    expect(out.lead_fields[0]?.picklist?.[0]?.value).toBe("Open");
  });

  it("users, listViews and campaigns unwrap data and pass their query", async () => {
    const { client, fetchMock } = sf([
      { body: { data: [{ id: "005", name: "Ana", email: "ana@acme.com" }] } },
      { body: { data: [{ id: "00B", label: "My Leads", object: "Lead" }] } },
      {
        body: {
          data: [{ id: "701", name: "Q3", status: "Active", type: "Webinar", member_count: 120 }],
        },
      },
    ]);
    const users = await client.users("conn_1", { q: "ana" });
    const views = await client.listViews("conn_1", "Lead");
    const campaigns = await client.campaigns("conn_1", { q: "q3" });
    expect(callAt(fetchMock, 0).url.pathname).toBe(`${BASE}/users`);
    expect(callAt(fetchMock, 0).url.searchParams.get("q")).toBe("ana");
    expect(callAt(fetchMock, 1).url.pathname).toBe(`${BASE}/list-views`);
    expect(callAt(fetchMock, 1).url.searchParams.get("object")).toBe("Lead");
    expect(callAt(fetchMock, 2).url.pathname).toBe(`${BASE}/campaigns`);
    expect(users[0]?.email).toBe("ana@acme.com");
    expect(views[0]?.label).toBe("My Leads");
    expect(campaigns[0]?.member_count).toBe(120);
  });

  it("previewImport POSTs the source and decodes the sample", async () => {
    const { client, fetchMock } = sf([
      {
        body: {
          total: 42,
          sample: [
            {
              record_id: "00Q",
              object: "Lead",
              name: "Ana Diaz",
              email: "ana@example.com",
              company: "Acme",
              title: "CTO",
              owner_name: "Bo",
              status: "Open",
              already_linked: false,
            },
          ],
        },
      },
    ]);
    const out = await client.previewImport("conn_1", {
      source_kind: "list_view",
      object: "Lead",
      source_id: "00B5g00000AbCdE",
    });
    const { url, init, body } = callAt(fetchMock);
    expect(init.method).toBe("POST");
    expect(url.pathname).toBe(`${BASE}/import/preview`);
    expect(body).toEqual({
      source_kind: "list_view",
      object: "Lead",
      source_id: "00B5g00000AbCdE",
    });
    expect(out.total).toBe(42);
    expect(out.sample[0]?.already_linked).toBe(false);
  });

  it("listImportSources unwraps data", async () => {
    const { client, fetchMock } = sf([{ body: { data: [source] } }]);
    const out = await client.listImportSources("conn_1");
    expect(callAt(fetchMock).url.pathname).toBe(`${BASE}/import-sources`);
    expect(out[0]?.last_result?.opted_out).toBe(10);
  });

  it("createImportSource POSTs with the caller's idempotency key and decodes the 201", async () => {
    const { client, fetchMock } = sf([{ body: source, status: 201 }]);
    const out = await client.createImportSource(
      "conn_1",
      { source_kind: "campaign", source_id: "7015g000000AbCdAAK", recurring: true },
      { idempotencyKey: "sf-import-1" },
    );
    const { url, init, body, headers } = callAt(fetchMock);
    expect(init.method).toBe("POST");
    expect(url.pathname).toBe(`${BASE}/import-sources`);
    expect(body).toEqual({
      source_kind: "campaign",
      source_id: "7015g000000AbCdAAK",
      recurring: true,
    });
    expect(headers["Idempotency-Key"]).toBe("sf-import-1");
    expect(out.status).toBe("running");
  });

  it("updateImportSource PATCHes and keeps an explicit null campaign_id", async () => {
    const { client, fetchMock } = sf([{ body: { ...source, campaign_id: undefined } }]);
    await client.updateImportSource("conn_1", "src_1", { campaign_id: null, recurring: false });
    const { url, init, body } = callAt(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url.pathname).toBe(`${BASE}/import-sources/src_1`);
    expect(body).toEqual({ campaign_id: null, recurring: false });
  });

  it("runImportSource POSTs to run and surfaces import_running as a ConflictError", async () => {
    const { client, fetchMock } = sf([
      { body: source },
      {
        status: 409,
        body: { error: "Conflict", message: "already running", code: "import_running" },
      },
    ]);
    const out = await client.runImportSource("conn_1", "src_1");
    expect(callAt(fetchMock, 0).init.method).toBe("POST");
    expect(callAt(fetchMock, 0).url.pathname).toBe(`${BASE}/import-sources/src_1/run`);
    expect(out.id).toBe("src_1");
    const err = await client.runImportSource("conn_1", "src_1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).code).toBe("import_running");
  });

  it("deleteImportSource DELETEs and resolves void on 204", async () => {
    const { client, fetchMock } = sf([{ body: undefined, status: 204 }]);
    await expect(client.deleteImportSource("conn_1", "src_1")).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url.pathname).toBe(`${BASE}/import-sources/src_1`);
  });

  it("listActivity pages with the cursor and passes the filters", async () => {
    const { client, fetchMock } = sf([
      { body: { data: [activity], pagination: { next_cursor: "c2", has_more: true } } },
      {
        body: {
          data: [{ ...activity, id: "act_2", status: "brand_new", kind: "something_new" }],
          pagination: { next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await client.listActivity("conn_1", { status: "failed", limit: 1 });
    const all = await page.toArray();
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(first.url.pathname).toBe(`${BASE}/activity`);
    expect(first.url.searchParams.get("status")).toBe("failed");
    expect(first.url.searchParams.get("limit")).toBe("1");
    expect(callAt(fetchMock, 1).url.searchParams.get("cursor")).toBe("c2");
    expect(all.map((a) => a.id)).toEqual(["act_1", "act_2"]);
    expect(all[1]?.status).toBe("brand_new");
  });

  it("retryActivity POSTs the ids and returns requeued", async () => {
    const { client, fetchMock } = sf([{ body: { requeued: 2 } }]);
    const out = await client.retryActivity("conn_1", ["act_1", "act_2"]);
    const { url, init, body } = callAt(fetchMock);
    expect(init.method).toBe("POST");
    expect(url.pathname).toBe(`${BASE}/activity/retry`);
    expect(body).toEqual({ ids: ["act_1", "act_2"] });
    expect(out.requeued).toBe(2);
  });

  it("syncNow POSTs sync-now", async () => {
    const { client, fetchMock } = sf([{ body: { ok: true } }]);
    const out = await client.syncNow("conn_1");
    const { url, init } = callAt(fetchMock);
    expect(init.method).toBe("POST");
    expect(url.pathname).toBe(`${BASE}/sync-now`);
    expect(out.ok).toBe(true);
  });

  it("encodes the connection id in the path", async () => {
    const { client, fetchMock } = sf([{ body: { ok: true } }]);
    await client.syncNow("a/b");
    expect(callAt(fetchMock).url.pathname).toBe("/v1/integrations/salesforce/a%2Fb/sync-now");
  });
});
