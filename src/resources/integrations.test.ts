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

describe("Integrations", () => {
  it("lists the catalog and unwraps the catalog array", async () => {
    const { http, fetchMock } = clientWith({
      catalog: [{ slug: "hubspot" }, { slug: "salesforce" }],
    });
    const result = await new Integrations(http).catalog();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/catalog");
    expect(result).toEqual([{ slug: "hubspot" }, { slug: "salesforce" }]);
  });

  it("passes catalog query params and falls back to empty array", async () => {
    const { http, fetchMock } = clientWith({});
    const result = await new Integrations(http).catalog({ category: "crm" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("category=crm");
    expect(result).toEqual([]);
  });

  it("lists connections and unwraps the connections array", async () => {
    const { http, fetchMock } = clientWith({ connections: [{ id: "conn_1" }] });
    const result = await new Integrations(http).listConnections();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections");
    expect(result).toEqual([{ id: "conn_1" }]);
  });

  it("lists connections with query and falls back to empty array", async () => {
    const { http, fetchMock } = clientWith({});
    const result = await new Integrations(http).listConnections({ provider: "hubspot" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("provider=hubspot");
    expect(result).toEqual([]);
  });

  it("creates a connection via POST with the body", async () => {
    const { http, fetchMock } = clientWith({ id: "conn_1", provider: "hubspot" });
    const result = await new Integrations(http).createConnection({ provider: "hubspot" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections");
    expect(JSON.parse(String(init.body))).toEqual({ provider: "hubspot" });
    expect(result).toEqual({ id: "conn_1", provider: "hubspot" });
  });

  it("gets a connection and attaches events and runs", async () => {
    const { http, fetchMock } = clientWith({
      connection: { id: "conn_1", provider: "hubspot", status: "active" },
      events: [{ id: "ev_1" }],
      runs: [{ id: "run_1" }],
    });
    const result = await new Integrations(http).getConnection("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections/conn_1");
    expect(result).toEqual({
      id: "conn_1",
      provider: "hubspot",
      status: "active",
      events: [{ id: "ev_1" }],
      runs: [{ id: "run_1" }],
    });
  });

  it("updates connection config via PATCH and unwraps the connection", async () => {
    const { http, fetchMock } = clientWith({ connection: { id: "conn_1", status: "active" } });
    const result = await new Integrations(http).updateConnectionConfig("conn_1", {
      api_key: "secret",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/integrations/connections/conn_1/config");
    expect(JSON.parse(String(init.body))).toEqual({ api_key: "secret" });
    expect(result).toEqual({ id: "conn_1", status: "active" });
  });

  it("deletes a connection via DELETE", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Integrations(http).deleteConnection("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/integrations/connections/conn_1");
  });

  it("lists connection events and unwraps the events array", async () => {
    const { http, fetchMock } = clientWith({ events: [{ id: "ev_1" }, { id: "ev_2" }] });
    const result = await new Integrations(http).listConnectionEvents("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections/conn_1/events");
    expect(result).toEqual([{ id: "ev_1" }, { id: "ev_2" }]);
  });

  it("lists connection events with query and falls back to empty array", async () => {
    const { http, fetchMock } = clientWith({});
    const result = await new Integrations(http).listConnectionEvents("conn_1", { type: "contact" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("type=contact");
    expect(result).toEqual([]);
  });

  it("creates a connection event via POST with the body", async () => {
    const { http, fetchMock } = clientWith({ id: "ev_1" });
    const result = await new Integrations(http).createConnectionEvent("conn_1", {
      event_type: "contact.created",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/events");
    expect(JSON.parse(String(init.body))).toEqual({ event_type: "contact.created" });
    expect(result).toEqual({ id: "ev_1" });
  });

  it("deletes a connection event via DELETE", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Integrations(http).deleteConnectionEvent("conn_1", "ev_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/integrations/connections/conn_1/events/ev_1");
  });

  it("gets field mappings and unwraps the mappings array", async () => {
    const { http, fetchMock } = clientWith({ mappings: [{ from: "email", to: "Email" }] });
    const result = await new Integrations(http).getFieldMappings("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections/conn_1/field-mappings");
    expect(result).toEqual([{ from: "email", to: "Email" }]);
  });

  it("falls back to empty array when field mappings are absent", async () => {
    const { http } = clientWith({});
    const result = await new Integrations(http).getFieldMappings("conn_1");
    expect(result).toEqual([]);
  });

  it("sets field mappings via PUT and unwraps the mappings array", async () => {
    const { http, fetchMock } = clientWith({ mappings: [{ from: "email", to: "Email" }] });
    const result = await new Integrations(http).setFieldMappings("conn_1", {
      mappings: [{ from: "email", to: "Email" }],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/integrations/connections/conn_1/field-mappings");
    expect(JSON.parse(String(init.body))).toEqual({
      mappings: [{ from: "email", to: "Email" }],
    });
    expect(result).toEqual([{ from: "email", to: "Email" }]);
  });

  it("falls back to empty array when set field mappings response is empty", async () => {
    const { http } = clientWith({});
    const result = await new Integrations(http).setFieldMappings("conn_1", { mappings: [] });
    expect(result).toEqual([]);
  });

  it("lists runs and unwraps the runs array", async () => {
    const { http, fetchMock } = clientWith({ runs: [{ id: "run_1" }] });
    const result = await new Integrations(http).listRuns("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections/conn_1/runs");
    expect(result).toEqual([{ id: "run_1" }]);
  });

  it("lists runs with query and falls back to empty array", async () => {
    const { http, fetchMock } = clientWith({});
    const result = await new Integrations(http).listRuns("conn_1", { status: "success" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("status=success");
    expect(result).toEqual([]);
  });

  it("gets the webhook secret", async () => {
    const body = {
      signing_secret: "whsec_abc",
      signature_header: "X-Warmbly-Signature",
      scheme: 'HMAC-SHA256 of "{t}.{body}", sent as t=<unix>,v1=<hex>',
    };
    const { http, fetchMock } = clientWith(body);
    const result = await new Integrations(http).getWebhookSecret("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections/conn_1/webhook-secret");
    expect(result).toEqual(body);
  });

  it("tests a connection via POST with the body", async () => {
    const { http, fetchMock } = clientWith({ sent: 2 });
    const result = await new Integrations(http).testConnection("conn_1", {
      email: "ops@warmbly.com",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/test");
    expect(JSON.parse(String(init.body))).toEqual({ email: "ops@warmbly.com" });
    expect(result).toEqual({ sent: 2 });
  });

  it("tests a connection without params", async () => {
    const { http, fetchMock } = clientWith({ sent: 0 });
    await new Integrations(http).testConnection("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/test");
  });

  it("pushes through a connection via POST with the body", async () => {
    const body = {
      provider: "hubspot",
      pushed: 1,
      failed: 0,
      results: [{ contact_id: "c_1", ok: true }],
    };
    const { http, fetchMock } = clientWith(body);
    const result = await new Integrations(http).pushConnection("conn_1", {
      contact_ids: ["c_1"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/push");
    expect(JSON.parse(String(init.body))).toEqual({ contact_ids: ["c_1"] });
    expect(result).toEqual(body);
  });

  it("pushes a select-all selection with the filters in the body", async () => {
    const { http, fetchMock } = clientWith({
      provider: "hubspot",
      pushed: 3,
      failed: 0,
      results: [],
    });
    await new Integrations(http).pushConnection("conn_1", {
      all: true,
      filters: { subscribed: true },
      exclude: ["c_9"],
    });
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      all: true,
      filters: { subscribed: true },
      exclude: ["c_9"],
    });
  });

  it("setSigningKey PUTs signing_key and unwraps the connection", async () => {
    const { http, fetchMock } = clientWith({
      connection: { id: "conn_1", provider: "calendly", status: "active" },
    });
    const conn = await new Integrations(http).setSigningKey("conn_1", "whsec_12345678");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/integrations\/connections\/conn_1\/signing-key$/);
    expect(JSON.parse(String(init.body))).toEqual({ signing_key: "whsec_12345678" });
    expect(conn.provider).toBe("calendly");
  });

  it("setSigningKey with an empty key sends it so the key is removed", async () => {
    const { http, fetchMock } = clientWith({ connection: { id: "conn_1" } });
    await new Integrations(http).setSigningKey("conn_1", "");
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ signing_key: "" });
  });

  it("setSigningKey surfaces a 400 for a provider that takes no key", async () => {
    const { http } = clientWith(
      { error: "Bad Request", message: "only Calendly and Cal.com connections take a signing key" },
      { status: 400 },
    );
    await expect(new Integrations(http).setSigningKey("conn_1", "x")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rotateInboundUrl POSTs bodyless and returns the new URL", async () => {
    const { http, fetchMock } = clientWith({
      inbound_webhook_url: "https://api.warmbly.com/v1/integrations/inbound/calendly/abc123",
    });
    const out = await new Integrations(http).rotateInboundUrl("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/integrations\/connections\/conn_1\/rotate-inbound-url$/);
    expect(init.body).toBeUndefined();
    expect(out.inbound_webhook_url).toContain("/calendly/");
  });

  it("decodes a connection carrying the inbound URL and health fields", async () => {
    const { http } = clientWith({
      id: "conn_1",
      provider: "cal_com",
      label: "Cal",
      status: "active",
      sync_direction: "pull",
      health: "ok",
      health_detail: null,
      inbound_webhook_url: "https://api.warmbly.com/v1/x",
      created_at: "2026-10-04T09:00:00Z",
    });
    const conn = await new Integrations(http).createConnection({ provider: "cal_com" });
    expect(conn.inbound_webhook_url).toBe("https://api.warmbly.com/v1/x");
    expect(conn.health_detail).toBeNull();
  });

  it("lists bookings via GET with query", async () => {
    const { http, fetchMock } = clientWith({ bookings: [] });
    const result = await new Integrations(http).bookings({ from: "2026-06-01" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/bookings");
    expect(url).toContain("from=2026-06-01");
    expect(result).toEqual({ bookings: [] });
  });
});
