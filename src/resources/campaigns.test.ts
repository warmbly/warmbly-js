import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { ConflictError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Campaigns } from "./campaigns";

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

describe("Campaigns", () => {
  it("starts a campaign by id", async () => {
    const { http, fetchMock } = clientWith({ id: "c1", status: "active" });
    const c = await new Campaigns(http).start("c1");
    expect(c.status).toBe("active");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/start");
  });

  it("updates a step under the nested path", async () => {
    const { http, fetchMock } = clientWith({ id: "s1", delay_days: 3 });
    await new Campaigns(http).updateStep("c1", "s1", { delay_days: 3 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/campaigns/c1/steps/s1");
    expect(JSON.parse(String(init.body))).toEqual({ delay_days: 3 });
  });

  it("replaces senders with PUT", async () => {
    const { http, fetchMock } = clientWith({ account_ids: ["a1"] });
    await new Campaigns(http).setSenders("c1", { account_ids: ["a1"] });
    expect(lastCall(fetchMock).init.method).toBe("PUT");
    expect(lastCall(fetchMock).url).toContain("/campaigns/c1/senders");
  });

  it("propagates a 409 conflict", async () => {
    const { http } = clientWith({ code: "conflict", message: "busy" }, { status: 409 });
    await expect(new Campaigns(http).start("c1")).rejects.toBeInstanceOf(ConflictError);
  });
});
