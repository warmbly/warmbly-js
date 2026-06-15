import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Misc } from "./misc";

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

describe("Misc", () => {
  it("creates a folder", async () => {
    const { http, fetchMock } = clientWith({ id: "f1", name: "Prospects" });
    const folder = await new Misc(http).createFolder({ name: "Prospects" });
    expect(folder.id).toBe("f1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/folders");
  });

  it("removes a team member via the nested path", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Misc(http).removeTeamMember("tm1", "u1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/teams/tm1/members/u1");
  });

  it("lists audit logs as a page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ action: "key.created" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Misc(http).auditLogs();
    expect(page.data[0]?.action).toBe("key.created");
    expect(lastCall(fetchMock).url).toContain("/audit-logs");
  });

  it("reads timezones from the flat list endpoint", async () => {
    const { http, fetchMock } = clientWith(["UTC", "America/New_York"]);
    const tz = await new Misc(http).timezones();
    expect(tz).toContain("UTC");
    expect(lastCall(fetchMock).url).toContain("/timezones");
  });
});
