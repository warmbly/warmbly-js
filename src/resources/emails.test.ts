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
  describe("bulkTag", () => {
    it("PATCHes emails/tags with the set-semantics body and returns the updated count", async () => {
      const { http, fetchMock } = clientWith({ updated: 2 });
      const result = await new Emails(http).bulkTag({
        email_ids: ["mb1", "mb2"],
        add_tags: ["tag_a"],
        remove_tags: ["tag_b"],
      });
      const { url, init } = lastCall(fetchMock);
      expect(init.method).toBe("PATCH");
      expect(url).toContain("/emails/tags");
      expect(JSON.parse(String(init.body))).toEqual({
        email_ids: ["mb1", "mb2"],
        add_tags: ["tag_a"],
        remove_tags: ["tag_b"],
      });
      expect(result.updated).toBe(2);
    });

    it("does not collide with the /emails/:id route", async () => {
      const { http, fetchMock } = clientWith({ updated: 0 });
      await new Emails(http).bulkTag({ email_ids: ["mb1"] });
      const { url } = lastCall(fetchMock);
      expect(url).toContain("/emails/tags");
      expect(url).not.toContain("/emails/tags/");
    });
  });
});

describe("Emails: allowance, tracking domain, hold/release, sync, auth check, behaviour", () => {
  it("allowance GETs /emails/allowance", async () => {
    const { http, fetchMock } = clientWith({ used: 3, allowance: 10, remaining: 7, basis: "free" });
    const out = await new Emails(http).allowance();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/allowance$/);
    expect(out.remaining).toBe(7);
  });

  it("getTrackingDomain GETs /emails/:id/track", async () => {
    const { http, fetchMock } = clientWith({ cname_target: "t.warmbly.com", status: "pending" });
    const out = await new Emails(http).getTrackingDomain("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/mb1\/track$/);
    expect(out.status).toBe("pending");
  });

  it("verifyTrackingDomain POSTs /emails/:id/track/verify with no body", async () => {
    const { http, fetchMock } = clientWith({ status: "verified" });
    const out = await new Emails(http).verifyTrackingDomain("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/emails/mb1/track/verify");
    expect(init.body).toBeUndefined();
    expect(out.status).toBe("verified");
  });

  it("hold POSTs /emails/:id/hold and returns the rotation state", async () => {
    const { http, fetchMock } = clientWith({ state: "reserve", reason: "held back by its owner" });
    const out = await new Emails(http).hold("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/emails/mb1/hold");
    expect(init.body).toBeUndefined();
    expect(out.state).toBe("reserve");
  });

  it("release POSTs /emails/:id/release", async () => {
    const { http, fetchMock } = clientWith({ state: "active" });
    const out = await new Emails(http).release("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/emails/mb1/release");
    expect(out.state).toBe("active");
  });

  it("sync GETs /emails/:id/sync", async () => {
    const { http, fetchMock } = clientWith({
      state: { backfill_status: "complete" },
      policy: { backfill_days: 30 },
    });
    const out = await new Emails(http).sync("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/emails/mb1/sync");
    expect(out.state?.backfill_status).toBe("complete");
    expect(out.policy.backfill_days).toBe(30);
  });

  it("recordAuthCheck POSTs /emails/:id/auth-check with no body", async () => {
    const { http, fetchMock } = clientWith({ spf: true, dmarc_inherited: true });
    const out = await new Emails(http).recordAuthCheck("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/emails/mb1/auth-check");
    expect(init.body).toBeUndefined();
    expect(out.dmarc_inherited).toBe(true);
  });

  it("getBehavior GETs /emails/:id/behavior", async () => {
    const { http, fetchMock } = clientWith({ email_account_id: "mb1", enabled: true });
    const out = await new Emails(http).getBehavior("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/mb1\/behavior$/);
    expect(out.enabled).toBe(true);
  });

  it("updateBehavior PUTs the patch to /emails/:id/behavior", async () => {
    const { http, fetchMock } = clientWith({ email_account_id: "mb1", daily_limit_min: 30 });
    await new Emails(http).updateBehavior("mb1", { daily_limit_min: 30, daily_limit_max: 45 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/emails\/mb1\/behavior$/);
    expect(JSON.parse(String(init.body))).toEqual({ daily_limit_min: 30, daily_limit_max: 45 });
  });

  it("behaviorPlan GETs /emails/:id/behavior/plan", async () => {
    const { http, fetchMock } = clientWith({ email_account_id: "mb1", remaining_today: 12 });
    const out = await new Emails(http).behaviorPlan("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/emails/mb1/behavior/plan");
    expect(out.remaining_today).toBe(12);
  });

  it("update passes save_to_sent and timezone through", async () => {
    const { http, fetchMock } = clientWith({ id: "mb1" });
    await new Emails(http).update("mb1", { save_to_sent: false, timezone: "America/Denver" });
    const { init } = lastCall(fetchMock);
    expect(JSON.parse(String(init.body))).toEqual({
      save_to_sent: false,
      timezone: "America/Denver",
    });
  });
});

describe("Emails (identity, certificates, sync, bulk)", () => {
  it("certificates GETs /emails/:id/certificates and decodes both servers", async () => {
    const { http, fetchMock } = clientWith({
      smtp: {
        host: "smtp.acme.com",
        port: 587,
        tls_unverified: true,
        tls_pin: "ab".repeat(32),
        observed: {
          fingerprint: "ab".repeat(32),
          self_signed: true,
          not_after: "2027-01-01T00:00:00Z",
        },
      },
      imap: { host: "imap.acme.com", port: 993, tls_unverified: false },
    });
    const certs = await new Emails(http).certificates("mb 1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/mb%201\/certificates$/);
    expect(certs.smtp.tls_unverified).toBe(true);
    expect(certs.smtp.observed?.self_signed).toBe(true);
    expect(certs.imap.observed).toBeUndefined();
  });

  it("setDirectTracking PATCHes { enabled } and decodes track_direct_mail", async () => {
    const { http, fetchMock } = clientWith({ track_direct_mail: true });
    const out = await new Emails(http).setDirectTracking("mb1", true);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/emails\/mb1\/direct-tracking$/);
    expect(JSON.parse(String(init.body))).toEqual({ enabled: true });
    expect(out.track_direct_mail).toBe(true);
  });

  it("identity GETs /emails/:id/identity", async () => {
    const { http, fetchMock } = clientWith({
      supported: true,
      provider: "google",
      mailbox_email: "a@acme.com",
      send_as_email: "",
      identities: [
        { email: "a@acme.com", name: "A", is_primary: true, is_default: true, verified: true },
        {
          email: "sales@acme.com",
          name: "Sales",
          is_primary: false,
          is_default: false,
          verified: false,
        },
      ],
      synced_at: "2026-05-01T10:00:00Z",
      signature_source: "manual",
    });
    const id = await new Emails(http).identity("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/mb1\/identity$/);
    expect(id.identities).toHaveLength(2);
    expect(id.identities[1]?.verified).toBe(false);
    expect(id.signature_source).toBe("manual");
  });

  it("refreshIdentity POSTs import_signature and sends no body when omitted", async () => {
    const payload = {
      supported: false,
      provider: "smtp_imap",
      mailbox_email: "a@acme.com",
      send_as_email: "",
      identities: [],
      signature_source: "manual",
    };
    const { http, fetchMock } = clientWith(payload);
    await new Emails(http).refreshIdentity("mb1", { import_signature: true });
    let call = lastCall(fetchMock);
    expect(call.init.method).toBe("POST");
    expect(call.url).toMatch(/\/emails\/mb1\/identity\/refresh$/);
    expect(JSON.parse(String(call.init.body))).toEqual({ import_signature: true });

    const res = await new Emails(http).refreshIdentity("mb1");
    call = lastCall(fetchMock);
    expect(call.init.body).toBeUndefined();
    expect(res.supported).toBe(false);
  });

  it("resumeSending POSTs /emails/:id/resume-sending and decodes the release flags", async () => {
    const { http, fetchMock } = clientWith({ hold_released: true, cooldown_cleared: false });
    const out = await new Emails(http).resumeSending("mb1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/mb1\/resume-sending$/);
    expect(init.body).toBeUndefined();
    expect(out).toEqual({ hold_released: true, cooldown_cleared: false });
  });

  it("updateSync PUTs { skip_folders } and decodes the stored list", async () => {
    const { http, fetchMock } = clientWith({ skip_folders: ["Junk"] });
    const out = await new Emails(http).updateSync("mb1", ["Junk"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/emails\/mb1\/sync$/);
    expect(JSON.parse(String(init.body))).toEqual({ skip_folders: ["Junk"] });
    expect(out.skip_folders).toEqual(["Junk"]);
  });

  it("sync decodes skip_folders and folders", async () => {
    const { http } = clientWith({
      state: null,
      policy: { backfill_days: 30 },
      skip_folders: [],
      folders: [{ name: "INBOX", folder: "inbox" }],
    });
    const out = await new Emails(http).sync("mb1");
    expect(out.state).toBeNull();
    expect(out.folders?.[0]).toEqual({ name: "INBOX", folder: "inbox" });
  });

  it("bulkDelete POSTs email_ids and decodes per-row results", async () => {
    const { http, fetchMock } = clientWith({
      succeeded: 1,
      failed: 1,
      results: [
        { id: "a", ok: true },
        { id: "b", ok: false, code: "not_found", message: "Email not found." },
      ],
    });
    const out = await new Emails(http).bulkDelete({ email_ids: ["a", "b"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/bulk\/delete$/);
    expect(JSON.parse(String(init.body))).toEqual({ email_ids: ["a", "b"] });
    expect(out.failed).toBe(1);
    expect(out.results[1]?.code).toBe("not_found");
  });

  it("bulkStatus POSTs email_ids and status", async () => {
    const { http, fetchMock } = clientWith({ succeeded: 2, failed: 0, results: [] });
    await new Emails(http).bulkStatus({ email_ids: ["a", "b"], status: "inactive" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/bulk\/status$/);
    expect(JSON.parse(String(init.body))).toEqual({ email_ids: ["a", "b"], status: "inactive" });
  });

  it("bulkWarmup POSTs email_ids and action", async () => {
    const { http, fetchMock } = clientWith({
      succeeded: 1,
      failed: 0,
      results: [{ id: "a", ok: true }],
    });
    const out = await new Emails(http).bulkWarmup({ email_ids: ["a"], action: "pause" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/bulk\/warmup$/);
    expect(JSON.parse(String(init.body))).toEqual({ email_ids: ["a"], action: "pause" });
    expect(out.succeeded).toBe(1);
  });
});
