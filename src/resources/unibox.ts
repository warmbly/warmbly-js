import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A unified-inbox conversation item. Documented-but-open shape. */
export interface UniboxItem {
  id: string;
  thread_id?: string;
  subject?: string;
  from?: string;
  seen?: boolean;
  snoozed_until?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

/** A scheduled (queued) unibox task. */
export interface UniboxScheduledTask {
  task_id: string;
  [key: string]: unknown;
}

/** Query params for listing the unibox. */
export interface ListUniboxParams {
  cursor?: string;
  limit?: number;
  status?: string;
  /**
   * Match either side of the exchange (sender or recipient), for "every conversation
   * with this person".
   */
  address?: string;
  /** Split the list by direction, resolved against your own mailbox addresses. */
  direction?: "sent" | "received";
  [key: string]: unknown;
}

/** Body for {@link Unibox.compose}: send a brand-new outbound email (not a reply). */
export interface ComposeParams {
  /**
   * The sending mailbox. Omit it (or pass `"auto"`) to let the platform pick the best
   * mailbox for the first recipient.
   */
  email_account_id?: string | "auto";
  /** Restricts the automatic pick to active mailboxes carrying this tag. Ignored when `email_account_id` is explicit. */
  from_tag_id?: string;
  /** One or more recipient addresses. Suppressed recipients are rejected with a 400. */
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  /** HTML body. Provide this and/or `body_plain`. */
  body_html?: string;
  /** Plain-text body. Provide this and/or `body_html`. */
  body_plain?: string;
  send_mode?: string;
  /** ISO-8601 send time, for a scheduled send. */
  scheduled_at?: string;
  [key: string]: unknown;
}

/** The result of {@link Unibox.compose}: which mailbox sent, and why. */
export interface ComposeResult {
  /** The queued send's task id, cancellable via {@link Unibox.cancelScheduled}. */
  task_id?: string;
  scheduled_at?: string | null;
  send_mode?: string;
  /** The mailbox the platform sent from. */
  account_id?: string;
  account_email?: string;
  /** Whether the mailbox was chosen automatically. */
  auto?: boolean;
  /** A human-readable explanation of the automatic pick. Present only when `auto`. */
  picked_reason?: string;
  [key: string]: unknown;
}

/** One mailbox scored against a compose recipient. */
export interface ComposeCandidate {
  id: string;
  email?: string;
  name?: string;
  provider?: string;
  auth_state?: string;
  warmup_active?: boolean;
  daily_limit?: number;
  sent_today?: number;
  /** Sends left in the mailbox's daily budget. */
  remaining_today?: number;
  /** Messages already exchanged with the recipient from this mailbox. */
  history_messages?: number;
  last_contact_at?: string | null;
  score?: number;
  /** Human-readable reasons behind the score. */
  reasons?: string[];
  recommended?: boolean;
  [key: string]: unknown;
}

/** The response of {@link Unibox.composeCandidates}. */
export interface ComposeCandidates {
  accounts: ComposeCandidate[];
  recommended_account_id?: string | null;
  recommended_reason?: string | null;
  /** The contact the address resolves to, when one exists. */
  contact?: Record<string, unknown> | null;
  /** Set when the address is on the workspace suppression list. */
  suppression?: { reason?: string; [key: string]: unknown } | null;
  [key: string]: unknown;
}

/** What an AI draft was grounded in, reported alongside the draft. */
export interface DraftGrounding {
  /** Whether a contact record fed the prompt. */
  contact?: boolean;
  /** How many prior messages with the address fed the prompt. */
  history?: number;
  /** Whether the workspace voice profile fed the prompt. */
  voice_profile?: boolean;
  [key: string]: unknown;
}

/** An AI-generated draft. It never sends; charges AI credits. */
export interface AIDraft {
  /** The drafted body. Absent when the model returned a `question` instead. */
  text?: string;
  /**
   * A clarifying question, returned instead of `text` when the purpose of the email is
   * genuinely unknowable. Answer it and draft again.
   */
  question?: string;
  /** What the draft was grounded in. Present on compose drafts. */
  grounding?: DraftGrounding;
  credits_remaining?: number;
  credits_charged?: number;
  tokens_used?: number;
  model?: string;
  [key: string]: unknown;
}

/** Body for {@link Unibox.replyDraft}. */
export interface ReplyDraftParams {
  thread_id: string;
  /** Optional steer for the model, e.g. "decline politely". */
  instruction?: string;
  [key: string]: unknown;
}

/** Body for {@link Unibox.composeDraft}. */
export interface ComposeDraftParams {
  /** The recipient address. Empty is allowed, but the draft is then ungrounded. */
  to?: string;
  subject?: string;
  /** Optional steer for the model. */
  instruction?: string;
  [key: string]: unknown;
}

/** An autosaved compose draft, scoped to the calling user within the organization. */
export interface ComposeDraft {
  id: string;
  email_account_id?: string | null;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Body for {@link Unibox.saveDraft}. The id is client-generated, so the PUT is
 * idempotent and safe for debounced autosave.
 */
export interface SaveComposeDraftParams {
  email_account_id?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

/** A reply the inbox agent drafted on an inbound human reply, awaiting review. */
export interface AgentDraft {
  id: string;
  organization_id?: string;
  thread_id?: string;
  source_message_id?: string;
  /** The drafted reply body. */
  body?: string;
  status?: "pending" | "approved" | "discarded" | string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * The unified inbox: list, count, thread reads, labels, seen state, replies, snoozes,
 * and scheduled sends. Reachable as `warmbly.unibox`.
 *
 * @example
 * const page = await warmbly.unibox.list({ status: "unread" });
 * await warmbly.unibox.reply({ thread_id: page.data[0]!.thread_id, body: "Thanks!" });
 */
export class Unibox extends APIResource {
  /**
   * Lists unibox conversations, auto-paginating when iterated.
   * @example
   * for await (const item of await warmbly.unibox.list()) console.log(item.subject);
   */
  list(params?: ListUniboxParams): Promise<Page<UniboxItem>> {
    return this.http.getPage<UniboxItem>("unibox", { query: params });
  }

  /**
   * Returns conversation counts (e.g. unread totals).
   * @example
   * const counts = await warmbly.unibox.count();
   */
  count(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/count", { query: params });
  }

  /**
   * Returns an inbox overview summary.
   * @example
   * const overview = await warmbly.unibox.overview();
   */
  overview(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/overview", { query: params });
  }

  /**
   * Retrieves a single unibox conversation by id.
   * @example
   * const item = await warmbly.unibox.get("ub_1");
   */
  get(id: string, opts?: RequestOptions): Promise<UniboxItem> {
    return this.http.get<UniboxItem>(this.path("unibox", id), opts);
  }

  /**
   * Fetches a full thread (via the `thread` query, e.g. by `thread_id`).
   * @example
   * const thread = await warmbly.unibox.thread({ thread_id: "t_1" });
   */
  thread(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/thread", { query: params });
  }

  /**
   * Reads the labels on a thread.
   * @example
   * const labels = await warmbly.unibox.getThreadLabels({ thread_id: "t_1" });
   */
  getThreadLabels(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/thread/labels", { query: params });
  }

  /**
   * Replaces the labels on a thread.
   * @example
   * await warmbly.unibox.setThreadLabels({ thread_id: "t_1", labels: ["lead"] });
   */
  setThreadLabels(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>("unibox/thread/labels", { body: params });
  }

  /**
   * Marks conversations as seen.
   * @example
   * await warmbly.unibox.markSeen({ ids: ["ub_1"], seen: true });
   */
  markSeen(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("unibox/seen", { body: params });
  }

  /**
   * Sends a reply within a thread.
   * @example
   * await warmbly.unibox.reply({ thread_id: "t_1", body: "Thanks!" });
   */
  reply(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("unibox/reply", { body: params });
  }

  /**
   * Drafts a reply with AI, grounded in the thread, the contact, and the workspace voice
   * profile. It never sends — pass the result to {@link Unibox.reply} yourself. Charges
   * AI credits.
   *
   * @example
   * const draft = await warmbly.unibox.replyDraft({ thread_id: "t_1", instruction: "decline politely" });
   * if (draft.text) await warmbly.unibox.reply({ thread_id: "t_1", body: draft.text });
   */
  replyDraft(params: ReplyDraftParams): Promise<AIDraft> {
    return this.http.post<AIDraft>("unibox/reply/draft", { body: params });
  }

  /**
   * Scores every active mailbox for a recipient — conversation affinity, remaining daily
   * budget, and domain-auth health — plus the recommended pick, the resolved contact, and
   * the address's suppression state.
   *
   * @example
   * const { accounts, recommended_account_id } = await warmbly.unibox.composeCandidates({
   *   to: "jordan@acme.com",
   * });
   */
  composeCandidates(params: { to: string; [key: string]: unknown }): Promise<ComposeCandidates> {
    return this.http.get<ComposeCandidates>("unibox/compose/candidates", { query: params });
  }

  /**
   * Sends a brand-new outbound email (not a reply). Recipients on the workspace
   * suppression list are rejected with a `400` before anything queues. Omit
   * `email_account_id` to let the platform pick the best mailbox and report why.
   *
   * @example
   * const sent = await warmbly.unibox.compose({
   *   to: ["jordan@acme.com"],
   *   subject: "Quick question",
   *   body_plain: "Hi Jordan — ...",
   * });
   * console.log(sent.account_email, sent.picked_reason);
   */
  compose(params: ComposeParams): Promise<ComposeResult> {
    return this.http.post<ComposeResult>("unibox/compose", { body: params });
  }

  /**
   * Drafts a brand-new email with AI, grounded in the recipient's contact record, your
   * correspondence history with the address, and the workspace voice profile. It never
   * sends, and returns a clarifying `question` instead of `text` when the purpose is
   * genuinely unknowable. Charges AI credits.
   *
   * @example
   * const draft = await warmbly.unibox.composeDraft({ to: "jordan@acme.com", subject: "Intro" });
   * if (draft.question) console.log("needs an answer:", draft.question);
   */
  composeDraft(params: ComposeDraftParams): Promise<AIDraft> {
    return this.http.post<AIDraft>("unibox/compose/draft", { body: params });
  }

  /**
   * Lists your autosaved compose drafts, newest first.
   * @example
   * const drafts = await warmbly.unibox.listDrafts();
   */
  listDrafts(params?: Record<string, unknown>): Promise<ComposeDraft[]> {
    return this.http
      .get<{ data: ComposeDraft[] }>("unibox/drafts", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Creates or replaces an autosaved compose draft. The id is yours to generate, which
   * makes the call idempotent and safe for debounced autosave and retries.
   *
   * @example
   * await warmbly.unibox.saveDraft("draft_local_1", { subject: "Intro", body: "Hi ..." });
   */
  saveDraft(id: string, params: SaveComposeDraftParams): Promise<{ id: string }> {
    return this.http.put<{ id: string }>(this.path("unibox", "drafts", id), { body: params });
  }

  /**
   * Deletes an autosaved compose draft. Deleting one that is already gone is a no-op.
   * @example
   * await warmbly.unibox.deleteDraft("draft_local_1");
   */
  deleteDraft(id: string, opts?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(this.path("unibox", "drafts", id), opts);
  }

  /**
   * Lists the replies the inbox agent drafted and is holding for review. The agent never
   * sends: approving one is the only path that transmits.
   *
   * @example
   * const drafts = await warmbly.unibox.agentDrafts();
   */
  agentDrafts(params?: Record<string, unknown>): Promise<AgentDraft[]> {
    return this.http
      .get<{ data: AgentDraft[] }>("unibox/agent-drafts", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Approves an inbox-agent draft and sends it through the normal reply path, optionally
   * with an edited `body`. The pending status is claimed before sending, so a double
   * approval can never double-send; safe to retry with an `Idempotency-Key`.
   *
   * @example
   * await warmbly.unibox.approveAgentDraft("ad_1", { body: "Thanks — Tuesday works." });
   */
  approveAgentDraft(
    id: string,
    params?: { body?: string; [key: string]: unknown },
  ): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      this.path("unibox", "agent-drafts", id, "approve"),
      { body: params },
    );
  }

  /**
   * Dismisses an inbox-agent draft without sending it.
   * @example
   * await warmbly.unibox.discardAgentDraft("ad_1");
   */
  discardAgentDraft(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      this.path("unibox", "agent-drafts", id, "discard"),
      opts,
    );
  }

  /**
   * Lists active snoozes.
   * @example
   * const snoozes = await warmbly.unibox.listSnoozes();
   */
  listSnoozes(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/snoozes", { query: params });
  }

  /**
   * Snoozes a conversation until a given time.
   * @example
   * await warmbly.unibox.snooze({ thread_id: "t_1", until: "2026-07-01T09:00:00Z" });
   */
  snooze(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("unibox/snooze", { body: params });
  }

  /**
   * Removes a snooze. The thread is identified by the `thread_id` query parameter.
   * @example
   * await warmbly.unibox.unsnooze({ thread_id: "t_1" });
   */
  unsnooze(params: {
    thread_id: string;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    return this.http.delete<Record<string, unknown>>("unibox/snooze", { query: params });
  }

  /**
   * Lists scheduled (queued) sends.
   * @example
   * const scheduled = await warmbly.unibox.scheduled();
   */
  scheduled(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/scheduled", { query: params });
  }

  /**
   * Cancels a scheduled send by task id.
   * @example
   * await warmbly.unibox.cancelScheduled("task_1");
   */
  cancelScheduled(taskId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("unibox", "scheduled", taskId), opts);
  }
}
