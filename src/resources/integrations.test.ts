import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Integrations } from "./integrations";

function clientWith(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...init.headers },
      }),
  );
  const http = new HttpClient(
    resolveClientOptions({
      apiKey: "wmbly_test",
      fetch: fetchMock as unknown as FetchLike,
    }),
  );
  return { http, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): {
  url: string;
  init: RequestInit;
} {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

const CONN = "11111111-1111-4111-8111-111111111111";
const SRC = "22222222-2222-4222-8222-222222222222";

function body(init: RequestInit): unknown {
  return JSON.parse(String(init.body));
}

describe("Integrations", () => {
  it("lists the catalog and unwraps the catalog array", async () => {
    const { http, fetchMock } = clientWith({
      catalog: [
        {
          provider: "salesforce",
          name: "Salesforce",
          category: "crm",
          auth_method: "oauth",
          beta: false,
          supports_push: true,
          configured: true,
          rank: 2,
        },
      ],
    });
    const result = await new Integrations(http).catalog();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/catalog");
    expect(result[0]?.rank).toBe(2);
    expect(result[0]?.provider).toBe("salesforce");
  });

  it("falls back to an empty catalog", async () => {
    const { http } = clientWith({});
    expect(await new Integrations(http).catalog()).toEqual([]);
  });

  it("lists connections and unwraps the connections array", async () => {
    const { http, fetchMock } = clientWith({
      connections: [
        {
          id: CONN,
          provider: "apollo",
          label: "Apollo",
          status: "connected",
          auth_method: "api_key",
          display_fields: {},
          sync_direction: "pull",
          health: "healthy",
          created_at: "2026-06-01T10:00:00Z",
          updated_at: "2026-06-01T10:00:00Z",
          future_field: 1,
        },
      ],
    });
    const result = await new Integrations(http).listConnections();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections");
    expect(result[0]?.status).toBe("connected");
    expect(result[0]?.future_field).toBe(1);
  });

  it("falls back to an empty connection list", async () => {
    const { http } = clientWith({});
    expect(await new Integrations(http).listConnections()).toEqual([]);
  });

  it("creates a connection via POST with provider, label and config", async () => {
    const { http, fetchMock } = clientWith({
      id: CONN,
      provider: "slack_webhook",
    });
    const result = await new Integrations(http).createConnection({
      provider: "slack_webhook",
      label: "Alerts",
      config: { webhook_url: "https://hooks.example.test/placeholder" },
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections");
    expect(body(init)).toEqual({
      provider: "slack_webhook",
      label: "Alerts",
      config: { webhook_url: "https://hooks.example.test/placeholder" },
    });
    expect(result.id).toBe(CONN);
  });

  it("gets a connection and attaches events and runs", async () => {
    const { http, fetchMock } = clientWith({
      connection: { id: CONN, provider: "hubspot", status: "degraded" },
      events: [{ id: "ev_1", event_type: "reply.received", enabled: true }],
      runs: [{ id: "run_1", kind: "push", status: "ok", records_processed: 3 }],
    });
    const result = await new Integrations(http).getConnection(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/connections/${CONN}`);
    expect(result.status).toBe("degraded");
    expect(result.events?.[0]?.event_type).toBe("reply.received");
    expect(result.runs?.[0]?.records_processed).toBe(3);
  });

  it("updates connection config via PATCH and unwraps the connection", async () => {
    const { http, fetchMock } = clientWith({
      connection: { id: CONN, sync_direction: "push" },
    });
    const result = await new Integrations(http).updateConnectionConfig(CONN, {
      config_capabilities: { objects: ["contact"] },
      sync_direction: "push",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain(`/integrations/connections/${CONN}/config`);
    expect(body(init)).toEqual({
      config_capabilities: { objects: ["contact"] },
      sync_direction: "push",
    });
    expect(result.sync_direction).toBe("push");
  });

  it("deletes a connection via DELETE", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Integrations(http).deleteConnection(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain(`/integrations/connections/${CONN}`);
  });

  it("lists connection events and falls back to empty", async () => {
    const { http, fetchMock } = clientWith({
      events: [{ id: "ev_1" }, { id: "ev_2" }],
    });
    const result = await new Integrations(http).listConnectionEvents(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/connections/${CONN}/events`);
    expect(result).toHaveLength(2);
    const empty = clientWith({});
    expect(await new Integrations(empty.http).listConnectionEvents(CONN)).toEqual([]);
  });

  it("creates a connection event via POST and returns the bare subscription", async () => {
    const { http, fetchMock } = clientWith(
      {
        id: "ev_1",
        connection_id: CONN,
        event_type: "reply.received",
        action: "clay.send_row",
        config: {},
        enabled: false,
        use_case: "custom",
      },
      { status: 201 },
    );
    const result = await new Integrations(http).createConnectionEvent(CONN, {
      event_type: "reply.received",
      action: "clay.send_row",
      config: {},
      enabled: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/connections/${CONN}/events`);
    expect(body(init)).toEqual({
      event_type: "reply.received",
      action: "clay.send_row",
      config: {},
      enabled: false,
    });
    expect(result.action).toBe("clay.send_row");
    expect(result.enabled).toBe(false);
  });

  it("deletes a connection event via DELETE", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Integrations(http).deleteConnectionEvent(CONN, "ev_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain(`/integrations/connections/${CONN}/events/ev_1`);
  });

  it("gets field mappings and falls back to empty", async () => {
    const { http, fetchMock } = clientWith({
      mappings: [
        {
          id: "m_1",
          connection_id: CONN,
          direction: "push",
          object_name: "contact",
          warmbly_field: "first_name",
          external_field: "FirstName",
          transform: "trim",
          static_value: "",
          is_default: true,
        },
      ],
    });
    const result = await new Integrations(http).getFieldMappings(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/connections/${CONN}/field-mappings`);
    expect(result[0]?.external_field).toBe("FirstName");
    const empty = clientWith({});
    expect(await new Integrations(empty.http).getFieldMappings(CONN)).toEqual([]);
  });

  it("sets field mappings via PUT with object and mappings", async () => {
    const { http, fetchMock } = clientWith({
      mappings: [{ warmbly_field: "company", external_field: "Company" }],
    });
    const result = await new Integrations(http).setFieldMappings(CONN, {
      object: "contact",
      mappings: [
        {
          warmbly_field: "company",
          external_field: "Company",
          transform: "uppercase",
        },
        {
          external_field: "LeadSource",
          transform: "static",
          static_value: "Warmbly",
        },
      ],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain(`/integrations/connections/${CONN}/field-mappings`);
    expect(body(init)).toEqual({
      object: "contact",
      mappings: [
        {
          warmbly_field: "company",
          external_field: "Company",
          transform: "uppercase",
        },
        {
          external_field: "LeadSource",
          transform: "static",
          static_value: "Warmbly",
        },
      ],
    });
    expect(result).toHaveLength(1);
    const empty = clientWith({});
    expect(
      await new Integrations(empty.http).setFieldMappings(CONN, {
        mappings: [],
      }),
    ).toEqual([]);
  });

  it("lists runs and falls back to empty", async () => {
    const { http, fetchMock } = clientWith({
      runs: [
        {
          id: "run_1",
          connection_id: CONN,
          kind: "refresh",
          status: "ok",
          detail: "",
          records_processed: 0,
          started_at: "2026-06-01T10:00:00Z",
          finished_at: "2026-06-01T10:00:01Z",
        },
      ],
    });
    const result = await new Integrations(http).listRuns(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/connections/${CONN}/runs`);
    expect(result[0]?.kind).toBe("refresh");
    const empty = clientWith({});
    expect(await new Integrations(empty.http).listRuns(CONN)).toEqual([]);
  });

  it("gets the webhook signing secret", async () => {
    const { http, fetchMock } = clientWith({
      signing_secret: "placeholder-secret",
      signature_header: "X-Warmbly-Signature",
      scheme: 'HMAC-SHA256 of "{t}.{body}", sent as t=<unix>,v1=<hex>',
    });
    const result = await new Integrations(http).getWebhookSecret(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/connections/${CONN}/webhook-secret`);
    expect(result.signature_header).toBe("X-Warmbly-Signature");
  });

  it("sets an inbound signing key via PUT and unwraps the connection", async () => {
    const { http, fetchMock } = clientWith({
      connection: { id: CONN, provider: "calendly", status: "connected" },
    });
    const result = await new Integrations(http).setSigningKey(CONN, "placeholder-key");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain(`/integrations/connections/${CONN}/signing-key`);
    expect(body(init)).toEqual({ signing_key: "placeholder-key" });
    expect(result.provider).toBe("calendly");
  });

  it("rotates the inbound URL via POST", async () => {
    const { http, fetchMock } = clientWith({
      inbound_webhook_url: "https://api.example.test/api/v1/integrations/inbound/calendly/abc",
    });
    const result = await new Integrations(http).rotateInboundUrl(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/connections/${CONN}/rotate-inbound-url`);
    expect(init.body).toBeUndefined();
    expect(result.inbound_webhook_url).toContain("/inbound/calendly/");
  });

  it("tests a connection via POST and returns the sent count", async () => {
    const { http, fetchMock } = clientWith({ sent: 2 });
    const result = await new Integrations(http).testConnection(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/connections/${CONN}/test`);
    expect(result.sent).toBe(2);
  });

  it("pushes contacts by id list", async () => {
    const { http, fetchMock } = clientWith({
      provider: "hubspot",
      pushed: 1,
      failed: 1,
      results: [
        { contact_id: "c_1", email: "ada@example.test", ok: true },
        {
          contact_id: "c_2",
          email: "bob@example.test",
          ok: false,
          error: "rate limited",
        },
      ],
    });
    const result = await new Integrations(http).pushConnection(CONN, {
      contact_ids: ["c_1", "c_2"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/connections/${CONN}/push`);
    expect(body(init)).toEqual({ contact_ids: ["c_1", "c_2"] });
    expect(result.failed).toBe(1);
    expect(result.results[1]?.error).toBe("rate limited");
  });

  it("pushes contacts by select-all filters", async () => {
    const { http, fetchMock } = clientWith({
      provider: "hubspot",
      pushed: 0,
      failed: 0,
      results: [],
    });
    await new Integrations(http).pushConnection(CONN, {
      all: true,
      filters: { q: "acme" },
      exclude: ["c_9"],
    });
    const { init } = lastCall(fetchMock);
    expect(body(init)).toEqual({
      all: true,
      filters: { q: "acme" },
      exclude: ["c_9"],
    });
  });

  it("lists bookings and unwraps the bookings array", async () => {
    const { http, fetchMock } = clientWith({
      bookings: [
        {
          id: "b_1",
          organization_id: "o_1",
          source: "cal_com",
          external_event_id: "evt_1",
          status: "rescheduled",
          invitee_email: "ada@example.test",
          invitee_name: "Ada",
          event_name: "Intro call",
          scheduled_for: "2026-07-01T15:00:00Z",
          contact_name: "Ada Lovelace",
          created_at: "2026-06-01T10:00:00Z",
          updated_at: "2026-06-01T10:00:00Z",
        },
      ],
    });
    const result = await new Integrations(http).bookings();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/integrations\/bookings$/);
    expect(result[0]?.status).toBe("rescheduled");
    const empty = clientWith({});
    expect(await new Integrations(empty.http).bookings()).toEqual([]);
  });

  it("lists community apps as a page with query", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          application_id: "app_1",
          slug: "acme-sync",
          name: "Acme Sync",
          scopes: 1048576,
          permissions: [],
          status: "published",
          listed: true,
          installs: 12,
          installed: false,
          published_at: "2026-05-01T00:00:00Z",
        },
      ],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Integrations(http).community({
      limit: 20,
      cursor: "abc",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/community?");
    expect(url).toContain("limit=20");
    expect(url).toContain("cursor=abc");
    expect(page.data[0]?.slug).toBe("acme-sync");
    expect(page.pagination.total).toBe(1);
  });

  it("opens a community app by slug", async () => {
    const { http, fetchMock } = clientWith({
      application_id: "app_1",
      slug: "acme-sync",
      installed: true,
    });
    const app = await new Integrations(http).getCommunityApp("acme-sync");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/community/acme-sync");
    expect(app.installed).toBe(true);
  });
});

describe("Integrations.apollo", () => {
  const source = {
    id: SRC,
    connection_id: CONN,
    name: "Q3 list",
    list_id: "list_1",
    list_name: "Q3 list",
    category_ids: [],
    verified_only: true,
    recurring: false,
    enabled: true,
    status: "idle",
    last_result: {
      read: 10,
      imported: 7,
      updated: 0,
      skipped: 1,
      failed: 0,
      no_email: 1,
      unverified: 1,
      suppressed: 0,
      already_seen: 0,
    },
    total_imported: 7,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  };
  const run = {
    id: "run_1",
    connection_id: CONN,
    overwrite: false,
    status: "running",
    total: 100,
    processed: 40,
    enriched: 30,
    not_found: 8,
    failed: 2,
    credits_consumed: 38,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  };

  it("reads the overview", async () => {
    const { http, fetchMock } = clientWith({
      connection_id: CONN,
      label: "Apollo",
      status: "connected",
      health: "healthy",
      account_name: "Ada",
      sources: 2,
      total_imported: 50,
    });
    const o = await new Integrations(http).apollo.overview(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(new RegExp(`/integrations/apollo/${CONN}$`));
    expect(o.sources).toBe(2);
  });

  it("replaces the key via PUT with api_key", async () => {
    const { http, fetchMock } = clientWith({
      connection_id: CONN,
      status: "connected",
    });
    const o = await new Integrations(http).apollo.replaceKey(CONN, "placeholder-key");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain(`/integrations/apollo/${CONN}/key`);
    expect(body(init)).toEqual({ api_key: "placeholder-key" });
    expect(o.status).toBe("connected");
  });

  it("lists saved lists and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "list_1", name: "Q3", count: 120 }],
    });
    const lists = await new Integrations(http).apollo.lists(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/apollo/${CONN}/lists`);
    expect(lists[0]?.count).toBe(120);
    const empty = clientWith({});
    expect(await new Integrations(empty.http).apollo.lists(CONN)).toEqual([]);
  });

  it("previews an import via POST", async () => {
    const { http, fetchMock } = clientWith({
      total: 120,
      sample: [
        {
          apollo_id: "p_1",
          name: "Ada Lovelace",
          email: "ada@example.test",
          email_status: "verified",
          title: "CTO",
          company: "Analytical",
          already_in_warmbly: false,
          will_import: true,
        },
      ],
    });
    const p = await new Integrations(http).apollo.previewImport(CONN, {
      list_id: "list_1",
      verified_only: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/apollo/${CONN}/import/preview`);
    expect(body(init)).toEqual({ list_id: "list_1", verified_only: false });
    expect(p.sample[0]?.will_import).toBe(true);
  });

  it("lists import sources and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [source] });
    const list = await new Integrations(http).apollo.listImportSources(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/apollo/${CONN}/import-sources`);
    expect(list[0]?.last_result?.imported).toBe(7);
  });

  it("creates an import source via POST", async () => {
    const { http, fetchMock } = clientWith(source, { status: 201 });
    const created = await new Integrations(http).apollo.createImportSource(CONN, {
      list_id: "list_1",
      list_name: "Q3 list",
      campaign_id: "camp_1",
      category_ids: ["cat_1"],
      verified_only: true,
      recurring: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/apollo/${CONN}/import-sources`);
    expect(body(init)).toEqual({
      list_id: "list_1",
      list_name: "Q3 list",
      campaign_id: "camp_1",
      category_ids: ["cat_1"],
      verified_only: true,
      recurring: false,
    });
    expect(created.id).toBe(SRC);
  });

  it("updates an import source via PATCH, clearing the campaign with null", async () => {
    const { http, fetchMock } = clientWith({ ...source, enabled: false });
    const updated = await new Integrations(http).apollo.updateImportSource(CONN, SRC, {
      campaign_id: null,
      enabled: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain(`/integrations/apollo/${CONN}/import-sources/${SRC}`);
    expect(body(init)).toEqual({ campaign_id: null, enabled: false });
    expect(updated.enabled).toBe(false);
  });

  it("deletes an import source via DELETE", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Integrations(http).apollo.deleteImportSource(CONN, SRC);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain(`/integrations/apollo/${CONN}/import-sources/${SRC}`);
  });

  it("runs an import source via POST", async () => {
    const { http, fetchMock } = clientWith({ ...source, status: "running" });
    const r = await new Integrations(http).apollo.runImportSource(CONN, SRC);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/apollo/${CONN}/import-sources/${SRC}/run`);
    expect(r.status).toBe("running");
  });

  it("lists enrichments with limit", async () => {
    const { http, fetchMock } = clientWith({ data: [run] });
    const runs = await new Integrations(http).apollo.listEnrichments(CONN, {
      limit: 5,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/apollo/${CONN}/enrichments`);
    expect(url).toContain("limit=5");
    expect(runs[0]?.credits_consumed).toBe(38);
  });

  it("starts an enrichment via POST", async () => {
    const { http, fetchMock } = clientWith({ ...run, status: "queued" }, { status: 202 });
    const r = await new Integrations(http).apollo.startEnrichment(CONN, {
      contact_ids: ["c_1"],
      overwrite: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/apollo/${CONN}/enrichments`);
    expect(body(init)).toEqual({ contact_ids: ["c_1"], overwrite: true });
    expect(r.status).toBe("queued");
  });

  it("gets one enrichment run", async () => {
    const { http, fetchMock } = clientWith({
      ...run,
      status: "done",
      finished_at: "2026-06-01T11:00:00Z",
    });
    const r = await new Integrations(http).apollo.getEnrichment(CONN, "run_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/apollo/${CONN}/enrichments/run_1`);
    expect(r.finished_at).toBe("2026-06-01T11:00:00Z");
  });
});

describe("Integrations.clay", () => {
  const settings = {
    connection_id: CONN,
    label: "Clay",
    status: "connected",
    health: "healthy",
    inbound_url_minted: true,
    defaults: {
      campaign_id: "camp_1",
      category_ids: [],
      segment_ids: [],
      dedup: "update",
      subscribed: true,
    },
    outbound: {
      webhook_url_set: true,
      webhook_host: "clay.example.test",
      auth_token_set: false,
      events: ["reply.received"],
    },
    stats: {
      received: 10,
      created: 6,
      updated: 3,
      skipped: 1,
      failed: 0,
      last_received_at: "2026-06-01T10:00:00Z",
    },
    available_events: ["reply.received", "meeting.booked"],
  };

  it("gets settings", async () => {
    const { http, fetchMock } = clientWith(settings);
    const s = await new Integrations(http).clay.getSettings(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(new RegExp(`/integrations/clay/${CONN}$`));
    expect(s.defaults.dedup).toBe("update");
    expect(s.outbound.webhook_host).toBe("clay.example.test");
  });

  it("updates settings via PATCH", async () => {
    const { http, fetchMock } = clientWith(settings);
    await new Integrations(http).clay.updateSettings(CONN, {
      defaults: { dedup: "skip", subscribed: false },
      webhook_url: "",
      events: ["meeting.booked"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(new RegExp(`/integrations/clay/${CONN}$`));
    expect(body(init)).toEqual({
      defaults: { dedup: "skip", subscribed: false },
      webhook_url: "",
      events: ["meeting.booked"],
    });
  });
});

describe("Integrations.salesforce", () => {
  const source = {
    id: SRC,
    connection_id: CONN,
    name: "Hot leads",
    source_kind: "list_view",
    object: "Lead",
    source_id: "00B000000000001",
    source_label: "Hot leads",
    category_ids: [],
    recurring: true,
    enabled: true,
    status: "idle",
    last_result: {
      read: 5,
      imported: 3,
      updated: 1,
      linked: 1,
      skipped: 0,
      failed: 0,
      no_email: 0,
      opted_out: 0,
    },
    total_imported: 3,
  };
  const settings = {
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
      lead_status_on_reply: {},
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
        direction: "pull",
        policy: "if_empty",
      },
    ],
    daily_api_budget: 0,
  };

  it("reads the overview without checks", async () => {
    const { http, fetchMock } = clientWith({
      connection_id: CONN,
      label: "Salesforce",
      status: "connected",
      health: "healthy",
      org: {
        instance_url: "https://acme.example.test",
        environment: "production",
        login_host: "login.example.test",
      },
      api: { used: 10, max: 100, calls_today: 4, budget: 20 },
      counts: {
        pending: 1,
        synced_24h: 5,
        failed: 0,
        skipped_24h: 2,
        linked_records: 40,
      },
      settings_enabled: true,
    });
    const o = await new Integrations(http).salesforce.overview(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(new RegExp(`/integrations/salesforce/${CONN}/overview$`));
    expect(o.counts.linked_records).toBe(40);
  });

  it("reads the overview with checks", async () => {
    const { http, fetchMock } = clientWith({
      connection_id: CONN,
      checks: [{ key: "api", label: "API access", ok: true }],
    });
    const o = await new Integrations(http).salesforce.overview(CONN, {
      checks: true,
    });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("checks=1");
    expect(o.checks?.[0]?.ok).toBe(true);
  });

  it("gets settings with fields and defaults", async () => {
    const { http, fetchMock } = clientWith({
      settings,
      warmbly_fields: [{ key: "first_name", label: "First name" }],
      defaults: settings,
    });
    const r = await new Integrations(http).salesforce.getSettings(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/settings`);
    expect(r.warmbly_fields[0]?.key).toBe("first_name");
    expect(r.settings.matching.create_when).toBe("reply");
  });

  it("updates settings via PUT and unwraps the saved settings", async () => {
    const { http, fetchMock } = clientWith({ settings });
    const saved = await new Integrations(http).salesforce.updateSettings(CONN, settings);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain(`/integrations/salesforce/${CONN}/settings`);
    expect(body(init)).toEqual(settings);
    expect(saved.field_map[0]?.salesforce).toBe("FirstName");
  });

  it("reads metadata", async () => {
    const { http, fetchMock } = clientWith({
      lead_fields: [
        {
          name: "Email",
          label: "Email",
          type: "email",
          createable: true,
          updateable: true,
          calculated: false,
          custom: false,
        },
      ],
      contact_fields: [],
      lead_statuses: [{ value: "Open", label: "Open" }],
      lead_sources: [],
    });
    const m = await new Integrations(http).salesforce.metadata(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/metadata`);
    expect(m.lead_fields[0]?.name).toBe("Email");
  });

  it("searches users with q", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "005000000000001", name: "Ada", email: "ada@example.test" }],
    });
    const users = await new Integrations(http).salesforce.users(CONN, {
      q: "ada",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/users`);
    expect(url).toContain("q=ada");
    expect(users[0]?.name).toBe("Ada");
  });

  it("lists list views for an object", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "00B000000000001", label: "Hot leads", object: "Lead" }],
    });
    const views = await new Integrations(http).salesforce.listViews(CONN, {
      object: "Lead",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/list-views`);
    expect(url).toContain("object=Lead");
    expect(views[0]?.label).toBe("Hot leads");
  });

  it("searches campaigns", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "701000000000001",
          name: "Webinar",
          status: "Planned",
          type: "Event",
          member_count: 30,
        },
      ],
    });
    const c = await new Integrations(http).salesforce.campaigns(CONN, {
      q: "web",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/campaigns`);
    expect(url).toContain("q=web");
    expect(c[0]?.member_count).toBe(30);
  });

  it("previews an import via POST", async () => {
    const { http, fetchMock } = clientWith({
      total: 40,
      sample: [
        {
          record_id: "00Q000000000001",
          object: "Lead",
          name: "Ada Lovelace",
          email: "ada@example.test",
          company: "Analytical",
          title: "CTO",
          owner_name: "Bob",
          status: "Open",
          already_linked: false,
        },
      ],
    });
    const p = await new Integrations(http).salesforce.previewImport(CONN, {
      source_kind: "list_view",
      object: "Lead",
      source_id: "00B000000000001",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/salesforce/${CONN}/import/preview`);
    expect(body(init)).toEqual({
      source_kind: "list_view",
      object: "Lead",
      source_id: "00B000000000001",
    });
    expect(p.total).toBe(40);
  });

  it("lists import sources", async () => {
    const { http, fetchMock } = clientWith({ data: [source] });
    const list = await new Integrations(http).salesforce.listImportSources(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/import-sources`);
    expect(list[0]?.last_result?.linked).toBe(1);
  });

  it("creates an import source via POST", async () => {
    const { http, fetchMock } = clientWith(source, { status: 201 });
    const created = await new Integrations(http).salesforce.createImportSource(CONN, {
      source_kind: "list_view",
      object: "Lead",
      source_id: "00B000000000001",
      source_label: "Hot leads",
      recurring: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/salesforce/${CONN}/import-sources`);
    expect(body(init)).toEqual({
      source_kind: "list_view",
      object: "Lead",
      source_id: "00B000000000001",
      source_label: "Hot leads",
      recurring: true,
    });
    expect(created.source_label).toBe("Hot leads");
  });

  it("updates an import source via PATCH", async () => {
    const { http, fetchMock } = clientWith({ ...source, recurring: false });
    const u = await new Integrations(http).salesforce.updateImportSource(CONN, SRC, {
      campaign_id: null,
      recurring: false,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain(`/integrations/salesforce/${CONN}/import-sources/${SRC}`);
    expect(body(init)).toEqual({ campaign_id: null, recurring: false });
    expect(u.recurring).toBe(false);
  });

  it("deletes an import source via DELETE", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Integrations(http).salesforce.deleteImportSource(CONN, SRC);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain(`/integrations/salesforce/${CONN}/import-sources/${SRC}`);
  });

  it("runs an import source via POST", async () => {
    const { http, fetchMock } = clientWith({ ...source, status: "running" });
    const r = await new Integrations(http).salesforce.runImportSource(CONN, SRC);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/salesforce/${CONN}/import-sources/${SRC}/run`);
    expect(r.status).toBe("running");
  });

  it("pages the activity log with filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "a_1",
          connection_id: CONN,
          contact_id: "c_1",
          contact_email: "ada@example.test",
          kind: "replied",
          status: "failed",
          attempts: 3,
          next_attempt_at: "2026-06-01T12:00:00Z",
          detail: "record locked",
          occurred_at: "2026-06-01T10:00:00Z",
          created_at: "2026-06-01T10:00:01Z",
        },
      ],
      pagination: { next_cursor: "cur2", has_more: true },
    });
    const page = await new Integrations(http).salesforce.listActivity(CONN, {
      status: "failed",
      contact_id: "c_1",
      limit: 25,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain(`/integrations/salesforce/${CONN}/activity`);
    expect(url).toContain("status=failed");
    expect(url).toContain("contact_id=c_1");
    expect(url).toContain("limit=25");
    expect(page.data[0]?.detail).toBe("record locked");
    expect(page.hasNextPage()).toBe(true);
  });

  it("retries activity rows via POST with ids", async () => {
    const { http, fetchMock } = clientWith({ requeued: 2 });
    const r = await new Integrations(http).salesforce.retryActivity(CONN, ["a_1", "a_2"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/salesforce/${CONN}/activity/retry`);
    expect(body(init)).toEqual({ ids: ["a_1", "a_2"] });
    expect(r.requeued).toBe(2);
  });

  it("runs sync-now via POST", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    const r = await new Integrations(http).salesforce.syncNow(CONN);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain(`/integrations/salesforce/${CONN}/sync-now`);
    expect(r.ok).toBe(true);
  });
});
