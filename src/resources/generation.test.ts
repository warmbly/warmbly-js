import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Generation } from "./generation";

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

describe("Generation", () => {
  it("write() POSTs generation/write and surfaces the real settled cost", async () => {
    const { http, fetchMock } = clientWith({
      text: "Hi Jordan,",
      credits_charged: 3,
      credits_remaining: 97,
      tokens_used: 1200,
      model: "standard",
    });
    const out = await new Generation(http).write({ prompt: "intro to a CTO", tone: "direct" });
    expect(out.text).toBe("Hi Jordan,");
    expect(out.credits_charged).toBe(3);
    expect(out.credits_remaining).toBe(97);

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/generation/write");
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "intro to a CTO", tone: "direct" });
  });

  it("edit() POSTs generation/edit with the passage and instruction", async () => {
    const { http, fetchMock } = clientWith({ text: "Shorter.", credits_charged: 1 });
    await new Generation(http).edit({ text: "A long passage", instruction: "shorten" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/generation/edit");
    expect(JSON.parse(String(init.body))).toEqual({
      text: "A long passage",
      instruction: "shorten",
    });
  });

  it("aiVariable() POSTs generation/ai-variable with the mode and contact", async () => {
    const { http, fetchMock } = clientWith({ text: "They sell CI tooling.", credits_charged: 2 });
    await new Generation(http).aiVariable({
      mode: "research",
      prompt: "what the company does",
      contact_id: "c_1",
      web_search: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/generation/ai-variable");
    expect(JSON.parse(String(init.body))).toEqual({
      mode: "research",
      prompt: "what the company does",
      contact_id: "c_1",
      web_search: true,
    });
  });
});
