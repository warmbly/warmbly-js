import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { AISkills } from "./ai-skills";

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

describe("AISkills", () => {
  it("list() unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "skill_1", name: "House style", enabled: true }],
    });
    const skills = await new AISkills(http).list();
    expect(skills.map((s) => s.name)).toEqual(["House style"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/ai/skills");
  });

  it("list() returns an empty array when the envelope has no data", async () => {
    const { http } = clientWith({});
    await expect(new AISkills(http).list()).resolves.toEqual([]);
  });

  it("create() POSTs a new skill", async () => {
    const { http, fetchMock } = clientWith({ id: "skill_1", name: "House style" });
    const skill = await new AISkills(http).create({
      name: "House style",
      content: "Keep emails under 90 words.",
    });
    expect(skill.id).toBe("skill_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/ai/skills");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "House style",
      content: "Keep emails under 90 words.",
    });
  });

  it("update() PATCHes a skill, which is how one is retired without losing it", async () => {
    const { http, fetchMock } = clientWith({ id: "skill_1", enabled: false });
    const skill = await new AISkills(http).update("skill_1", { enabled: false });
    expect(skill.enabled).toBe(false);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/ai/skills/skill_1");
    expect(JSON.parse(String(init.body))).toEqual({ enabled: false });
  });

  it("delete() DELETEs a skill", async () => {
    const { http, fetchMock } = clientWith({ deleted: true });
    await expect(new AISkills(http).delete("skill_1")).resolves.toEqual({ deleted: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/ai/skills/skill_1");
  });
});
