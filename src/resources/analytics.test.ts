import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Analytics } from "./analytics";

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

function lastUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  return String(fetchMock.mock.calls.at(-1)?.[0]);
}

describe("Analytics", () => {
  it("requests the dashboard with query params", async () => {
    const { http, fetchMock } = clientWith({ sent: 10 });
    const report = await new Analytics(http).dashboard({ from: "2026-06-01" });
    expect(report.sent).toBe(10);
    expect(lastUrl(fetchMock)).toContain("/analytics/dashboard?from=2026-06-01");
  });

  it("builds the nested campaign daily path", async () => {
    const { http, fetchMock } = clientWith({ days: [] });
    await new Analytics(http).campaignDaily("c1");
    expect(lastUrl(fetchMock)).toContain("/analytics/campaigns/c1/daily");
  });

  it("hits the campaigns compare path", async () => {
    const { http, fetchMock } = clientWith({ rows: [] });
    await new Analytics(http).compareCampaigns({ ids: ["c1", "c2"] });
    const url = lastUrl(fetchMock);
    expect(url).toContain("/analytics/campaigns/compare");
    expect(url).toContain("ids=c1");
    expect(url).toContain("ids=c2");
  });
});
