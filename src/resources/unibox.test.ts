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
    const { http, fetchMock } = clientWith({ count: 3 });
    const result = await new Unibox(http).count({ email_id: "mb_1" });
    expect(result).toEqual({ count: 3 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/count");
    expect(url).toContain("email_id=mb_1");
  });

  it("count() works with no params", async () => {
    const { http, fetchMock } = clientWith({ count: 0 });
    await new Unibox(http).count();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/count");
  });

  it("overview() GETs unibox/overview with a query", async () => {
    const { http, fetchMock } = clientWith({
      total: 42,
      unread: 5,
      today: 2,
      week: 9,
      snoozed: 1,
      awaiting_reply: 3,
      automated: 7,
      automated_unread: 4,
      scheduled_pending: 1,
      scheduled_pending_max: 100,
      folders: [{ folder: "inbox", unread: 5, total: 30 }],
      generated_at: "2026-10-04T09:00:00Z",
    });
    const result = await new Unibox(http).overview();
    expect(result.automated_unread).toBe(4);
    expect(result.folders?.[0]?.folder).toBe("inbox");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/overview");
  });

  it("overview() works with no params", async () => {
    const { http, fetchMock } = clientWith({ total: 0 });
    await new Unibox(http).overview();
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/unibox/overview");
  });

  it("get() GETs a single conversation by id", async () => {
    const { http, fetchMock } = clientWith({
      id: "ub_1",
      email_id: "mb_1",
      folder: "inbox",
      thread_id: "t_1",
      from: ["lead@warmbly.com"],
      to: ["sam@warmbly.com"],
      subject: "Re: Hello",
      body_plain: "Sounds good",
    });
    const item = await new Unibox(http).get("ub_1");
    expect(item.id).toBe("ub_1");
    expect(item.from).toEqual(["lead@warmbly.com"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/ub_1");
  });

  it("thread() GETs unibox/thread with the thread_id query", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "ub_1",
          email_id: "mb_1",
          thread_id: "t_1",
          from_addr: ["lead@warmbly.com"],
          to_addr: ["sam@warmbly.com"],
          subject: "Hello",
          snippet: "Hi Sam",
          internal_date: "2026-10-04T09:00:00Z",
          seen: false,
          message_count: 0,
          has_unread: false,
          labels: [],
          answers_mailbox_id: "mb_2",
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    });
    const result = await new Unibox(http).thread({ thread_id: "t_1", limit: 20 });
    expect(result.data[0]?.answers_mailbox_id).toBe("mb_2");
    expect(result.data[0]?.from_addr).toEqual(["lead@warmbly.com"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/thread");
    expect(url).toContain("thread_id=t_1");
    expect(url).toContain("limit=20");
  });

  it("getThreadLabels() GETs unibox/thread/labels with a query", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "cat_1", title: "Lead", color: "#22c55e" }],
    });
    const result = await new Unibox(http).getThreadLabels({ thread_id: "t_1" });
    expect(result).toEqual([{ id: "cat_1", title: "Lead", color: "#22c55e" }]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/thread/labels");
    expect(url).toContain("thread_id=t_1");
  });

  it("setThreadLabels() PUTs unibox/thread/labels with a JSON body", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "cat_1", title: "Lead", color: "#22c55e" }],
    });
    const labels = await new Unibox(http).setThreadLabels({
      thread_id: "t_1",
      category_ids: ["cat_1"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/unibox/thread/labels");
    expect(JSON.parse(String(init.body))).toEqual({ thread_id: "t_1", category_ids: ["cat_1"] });
    expect(labels[0]?.id).toBe("cat_1");
  });

  it("markSeen() PATCHes unibox/seen with a JSON body", async () => {
    const { http, fetchMock } = clientWith({
      email_ids: ["ub_1"],
      thread_ids: ["t_1"],
      seen: true,
    });
    await new Unibox(http).markSeen({ email_ids: ["ub_1"], thread_ids: ["t_1"], seen: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/unibox/seen");
    expect(JSON.parse(String(init.body))).toEqual({
      email_ids: ["ub_1"],
      thread_ids: ["t_1"],
      seen: true,
    });
  });

  it("reply() POSTs unibox/reply with a JSON body", async () => {
    const { http, fetchMock } = clientWith({ task_id: "task_1" });
    const params = {
      email_account_id: "mb_1",
      to: ["jordan@acme.com"],
      subject: "Re: Hello",
      body_plain: "Thanks!",
      thread_id: "t_1",
      forward_message_id: "ub_9",
    };
    await new Unibox(http).reply(params);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/reply");
    expect(JSON.parse(String(init.body))).toEqual(params);
  });

  it("listSnoozes() GETs unibox/snoozes with a query", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          id: "sn_1",
          user_id: "u_1",
          thread_id: "t_1",
          snoozed_until: "2026-11-01T09:00:00Z",
          created_at: "2026-10-04T09:00:00Z",
          updated_at: "2026-10-04T09:00:00Z",
        },
      ],
    });
    const out = await new Unibox(http).listSnoozes();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/snoozes");
    expect(out.data[0]?.thread_id).toBe("t_1");
  });

  it("listSnoozes() works with no params", async () => {
    const { http, fetchMock } = clientWith({ data: [] });
    await new Unibox(http).listSnoozes();
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/unibox/snoozes");
  });

  it("snooze() POSTs unibox/snooze with a JSON body", async () => {
    const { http, fetchMock } = clientWith({
      id: "sn_1",
      thread_id: "t_1",
      snoozed_until: "2026-11-01T09:00:00Z",
    });
    const out = await new Unibox(http).snooze({
      thread_id: "t_1",
      snoozed_until: "2026-11-01T09:00:00Z",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/unibox/snooze");
    expect(JSON.parse(String(init.body))).toEqual({
      thread_id: "t_1",
      snoozed_until: "2026-11-01T09:00:00Z",
    });
    expect("thread_id" in out && out.thread_id).toBe("t_1");
  });

  it("snooze() with several threads answers with a data envelope", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        { id: "sn_1", thread_id: "t_1", snoozed_until: "2026-11-01T09:00:00Z" },
        { id: "sn_2", thread_id: "t_2", snoozed_until: "2026-11-01T09:00:00Z" },
      ],
    });
    const out = await new Unibox(http).snooze({
      thread_ids: ["t_1", "t_2"],
      snoozed_until: "2026-11-01T09:00:00Z",
    });
    expect(JSON.parse(String(lastCall(fetchMock).init.body)).thread_ids).toEqual(["t_1", "t_2"]);
    expect("data" in out && out.data).toHaveLength(2);
  });

  it("unsnooze() DELETEs unibox/snooze with thread_id in the query string, not the body", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await expect(new Unibox(http).unsnooze({ thread_id: "t_1,t_2" })).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/unibox/snooze");
    expect(url).toContain("thread_id=t_1%2Ct_2");
    expect(init.body).toBeUndefined();
  });

  it("scheduled() GETs unibox/scheduled with a query", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        {
          task_id: "task_1",
          scheduled_at: "2026-10-05T09:00:00Z",
          created_at: "2026-10-04T09:00:00Z",
          account_id: "mb_1",
          account_email: "sam@warmbly.com",
          account_name: "Sam",
          to: ["jordan@acme.com"],
          subject: "Re: Hello",
          snippet: "Thanks",
          thread_id: "t_1",
        },
      ],
    });
    const result = await new Unibox(http).scheduled({ thread_id: "t_1" });
    expect(result.data[0]?.account_email).toBe("sam@warmbly.com");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/unibox/scheduled");
    expect(url).toContain("thread_id=t_1");
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

describe("Unibox: folder filing and list filters", () => {
  it("moveFolder PATCHes /unibox/folder with the destination and decodes the echo", async () => {
    const { http, fetchMock } = clientWith({
      email_ids: null,
      thread_ids: ["t_1", "t_2"],
      folder: "archive",
    });
    const out = await new Unibox(http).moveFolder({
      thread_ids: ["t_1", "t_2"],
      folder: "archive",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/unibox\/folder$/);
    expect(JSON.parse(String(init.body))).toEqual({
      thread_ids: ["t_1", "t_2"],
      folder: "archive",
    });
    expect(out.email_ids).toBeNull();
    expect(out.folder).toBe("archive");
  });

  it("moveFolder surfaces a 400 for a folder a user cannot file into", async () => {
    const { http } = clientWith(
      { error: "Bad Request", message: "folder must be inbox, archive or trash" },
      { status: 400 },
    );
    await expect(
      new Unibox(http).moveFolder({ email_ids: ["ub_1"], folder: "spam" as never }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("list forwards the automated, include_archived and category filters", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    });
    await new Unibox(http).list({
      automated: false,
      include_archived: true,
      uncategorized: true,
      category_ids: "cat_1,cat_2",
      unseen: true,
    });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("automated=false");
    expect(url).toContain("include_archived=true");
    expect(url).toContain("uncategorized=true");
    expect(url).toContain("category_ids=cat_1%2Ccat_2");
    expect(url).toContain("unseen=true");
  });
});
