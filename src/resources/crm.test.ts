import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { UnprocessableEntityError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Crm } from "./crm";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
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

describe("Crm", () => {
  it("creates a stage under a pipeline", async () => {
    const { http, fetchMock } = clientWith({ id: "st1", name: "Qualified" });
    await new Crm(http).createStage("pl1", { name: "Qualified" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/pipelines/pl1/stages");
  });

  it("searches deals via POST", async () => {
    const { http, fetchMock } = clientWith({ data: [] });
    await new Crm(http).searchDeals({ query: "acme" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/search");
    expect(JSON.parse(String(init.body))).toEqual({ query: "acme" });
  });

  it("surfaces a 422 on invalid deal creation", async () => {
    const { http } = clientWith({ code: "unprocessable", message: "bad" }, { status: 422 });
    await expect(new Crm(http).createDeal({})).rejects.toBeInstanceOf(UnprocessableEntityError);
  });
});
