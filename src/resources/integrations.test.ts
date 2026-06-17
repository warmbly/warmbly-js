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
    const { http, fetchMock } = clientWith({ secret: "whsec_abc" });
    const result = await new Integrations(http).getWebhookSecret("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/integrations/connections/conn_1/webhook-secret");
    expect(result).toEqual({ secret: "whsec_abc" });
  });

  it("tests a connection via POST with the body", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    const result = await new Integrations(http).testConnection("conn_1", {
      email: "ops@warmbly.com",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/test");
    expect(JSON.parse(String(init.body))).toEqual({ email: "ops@warmbly.com" });
    expect(result).toEqual({ ok: true });
  });

  it("tests a connection without params", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Integrations(http).testConnection("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/test");
  });

  it("pushes through a connection via POST with the body", async () => {
    const { http, fetchMock } = clientWith({ pushed: 1 });
    const result = await new Integrations(http).pushConnection("conn_1", {
      contact_ids: ["c_1"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/push");
    expect(JSON.parse(String(init.body))).toEqual({ contact_ids: ["c_1"] });
    expect(result).toEqual({ pushed: 1 });
  });

  it("pushes through a connection without params", async () => {
    const { http, fetchMock } = clientWith({ pushed: 0 });
    await new Integrations(http).pushConnection("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/integrations/connections/conn_1/push");
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
