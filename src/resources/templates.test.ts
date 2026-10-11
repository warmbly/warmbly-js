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
    });
  });

  describe("score", () => {
    it("POSTs to templates/score and decodes the rules issues", async () => {
      const body = {
        score: 82,
        issues: [
          {
            severity: "warn",
            code: "spam_triggers",
            message: "2 spam-trigger term(s) found.",
            field: "subject",
            spans: [{ field: "subject", text: "FREE", line: 1, excerpt: "FREE offer" }],
            suggestion: "Cut the trigger words.",
          },
          { severity: "high", code: "empty_subject", message: "Subject is empty." },
        ],
      };
      const { http, fetchMock } = clientWith(body);
      const result = await new Templates(http).score({
        subject: "FREE offer",
        body_plain: "Hello",
      });
      expect(result.score).toBe(82);
      expect(result.issues[0]?.spans?.[0]?.text).toBe("FREE");
      expect(result.issues[1]?.spans).toBeUndefined();
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/templates/score");
      expect(await parseBody(init)).toEqual({ subject: "FREE offer", body_plain: "Hello" });
    });
  });

  describe("analyze", () => {
    const analysis = {
      score: 71,
      verdict: "Likely lands in promotions.",
      findings: [
        {
          severity: "high",
          field: "subject",
          text: "Act now",
          line: 1,
          excerpt: "Act now: quick question",
          issue: "Urgency language reads as bulk mail.",
          suggestion: "Lead with the specific ask.",
          category: "trigger_word",
        },
        { severity: "info", issue: "No unsubscribe context." },
      ],
      suggested_subject: "quick question",
      improvements: ["Shorten the opening paragraph."],
      rules: { score: 80, issues: [] },
      judgment: {
        reads_as: 0.4,
        personalization: 0.7,
        ask: "one_clear_ask",
        spam_claim: 0.05,
        confidence: 0.9,
        model: "typesafe-1",
        input_tokens: 220,
      },
      model: "claude-haiku",
      tokens_used: 640,
      credits_remaining: 98,
      credits_charged: 2,
    };

    it("POSTs the copy to templates/analyze and decodes findings, rules and judgment", async () => {
      const { http, fetchMock } = clientWith(analysis);
      const result = await new Templates(http).analyze({
        subject: "Act now: quick question",
        body_plain: "Hi Sam",
      });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toMatch(/\/templates\/analyze$/);
      expect(await parseBody(init)).toEqual({
        subject: "Act now: quick question",
        body_plain: "Hi Sam",
      });
      expect(result.findings[0]?.suggestion).toBe("Lead with the specific ask.");
      expect(result.rules.score).toBe(80);
      expect(result.judgment?.ask).toBe("one_clear_ask");
      expect(result.credits_charged).toBe(2);
    });

    it("decodes the judgment-only fallback, which charges nothing", async () => {
      const { http } = clientWith({
        score: 90,
        verdict: "Reads as a personal note with one clear ask.",
        findings: [],
        rules: { score: 90, issues: [] },
        judgment: analysis.judgment,
        model: "typesafe-1",
        tokens_used: 220,
        credits_remaining: 100,
        credits_charged: 0,
      });
      const result = await new Templates(http).analyze({ body_plain: "Hi" });
      expect(result.findings).toEqual([]);
      expect(result.suggested_subject).toBeUndefined();
      expect(result.credits_charged).toBe(0);
    });

    it("sends the caller's Idempotency-Key", async () => {
      const { http, fetchMock } = clientWith(analysis);
      await new Templates(http).analyze({ body_plain: "Hi" }, { idempotencyKey: "an-key-1" });
      const headers = lastCall(fetchMock).init.headers as Record<string, string>;
      const key = Object.keys(headers).find((k) => k.toLowerCase() === "idempotency-key");
      expect(key && headers[key]).toBe("an-key-1");
    });

    it("surfaces the ai_not_configured 503", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "Service Unavailable",
              message: "AI analysis is not configured on this deployment.",
              code: "ai_not_configured",
            }),
            { status: 503, headers: { "content-type": "application/json" } },
          ),
      );
      const http = new HttpClient(
        resolveClientOptions({
          apiKey: "wmbly_test",
          fetch: fetchMock as unknown as FetchLike,
          maxRetries: 0,
        }),
      );
      const err = await new Templates(http).analyze({ body_plain: "Hi" }).catch((e) => e);
      expect(err.status).toBe(503);
      expect(err.code).toBe("ai_not_configured");
    });
  });

  describe("reorder", () => {
    it("PATCHes templates/reorder with ids and unwraps the reordered set", async () => {
      const { http, fetchMock } = clientWith({
        data: [
          { id: "tpl_2", position: 1 },
          { id: "tpl_1", position: 2 },
        ],
      });
      const result = await new Templates(http).reorder({ ids: ["tpl_2", "tpl_1"] });
      expect(result.map((t) => t.id)).toEqual(["tpl_2", "tpl_1"]);
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
