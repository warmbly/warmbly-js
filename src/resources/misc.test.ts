import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Misc } from "./misc";

function clientWith(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...init.headers },
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

describe("Misc folders", () => {
  it("creates a folder via POST /folders with body", async () => {
    const { http, fetchMock } = clientWith({ id: "f_1", title: "Prospects" });
    const folder = await new Misc(http).createFolder({ title: "Prospects" });
    expect(folder.id).toBe("f_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/folders");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Prospects" });
  });

  it("updates a folder via PATCH /folders/:id with body", async () => {
    const { http, fetchMock } = clientWith({ id: "f_1", title: "B" });
    await new Misc(http).updateFolder("f_1", { title: "B" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/folders/f_1");
    expect(JSON.parse(String(init.body))).toEqual({ title: "B" });
  });

  it("deletes a folder via DELETE /folders/:id", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Misc(http).deleteFolder("f_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/folders/f_1");
  });
});

describe("Misc tags", () => {
  it("creates a tag via POST /tags with body", async () => {
    const { http, fetchMock } = clientWith({ id: "t_1", title: "hot" });
    const tag = await new Misc(http).createTag({ title: "hot" });
    expect(tag.id).toBe("t_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/tags");
    expect(JSON.parse(String(init.body))).toEqual({ title: "hot" });
  });

  it("updates a tag via PATCH /tags/:id with body", async () => {
    const { http, fetchMock } = clientWith({ id: "t_1", title: "warm" });
    await new Misc(http).updateTag("t_1", { title: "warm" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/tags/t_1");
    expect(JSON.parse(String(init.body))).toEqual({ title: "warm" });
  });

  it("deletes a tag via DELETE /tags/:id", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Misc(http).deleteTag("t_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/tags/t_1");
  });
});

describe("Misc categories", () => {
  it("creates a category via POST /categories with body", async () => {
    const { http, fetchMock } = clientWith({ id: "c_1", title: "VIP" });
    const category = await new Misc(http).createCategory({ title: "VIP" });
    expect(category.id).toBe("c_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/categories");
    expect(JSON.parse(String(init.body))).toEqual({ title: "VIP" });
  });

  it("updates a category via PATCH /categories/:id with body", async () => {
    const { http, fetchMock } = clientWith({ id: "c_1", title: "X" });
    await new Misc(http).updateCategory("c_1", { title: "X" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/categories/c_1");
    expect(JSON.parse(String(init.body))).toEqual({ title: "X" });
  });

  it("deletes a category via DELETE /categories/:id", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Misc(http).deleteCategory("c_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/categories/c_1");
  });
});

describe("Misc teams", () => {
  it("lists teams and unwraps the data array", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "tm_1" }, { id: "tm_2" }] });
    const teams = await new Misc(http).listTeams();
    expect(teams).toHaveLength(2);
    expect(teams[0]?.id).toBe("tm_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/teams");
  });

  it("lists teams with query params", async () => {
    const { http, fetchMock } = clientWith({ data: [] });
    await new Misc(http).listTeams({ limit: 5 });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/teams");
    expect(url).toContain("limit=5");
  });

  it("returns an empty array when data is missing", async () => {
    const { http } = clientWith({});
    const teams = await new Misc(http).listTeams();
    expect(teams).toEqual([]);
  });

  it("creates a team via POST /teams with body", async () => {
    const { http, fetchMock } = clientWith({ id: "tm_1", name: "Sales" });
    const team = await new Misc(http).createTeam({ name: "Sales" });
    expect(team.id).toBe("tm_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/teams");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Sales" });
  });

  it("retrieves a team via GET /teams/:id", async () => {
    const { http, fetchMock } = clientWith({ id: "tm_1" });
    const team = await new Misc(http).getTeam("tm_1");
    expect(team.id).toBe("tm_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/teams/tm_1");
  });

  it("updates a team via PATCH /teams/:id with body", async () => {
    const { http, fetchMock } = clientWith({ id: "tm_1", name: "X" });
    await new Misc(http).updateTeam("tm_1", { name: "X" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/teams/tm_1");
    expect(JSON.parse(String(init.body))).toEqual({ name: "X" });
  });

  it("deletes a team via DELETE /teams/:id", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Misc(http).deleteTeam("tm_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/teams/tm_1");
  });

  it("adds a team member via POST /teams/:id/members with body", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Misc(http).addTeamMember("tm_1", { email: "rep@warmbly.com" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/teams/tm_1/members");
    expect(JSON.parse(String(init.body))).toEqual({ email: "rep@warmbly.com" });
  });

  it("removes a team member via the nested DELETE path", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Misc(http).removeTeamMember("tm_1", "u_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/teams/tm_1/members/u_1");
  });
});

describe("Misc audit logs", () => {
  it("lists audit logs as a page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ action: "key.created" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Misc(http).auditLogs();
    expect(page.data[0]?.action).toBe("key.created");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/audit-logs");
  });

  it("passes query params to the audit logs endpoint", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    await new Misc(http).auditLogs({ action: "key.created" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/audit-logs");
    expect(url).toContain("action=key.created");
  });
});

describe("Misc outreach settings", () => {
  it("reads outreach settings via GET /outreach/settings", async () => {
    const { http, fetchMock } = clientWith({ daily_cap: 100 });
    const settings = await new Misc(http).getOutreachSettings();
    expect(settings.daily_cap).toBe(100);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/outreach/settings");
  });

  it("updates outreach settings via PATCH with wrapped body", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Misc(http).updateOutreachSettings({ settings: { daily_cap: 100 } });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/outreach/settings");
    expect(JSON.parse(String(init.body))).toEqual({ settings: { daily_cap: 100 } });
  });
});

describe("Misc warmup routing", () => {
  it("lists warmup routing rules and unwraps the rules array", async () => {
    const { http, fetchMock } = clientWith({ rules: [{ id: "wr_1" }] });
    const rules = await new Misc(http).listWarmupRouting();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.id).toBe("wr_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/warmup/routing");
  });

  it("lists warmup routing with query params", async () => {
    const { http, fetchMock } = clientWith({ rules: [] });
    await new Misc(http).listWarmupRouting({ active: true });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/warmup/routing");
    expect(url).toContain("active=true");
  });

  it("returns an empty array when rules is missing", async () => {
    const { http } = clientWith({});
    const rules = await new Misc(http).listWarmupRouting();
    expect(rules).toEqual([]);
  });

  it("creates a warmup routing rule via POST with body", async () => {
    const { http, fetchMock } = clientWith({ id: "wr_1" });
    await new Misc(http).createWarmupRouting({ priority: 1 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/warmup/routing");
    expect(JSON.parse(String(init.body))).toEqual({ priority: 1 });
  });

  it("updates a warmup routing rule via PATCH /warmup/routing/:id", async () => {
    const { http, fetchMock } = clientWith({ id: "wr_1" });
    await new Misc(http).updateWarmupRouting("wr_1", { priority: 2 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/warmup/routing/wr_1");
    expect(JSON.parse(String(init.body))).toEqual({ priority: 2 });
  });

  it("deletes a warmup routing rule via DELETE /warmup/routing/:id", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Misc(http).deleteWarmupRouting("wr_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/warmup/routing/wr_1");
  });
});

describe("Misc plans and timezones", () => {
  it("lists plans and unwraps the plans array", async () => {
    const { http, fetchMock } = clientWith({ plans: [{ id: "p_1", name: "Pro" }] });
    const plans = await new Misc(http).plans();
    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe("p_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/plans");
  });

  it("returns an empty array when plans is missing", async () => {
    const { http } = clientWith({});
    const plans = await new Misc(http).plans();
    expect(plans).toEqual([]);
  });

  it("reads timezones from the flat list endpoint", async () => {
    const { http, fetchMock } = clientWith(["UTC", "America/New_York"]);
    const tz = await new Misc(http).timezones();
    expect(tz).toContain("UTC");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/timezones");
  });
});
