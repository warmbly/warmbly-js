import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Unibox } from "./unibox";

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

describe("Unibox", () => {
  it("lists conversations as a page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "u1" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Unibox(http).list({ status: "unread" });
    expect(page.data[0]?.id).toBe("u1");
    expect(lastCall(fetchMock).url).toContain("/unibox?status=unread");
  });

  it("replaces thread labels with PUT", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Unibox(http).setThreadLabels({ thread_id: "t1", labels: ["lead"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/unibox/thread/labels");
  });

  it("cancels a scheduled task by id", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Unibox(http).cancelScheduled("task1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/unibox/scheduled/task1");
  });
});
