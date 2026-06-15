import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Integrations } from "./integrations";

function clientWith(body: unknown): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
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

describe("Integrations", () => {
  it("updates a connection config with PATCH", async () => {
    const { http, fetchMock } = clientWith({ id: "conn1" });
    await new Integrations(http).updateConnectionConfig("conn1", { api_key: "x" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/integrations/connections/conn1/config");
  });

  it("replaces field mappings with PUT", async () => {
    const { http, fetchMock } = clientWith({ mappings: [] });
    await new Integrations(http).setFieldMappings("conn1", { mappings: [] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/integrations/connections/conn1/field-mappings");
  });

  it("removes a connection event via the nested path", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Integrations(http).deleteConnectionEvent("conn1", "ev1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/integrations/connections/conn1/events/ev1");
  });
});
