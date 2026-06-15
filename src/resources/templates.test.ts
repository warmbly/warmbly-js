import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Templates } from "./templates";

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

describe("Templates", () => {
  it("renders a template by id", async () => {
    const { http, fetchMock } = clientWith({ html: "<p>Hi Sam</p>" });
    await new Templates(http).render("tpl1", { variables: { first_name: "Sam" } });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/templates/tpl1/render");
  });

  it("reorders templates with PATCH", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Templates(http).reorder({ order: ["t2", "t1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/templates/reorder");
  });

  it("previews a campaign template at the top-level path", async () => {
    const { http, fetchMock } = clientWith({ preview: "..." });
    await new Templates(http).campaignPreview({ campaign_id: "c1" });
    expect(lastCall(fetchMock).url).toContain("/campaign-template-preview");
  });
});
