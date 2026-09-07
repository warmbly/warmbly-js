import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { AgentTools } from "./agent-tools";

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

describe("AgentTools", () => {
  it("list GETs /ai/tools in the native format by default", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        { name: "list_threads", description: "List threads", input_schema: { type: "object" } },
      ],
    });
    const tools = await new AgentTools(http).list();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/ai\/tools$/);
    expect(tools[0]?.name).toBe("list_threads");
    expect(tools[0]?.input_schema).toEqual({ type: "object" });
  });

  it("list passes format=openai and types the function-calling shape", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ type: "function", function: { name: "x", description: "d", parameters: {} } }],
    });
    const tools = await new AgentTools(http).list({ format: "openai" });
    expect(lastCall(fetchMock).url).toContain("format=openai");
    expect(tools[0]?.type).toBe("function");
    expect(tools[0]?.function.name).toBe("x");
  });

  it("list returns an empty array when data is absent", async () => {
    const { http } = clientWith({});
    expect(await new AgentTools(http).list({ format: "hermes" })).toEqual([]);
  });

  it("call POSTs the argument object to /ai/tools/:name/call and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: { name: "list_threads", result: { threads: [], count: 0 } },
    });
    const out = await new AgentTools(http).call<{ count: number }>("list_threads", {
      folder: "inbox",
      limit: 10,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/ai/tools/list_threads/call");
    expect(JSON.parse(String(init.body))).toEqual({ folder: "inbox", limit: 10 });
    expect(out.name).toBe("list_threads");
    expect(out.result.count).toBe(0);
  });

  it("call sends an empty object when no arguments are given and encodes the name", async () => {
    const { http, fetchMock } = clientWith({ data: { name: "a b", result: "ok" } });
    await new AgentTools(http).call("a b");
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/ai/tools/a%20b/call");
    expect(JSON.parse(String(init.body))).toEqual({});
  });
});
