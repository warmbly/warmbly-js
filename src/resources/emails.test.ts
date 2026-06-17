import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Emails, type WarmupAction } from "./emails";

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

describe("Emails", () => {
  describe("list", () => {
    it("GETs /emails and returns a Page of mailboxes", async () => {
      const { http, fetchMock } = clientWith({
        data: [{ id: "mb1", email: "team@warmbly.com" }],
        pagination: { total: 1, next_cursor: null, has_more: false },
      });
      const page = await new Emails(http).list();
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("GET");
      expect(url).toContain("/emails");
      expect(page.data).toEqual([{ id: "mb1", email: "team@warmbly.com" }]);
    });

    it("passes q and tag query params", async () => {
      const { http, fetchMock } = clientWith({
        data: [],
        pagination: { total: 0, next_cursor: null, has_more: false },
      });
      await new Emails(http).list({ q: "team@warmbly.com", tag: "vip" });
      const { url } = lastCall(fetchMock);
      expect(url).toContain("q=team%40warmbly.com");
      expect(url).toContain("tag=vip");
    });

    it("passes cursor and limit query params", async () => {
      const { http, fetchMock } = clientWith({
        data: [],
        pagination: { total: 0, next_cursor: null, has_more: false },
      });
      await new Emails(http).list({ cursor: "c1", limit: 25 });
      const { url } = lastCall(fetchMock);
      expect(url).toContain("cursor=c1");
      expect(url).toContain("limit=25");
    });
  });

  describe("get", () => {
    it("GETs /emails/:id", async () => {
      const { http, fetchMock } = clientWith({ id: "mb1", email: "team@warmbly.com" });
      const mb = await new Emails(http).get("mb1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("GET");
      expect(url).toContain("/emails/mb1");
      expect(mb.email).toBe("team@warmbly.com");
    });

    it("encodes ids with reserved characters", async () => {
      const { http, fetchMock } = clientWith({ id: "a/b" });
      await new Emails(http).get("a/b");
      expect(lastCall(fetchMock).url).toContain("/emails/a%2Fb");
    });
  });

  describe("update", () => {
    it("PATCHes /emails/:id with a JSON body", async () => {
      const { http, fetchMock } = clientWith({ id: "mb1", daily_send_limit: 40 });
      await new Emails(http).update("mb1", { daily_send_limit: 40 });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("PATCH");
      expect(url).toContain("/emails/mb1");
      expect(JSON.parse(String(init.body))).toEqual({ daily_send_limit: 40 });
    });
  });

  describe("delete", () => {
    it("DELETEs /emails/:id", async () => {
      const { http, fetchMock } = clientWith(undefined, { status: 200 });
      await new Emails(http).delete("mb1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("DELETE");
      expect(url).toContain("/emails/mb1");
    });
  });

  describe("track", () => {
    it("PATCHes /emails/:id/track with domain in the query string and no body", async () => {
      const { http, fetchMock } = clientWith({ id: "mb1" });
      await new Emails(http).track("mb1", { domain: "track.warmbly.com" });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("PATCH");
      expect(url).toContain("/emails/mb1/track");
      expect(url).toContain("domain=track.warmbly.com");
      expect(init.body).toBeUndefined();
    });
  });

  describe("verify", () => {
    it("POSTs /emails/verify with the body", async () => {
      const { http, fetchMock } = clientWith({ results: [] });
      await new Emails(http).verify({ emails: ["team@warmbly.com"] });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/emails/verify");
      expect(JSON.parse(String(init.body))).toEqual({ emails: ["team@warmbly.com"] });
    });
  });

  describe("authCheck", () => {
    it("GETs /emails/:id/auth-check", async () => {
      const { http, fetchMock } = clientWith({ spf: "pass" });
      const check = await new Emails(http).authCheck("mb1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("GET");
      expect(url).toContain("/emails/mb1/auth-check");
      expect(check.spf).toBe("pass");
    });
  });

  describe("warmupBanStatus", () => {
    it("GETs /emails/:id/warmup/ban-status", async () => {
      const { http, fetchMock } = clientWith({ banned: false });
      const status = await new Emails(http).warmupBanStatus("mb1");
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("GET");
      expect(url).toContain("/emails/mb1/warmup/ban-status");
      expect(status.banned).toBe(false);
    });
  });

  describe("warmup", () => {
    const actions: WarmupAction[] = ["start", "pause", "resume", "stop", "appeal"];
    for (const action of actions) {
      it(`POSTs /emails/:id/warmup/${action}`, async () => {
        const { http, fetchMock } = clientWith({ ok: true });
        await new Emails(http).warmup("mb1", action);
        const { url, init } = lastCall(fetchMock);
        expect(init.method).toBe("POST");
        expect(url).toContain(`/emails/mb1/warmup/${action}`);
      });
    }

    it("forwards an optional params body", async () => {
      const { http, fetchMock } = clientWith({ ok: true });
      await new Emails(http).warmup("mb1", "appeal", { reason: "false positive" });
      const { init } = lastCall(fetchMock);
      expect(JSON.parse(String(init.body))).toEqual({ reason: "false positive" });
    });
  });

  describe("send", () => {
    it("POSTs /emails/:id/send with to/subject/body_html/body_plain", async () => {
      const { http, fetchMock } = clientWith({ message_id: "m1" });
      const params = {
        to: ["team@warmbly.com"],
        subject: "Hi",
        body_html: "<p>Hello from Warmbly</p>",
        body_plain: "Hello from Warmbly",
      };
      const result = await new Emails(http).send("mb1", params);
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("POST");
      expect(url).toContain("/emails/mb1/send");
      const body = JSON.parse(String(init.body));
      expect(body.to).toEqual(["team@warmbly.com"]);
      expect(body.subject).toBe("Hi");
      expect(body.body_html).toBe("<p>Hello from Warmbly</p>");
      expect(body.body_plain).toBe("Hello from Warmbly");
      expect(result.message_id).toBe("m1");
    });
  });
});
