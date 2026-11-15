import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A canonical unibox folder. */
export type UniboxFolder = "inbox" | "sent" | "drafts" | "archive" | "spam" | "trash";

/**
 * A unified-inbox message. List and thread rows carry `snippet`, a one-line preview;
 * {@link Unibox.get} adds the sanitized `body_html` and `body_plain`.
 */
export interface UniboxItem {
  id: string;
  /** The mailbox that holds the message. */
  email_id?: string;
  thread_id?: string;
  subject?: string;
  /** List and thread rows: sender addresses. */
  from_addr?: string[];
  /** List and thread rows: recipient addresses. */
  to_addr?: string[];
  /** {@link Unibox.get} only: sender addresses. */
  from?: string[];
  /** {@link Unibox.get} only: recipient addresses. */
  to?: string[];
  cc?: string[];
  bcc?: string[];
  seen?: boolean;
  /** {@link Unibox.get} only: the canonical folder. */
  folder?: UniboxFolder | (string & {});
  /** A one-line summary, not the body. */
  snippet?: string;
  /** Sanitized HTML body (scripts, handlers, frames, and unsafe URLs removed). Only on `get`. */
  body_html?: string;
  /** Plain-text body. Only on `get`. */
  body_plain?: string;
  /** True on the rare message whose stored body could not be read. */
  body_truncated?: boolean;
  internal_date?: string;
  /** List rows collapse to one row per thread: messages in the conversation. */
  message_count?: number;
  /** List rows: true when any message in the thread is unseen. */
  has_unread?: boolean;
  /** The conversation's labels (id, title, color). */
  labels?: Array<{ id: string; title?: string; color?: string; [key: string]: unknown }>;
  /** Thread reads: the workspace mailbox that sent the email this message answers, when it is not `email_id`. */
  answers_mailbox_id?: string;
  /** List reads: the campaign a send in this conversation belongs to. */
  campaign_id?: string;
  snoozed_until?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

/** Counters returned by {@link Unibox.overview}. Unknown counters pass through. */
export interface UniboxOverview {
  unread?: number;
  today?: number;
  week?: number;
  snoozed?: number;
  awaiting_reply?: number;
  /** Conversations no person wrote in. Left out of the unread, today, week and inbox counts. */
  automated?: number;
  automated_unread?: number;
  awaiting_agent_draft?: number;
  /** Threads with a mailbox or pending agent draft, each counted once. */
  drafts?: number;
  scheduled_pending?: number;
  scheduled_pending_max?: number;
  folders?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** A scheduled (queued) unibox task. */
export interface UniboxScheduledTask {
  task_id: string;
  scheduled_at?: string;
  created_at?: string;
  /** The sending mailbox. */
  account_id?: string;
  account_email?: string;
  account_name?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  snippet?: string;
  thread_id?: string;
  [key: string]: unknown;
}

/** Query params for listing the unibox. */
export interface ListUniboxParams {
  cursor?: string;
  limit?: number;
  /** Filter by sender address. */
  from?: string;
  /** Filter by subject. */
  subject?: string;
  /** `true` lists unread messages only. */
  unseen?: boolean;
  /** `true` lists only snoozed threads; `any` ignores snooze state. Absent hides snoozed threads. */
  snoozed?: boolean | "any";
  /** `true` lists conversations waiting on a reply from the other side. */
  awaiting_reply?: boolean;
  /** `true` lists conversations holding a pending inbox-agent draft. */
  agent_drafts?: boolean;
  /** Inclusive lower bound: `YYYY-MM-DD` or an RFC 3339 timestamp. */
  since?: string;
  /** Upper bound: a `YYYY-MM-DD` date keeps that whole UTC day; an RFC 3339 instant is exclusive. */
  until?: string;
  /** Conversations traced to a send of this campaign. */
  campaign_id?: string;
  /** Conversations traced to a send to this contact, or exchanged with their address. */
  contact_id?: string;
  /** One mailbox id, or a comma-separated list. */
  email_id?: string;
  /** Comma-separated mailbox ids. */
  email_ids?: string;
  /** Comma-separated mailbox tag ids. */
  tag_ids?: string;
  /** Comma-separated conversation label ids; a thread matches if it carries any. */
  category_ids?: string;
  /** `true` lists threads with no labels at all. */
  uncategorized?: boolean;
  /** `true` lists only conversations no person wrote in; `false` leaves them out. */
  automated?: boolean;
  /** `true` puts archived conversations back into an unscoped list. */
  include_archived?: boolean;
  /**
   * Match either side of the exchange (sender or recipient), for "every conversation
   * with this person".
   */
  address?: string;
  /** Split the list by direction, resolved against your own mailbox addresses. */
  direction?: "sent" | "received";
  /** One canonical folder. Omit for every folder except `spam` and `trash`. */
  folder?: UniboxFolder;
  [key: string]: unknown;
}

/**
 * Body for {@link Unibox.markSeen}: an explicit batch of up to 500 ids, or a whole
 * canonical folder. Send one of `email_ids` or `folder`, not both.
 */
export interface MarkSeenParams {
  email_ids?: string[];
  /** Mark whole conversations: each entry is a thread id, or a message id for mail with no thread. */
  thread_ids?: string[];
  folder?: UniboxFolder;
  seen: boolean;
  [key: string]: unknown;
}

/** A folder a message may be filed into from the unibox. `sent`, `drafts` and `spam` are provider verdicts. */
export type FilableFolder = "inbox" | "archive" | "trash";

/** Body for {@link Unibox.moveFolder}: files messages and/or whole conversations into one folder. */
export interface MoveFolderParams {
  /** Message ids to file. */
  email_ids?: string[];
  /** Whole conversations to file: a thread id, or a message id for mail with no thread. */
  thread_ids?: string[];
  /** Archive = `archive`, Delete = `trash`, Move to inbox = `inbox`. */
  folder: FilableFolder;
  [key: string]: unknown;
}

/** Body for {@link Unibox.upsertThreadDraft}. */
export interface UpsertThreadDraftParams {
  /** The conversation to draft on, at most 998 characters. */
  thread_id: string;
  /** The draft reply, at most 8000 characters. */
  body: string;
  /** A short slug naming the writer (letters, digits, dot, dash, underscore; at most 40). Stored as the draft's model. */
  source: string;
  /** What the inbound message was, at most 40 characters. */
  intent_class?: string;
  confidence?: number;
  [key: string]: unknown;
}

/** The result of {@link Unibox.upsertThreadDraft}. */
export interface UpsertThreadDraftResult {
  id: string;
  /** Always `pending` on success. */
  status: "pending" | (string & {});
  /** True when a new draft was created, false when the pending one was replaced. */
  created: boolean;
  [key: string]: unknown;
}

/** Body for {@link Unibox.setThreadLabels}: the full desired label set. */
export interface SetThreadLabelsParams {
  thread_id: string;
  /** Conversation label (category) ids. Replaces the thread's labels; send `[]` to clear. */
  category_ids: string[];
  [key: string]: unknown;
}

/** Body for {@link Unibox.snooze}. Name the thread with `thread_id` and/or `thread_ids`. */
export interface SnoozeParams {
  thread_id?: string;
  /** Snooze a whole selection in one call. */
  thread_ids?: string[];
  /** When the threads come back (RFC 3339). Required. */
  snoozed_until: string;
  [key: string]: unknown;
}

/** One of your snoozed threads. */
export interface UniboxSnooze {
  id: string;
  user_id: string;
  thread_id: string;
  snoozed_until: string;
  created_at: string;
  updated_at: string;
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
  email_account_id?: string;
  owner_user_id?: string;
  thread_id?: string;
  source_message_id?: string;
  contact_id?: string;
  campaign_id?: string;
  to_addr?: string;
  subject?: string;
  in_reply_to?: string;
  /** The drafted reply body. */
  body?: string;
  intent_class?: string;
  confidence?: number;
  /** Who wrote the draft (the `source` slug for API-written drafts). */
  model?: string;
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
 * const page = await warmbly.unibox.list({ unseen: true });
 * await warmbly.unibox.moveFolder({ thread_ids: [page.data[0]!.thread_id!], folder: "archive" });
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
   * Returns the unseen message count, optionally for one mailbox (`email_id`). Needs
   * `READ_UNIBOX`.
   * @example
   * const { count } = await warmbly.unibox.count();
   */
  count(params?: { email_id?: string; [key: string]: unknown }): Promise<{ count: number }> {
    return this.http.get<{ count: number }>("unibox/count", { query: params });
  }

  /**
   * Returns an inbox overview summary.
   * @example
   * const overview = await warmbly.unibox.overview();
   */
  overview(opts?: RequestOptions): Promise<UniboxOverview> {
    return this.http.get<UniboxOverview>("unibox/overview", opts);
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
   * Fetches a full thread. Name it with `thread_id` (or `id`); `email_id` (or `email`)
   * narrows it to one mailbox, and `cursor` and `limit` page through the messages.
   * @example
   * const thread = await warmbly.unibox.thread({ thread_id: "t_1" });
   */
  thread(params: {
    thread_id?: string;
    id?: string;
    email_id?: string;
    cursor?: string;
    limit?: number;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/thread", { query: params });
  }

  /**
   * Reads the labels on a thread. The server answers `{ data: [...] }`. Needs `READ_UNIBOX`.
   * @example
   * const { data } = await warmbly.unibox.getThreadLabels({ thread_id: "t_1" });
   */
  getThreadLabels(params: {
    thread_id: string;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/thread/labels", { query: params });
  }

  /**
   * Replaces the labels on a thread with the given conversation label ids
   * (`category_ids`; only the workspace's own labels attach). Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.setThreadLabels({ thread_id: "t_1", category_ids: ["cat_1"] });
   */
  setThreadLabels(params: SetThreadLabelsParams): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>("unibox/thread/labels", { body: params });
  }

  /**
   * Marks messages as read or unread, org-wide: an explicit batch of up to 500 ids, or
   * a whole canonical folder. Send one of `email_ids`, `thread_ids` or `folder`. The
   * server echoes the request body. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.markSeen({ email_ids: ["ub_1"], seen: true });
   * await warmbly.unibox.markSeen({ folder: "inbox", seen: true });
   */
  markSeen(params: MarkSeenParams): Promise<MarkSeenParams> {
    return this.http.patch<MarkSeenParams>("unibox/seen", { body: params });
  }

  /**
   * Files messages and/or whole conversations into `inbox`, `archive` or `trash`
   * (unibox Move to inbox, Archive and Delete). The store changes first, then the move is
   * relayed to each mailbox that has `relay_folder_moves` on. Naturally idempotent: the
   * body names the destination. The server echoes the request body. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.moveFolder({ thread_ids: ["t_1"], folder: "archive" });
   */
  moveFolder(params: MoveFolderParams, opts?: RequestOptions): Promise<MoveFolderParams> {
    return this.http.patch<MoveFolderParams>("unibox/folder", { ...opts, body: params });
  }

  /**
   * Writes a reply draft for the newest inbound message on a thread: replaces the
   * thread's pending draft or creates one, for review in the Drafts view. It never sends.
   * Naturally idempotent per thread. A 404 `thread_not_found` means no inbound message
   * exists; 409 `already_sent` or `draft_discarded` mean the newest inbound message has
   * already been handled. Needs `WRITE_UNIBOX`.
   * @example
   * const { id, created } = await warmbly.unibox.upsertThreadDraft({
   *   thread_id: "t_1",
   *   body: "Thanks, Tuesday works.",
   *   source: "my-agent",
   *   intent_class: "meeting_request",
   *   confidence: 0.82,
   * });
   */
  upsertThreadDraft(
    params: UpsertThreadDraftParams,
    opts?: RequestOptions,
  ): Promise<UpsertThreadDraftResult> {
    return this.http.put<UpsertThreadDraftResult>("unibox/ai-drafts/by-thread", {
      ...opts,
      body: params,
    });
  }

  /**
   * Sends (or schedules) a reply or forward. `email_account_id`, `to` and `subject` are
   * required; provide `body_html` and/or `body_plain`; `thread_id` and `in_reply_to`
   * thread it; `forward_message_id` makes it a forward. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.reply({
   *   email_account_id: "mb_1",
   *   to: ["jordan@acme.com"],
   *   subject: "Re: Intro",
   *   thread_id: "t_1",
   *   body_plain: "Thanks!",
   * });
   */
  reply(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("unibox/reply", { body: params });
  }

  /**
   * Drafts a reply with AI, grounded in the thread, the contact, and the workspace voice
   * profile. It never sends - pass the result to {@link Unibox.reply} yourself. Charges
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
   * Scores every active mailbox for a recipient - conversation affinity, remaining daily
   * budget, and domain-auth health - plus the recommended pick, the resolved contact, and
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
   *   body_plain: "Hi Jordan - ...",
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
   * await warmbly.unibox.approveAgentDraft("ad_1", { body: "Thanks - Tuesday works." });
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
   * Lists your active snoozes. Needs `READ_UNIBOX`.
   * @example
   * const snoozes = await warmbly.unibox.listSnoozes();
   */
  listSnoozes(opts?: RequestOptions): Promise<{ data: UniboxSnooze[] }> {
    return this.http.get<{ data: UniboxSnooze[] }>("unibox/snoozes", opts);
  }

  /**
   * Snoozes one or more conversations until `snoozed_until`; a second call on the same
   * thread moves the time. Naming exactly one thread answers with that snooze row; naming
   * several answers `{ data }`. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.snooze({ thread_id: "t_1", snoozed_until: "2026-07-01T09:00:00Z" });
   */
  snooze(params: SnoozeParams): Promise<UniboxSnooze | { data: UniboxSnooze[] }> {
    return this.http.post<UniboxSnooze | { data: UniboxSnooze[] }>("unibox/snooze", {
      body: params,
    });
  }

  /**
   * Removes snoozes. The thread is identified by the `thread_id` query parameter (a
   * comma-separated list unsnoozes several). Deleting one that does not exist still
   * succeeds (204). Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.unsnooze({ thread_id: "t_1" });
   */
  unsnooze(params: { thread_id: string; [key: string]: unknown }): Promise<void> {
    return this.http.delete<void>("unibox/snooze", { query: params });
  }

  /**
   * Lists scheduled (queued) sends, optionally for one thread (`thread_id`). Needs
   * `READ_UNIBOX`.
   * @example
   * const scheduled = await warmbly.unibox.scheduled();
   */
  scheduled(params?: {
    thread_id?: string;
    [key: string]: unknown;
  }): Promise<{ data: UniboxScheduledTask[] }> {
    return this.http.get<{ data: UniboxScheduledTask[] }>("unibox/scheduled", { query: params });
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
