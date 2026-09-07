import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Segments } from "./segments";

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

describe("Segments", () => {
  it("list GETs /segments and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "seg1", name: "Warm" }] });
    const out = await new Segments(http).list();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/segments$/);
    expect(out).toEqual([{ id: "seg1", name: "Warm" }]);
  });

  it("list tolerates a missing data array", async () => {
    const { http } = clientWith({});
    expect(await new Segments(http).list()).toEqual([]);
  });

  it("fields GETs /segments/fields and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ field: "email_domain", kind: "text", label: "Email domain" }],
    });
    const out = await new Segments(http).fields();
    expect(lastCall(fetchMock).url).toMatch(/\/segments\/fields$/);
    expect(out[0]?.field).toBe("email_domain");
  });

  it("preview POSTs the definition to /segments/preview", async () => {
    const { http, fetchMock } = clientWith({ contact_count: 412 });
    const conditions = [{ field: "custom.industry", operator: "equals", value: "fintech" }];
    const out = await new Segments(http).preview({ id: "seg1", match: "all", conditions });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/segments\/preview$/);
    expect(JSON.parse(String(init.body))).toEqual({ id: "seg1", match: "all", conditions });
    expect(out.contact_count).toBe(412);
  });

  it("create POSTs /segments", async () => {
    const { http, fetchMock } = clientWith({ id: "seg1", name: "Warm" }, { status: 201 });
    const out = await new Segments(http).create({ name: "Warm", color: "#0284c7" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/segments$/);
    expect(JSON.parse(String(init.body))).toEqual({ name: "Warm", color: "#0284c7" });
    expect(out.id).toBe("seg1");
  });

  it("get GETs /segments/:id with an encoded id", async () => {
    const { http, fetchMock } = clientWith({ id: "a/b" });
    await new Segments(http).get("a/b");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/segments/a%2Fb");
  });

  it("update PATCHes /segments/:id", async () => {
    const { http, fetchMock } = clientWith({ id: "seg1", match: "any" });
    await new Segments(http).update("seg1", { match: "any" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/segments/seg1");
    expect(JSON.parse(String(init.body))).toEqual({ match: "any" });
  });

  it("delete DELETEs /segments/:id", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 200 });
    await new Segments(http).delete("seg1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/segments/seg1");
  });

  it("setMembers POSTs contacts and mode to /segments/:id/members", async () => {
    const { http, fetchMock } = clientWith({ updated: 2 });
    const out = await new Segments(http).setMembers("seg1", {
      contacts: ["c1", "c2"],
      mode: "include",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/segments/seg1/members");
    expect(JSON.parse(String(init.body))).toEqual({ contacts: ["c1", "c2"], mode: "include" });
    expect(out.updated).toBe(2);
  });

  it("memberModes POSTs /segments/:id/members/lookup and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: { c1: "include" } });
    const out = await new Segments(http).memberModes("seg1", ["c1", "c2"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/segments/seg1/members/lookup");
    expect(JSON.parse(String(init.body))).toEqual({ contacts: ["c1", "c2"] });
    expect(out).toEqual({ c1: "include" });
  });

  it("memberModes returns an empty map when data is absent", async () => {
    const { http } = clientWith({});
    expect(await new Segments(http).memberModes("seg1", ["c1"])).toEqual({});
  });

  it("overrides GETs /segments/:id/overrides and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ contact_id: "c1", mode: "exclude" }] });
    const out = await new Segments(http).overrides("seg1");
    expect(lastCall(fetchMock).url).toContain("/segments/seg1/overrides");
    expect(out[0]?.mode).toBe("exclude");
  });

  it("addToCampaign POSTs /segments/:id/add-to-campaign", async () => {
    const { http, fetchMock } = clientWith({ campaign_id: "camp1", added: 5, members: 7 });
    const out = await new Segments(http).addToCampaign("seg1", { campaign_id: "camp1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/segments/seg1/add-to-campaign");
    expect(JSON.parse(String(init.body))).toEqual({ campaign_id: "camp1" });
    expect(out.added).toBe(5);
  });
});
