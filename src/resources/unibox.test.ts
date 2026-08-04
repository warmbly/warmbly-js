import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Unibox } from "./unibox";

function clientWith(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
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

describe("Unibox", () => {
  it("list() GETs the unibox, returns a Page, and forwards query params", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "ub_1", thread_id: "t_1", from: "lead@warmbly.com" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await new Unibox(http).list({ status: "unread", limit: 10 });
    expect(page.data.map((i) => i.id)).toEqual(["ub_1"]);

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox");
    expect(url).toContain("status=unread");
    expect(url).toContain("limit=10");
  });

  it("list() works with no params", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    await new Unibox(http).list();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox");
  });

  it("count() GETs unibox/count with a query", async () => {
    const { http, fetchMock } = clientWith({ unread: 3 });
    const result = await new Unibox(http).count({ status: "unread" });
    expect(result).toEqual({ unread: 3 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/count");
    expect(url).toContain("status=unread");
  });

  it("count() works with no params", async () => {
    const { http, fetchMock } = clientWith({ unread: 0 });
    await new Unibox(http).count();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/count");
  });

  it("overview() GETs unibox/overview with a query", async () => {
    const { http, fetchMock } = clientWith({ total: 42 });
    const result = await new Unibox(http).overview({ window: "7d" });
    expect(result).toEqual({ total: 42 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/overview");
    expect(url).toContain("window=7d");
  });

  it("overview() works with no params", async () => {
    const { http, fetchMock } = clientWith({ total: 0 });
    await new Unibox(http).overview();
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/unibox/overview");
  });

  it("get() GETs a single conversation by id", async () => {
    const { http, fetchMock } = clientWith({ id: "ub_1", from: "lead@warmbly.com" });
    const item = await new Unibox(http).get("ub_1");
    expect(item.id).toBe("ub_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/ub_1");
  });

  it("thread() GETs unibox/thread with the thread_id query", async () => {
    const { http, fetchMock } = clientWith({ thread_id: "t_1", messages: [] });
    const result = await new Unibox(http).thread({ thread_id: "t_1" });
    expect(result).toEqual({ thread_id: "t_1", messages: [] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/thread");
    expect(url).toContain("thread_id=t_1");
  });

  it("getThreadLabels() GETs unibox/thread/labels with a query", async () => {
    const { http, fetchMock } = clientWith({ labels: ["lead"] });
    const result = await new Unibox(http).getThreadLabels({ thread_id: "t_1" });
    expect(result).toEqual({ labels: ["lead"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/thread/labels");
    expect(url).toContain("thread_id=t_1");
  });

  it("setThreadLabels() PUTs unibox/thread/labels with a JSON body", async () => {
    const { http, fetchMock } = clientWith({ labels: ["lead"] });
    await new Unibox(http).setThreadLabels({ thread_id: "t_1", labels: ["lead"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/unibox/thread/labels");
    expect(JSON.parse(String(init.body))).toEqual({ thread_id: "t_1", labels: ["lead"] });
  });

  it("markSeen() PATCHes unibox/seen with a JSON body", async () => {
    const { http, fetchMock } = clientWith({ updated: 1 });
    await new Unibox(http).markSeen({ ids: ["ub_1"], seen: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/unibox/seen");
    expect(JSON.parse(String(init.body))).toEqual({ ids: ["ub_1"], seen: true });
  });

  it("reply() POSTs unibox/reply with a JSON body", async () => {
    const { http, fetchMock } = clientWith({ sent: true });
    await new Unibox(http).reply({ thread_id: "t_1", body: "Thanks!" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/reply");
    expect(JSON.parse(String(init.body))).toEqual({ thread_id: "t_1", body: "Thanks!" });
  });

  it("listSnoozes() GETs unibox/snoozes with a query", async () => {
    const { http, fetchMock } = clientWith({ data: [] });
    await new Unibox(http).listSnoozes({ status: "active" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/snoozes");
    expect(url).toContain("status=active");
  });

  it("listSnoozes() works with no params", async () => {
    const { http, fetchMock } = clientWith({ data: [] });
    await new Unibox(http).listSnoozes();
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/unibox/snoozes");
  });

  it("snooze() POSTs unibox/snooze with a JSON body", async () => {
    const { http, fetchMock } = clientWith({ snoozed: true });
    await new Unibox(http).snooze({ thread_id: "t_1", until: "2026-07-01T09:00:00Z" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/snooze");
    expect(JSON.parse(String(init.body))).toEqual({
      thread_id: "t_1",
      until: "2026-07-01T09:00:00Z",
    });
  });

  it("unsnooze() DELETEs unibox/snooze with thread_id in the query string, not the body", async () => {
    const { http, fetchMock } = clientWith({ snoozed: false });
    await new Unibox(http).unsnooze({ thread_id: "t_1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/unibox/snooze");
    expect(url).toContain("thread_id=t_1");
    expect(init.body).toBeUndefined();
  });

  it("scheduled() GETs unibox/scheduled with a query", async () => {
    const { http, fetchMock } = clientWith({ data: [{ task_id: "task_1" }] });
    const result = await new Unibox(http).scheduled({ limit: 5 });
    expect(result).toEqual({ data: [{ task_id: "task_1" }] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/scheduled");
    expect(url).toContain("limit=5");
  });

  it("scheduled() works with no params", async () => {
    const { http, fetchMock } = clientWith({ data: [] });
    await new Unibox(http).scheduled();
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/unibox/scheduled");
  });

  it("cancelScheduled() DELETEs unibox/scheduled/:taskId", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Unibox(http).cancelScheduled("task_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/unibox/scheduled/task_1");
  });

  it("list() forwards the address and direction filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    await new Unibox(http).list({ address: "jordan@acme.com", direction: "sent" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("address=jordan%40acme.com");
    expect(url).toContain("direction=sent");
  });

  it("replyDraft() POSTs unibox/reply/draft and returns the draft with its cost", async () => {
    const { http, fetchMock } = clientWith({
      text: "Happy to help.",
      credits_charged: 2,
      tokens_used: 410,
      model: "standard",
    });
    const draft = await new Unibox(http).replyDraft({ thread_id: "t_1", instruction: "be brief" });
    expect(draft.text).toBe("Happy to help.");
    expect(draft.credits_charged).toBe(2);

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/reply/draft");
    expect(JSON.parse(String(init.body))).toEqual({ thread_id: "t_1", instruction: "be brief" });
  });

  it("composeCandidates() GETs unibox/compose/candidates with the recipient", async () => {
    const { http, fetchMock } = clientWith({
      accounts: [{ id: "mb_1", email: "sales@warmbly.com", score: 90, recommended: true }],
      recommended_account_id: "mb_1",
      recommended_reason: "already talks to this address",
      contact: null,
      suppression: null,
    });
    const result = await new Unibox(http).composeCandidates({ to: "jordan@acme.com" });
    expect(result.accounts[0]?.id).toBe("mb_1");
    expect(result.recommended_account_id).toBe("mb_1");

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/compose/candidates");
    expect(url).toContain("to=jordan%40acme.com");
  });

  it("compose() POSTs unibox/compose and reports the auto-picked mailbox", async () => {
    const { http, fetchMock } = clientWith({
      task_id: "task_9",
      account_id: "mb_1",
      account_email: "sales@warmbly.com",
      auto: true,
      picked_reason: "most budget left today",
    });
    const sent = await new Unibox(http).compose({
      to: ["jordan@acme.com"],
      subject: "Quick question",
      body_plain: "Hi Jordan",
    });
    expect(sent.auto).toBe(true);
    expect(sent.picked_reason).toBe("most budget left today");

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/compose");
    expect(JSON.parse(String(init.body))).toEqual({
      to: ["jordan@acme.com"],
      subject: "Quick question",
      body_plain: "Hi Jordan",
    });
  });

  it("composeDraft() POSTs unibox/compose/draft and can return a question instead of text", async () => {
    const { http, fetchMock } = clientWith({
      question: "What are you hoping to get out of the call?",
      grounding: { contact: true, history: 3, voice_profile: false },
      credits_charged: 2,
    });
    const draft = await new Unibox(http).composeDraft({ to: "jordan@acme.com" });
    expect(draft.question).toBe("What are you hoping to get out of the call?");
    expect(draft.text).toBeUndefined();
    expect(draft.grounding?.history).toBe(3);

    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/compose/draft");
  });

  it("listDrafts() unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "d_1", subject: "Intro" }] });
    const drafts = await new Unibox(http).listDrafts();
    expect(drafts.map((d) => d.id)).toEqual(["d_1"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/drafts");
  });

  it("listDrafts() returns an empty array when the envelope has no data", async () => {
    const { http } = clientWith({});
    await expect(new Unibox(http).listDrafts()).resolves.toEqual([]);
  });

  it("saveDraft() PUTs the client-generated id, which keeps autosave idempotent", async () => {
    const { http, fetchMock } = clientWith({ id: "d_local_1" });
    const saved = await new Unibox(http).saveDraft("d_local_1", { subject: "Intro", body: "Hi" });
    expect(saved.id).toBe("d_local_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/unibox/drafts/d_local_1");
    expect(JSON.parse(String(init.body))).toEqual({ subject: "Intro", body: "Hi" });
  });

  it("deleteDraft() DELETEs unibox/drafts/:id", async () => {
    const { http, fetchMock } = clientWith({ deleted: true });
    await expect(new Unibox(http).deleteDraft("d_1")).resolves.toEqual({ deleted: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/unibox/drafts/d_1");
  });

  it("agentDrafts() unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "ad_1", thread_id: "t_1", status: "pending" }],
    });
    const drafts = await new Unibox(http).agentDrafts();
    expect(drafts.map((d) => d.status)).toEqual(["pending"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/agent-drafts");
  });

  it("approveAgentDraft() POSTs the approve path with an optional edited body", async () => {
    const { http, fetchMock } = clientWith({ sent: true });
    await new Unibox(http).approveAgentDraft("ad_1", { body: "Tuesday works." });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/agent-drafts/ad_1/approve");
    expect(JSON.parse(String(init.body))).toEqual({ body: "Tuesday works." });
  });

  it("discardAgentDraft() POSTs the discard path", async () => {
    const { http, fetchMock } = clientWith({ discarded: true });
    await new Unibox(http).discardAgentDraft("ad_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/agent-drafts/ad_1/discard");
  });
});
