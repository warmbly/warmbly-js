import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { LeadSync } from "./lead-sync";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
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

describe("LeadSync", () => {
  it("googleConnection() GETs the connection status", async () => {
    const { http, fetchMock } = clientWith({
      connected: true,
      connection: { id: "conn_1", external_account_name: "ops@warmbly.com" },
    });
    const result = await new LeadSync(http).googleConnection();
    expect(result.connected).toBe(true);
    expect(result.connection?.id).toBe("conn_1");

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/lead-sync/google/connection");
  });

  it("spreadsheet() POSTs the sheet lookup", async () => {
    const { http, fetchMock } = clientWith({ tabs: ["Leads"] });
    await new LeadSync(http).spreadsheet({ connection_id: "conn_1", sheet_id: "1AbC" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/lead-sync/google/spreadsheet");
    expect(JSON.parse(String(init.body))).toEqual({ connection_id: "conn_1", sheet_id: "1AbC" });
  });

  it("preview() POSTs the dry-run preview", async () => {
    const { http, fetchMock } = clientWith({ rows: 12, new_contacts: 9 });
    await new LeadSync(http).preview({
      connection_id: "conn_1",
      sheet_id: "1AbC",
      tab_title: "Leads",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/lead-sync/google/preview");
  });

  it("listSources() unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "ls_1", label: "Weekly leads" }] });
    const sources = await new LeadSync(http).listSources();
    expect(sources.map((s) => s.id)).toEqual(["ls_1"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/lead-sync/sources");
  });

  it("listSources() returns an empty array when the envelope has no data", async () => {
    const { http } = clientWith({});
    await expect(new LeadSync(http).listSources()).resolves.toEqual([]);
  });

  it("createSource() POSTs a new source", async () => {
    const { http, fetchMock } = clientWith({ id: "ls_1", dedup: "update" });
    const source = await new LeadSync(http).createSource({
      connection_id: "conn_1",
      sheet_id: "1AbC",
      tab_title: "Leads",
      has_header: true,
      dedup: "update",
    });
    expect(source.dedup).toBe("update");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/lead-sync/sources");
  });

  it("getSource() GETs one source", async () => {
    const { http, fetchMock } = clientWith({ id: "ls_1" });
    await new LeadSync(http).getSource("ls_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/lead-sync/sources/ls_1");
  });

  it("updateSource() PATCHes one source", async () => {
    const { http, fetchMock } = clientWith({ id: "ls_1", dedup: "skip" });
    await new LeadSync(http).updateSource("ls_1", { dedup: "skip" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/lead-sync/sources/ls_1");
    expect(JSON.parse(String(init.body))).toEqual({ dedup: "skip" });
  });

  it("deleteSource() DELETEs one source", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new LeadSync(http).deleteSource("ls_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/lead-sync/sources/ls_1");
  });

  it("syncNow() POSTs the sync path", async () => {
    const { http, fetchMock } = clientWith({ created: 4, updated: 2 });
    const result = await new LeadSync(http).syncNow("ls_1");
    expect(result).toEqual({ created: 4, updated: 2 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/lead-sync/sources/ls_1/sync");
  });
});
