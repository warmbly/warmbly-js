import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { ConflictError, NotFoundError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Campaigns } from "./campaigns";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? (init.status === 204 ? null : "") : JSON.stringify(body), {
        status: init.status ?? 200,
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

function headerOf(init: RequestInit, name: string): string | undefined {
  const headers = init.headers as Record<string, string> | undefined;
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

describe("Campaigns", () => {
  it("lists campaigns as a Page with query params", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "c1", name: "Q3 outreach" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Campaigns(http).list({ status: "active", limit: 10 });
    expect(page.data[0]?.id).toBe("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns");
    expect(url).toContain("status=active");
    expect(url).toContain("limit=10");
  });

  it("lists campaigns without params", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    const page = await new Campaigns(http).list();
    expect(page.data).toEqual([]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns");
  });

  it("creates a campaign", async () => {
    const { http, fetchMock } = clientWith({ id: "c1", name: "Q3 outreach" });
    const c = await new Campaigns(http).create({ name: "Q3 outreach" });
    expect(c.id).toBe("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Q3 outreach" });
  });

  it("gets a campaign by id", async () => {
    const { http, fetchMock } = clientWith({ id: "c1" });
    const c = await new Campaigns(http).get("c1");
    expect(c.id).toBe("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1");
  });

  it("updates a campaign", async () => {
    const { http, fetchMock } = clientWith({ id: "c1", name: "Renamed" });
    await new Campaigns(http).update("c1", { name: "Renamed" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/campaigns/c1");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Renamed" });
  });

  it("deletes a campaign", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Campaigns(http).delete("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/campaigns/c1");
  });

  it("gets advanced settings", async () => {
    const { http, fetchMock } = clientWith({ daily_limit: 50 });
    const adv = await new Campaigns(http).getAdvanced("c1");
    expect(adv.daily_limit).toBe(50);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/advanced");
  });

  it("updates advanced settings", async () => {
    const { http, fetchMock } = clientWith({ daily_limit: 50 });
    await new Campaigns(http).updateAdvanced("c1", { daily_limit: 50 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/campaigns/c1/advanced");
    expect(JSON.parse(String(init.body))).toEqual({ daily_limit: 50 });
  });

  it("starts a campaign by id", async () => {
    const { http, fetchMock } = clientWith({ id: "c1", status: "active" });
    const c = await new Campaigns(http).start("c1");
    expect(c.status).toBe("active");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/start");
  });

  it("stops a campaign by id", async () => {
    const { http, fetchMock } = clientWith({ id: "c1", status: "stopped" });
    const c = await new Campaigns(http).stop("c1");
    expect(c.status).toBe("stopped");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/stop");
  });

  it("lists logs as a Page", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ event: "sent" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Campaigns(http).logs("c1", { level: "info" });
    expect(page.data[0]?.event).toBe("sent");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/logs");
    expect(url).toContain("level=info");
  });

  it("sends a test email", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Campaigns(http).testEmail("c1", { to: "dev@warmbly.com" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/test-email");
    expect(JSON.parse(String(init.body))).toEqual({ to: "dev@warmbly.com" });
  });

  it("lists A/B variants", async () => {
    const { http, fetchMock } = clientWith([{ id: "v1" }]);
    const variants = await new Campaigns(http).listAbVariants("c1");
    expect(variants[0]?.id).toBe("v1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/ab-variants");
  });

  it("creates an A/B variant", async () => {
    const { http, fetchMock } = clientWith({ id: "v1" });
    await new Campaigns(http).createAbVariant("c1", { subject: "Hi" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/ab-variants");
    expect(JSON.parse(String(init.body))).toEqual({ subject: "Hi" });
  });

  it("updates an A/B variant", async () => {
    const { http, fetchMock } = clientWith({ id: "v1" });
    await new Campaigns(http).updateAbVariant("c1", "v1", { subject: "Hey" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/campaigns/c1/ab-variants/v1");
    expect(JSON.parse(String(init.body))).toEqual({ subject: "Hey" });
  });

  it("deletes an A/B variant", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Campaigns(http).deleteAbVariant("c1", "v1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/campaigns/c1/ab-variants/v1");
  });

  it("lists attachments", async () => {
    const { http, fetchMock } = clientWith([{ id: "att_1" }]);
    const files = await new Campaigns(http).listAttachments("c1");
    expect(files[0]?.id).toBe("att_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/attachments");
  });

  it("creates an attachment as multipart FormData with step_id and filename", async () => {
    const { http, fetchMock } = clientWith({ id: "att_1" });
    const file = new Blob(["hello"], { type: "text/plain" });
    await new Campaigns(http).createAttachment("c1", file, {
      step_id: "step_1",
      filename: "note.txt",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/attachments");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as unknown as FormData;
    const filePart = form.get("file");
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as File).name).toBe("note.txt");
    expect(form.get("step_id")).toBe("step_1");
    // No JSON Content-Type should be forced; the runtime sets the multipart boundary.
    expect(headerOf(init, "content-type")).toBeUndefined();
  });

  it("creates an attachment without optional params (no step_id appended)", async () => {
    const { http, fetchMock } = clientWith({ id: "att_2" });
    const file = new Blob(["data"], { type: "text/plain" });
    await new Campaigns(http).createAttachment("c1", file);
    const { init } = lastCall(fetchMock);
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as unknown as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(form.get("step_id")).toBeNull();
    expect(headerOf(init, "content-type")).toBeUndefined();
    // A non-spec FormData would stringify an omitted filename into a file named "undefined".
    expect((form.get("file") as File).name).not.toBe("undefined");
  });

  it("deletes an attachment", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Campaigns(http).deleteAttachment("c1", "att_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/campaigns/c1/attachments/att_1");
  });

  it("gets senders", async () => {
    const { http, fetchMock } = clientWith({ account_ids: ["a1"] });
    const senders = await new Campaigns(http).getSenders("c1");
    expect(senders.account_ids).toEqual(["a1"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/senders");
  });

  it("replaces senders with PUT", async () => {
    const { http, fetchMock } = clientWith({ account_ids: ["a1"] });
    await new Campaigns(http).setSenders("c1", { account_ids: ["a1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/campaigns/c1/senders");
    expect(JSON.parse(String(init.body))).toEqual({ account_ids: ["a1"] });
  });

  it("runs preflight with body", async () => {
    const { http, fetchMock } = clientWith({ ready: true });
    await new Campaigns(http).preflight("c1", { strict: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/preflight");
    expect(JSON.parse(String(init.body))).toEqual({ strict: true });
  });

  it("runs preflight without body", async () => {
    const { http, fetchMock } = clientWith({ ready: true });
    const result = await new Campaigns(http).preflight("c1");
    expect(result.ready).toBe(true);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/preflight");
    expect(init.body).toBeUndefined();
  });

  it("returns A/B analysis with query params", async () => {
    const { http, fetchMock } = clientWith({ winner: "v1" });
    const analysis = await new Campaigns(http).abAnalysis("c1", { window: "7d" });
    expect(analysis.winner).toBe("v1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/ab-analysis");
    expect(url).toContain("window=7d");
  });

  it("lists steps", async () => {
    const { http, fetchMock } = clientWith([{ id: "s1" }]);
    const steps = await new Campaigns(http).listSteps("c1");
    expect(steps[0]?.id).toBe("s1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/steps");
  });

  it("creates a step with no JSON body", async () => {
    const { http, fetchMock } = clientWith({ id: "s1" });
    const step = await new Campaigns(http).createStep("c1");
    expect(step.id).toBe("s1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/steps");
    expect(init.body).toBeUndefined();
    expect(headerOf(init, "content-type")).toBeUndefined();
  });

  it("updates a step under the nested path", async () => {
    const { http, fetchMock } = clientWith({ id: "s1", delay_days: 3 });
    await new Campaigns(http).updateStep("c1", "s1", { delay_days: 3 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/campaigns/c1/steps/s1");
    expect(JSON.parse(String(init.body))).toEqual({ delay_days: 3 });
  });

  it("deletes a step", async () => {
    const { http, fetchMock } = clientWith(undefined);
    await new Campaigns(http).deleteStep("c1", "s1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/campaigns/c1/steps/s1");
  });

  it("propagates a 409 conflict", async () => {
    const { http } = clientWith({ code: "conflict", message: "busy" }, { status: 409 });
    await expect(new Campaigns(http).start("c1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("maps a 404 to NotFoundError", async () => {
    const { http } = clientWith({ code: "not_found", message: "missing" }, { status: 404 });
    await expect(new Campaigns(http).get("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
  it("overview() GETs the top-level campaigns-overview path", async () => {
    const { http, fetchMock } = clientWith({ active: 3, draft: 1 });
    const overview = await new Campaigns(http).overview();
    expect(overview).toEqual({ active: 3, draft: 1 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns-overview");
    expect(url).not.toContain("/campaigns/");
  });

  it("setStepLayout() PATCHes the step-layout path with positions only", async () => {
    const { http, fetchMock } = clientWith({ ok: true });
    await new Campaigns(http).setStepLayout("c1", {
      positions: [{ id: "s1", x: 120, y: 40 }],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/campaigns/c1/step-layout");
    expect(JSON.parse(String(init.body))).toEqual({ positions: [{ id: "s1", x: 120, y: 40 }] });
  });

  it("verifyTrackingDomain() POSTs the nested verify path", async () => {
    const { http, fetchMock } = clientWith({ verified: true });
    const status = await new Campaigns(http).verifyTrackingDomain("c1");
    expect(status).toEqual({ verified: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/tracking-domain/verify");
  });
});

describe("Campaigns: estimate, duplicate, forms, segments, start options", () => {
  it("estimate POSTs the audience to /campaigns-estimate", async () => {
    const { http, fetchMock } = clientWith({ recipients: 1000, mailboxes: 4, sending_days: 5 });
    const out = await new Campaigns(http).estimate({ segment_ids: ["seg1"], daily_limit: 40 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/campaigns-estimate$/);
    expect(JSON.parse(String(init.body))).toEqual({ segment_ids: ["seg1"], daily_limit: 40 });
    expect(out.recipients).toBe(1000);
  });

  it("duplicate POSTs /campaigns/:id/duplicate with an optional name", async () => {
    const { http, fetchMock } = clientWith({ id: "camp2", status: "draft" }, { status: 201 });
    const out = await new Campaigns(http).duplicate("camp1", { name: "Copy" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/camp1/duplicate");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Copy" });
    expect(out.id).toBe("camp2");
  });

  it("duplicate sends no body when no params are given", async () => {
    const { http, fetchMock } = clientWith({ id: "camp2" }, { status: 201 });
    await new Campaigns(http).duplicate("camp1");
    expect(lastCall(fetchMock).init.body).toBeUndefined();
  });

  it("forms GETs /campaigns/:id/forms and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ form_id: "f1", submissions: 3 }] });
    const out = await new Campaigns(http).forms("camp1");
    expect(lastCall(fetchMock).url).toContain("/campaigns/camp1/forms");
    expect(out[0]?.submissions).toBe(3);
  });

  it("listSegments GETs /campaigns/:id/segments and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ segment_id: "seg1", lead_count: 9 }] });
    const out = await new Campaigns(http).listSegments("camp1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/camp1/segments");
    expect(out[0]?.lead_count).toBe(9);
  });

  it("setSegments PUTs segment_ids to /campaigns/:id/segments", async () => {
    const { http, fetchMock } = clientWith({ data: [{ segment_id: "seg1" }], added: 397 });
    const out = await new Campaigns(http).setSegments("camp1", ["seg1", "seg2"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/campaigns/camp1/segments");
    expect(JSON.parse(String(init.body))).toEqual({ segment_ids: ["seg1", "seg2"] });
    expect(out.added).toBe(397);
  });

  it("setSegments sends an explicit empty array to detach every segment", async () => {
    const { http, fetchMock } = clientWith({ data: [], added: 0 });
    await new Campaigns(http).setSegments("camp1", []);
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ segment_ids: [] });
  });

  it("start sends acknowledge_list_risk when given and no body otherwise", async () => {
    const { http, fetchMock } = clientWith({ id: "camp1", status: "active" });
    await new Campaigns(http).start("camp1");
    expect(lastCall(fetchMock).init.body).toBeUndefined();
    await new Campaigns(http).start("camp1", { acknowledge_list_risk: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/camp1/start");
    expect(JSON.parse(String(init.body))).toEqual({ acknowledge_list_risk: true });
  });

  it("list passes q and folder filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    await new Campaigns(http).list({ q: "launch", folder: "f1" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("q=launch");
    expect(url).toContain("folder=f1");
  });

  it("estimate sends the extended projection body and decodes the rich result", async () => {
    const { http, fetchMock } = clientWith({
      recipients: 100,
      mailboxes: 2,
      daily_capacity: 40,
      remaining_today: 30,
      sending_days: 3,
      estimated_finish_at: "2026-11-12T00:00:00Z",
      steps: 3,
      total_sends: 300,
      first_touch_finish_at: "2026-11-10T00:00:00Z",
      steady_capacity: 60,
      full_capacity_at: null,
      ramping: 1,
      held: 0,
      warmup: { mailboxes: 2, per_day: 10, per_day_without: 20, reply_rate: 35 },
      other_campaigns_per_day: 5,
      bottleneck: "warmup_graduation",
      timeline: [
        {
          date: "2026-11-09",
          sending_day: true,
          capacity: 40,
          sends: 30,
          first_emails: 30,
          follow_ups: 0,
          warmup: 10,
        },
      ],
      senders: [
        {
          id: "a1",
          email: "a@x.io",
          provider: "google",
          state: "ramping",
          first_day_cap: 10,
          steady_cap: 30,
          warmup_per_day: 5,
          warmup_without: 10,
          full_cap_at: null,
        },
      ],
      scenarios: [{ kind: "more_mailboxes", value: 2, finish_at: null }],
    });
    const est = await new Campaigns(http).estimate({
      segment_ids: [],
      campaign_id: "camp1",
      start_time: "09:00",
      end_time: "17:00",
      step_waits: [3, 5],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns-estimate");
    expect(JSON.parse(String(init.body))).toEqual({
      segment_ids: [],
      campaign_id: "camp1",
      start_time: "09:00",
      end_time: "17:00",
      step_waits: [3, 5],
    });
    expect(est.total_sends).toBe(300);
    expect(est.timeline?.[0]?.first_emails).toBe(30);
    expect(est.senders?.[0]?.state).toBe("ramping");
    expect(est.scenarios?.[0]?.finish_at).toBeNull();
  });

  it("createStep treats a request-options-only second argument as options", async () => {
    const { http, fetchMock } = clientWith({ id: "s1" });
    const controller = new AbortController();
    controller.abort();
    await expect(
      new Campaigns(http).createStep("c1", { signal: controller.signal }),
    ).rejects.toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createStep sends the optional step body including thread_reply", async () => {
    const { http, fetchMock } = clientWith({ id: "s2", thread_reply: false });
    const step = await new Campaigns(http).createStep("c1", {
      subject: "New topic",
      thread_reply: false,
      wait_after: 2,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/steps");
    expect(JSON.parse(String(init.body))).toEqual({
      subject: "New topic",
      thread_reply: false,
      wait_after: 2,
    });
    expect(step.thread_reply).toBe(false);
  });

  it("getLeadHold reads the hold for one lead", async () => {
    const { http, fetchMock } = clientWith({
      campaign_id: "c1",
      contact_id: "p1",
      hold: {
        since: "2026-11-08T10:00:00Z",
        until: "2026-12-01T00:00:00Z",
        reason: "ooo",
        source: "out_of_office",
      },
    });
    const res = await new Campaigns(http).getLeadHold("c1", "p1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/leads/p1/hold");
    expect(res.hold?.source).toBe("out_of_office");
  });

  it("getLeadHold decodes an unheld lead (no hold key)", async () => {
    const { http } = clientWith({ campaign_id: "c1", contact_id: "p1" });
    const res = await new Campaigns(http).getLeadHold("c1", "p1");
    expect(res.hold).toBeUndefined();
  });

  it("pauseLead posts until and reason", async () => {
    const { http, fetchMock } = clientWith({
      campaign_id: "c1",
      contact_id: "p1",
      hold: {
        since: "2026-11-08T10:00:00Z",
        until: "2026-12-01T00:00:00Z",
        reason: "leave",
        source: "manual",
      },
    });
    const res = await new Campaigns(http).pauseLead("c1", "p1", {
      until: "2026-12-01T00:00:00Z",
      reason: "leave",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/leads/p1/pause");
    expect(JSON.parse(String(init.body))).toEqual({
      until: "2026-12-01T00:00:00Z",
      reason: "leave",
    });
    expect(res.hold?.source).toBe("manual");
  });

  it("pauseLead with no params sends no body (open-ended hold)", async () => {
    const { http, fetchMock } = clientWith({
      campaign_id: "c1",
      contact_id: "p1",
      hold: { since: "2026-11-08T10:00:00Z", source: "manual" },
    });
    await new Campaigns(http).pauseLead("c1", "p1");
    expect(lastCall(fetchMock).init.body).toBeUndefined();
  });

  it("resumeLead posts with no body and decodes a hold-less answer", async () => {
    const { http, fetchMock } = clientWith({ campaign_id: "c1", contact_id: "p1" });
    const res = await new Campaigns(http).resumeLead("c1", "p1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/campaigns/c1/leads/p1/resume");
    expect(init.body).toBeUndefined();
    expect(res.hold).toBeUndefined();
  });

  it("getLeadCC reads the copied contacts", async () => {
    const { http, fetchMock } = clientWith({
      campaign_id: "c1",
      contact_id: "p1",
      cc: [
        {
          contact_id: "p2",
          email: "b@x.io",
          first_name: "B",
          last_name: "Bee",
          company: "X",
          status: "bounced",
          bounced_at: "2026-11-01T00:00:00Z",
        },
      ],
    });
    const res = await new Campaigns(http).getLeadCC("c1", "p1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/leads/p1/cc");
    expect(res.cc[0]?.status).toBe("bounced");
  });

  it("setLeadCC PUTs contact_ids", async () => {
    const { http, fetchMock } = clientWith({ campaign_id: "c1", contact_id: "p1", cc: [] });
    const res = await new Campaigns(http).setLeadCC("c1", "p1", ["p2", "p3"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/campaigns/c1/leads/p1/cc");
    expect(JSON.parse(String(init.body))).toEqual({ contact_ids: ["p2", "p3"] });
    expect(res.cc).toEqual([]);
  });

  it("suggestLeadCC unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        { contact_id: "p2", email: "b@x.io", first_name: "B", last_name: "Bee", reason: "domain" },
      ],
    });
    const res = await new Campaigns(http).suggestLeadCC("c1", "p1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/leads/p1/cc/suggestions");
    expect(res[0]?.reason).toBe("domain");
  });

  it("sendPlan reads the bare plan", async () => {
    const { http, fetchMock } = clientWith({
      campaign_id: "c1",
      status: "active",
      day: "2026-11-08",
      timezone: "UTC",
      computed_at: "2026-11-08T10:00:00Z",
      stale: false,
      configured_ceiling: 100,
      projected_today: 60,
      sent_today: 20,
      expected_remaining: 40,
      bottleneck: "campaign_daily_limit",
      limits: [{ kind: "campaign_daily_limit", emails: 40, mailboxes: 2 }],
      window: { sending_day: true, open_now: true, minutes_left: 300 },
      leads: {
        due_now: 10,
        due_later_today: 5,
        new_leads_due_today: 8,
        waiting_on_step: 1,
        waiting_on_condition: 0,
        held: 2,
        waiting_on_sender: 0,
        new_leads_started_today: 3,
        max_new_leads_per_day: 0,
      },
      mailboxes: [
        {
          id: "a1",
          email: "a@x.io",
          provider: "google",
          configured_cap: 50,
          cap_today: 30,
          limited_by: "campaign_ramp",
          sent_today: 10,
          sent_by_other_campaigns: 0,
          expected_remaining: 20,
          state: "sending",
          min_gap_seconds: 60,
        },
      ],
    });
    const plan = await new Campaigns(http).sendPlan("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/send-plan");
    expect(plan.projected_today).toBe(60);
    expect(plan.limits[0]?.kind).toBe("campaign_daily_limit");
    expect(plan.mailboxes[0]?.limited_by).toBe("campaign_ramp");
    expect(plan.organization).toBeUndefined();
  });

  it("warmupPlacement returns data and days", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          sequence_id: "s1",
          variant_id: null,
          placement: { sent: 10, reported: 8, inbox: 6, tabs: 1, spam: 1, rescued: 0 },
          by_group: [
            { group: "google", sent: 10, reported: 8, inbox: 6, tabs: 1, spam: 1, rescued: 0 },
          ],
        },
      ],
      days: 30,
    });
    const res = await new Campaigns(http).warmupPlacement("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/warmup-placement");
    expect(res.days).toBe(30);
    expect(res.data[0]?.variant_id).toBeNull();
    expect(res.data[0]?.by_group[0]?.group).toBe("google");
  });

  it("getPlacementMonitor unwraps data and returns null when none", async () => {
    const monitor = {
      id: "m1",
      campaign_id: "c1",
      created_by: null,
      enabled: true,
      interval_days: 7,
      panel: "instance",
      alert_below: 70,
      pause_on_alert: false,
      next_run_at: "2026-11-09T00:00:00Z",
      last_run_at: null,
      last_test_id: null,
      last_alert_at: null,
      created_at: "2026-11-08T00:00:00Z",
      updated_at: "2026-11-08T00:00:00Z",
    };
    const a = clientWith({ data: monitor });
    const got = await new Campaigns(a.http).getPlacementMonitor("c1");
    const { url, init } = lastCall(a.fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/campaigns/c1/placement-monitor");
    expect(got?.interval_days).toBe(7);
    const b = clientWith({ data: null });
    expect(await new Campaigns(b.http).getPlacementMonitor("c1")).toBeNull();
  });

  it("putPlacementMonitor PUTs the body and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: {
        id: "m1",
        campaign_id: "c1",
        enabled: false,
        interval_days: 3,
        panel: "cloud",
        alert_below: 50,
        pause_on_alert: true,
      },
    });
    const res = await new Campaigns(http).putPlacementMonitor("c1", {
      enabled: false,
      interval_days: 3,
      panel: "cloud",
      alert_below: 50,
      pause_on_alert: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/campaigns/c1/placement-monitor");
    expect(JSON.parse(String(init.body))).toEqual({
      enabled: false,
      interval_days: 3,
      panel: "cloud",
      alert_below: 50,
      pause_on_alert: true,
    });
    expect(res.panel).toBe("cloud");
  });

  it("deletePlacementMonitor issues DELETE and tolerates 204", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Campaigns(http).deletePlacementMonitor("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/campaigns/c1/placement-monitor");
  });
});
