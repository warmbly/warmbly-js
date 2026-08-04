import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Automations } from "./automations";

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

const graph = { nodes: [], edges: [] };

describe("Automations", () => {
  it("list() unwraps the automations envelope", async () => {
    const { http, fetchMock } = clientWith({
      automations: [{ id: "auto_1", name: "Notify on reply" }],
    });
    const flows = await new Automations(http).list();
    expect(flows.map((f) => f.id)).toEqual(["auto_1"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/automations");
  });

  it("list() returns an empty array when the envelope has no automations", async () => {
    const { http } = clientWith({});
    await expect(new Automations(http).list()).resolves.toEqual([]);
  });

  it("create() POSTs and unwraps the automation envelope", async () => {
    const { http, fetchMock } = clientWith({ automation: { id: "auto_1", name: "Flow" } });
    const flow = await new Automations(http).create({
      name: "Flow",
      trigger_event: "inbox.reply_received",
      graph,
    });
    expect(flow.id).toBe("auto_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/automations");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Flow",
      trigger_event: "inbox.reply_received",
      graph,
    });
  });

  it("get() unwraps the automation envelope", async () => {
    const { http, fetchMock } = clientWith({ automation: { id: "auto_1", graph } });
    const flow = await new Automations(http).get("auto_1");
    expect(flow.graph).toEqual(graph);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/automations/auto_1");
  });

  it("update() PATCHes the full write payload", async () => {
    const { http, fetchMock } = clientWith({ automation: { id: "auto_1", enabled: false } });
    const flow = await new Automations(http).update("auto_1", {
      name: "Flow",
      enabled: false,
      trigger_event: "inbox.reply_received",
      graph,
    });
    expect(flow.enabled).toBe(false);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/automations/auto_1");
  });

  it("setLayout() PATCHes the layout path with positions only", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Automations(http).setLayout("auto_1", {
      positions: [{ id: "trigger", x: 10, y: 20 }],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/automations/auto_1/layout");
    expect(JSON.parse(String(init.body))).toEqual({
      positions: [{ id: "trigger", x: 10, y: 20 }],
    });
  });

  it("delete() DELETEs the automation", async () => {
    const { http, fetchMock } = clientWith({ deleted: true });
    await expect(new Automations(http).delete("auto_1")).resolves.toEqual({ deleted: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/automations/auto_1");
  });

  it("test() POSTs the test path with sample data", async () => {
    const { http, fetchMock } = clientWith({ path: ["trigger"], previews: [] });
    await new Automations(http).test("auto_1", { data: { email: "a@b.com" } });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/automations/auto_1/test");
    expect(JSON.parse(String(init.body))).toEqual({ data: { email: "a@b.com" } });
  });

  it("runs() unwraps the runs envelope and forwards the limit", async () => {
    const { http, fetchMock } = clientWith({ runs: [{ id: "run_1" }] });
    const runs = await new Automations(http).runs("auto_1", { limit: 20 });
    expect(runs).toEqual([{ id: "run_1" }]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/automations/auto_1/runs");
    expect(url).toContain("limit=20");
  });
});
