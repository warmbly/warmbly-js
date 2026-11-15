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
      new Response(body === undefined ? (init.status === 204 ? null : "") : JSON.stringify(body), {
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

describe("Emails connect (Partnership)", () => {
  const smtp = {
    username: "team@warmbly.com",
    password: "secret",
    host: "smtp.warmbly.com",
    port: 587,
    security: "starttls",
  };
  const imap = {
    username: "team@warmbly.com",
    password: "secret",
    host: "imap.warmbly.com",
    port: 993,
    security: "tls",
  };
  const mailbox = {
    id: "8f1e2d3c-0000-4000-8000-000000000001",
    email: "team@warmbly.com",
    name: "Team",
    provider: "smtp_imap",
    status: "active",
    warmup: "2026-11-01T09:00:00Z",
    warmup_paused_at: null,
    campaign_limit: 50,
    tags: [],
  };

  it("connectSmtpImap POSTs the account and warmup and decodes mailbox + warmup_note", async () => {
    const { http, fetchMock } = clientWith({ mailbox, warmup_note: "" }, { status: 201 });
    const out = await new Emails(http).connectSmtpImap({
      email: "team@warmbly.com",
      name: "Team",
      smtp,
      imap,
      warmup: { enabled: true, max: 40, reply_rate: 30 },
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/connect\/smtp-imap$/);
    expect(JSON.parse(String(init.body))).toEqual({
      email: "team@warmbly.com",
      name: "Team",
      smtp,
      imap,
      warmup: { enabled: true, max: 40, reply_rate: 30 },
    });
    expect(out.mailbox.id).toBe(mailbox.id);
    expect(out.mailbox.warmup).toBe("2026-11-01T09:00:00Z");
    expect(out.warmup_note).toBe("");
  });

  it("connectSmtpImapBulk POSTs accounts and decodes rows, summary and allowance", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        { row: 1, email: "a@warmbly.com", status: "connected", id: mailbox.id },
        {
          row: 2,
          email: "b@warmbly.com",
          status: "failed",
          code: "smtp_auth",
          message: "Bad login",
        },
      ],
      summary: { total: 2, connected: 1, skipped: 0, failed: 1 },
      allowance: { used: 3, allowance: 10, remaining: 7, basis: "plan" },
    });
    const out = await new Emails(http).connectSmtpImapBulk({
      accounts: [{ email: "a@warmbly.com", smtp, imap }],
      warmup: { enabled: true },
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/connect\/smtp-imap\/bulk$/);
    expect(JSON.parse(String(init.body))).toEqual({
      accounts: [{ email: "a@warmbly.com", smtp, imap }],
      warmup: { enabled: true },
    });
    expect(out.summary.failed).toBe(1);
    expect(out.data[1]?.code).toBe("smtp_auth");
    expect(out.allowance?.remaining).toBe(7);
  });

  it("connectOAuth POSTs the grant and decodes renewed", async () => {
    const { http, fetchMock } = clientWith({
      mailbox: { ...mailbox, provider: "gmail" },
      renewed: true,
      warmup_note: "",
    });
    const out = await new Emails(http).connectOAuth({
      provider: "gmail",
      code: "4/0Ab",
      redirect_uri: "https://agency.warmbly.com/cb",
      code_verifier: "v",
      email: "team@warmbly.com",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/connect\/oauth$/);
    expect(JSON.parse(String(init.body))).toEqual({
      provider: "gmail",
      code: "4/0Ab",
      redirect_uri: "https://agency.warmbly.com/cb",
      code_verifier: "v",
      email: "team@warmbly.com",
    });
    expect(out.renewed).toBe(true);
    expect(out.mailbox.provider).toBe("gmail");
  });

  it("connectOAuthBulk POSTs grants and decodes the renewed summary", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ row: 1, email: "a@warmbly.com", status: "renewed", id: mailbox.id }],
      summary: { total: 1, connected: 0, renewed: 1, failed: 0 },
    });
    const out = await new Emails(http).connectOAuthBulk({
      grants: [{ provider: "outlook", refresh_token: "M.R3" }],
      warmup: { enabled: false },
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/connect\/oauth\/bulk$/);
    expect(JSON.parse(String(init.body))).toEqual({
      grants: [{ provider: "outlook", refresh_token: "M.R3" }],
      warmup: { enabled: false },
    });
    expect(out.summary.renewed).toBe(1);
    expect(out.data[0]?.status).toBe("renewed");
  });

  const link = {
    id: "11111111-0000-4000-8000-000000000001",
    organization_id: "22222222-0000-4000-8000-000000000001",
    created_by: "33333333-0000-4000-8000-000000000001",
    provider: "gmail",
    email: "owner@warmbly.com",
    warmup: { enabled: true, max: 30 },
    status: "pending",
    expires_at: "2026-11-18T09:00:00Z",
    created_at: "2026-11-15T09:00:00Z",
  };

  it("createConnectLink POSTs and decodes the one-time url", async () => {
    const { http, fetchMock } = clientWith(
      { ...link, url: "https://app.warmbly.com/connect/abc" },
      { status: 201 },
    );
    const out = await new Emails(http).createConnectLink({
      provider: "gmail",
      email: "owner@warmbly.com",
      warmup: { enabled: true, max: 30 },
      return_url: "https://agency.warmbly.com/done",
      expires_in_hours: 72,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/connect\/links$/);
    expect(JSON.parse(String(init.body))).toEqual({
      provider: "gmail",
      email: "owner@warmbly.com",
      warmup: { enabled: true, max: 30 },
      return_url: "https://agency.warmbly.com/done",
      expires_in_hours: 72,
    });
    expect(out.url).toBe("https://app.warmbly.com/connect/abc");
    expect(out.warmup.max).toBe(30);
  });

  it("listConnectLinks GETs a Page with cursor and limit", async () => {
    const { http, fetchMock } = clientWith({
      data: [link],
      pagination: { next_cursor: "nxt", has_more: true },
    });
    const page = await new Emails(http).listConnectLinks({ cursor: "c1", limit: 50 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/emails/connect/links?");
    expect(url).toContain("cursor=c1");
    expect(url).toContain("limit=50");
    expect(page.data[0]?.status).toBe("pending");
    expect(page.hasNextPage()).toBe(true);
  });

  it("getConnectLink GETs one link", async () => {
    const { http, fetchMock } = clientWith({
      ...link,
      status: "connected",
      email_account_id: mailbox.id,
      completed_at: "2026-11-15T10:00:00Z",
    });
    const out = await new Emails(http).getConnectLink(link.id);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(new RegExp(`/emails/connect/links/${link.id}$`));
    expect(out.email_account_id).toBe(mailbox.id);
  });

  it("revokeConnectLink DELETEs and decodes the link", async () => {
    const { http, fetchMock } = clientWith({ ...link, status: "revoked" });
    const out = await new Emails(http).revokeConnectLink(link.id);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(new RegExp(`/emails/connect/links/${link.id}$`));
    expect(out.status).toBe("revoked");
  });

  const app = {
    id: "44444444-0000-4000-8000-000000000001",
    organization_id: link.organization_id,
    provider: "gmail",
    client_id: "1234.apps.googleusercontent.com",
    has_secret: true,
    app_name: "Warmbly Agency",
    redirect_url: "https://api.warmbly.com/v1/emails/oauth/callback",
    custom_redirect: false,
    created_at: "2026-11-01T09:00:00Z",
    updated_at: "2026-11-01T09:00:00Z",
    mailboxes: 4,
  };

  it("listOAuthApps GETs data and callbacks", async () => {
    const { http, fetchMock } = clientWith({
      data: [app],
      callbacks: { gmail: app.redirect_url, outlook: "https://api.warmbly.com/ms" },
    });
    const out = await new Emails(http).listOAuthApps();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/oauth-apps$/);
    expect(out.data[0]?.mailboxes).toBe(4);
    expect(out.callbacks.outlook).toBe("https://api.warmbly.com/ms");
  });

  it("putOAuthApp PUTs the client to the provider path", async () => {
    const { http, fetchMock } = clientWith(app);
    const out = await new Emails(http).putOAuthApp("gmail", {
      app_name: "Warmbly Agency",
      client_id: app.client_id,
      client_secret: "GOCSPX-x",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/emails\/oauth-apps\/gmail$/);
    expect(JSON.parse(String(init.body))).toEqual({
      app_name: "Warmbly Agency",
      client_id: app.client_id,
      client_secret: "GOCSPX-x",
    });
    expect(out.has_secret).toBe(true);
  });

  it("deleteOAuthApp DELETEs and tolerates 204", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    const out = await new Emails(http).deleteOAuthApp("outlook");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/emails\/oauth-apps\/outlook$/);
    expect(out).toBeUndefined();
  });
});

describe("Emails client connect links", () => {
  const clientLink = {
    id: "55555555-0000-4000-8000-000000000001",
    organization_id: "22222222-0000-4000-8000-000000000001",
    created_by: "33333333-0000-4000-8000-000000000001",
    label: "Acme mailboxes",
    allowed_providers: ["gmail", "outlook"],
    max_mailboxes: 10,
    mailboxes_connected: 2,
    tag_ids: ["66666666-0000-4000-8000-000000000001"],
    warmup: true,
    expires_at: "2026-11-22T09:00:00Z",
    revoked_at: null,
    created_at: "2026-11-15T09:00:00Z",
    last_used_at: null,
    status: "active",
  };

  it("createClientLink POSTs the body and decodes link + url", async () => {
    const { http, fetchMock } = clientWith(
      { link: clientLink, url: "https://portal.warmbly.com/c/tok" },
      { status: 201 },
    );
    const out = await new Emails(http).createClientLink({
      label: "Acme mailboxes",
      providers: ["gmail", "outlook"],
      max_mailboxes: 10,
      expires_in_days: 7,
      tag_ids: ["66666666-0000-4000-8000-000000000001"],
      warmup: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/emails\/client-links$/);
    expect(JSON.parse(String(init.body))).toEqual({
      label: "Acme mailboxes",
      providers: ["gmail", "outlook"],
      max_mailboxes: 10,
      expires_in_days: 7,
      tag_ids: ["66666666-0000-4000-8000-000000000001"],
      warmup: true,
    });
    expect(out.url).toBe("https://portal.warmbly.com/c/tok");
    expect(out.link.status).toBe("active");
  });

  it("listClientLinks GETs a Page with cursor and limit", async () => {
    const { http, fetchMock } = clientWith({
      data: [clientLink],
      pagination: { next_cursor: null, has_more: false },
    });
    const page = await new Emails(http).listClientLinks({ cursor: "c1", limit: 20 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/emails/client-links?");
    expect(url).toContain("cursor=c1");
    expect(url).toContain("limit=20");
    expect(page.data[0]?.mailboxes_connected).toBe(2);
    expect(page.data[0]?.revoked_at).toBeNull();
  });

  it("listClientLinkUses unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "77777777-0000-4000-8000-000000000001",
          link_id: clientLink.id,
          email_account_id: null,
          email: "a@acme.com",
          provider: "gmail",
          connected_at: "2026-11-15T10:00:00Z",
        },
      ],
    });
    const uses = await new Emails(http).listClientLinkUses(clientLink.id);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(new RegExp(`/emails/client-links/${clientLink.id}/uses$`));
    expect(uses[0]?.email_account_id).toBeNull();
    expect(uses[0]?.email).toBe("a@acme.com");
  });

  it("revokeClientLink POSTs to /revoke without a body", async () => {
    const { http, fetchMock } = clientWith({
      ...clientLink,
      status: "revoked",
      revoked_at: "2026-11-15T11:00:00Z",
    });
    const out = await new Emails(http).revokeClientLink(clientLink.id);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(new RegExp(`/emails/client-links/${clientLink.id}/revoke$`));
    expect(init.body).toBeUndefined();
    expect(out.status).toBe("revoked");
  });
});

describe("Emails warmup filter tag", () => {
  it("getWarmupFilterTag GETs and decodes a null tag", async () => {
    const { http, fetchMock } = clientWith({ tag: null });
    const out = await new Emails(http).getWarmupFilterTag("mb_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/emails\/mb_1\/warmup-filter-tag$/);
    expect(out.tag).toBeNull();
  });

  it("setWarmupFilterTag PUTs no body for a random code", async () => {
    const { http, fetchMock } = clientWith({ tag: "k7q2-mx94-ab3d" });
    const out = await new Emails(http).setWarmupFilterTag("mb_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/emails\/mb_1\/warmup-filter-tag$/);
    expect(init.body).toBeUndefined();
    expect(out.tag).toBe("k7q2-mx94-ab3d");
  });

  it("setWarmupFilterTag PUTs a chosen tag", async () => {
    const { http, fetchMock } = clientWith({ tag: "acme-filter-01" });
    await new Emails(http).setWarmupFilterTag("mb_1", { tag: "acme-filter-01" });
    const { init } = lastCall(fetchMock);
    expect(JSON.parse(String(init.body))).toEqual({ tag: "acme-filter-01" });
  });

  it("clearWarmupFilterTag DELETEs and decodes tag null", async () => {
    const { http, fetchMock } = clientWith({ tag: null });
    const out = await new Emails(http).clearWarmupFilterTag("mb_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/emails\/mb_1\/warmup-filter-tag$/);
    expect(out.tag).toBeNull();
  });
});
