import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Templates } from "./templates";

function clientWith(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
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

async function parseBody(init: RequestInit): Promise<unknown> {
  return JSON.parse(String(init.body));
}

describe("Templates", () => {
  describe("list", () => {
    it("unwraps the data array and returns Template[]", async () => {
      const { http, fetchMock } = clientWith({ data: [{ id: "tpl_1" }, { id: "tpl_2" }] });
      const result = await new Templates(http).list();
      expect(result).toEqual([{ id: "tpl_1" }, { id: "tpl_2" }]);
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("GET");
      expect(url).toContain("/templates");
    });

    it("returns an empty array when data is absent", async () => {
      const { http } = clientWith({});
      const result = await new Templates(http).list();
      expect(result).toEqual([]);
    });

    it("sends the q query param when searching", async () => {
      const { http, fetchMock } = clientWith({ data: [{ id: "tpl_1" }] });
      await new Templates(http).list({ q: "welcome" });
      const { url } = lastCall(fetchMock);
      expect(url).toContain("q=welcome");
    });
  });

  describe("create", () => {
    it("POSTs to templates with the params body", async () => {
      const { http, fetchMock } = clientWith({ id: "tpl_1", name: "Intro" });
      const result = await new Templates(http).create({
        name: "Intro",
        subject: "Hi from team@warmbly.com",
      });
      expect(result).toEqual({ id: "tpl_1", name: "Intro" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates");
      expect(await parseBody(init)).toEqual({
        name: "Intro",
        subject: "Hi from team@warmbly.com",
      });
    });
  });

  describe("get", () => {
    it("GETs a single template by id", async () => {
      const { http, fetchMock } = clientWith({ id: "tpl_1" });
      const result = await new Templates(http).get("tpl_1");
      expect(result).toEqual({ id: "tpl_1" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("GET");
      expect(url).toContain("/templates/tpl_1");
    });
  });

  describe("update", () => {
    it("PATCHes a template by id with the params body", async () => {
      const { http, fetchMock } = clientWith({ id: "tpl_1", subject: "New subject" });
      const result = await new Templates(http).update("tpl_1", { subject: "New subject" });
      expect(result).toEqual({ id: "tpl_1", subject: "New subject" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("PATCH");
      expect(url).toContain("/templates/tpl_1");
      expect(await parseBody(init)).toEqual({ subject: "New subject" });
    });
  });

  describe("delete", () => {
    it("DELETEs a template by id", async () => {
      const { http, fetchMock } = clientWith(undefined);
      await new Templates(http).delete("tpl_1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("DELETE");
      expect(url).toContain("/templates/tpl_1");
    });
  });

  describe("duplicate", () => {
    it("POSTs to the duplicate sub-path", async () => {
      const { http, fetchMock } = clientWith({ id: "tpl_2" });
      const result = await new Templates(http).duplicate("tpl_1", { name: "Intro copy" });
      expect(result).toEqual({ id: "tpl_2" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/tpl_1/duplicate");
      expect(await parseBody(init)).toEqual({ name: "Intro copy" });
    });

    it("works without params", async () => {
      const { http, fetchMock } = clientWith({ id: "tpl_2" });
      await new Templates(http).duplicate("tpl_1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/tpl_1/duplicate");
    });
  });

  describe("render", () => {
    it("POSTs to the render sub-path with variables", async () => {
      const { http, fetchMock } = clientWith({ html: "<p>Hi Sam</p>" });
      const result = await new Templates(http).render("tpl_1", {
        variables: { first_name: "Sam" },
      });
      expect(result).toEqual({ html: "<p>Hi Sam</p>" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/tpl_1/render");
      expect(await parseBody(init)).toEqual({ variables: { first_name: "Sam" } });
    });

    it("works without params", async () => {
      const { http, fetchMock } = clientWith({ html: "<p></p>" });
      await new Templates(http).render("tpl_1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/tpl_1/render");
    });
  });

  describe("score", () => {
    it("POSTs to templates/score with the params body", async () => {
      const { http, fetchMock } = clientWith({ score: 92 });
      const result = await new Templates(http).score({ subject: "Hi", body: "Hello" });
      expect(result).toEqual({ score: 92 });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/score");
      expect(await parseBody(init)).toEqual({ subject: "Hi", body: "Hello" });
    });
  });

  describe("reorder", () => {
    it("PATCHes templates/reorder with the order body", async () => {
      const { http, fetchMock } = clientWith({ ok: true });
      const result = await new Templates(http).reorder({ order: ["tpl_2", "tpl_1"] });
      expect(result).toEqual({ ok: true });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("PATCH");
      expect(url).toContain("/templates/reorder");
      expect(await parseBody(init)).toEqual({ order: ["tpl_2", "tpl_1"] });
    });
  });

  describe("campaignPreview", () => {
    it("POSTs to the top-level campaign-template-preview path", async () => {
      const { http, fetchMock } = clientWith({ preview: "<p>Preview</p>" });
      const result = await new Templates(http).campaignPreview({ campaign_id: "c_1" });
      expect(result).toEqual({ preview: "<p>Preview</p>" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/campaign-template-preview");
      expect(await parseBody(init)).toEqual({ campaign_id: "c_1" });
    });
  });
});
