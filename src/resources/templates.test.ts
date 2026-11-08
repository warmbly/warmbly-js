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
    it("POSTs to the render sub-path with variables and decodes subject/bodies", async () => {
      const rendered = { subject: "Hi Sam", body_html: "<p>Hi Sam</p>", body_plain: "Hi Sam" };
      const { http, fetchMock } = clientWith(rendered);
      const result = await new Templates(http).render("tpl_1", {
        variables: { FirstName: "Sam" },
      });
      expect(result).toEqual(rendered);
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/tpl_1/render");
      expect(await parseBody(init)).toEqual({ variables: { FirstName: "Sam" } });
    });

    it("works without params", async () => {
      const { http, fetchMock } = clientWith({ subject: "", body_html: "", body_plain: "" });
      await new Templates(http).render("tpl_1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/tpl_1/render");
      expect(init.body).toBeUndefined();
    });
  });

  describe("score", () => {
    it("POSTs to templates/score with body_html/body_plain and decodes issues", async () => {
      const { http, fetchMock } = clientWith({
        score: 82,
        issues: [
          {
            severity: "warn",
            code: "trigger_word",
            message: "Spammy phrase",
            field: "subject",
            spans: [{ text: "FREE" }],
            suggestion: "Drop it",
          },
        ],
      });
      const result = await new Templates(http).score({ subject: "FREE", body_plain: "Hello" });
      expect(result.score).toBe(82);
      expect(result.issues[0]?.field).toBe("subject");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/score");
      expect(await parseBody(init)).toEqual({ subject: "FREE", body_plain: "Hello" });
    });
  });

  describe("analyze", () => {
    it("POSTs to templates/analyze and decodes the AI analysis", async () => {
      const { http, fetchMock } = clientWith({
        score: 61,
        verdict: "Likely to be filtered",
        findings: [
          {
            severity: "high",
            field: "subject",
            text: "Act now!!!",
            line: 1,
            excerpt: "Act now!!!",
            issue: "Urgency trigger",
            suggestion: "Ask a question instead",
            category: "trigger_word",
          },
        ],
        suggested_subject: "Quick question",
        improvements: ["Add a clear ask"],
        rules: { score: 70, issues: [] },
        judgment: {
          reads_as: 0.8,
          personalization: 0.2,
          ask: "none",
          spam_claim: 0.1,
          confidence: 0.9,
          model: "judge-1",
          input_tokens: 120,
        },
        model: "claude-x",
        tokens_used: 900,
        credits_charged: 2,
        credits_remaining: 98,
        charged_usd: 0.02,
        balance_usd: 0.98,
      });
      const params = { subject: "Act now!!!", body_html: "<p>Buy</p>", body_plain: "Buy" };
      const result = await new Templates(http).analyze(params);
      expect(result.findings[0]?.suggestion).toBe("Ask a question instead");
      expect(result.rules.score).toBe(70);
      expect(result.judgment?.ask).toBe("none");
      expect(result.credits_charged).toBe(2);
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/analyze");
      expect(await parseBody(init)).toEqual(params);
    });

    it("decodes the judgment-only answer (no suggested subject, no improvements, no judgment-less fields)", async () => {
      const { http } = clientWith({
        score: 55,
        verdict: "Reads as bulk",
        findings: [],
        rules: { score: 55, issues: [] },
        judgment: {
          reads_as: 0.9,
          personalization: 0.1,
          ask: "several",
          spam_claim: 0.7,
          confidence: 0.8,
          model: "j",
          input_tokens: 10,
        },
        model: "j",
        tokens_used: 10,
        credits_charged: 0,
        credits_remaining: 5,
        charged_usd: 0,
        balance_usd: 0.05,
      });
      const result = await new Templates(http).analyze({ subject: "Hi" });
      expect(result.findings).toEqual([]);
      expect(result.suggested_subject).toBeUndefined();
      expect(result.credits_charged).toBe(0);
    });
  });

  describe("reorder", () => {
    it("PATCHes templates/reorder with the ids body and returns the ordered set", async () => {
      const { http, fetchMock } = clientWith({
        data: [
          { id: "tpl_2", position: 1 },
          { id: "tpl_1", position: 2 },
        ],
      });
      const result = await new Templates(http).reorder({ ids: ["tpl_2", "tpl_1"] });
      expect(result.data.map((t) => t.position)).toEqual([1, 2]);
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("PATCH");
      expect(url).toContain("/templates/reorder");
      expect(await parseBody(init)).toEqual({ ids: ["tpl_2", "tpl_1"] });
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
