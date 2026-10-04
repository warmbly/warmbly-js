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
  /** The connected mailbox the message belongs to. */
  email_id?: string;
  thread_id?: string;
  subject?: string;
  /** The sender addresses of a list or thread row. */
  from_addr?: string[];
  /** The recipient addresses of a list or thread row. */
  to_addr?: string[];
  /** When the message arrived. On list and thread rows. */
  internal_date?: string;
  seen?: boolean;
  /** Messages in the conversation behind a list row; 1 for a singleton, 0 on thread reads. */
  message_count?: number;
  /** True if any message in the conversation is unread. On list rows. */
  has_unread?: boolean;
  /** The conversation's assigned labels. */
  labels?: Array<{ id: string; title: string; color: string; [key: string]: unknown }>;
  /**
   * The workspace mailbox that sent the email this message replies to, when that is not the
   * mailbox holding it (a reply that landed in a shared reply inbox). Thread reads only.
   */
  answers_mailbox_id?: string;
  /**
   * The sender addresses. Only on {@link Unibox.get}, which returns the full message.
   * List and thread rows use `from_addr`.
   */
  from?: string[];
  /** Recipient addresses. Only on `get`. */
  to?: string[];
  cc?: string[];
  bcc?: string[];
  date?: string;
  message_id?: string;
  in_reply_to?: string[];
  parent_id?: string;
  flags?: string[];
  size?: number;
  /** The canonical folder the message sits in. Only on `get`. */
  folder?: UniboxFolder | (string & {});
  /** A one-line summary, not the body. */
  snippet?: string;
  /** Sanitized HTML body (scripts, handlers, frames, and unsafe URLs removed). Only on `get`. */
  body_html?: string;
  /** Plain-text body. Only on `get`. */
  body_plain?: string;
  /** True on the rare message whose stored body could not be read. */
  body_truncated?: boolean;
  /** @deprecated The server never returns this on a message; see {@link Unibox.listSnoozes}. */
  snoozed_until?: string | null;
  /** @deprecated The server returns `internal_date` and `date`, not `created_at`. */
  created_at?: string;
  [key: string]: unknown;
}

/** A scheduled (queued) outbound unibox send. */
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
  /** The thread the reply will land in, when queued from the unibox. */
  thread_id?: string;
  [key: string]: unknown;
}

/** A snoozed conversation. */
export interface UniboxSnooze {
  id: string;
  user_id?: string;
  thread_id: string;
  snoozed_until: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Unibox.snooze}. Name one thread, several, or both (the union is snoozed). */
export interface SnoozeParams {
  thread_id?: string;
  /** Snooze a whole selection in one call. */
  thread_ids?: string[];
  /** RFC 3339. Required. */
  snoozed_until: string;
  [key: string]: unknown;
}

/** Counts behind the unibox's scope rail. */
export interface UniboxOverview {
  total: number;
  unread: number;
  today: number;
  week: number;
  snoozed: number;
  awaiting_reply: number;
  /** Conversations no person wrote in. They are left out of `unread`, `today`, `week`, the inbox folder, and the mailbox and tag counts. */
  automated?: number;
  automated_unread?: number;
  awaiting_agent_draft?: number;
  scheduled_pending?: number;
  /** The cap on pending scheduled sends per workspace. */
  scheduled_pending_max?: number;
  folders?: Array<{ folder: string; unread: number; total: number; [key: string]: unknown }>;
  mailboxes?: Array<Record<string, unknown>>;
  tags?: Array<Record<string, unknown>>;
  categories?: Array<Record<string, unknown>>;
  generated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Unibox.reply}: a reply or forward sent from a mailbox. */
export interface ReplyParams {
  /** The sending mailbox. */
  email_account_id: string;
  /** At least one recipient. */
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html?: string;
  body_plain?: string;
  /** Message-IDs this replies to. */
  in_reply_to?: string[];
  /** The conversation to reply in. */
  thread_id?: string;
  /** `instant` (default) or a scheduled mode with `scheduled_at`. */
  send_mode?: string;
  scheduled_at?: string;
  /**
   * Make the send a forward of this stored message, which goes out under your body and
   * signature. Also needs `READ_UNIBOX`.
   */
  forward_message_id?: string;
  [key: string]: unknown;
}

/** Body for {@link Unibox.setThreadLabels}: the full desired label set for a conversation. */
export interface SetThreadLabelsParams {
  thread_id: string;
  /** Label (category) ids; the set replaces the current one. Send `[]` to clear. */
  category_ids: string[];
}

/** Query params for {@link Unibox.thread}. */
export interface UniboxThreadParams {
  /** The conversation id. Required. */
  thread_id: string;
  /** Restrict to one mailbox. Omit to read the thread across the organization. */
  email_id?: string;
  cursor?: string;
  limit?: number;
  [key: string]: unknown;
}

/** Body for {@link Unibox.moveFolder}. */
export interface MoveFolderParams {
  /** Message ids, up to 500. */
  email_ids?: string[];
  /**
   * Whole conversations, up to 500. Each entry is a thread id, or a message id for mail
   * that never got one.
   */
  thread_ids?: string[];
  /** Where to file them: `inbox`, `archive` or `trash`. */
  folder: "inbox" | "archive" | "trash";
}

/** The echo of a {@link Unibox.moveFolder} request. */
export interface MoveFolderResult {
  /** Always present; `null` when the request named only threads. */
  email_ids: string[] | null;
  thread_ids?: string[];
  folder: string;
  [key: string]: unknown;
}

/** Query params for listing the unibox. */
export interface ListUniboxParams {
  cursor?: string;
  limit?: number;
  /** @deprecated The server has no `status` filter. Use `unseen`. */
  status?: string;
  /** Only conversations with unread mail. Only the value `true` is honoured. */
  unseen?: boolean;
  /** Sender substring filter. */
  from?: string;
  subject?: string;
  /** `true` lists only snoozed conversations, `any` ignores snoozes; omitted hides them. */
  snoozed?: "true" | "any";
  /** Only conversations awaiting a reply. */
  awaiting_reply?: boolean;
  /** Only conversations with a pending inbox-agent draft. */
  agent_drafts?: boolean;
  /** `YYYY-MM-DD`. */
  since?: string;
  /** `YYYY-MM-DD`. */
  until?: string;
  /** One mailbox id. */
  email_id?: string;
  /** Comma-separated mailbox ids. */
  email_ids?: string;
  /** Only conversations carrying no labels. */
  uncategorized?: boolean;
  /** Comma-separated label ids; a conversation matches if it carries any. */
  category_ids?: string;
  /** `true` lists only conversations no person wrote in, `false` leaves them out; omitted is both. */
  automated?: boolean;
  /** Put archived conversations back into an unscoped result. Ignored when `folder` is set. */
  include_archived?: boolean;
  /**
   * Match either side of the exchange (sender or recipient), for "every conversation
   * with this person".
   */
  address?: string;
  /** Split the list by direction, resolved against your own mailbox addresses. */
  direction?: "sent" | "received";
  /**
   * One canonical folder. Omit for every working folder (`spam`, `trash` and `archive`
   * stay out unless `include_archived` asks for filed mail).
   */
  folder?: UniboxFolder;
  [key: string]: unknown;
}

/**
 * Body for {@link Unibox.markSeen}: an explicit batch of up to 500 message ids and/or up to
 * 500 conversations, or a whole canonical folder. A `folder` cannot be combined with ids.
 */
export interface MarkSeenParams {
  email_ids?: string[];
  /** Whole conversations, up to 500: a thread id, or a message id for mail that never got one. */
  thread_ids?: string[];
  folder?: UniboxFolder;
  seen: boolean;
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
  /** The rich (HTML) body, when the draft was written in the rich composer. */
  body_html?: string;
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
  /** The rich (HTML) body. */
  body_html?: string;
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
   * Returns the unseen-message count, optionally for one mailbox (`email_id`). Needs
   * `READ_UNIBOX`.
   * @example
   * const { count } = await warmbly.unibox.count();
   */
  count(params?: { email_id?: string; [key: string]: unknown }): Promise<{ count: number }> {
    return this.http.get<{ count: number }>("unibox/count", { query: params });
  }

  /**
   * Returns the inbox overview that backs the scope rail: unread, today, week, snoozed,
   * awaiting-reply and automated totals plus per-folder, mailbox, tag and label counts.
   * Needs `READ_UNIBOX`.
   * @example
   * const overview = await warmbly.unibox.overview();
   */
  overview(params?: Record<string, unknown>): Promise<UniboxOverview> {
    return this.http.get<UniboxOverview>("unibox/overview", { query: params });
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
   * Reads every message of a conversation, auto-paginating when iterated. Needs
   * `READ_UNIBOX`.
   * @example
   * for await (const msg of await warmbly.unibox.thread({ thread_id: "t_1" })) console.log(msg.subject);
   */
  thread(params: UniboxThreadParams): Promise<Page<UniboxItem>> {
    return this.http.getPage<UniboxItem>("unibox/thread", { query: params });
  }

  /**
   * Reads the labels on a conversation. Needs `READ_UNIBOX`.
   * @example
   * const labels = await warmbly.unibox.getThreadLabels({ thread_id: "t_1" });
   */
  getThreadLabels(params: {
    thread_id: string;
    [key: string]: unknown;
  }): Promise<Array<{ id: string; title?: string; color?: string; [key: string]: unknown }>> {
    return this.http
      .get<{ data: Array<{ id: string; title?: string; color?: string }> }>(
        "unibox/thread/labels",
        { query: params },
      )
      .then((r) => r.data ?? []);
  }

  /**
   * Replaces the labels on a conversation with `category_ids`. The body is the desired set,
   * so retries are safe. Returns the labels now attached. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.setThreadLabels({ thread_id: "t_1", category_ids: ["cat_1"] });
   */
  setThreadLabels(
    params: SetThreadLabelsParams,
  ): Promise<Array<{ id: string; title?: string; color?: string; [key: string]: unknown }>> {
    return this.http
      .put<{ data: Array<{ id: string; title?: string; color?: string }> }>(
        "unibox/thread/labels",
        { body: params },
      )
      .then((r) => r.data ?? []);
  }

  /**
   * Marks messages as read or unread, org-wide: an explicit batch of up to 500 ids, or
   * a whole canonical folder. Send one of `email_ids` or `folder`.
   * @example
   * await warmbly.unibox.markSeen({ email_ids: ["ub_1"], seen: true });
   * await warmbly.unibox.markSeen({ folder: "inbox", seen: true });
   */
  markSeen(params: MarkSeenParams): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("unibox/seen", { body: params });
  }

  /**
   * Re-files messages or whole conversations into `inbox`, `archive` or `trash`
   * (Archive, Delete and Move to inbox). Up to 500 message ids and 500 conversations per
   * call. The store changes first and the move is then relayed to each mailbox that has
   * `relay_folder_moves` on. The body names a destination, not a delta, so retries need no
   * `Idempotency-Key`. Other folders are a 400: `sent`, `drafts` and `spam` are provider
   * verdicts. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.moveFolder({ thread_ids: ["t_1", "t_2"], folder: "archive" });
   */
  moveFolder(params: MoveFolderParams): Promise<MoveFolderResult> {
    return this.http.patch<MoveFolderResult>("unibox/folder", { body: params });
  }

  /**
   * Sends a reply or forward from a mailbox. `email_account_id`, `to` and `subject` are
   * required, plus `body_html` and/or `body_plain`. Pass `thread_id` and `in_reply_to` to
   * reply in a conversation, or `forward_message_id` to forward a stored message. Needs
   * `WRITE_UNIBOX` (and `READ_UNIBOX` for a forward).
   * @example
   * await warmbly.unibox.reply({
   *   email_account_id: "mb_1",
   *   to: ["jordan@acme.com"],
   *   subject: "Re: Quick question",
   *   body_plain: "Thanks!",
   *   thread_id: "t_1",
   * });
   */
  reply(params: ReplyParams): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("unibox/reply", { body: params });
  }

  /**
   * Drafts a reply with AI, grounded in the thread, the contact, and the workspace voice
   * profile. It never sends — pass the result to {@link Unibox.reply} yourself. Charges
   * AI credits.
   *
   * @example
   * const draft = await warmbly.unibox.replyDraft({ thread_id: "t_1", instruction: "decline politely" });
   * if (draft.text) {
   *   await warmbly.unibox.reply({
   *     email_account_id: "mb_1",
   *     to: ["jordan@acme.com"],
   *     subject: "Re: Quick question",
   *     thread_id: "t_1",
   *     body_plain: draft.text,
   *   });
   * }
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
   * Lists the calling user's active snoozes. Needs `READ_UNIBOX`.
   * @example
   * const { data } = await warmbly.unibox.listSnoozes();
   */
  listSnoozes(params?: Record<string, unknown>): Promise<{ data: UniboxSnooze[] }> {
    return this.http.get<{ data: UniboxSnooze[] }>("unibox/snoozes", { query: params });
  }

  /**
   * Snoozes conversations until a time (`snoozed_until`, RFC 3339). Upsert semantics: a
   * second call on the same thread moves the time. Name `thread_id`, `thread_ids`, or both.
   * A request naming one thread answers with that snooze row; one naming several answers
   * with `{ data }`. Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.snooze({ thread_id: "t_1", snoozed_until: "2026-11-01T09:00:00Z" });
   */
  snooze(params: SnoozeParams): Promise<UniboxSnooze | { data: UniboxSnooze[] }> {
    return this.http.post<UniboxSnooze | { data: UniboxSnooze[] }>("unibox/snooze", {
      body: params,
    });
  }

  /**
   * Removes a snooze immediately. `thread_id` is one id or a comma-separated list. Resolves
   * with no body (204). Needs `WRITE_UNIBOX`.
   * @example
   * await warmbly.unibox.unsnooze({ thread_id: "t_1" });
   */
  unsnooze(params: { thread_id: string; [key: string]: unknown }): Promise<void> {
    return this.http.delete<void>("unibox/snooze", { query: params });
  }

  /**
   * Lists the pending scheduled sends queued from the organization's mailboxes, or those of
   * one conversation with `thread_id`. Needs `READ_UNIBOX`.
   * @example
   * const { data } = await warmbly.unibox.scheduled();
   */
  scheduled(params?: {
    thread_id?: string;
    [key: string]: unknown;
  }): Promise<{ data: UniboxScheduledTask[] }> {
    return this.http.get<{ data: UniboxScheduledTask[] }>("unibox/scheduled", {
      query: params,
    });
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
