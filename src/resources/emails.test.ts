import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Emails } from "./emails";

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

describe("Emails", () => {
  it("controls warmup via the action sub-path", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Emails(http).warmup("mb1", "pause");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/emails/mb1/warmup/pause");
  });

  it("reads the warmup ban status", async () => {
    const { http, fetchMock } = clientWith({ banned: false });
    const status = await new Emails(http).warmupBanStatus("mb1");
    expect(status.banned).toBe(false);
    expect(lastCall(fetchMock).url).toContain("/emails/mb1/warmup/ban-status");
  });

  it("sends a one-off email", async () => {
    const { http, fetchMock } = clientWith({ message_id: "m1" });
    await new Emails(http).send("mb1", { to: "team@warmbly.com", subject: "Hi" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/emails/mb1/send");
    expect(JSON.parse(String(init.body))).toEqual({ to: "team@warmbly.com", subject: "Hi" });
  });
});
