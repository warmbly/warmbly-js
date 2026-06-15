import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { BadRequestError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Webhooks } from "./webhooks";

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

describe("Webhooks", () => {
  it("lists endpoints from the { endpoints } envelope", async () => {
    const { http, fetchMock } = clientWith({ endpoints: [{ id: "ep1", url: "https://x" }] });
    const { endpoints } = await new Webhooks(http).list();
    expect(endpoints[0]?.id).toBe("ep1");
    expect(lastCall(fetchMock).url).toContain("/webhooks");
  });

  it("creates an endpoint and returns the one-time secret", async () => {
    const { http } = clientWith({ id: "ep1", url: "https://x", secret: "whsec_abc" });
    const ep = await new Webhooks(http).create({ url: "https://x" });
    expect(ep.secret).toBe("whsec_abc");
  });

  it("paginates org-wide deliveries", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "d1", status: "delivered" }],
      pagination: { next_cursor: null, has_more: false, total: null },
    });
    const page = await new Webhooks(http).deliveries({ status: "delivered" });
    expect(page.data[0]?.id).toBe("d1");
    expect(lastCall(fetchMock).url).toContain("/webhooks/deliveries?status=delivered");
  });

  it("rotates the signing secret", async () => {
    const { http, fetchMock } = clientWith({ secret: "whsec_new" });
    const { secret } = await new Webhooks(http).rotateSecret("ep1");
    expect(secret).toBe("whsec_new");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/webhooks/ep1/rotate-secret");
  });

  it("maps a bad limit to BadRequestError", async () => {
    const { http } = clientWith(
      { code: "bad_request", message: "limit out of range" },
      { status: 400 },
    );
    await expect(new Webhooks(http).deliveries({ limit: 9999 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});
