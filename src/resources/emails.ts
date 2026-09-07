import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A connected sending mailbox (email account). Documented-but-open shape. */
export interface EmailAccount {
  id: string;
  email?: string;
  provider?: "gmail" | "outlook" | "smtp_imap" | (string & {});
  status?: "active" | "inactive" | "revoked" | (string & {});
  warmup_enabled?: boolean;
  /** The sending domain's authentication state, refreshed by a background check. */
  auth_state?: "passing" | "failing" | "unknown" | (string & {});
  /** When the domain entered `failing`; null otherwise. */
  auth_failing_since?: string | null;
  tracking_domain?: string;
  tracking_domain_verified?: boolean;
  /** The mailbox's own IANA zone, when set. */
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Emails.update}. Every field is optional; open shape. */
export interface UpdateEmailParams {
  /** Daily cold-campaign cap, 0..5000 (default 50). */
  campaign_limit?: number;
  /** The mailbox's IANA zone. Send an empty string to clear it. */
  timezone?: string;
  /** SMTP/IMAP only: file a copy of each outbound message in the Sent folder (default true). */
  save_to_sent?: boolean;
  [key: string]: unknown;
}

/** Query params for listing mailboxes. */
export interface ListEmailsParams {
  cursor?: string;
  limit?: number;
  /** Full-text search across the mailbox address and label. */
  q?: string;
  /** Filter to mailboxes carrying this tag. */
  tag?: string;
  [key: string]: unknown;
}

/** Body for sending a one-off email. The platform requires `body_html` and/or `body_plain`. */
export interface SendEmailParams {
  /** One or more recipient addresses. */
  to: string[];
  subject?: string;
  /** HTML body. Provide this and/or `body_plain`. */
  body_html?: string;
  /** Plain-text body. Provide this and/or `body_html`. */
  body_plain?: string;
  [key: string]: unknown;
}

/**
 * Body for {@link Emails.bulkTag}: add and/or remove tags across many mailboxes in one
 * transaction. Set semantics, so re-adding an existing tag is a no-op.
 */
export interface BulkTagEmailsParams {
  /** The mailboxes to retag, 1..1000 ids. */
  email_ids: string[];
  /** Tag ids to add, up to 100. */
  add_tags?: string[];
  /** Tag ids to remove, up to 100. */
  remove_tags?: string[];
  [key: string]: unknown;
}

/** Query params for updating a mailbox's tracking domain. */
export interface TrackParams {
  /** The custom tracking domain to apply (sent as the `domain` query parameter). */
  domain: string;
  [key: string]: unknown;
}

/**
 * Warmup actions accepted by {@link Emails.warmup}: start, pause, resume, stop, appeal.
 */
export type WarmupAction = "start" | "pause" | "resume" | "stop" | "appeal";

/** The verification state of a custom tracking domain. */
export type TrackingDomainVerification =
  | "verified"
  | "unset"
  | "no_target"
  | "not_found"
  | "wrong_target"
  | "lookup_error"
  | "pending"
  | (string & {});

/** A tracking domain's stored state plus what this deployment expects in the `CNAME`. */
export interface TrackingDomainStatus {
  tracking_domain?: string;
  tracking_domain_verified?: boolean;
  tracking_domain_verified_at?: string | null;
  /** The value to put in the `CNAME`. Empty when the deployment has no tracking host. */
  cname_target?: string;
  status?: TrackingDomainVerification;
  /** One sentence explaining `status`, safe to show to an end user. */
  message?: string;
  /** What DNS returned, when it differs from the target. */
  observed?: string;
  /** True when the record is right but the deployment's own tracking host does not resolve. */
  tracking_host_unresolvable?: boolean;
  [key: string]: unknown;
}

/** What decides the mailbox allowance. */
export type MailboxAllowanceBasis =
  | "fair_use"
  | "plan"
  | "override"
  | "free"
  | "unlimited"
  | (string & {});

/** How many mailboxes the workspace holds and may hold, and why. */
export interface MailboxAllowance {
  used: number;
  /** `null` for unlimited. */
  allowance: number | null;
  /** `null` for unlimited. Every connect path refuses once this is 0. */
  remaining: number | null;
  basis: MailboxAllowanceBasis;
  sends_per_mailbox?: number;
  plan_daily_sends?: number;
  plan_name?: string;
  paid?: boolean;
  /** The open limit-increase request for mailboxes, if any. */
  pending_request?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A live SPF, DKIM, and DMARC lookup on a mailbox's sending domain. */
export interface DomainAuthCheck {
  domain?: string;
  spf?: boolean;
  dkim?: boolean;
  dmarc?: boolean;
  spf_record?: string;
  dkim_selectors?: string[];
  dmarc_policy?: string;
  /** The domain the DMARC record was read from, when inherited from the organizational domain. */
  dmarc_domain?: string;
  dmarc_inherited?: boolean;
  /** True for a special-use domain that cannot resolve by definition. */
  reserved?: boolean;
  /** True when DNS could not answer. */
  lookup_error?: boolean;
  summary?: string;
  [key: string]: unknown;
}

/** A mailbox's place in cold-send rotation, as returned by hold and release. */
export interface SendRotationState {
  state: "active" | "resting" | "reserve" | (string & {});
  since?: string;
  reason?: string;
  [key: string]: unknown;
}

/** What the platform knows about a mailbox's inbound sync. */
export interface EmailSyncStatus {
  /** `null` until the worker has reported. */
  state: {
    backfill_status?: string;
    backfill_synced?: number;
    backfill_since?: string;
    backfill_started_at?: string;
    backfill_completed_at?: string;
    /** Set while fair use is holding the mailbox. */
    throttled_until?: string;
    throttle_reason?: string;
    deferred?: number;
    last_synced_at?: string;
    [key: string]: unknown;
  } | null;
  policy: {
    backfill_days?: number;
    backfill_messages?: number;
    daily_messages?: number;
    org_daily_messages?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * The human sending behaviour profile: the ranges a mailbox rolls its workday from.
 * Minutes are minutes of the day in the mailbox's zone; `weekdays` is a bitmask.
 */
export interface SendingBehavior {
  email_account_id: string;
  enabled: boolean;
  daily_limit_min?: number;
  daily_limit_max?: number;
  hourly_limit_min?: number;
  hourly_limit_max?: number;
  gap_min_seconds?: number;
  gap_max_seconds?: number;
  work_start_min?: number;
  work_start_max?: number;
  work_end_min?: number;
  work_end_max?: number;
  lunch_enabled?: boolean;
  lunch_earliest?: number;
  lunch_latest?: number;
  lunch_min_minutes?: number;
  lunch_max_minutes?: number;
  weekdays?: number;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Emails.updateBehavior}. Every field is optional. */
export type UpdateSendingBehaviorParams = Partial<
  Omit<SendingBehavior, "email_account_id" | "created_at" | "updated_at" | "timezone">
> & { [key: string]: unknown };

/** The workday a mailbox rolled for today, plus what it has sent and may still send. */
export interface DailySendingPlan {
  email_account_id: string;
  plan_date?: string;
  timezone?: string;
  is_working_day?: boolean;
  daily_limit?: number;
  hourly_limit?: number;
  work_start_minute?: number;
  work_end_minute?: number;
  lunch_start_minute?: number | null;
  lunch_end_minute?: number | null;
  gap_min_seconds?: number;
  gap_max_seconds?: number;
  sent_today?: number;
  remaining_today?: number;
  behavior?: SendingBehavior;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Manage connected mailboxes: list, inspect, update, verify, warmup control, and sending.
 * Reachable as `warmbly.emails`.
 *
 * @example
 * for await (const mb of await warmbly.emails.list()) console.log(mb.email);
 * await warmbly.emails.warmup("mb_1", "start");
 */
export class Emails extends APIResource {
  /**
   * Lists mailboxes, auto-paginating when iterated.
   * @example
   * const page = await warmbly.emails.list({ status: "connected" });
   */
  list(params?: ListEmailsParams): Promise<Page<EmailAccount>> {
    return this.http.getPage<EmailAccount>("emails", { query: params });
  }

  /**
   * Retrieves a mailbox by id.
   * @example
   * const mb = await warmbly.emails.get("mb_1");
   */
  get(id: string, opts?: RequestOptions): Promise<EmailAccount> {
    return this.http.get<EmailAccount>(this.path("emails", id), opts);
  }

  /**
   * Updates a mailbox.
   * @example
   * await warmbly.emails.update("mb_1", { daily_send_limit: 40 });
   */
  update(id: string, params: UpdateEmailParams): Promise<EmailAccount> {
    return this.http.patch<EmailAccount>(this.path("emails", id), { body: params });
  }

  /**
   * Reports how many mailboxes the workspace holds, how many it may hold, and why. Read
   * it before a connect: every connect path refuses with `mailbox_allowance_reached`
   * once `remaining` is 0.
   * @example
   * const { used, allowance, remaining } = await warmbly.emails.allowance();
   */
  allowance(opts?: RequestOptions): Promise<MailboxAllowance> {
    return this.http.get<MailboxAllowance>("emails/allowance", opts);
  }

  /**
   * Disconnects/deletes a mailbox.
   * @example
   * await warmbly.emails.delete("mb_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("emails", id), opts);
  }

  /**
   * Adds and/or removes tags across up to 1000 mailboxes in one transaction. Set
   * semantics make it naturally idempotent, so retries need no `Idempotency-Key`.
   * Ids you don't own are skipped rather than erroring. Returns the number of
   * mailboxes touched.
   *
   * @example
   * const { updated } = await warmbly.emails.bulkTag({
   *   email_ids: ["mb_1", "mb_2"],
   *   add_tags: ["tag_outbound"],
   *   remove_tags: ["tag_paused"],
   * });
   */
  bulkTag(params: BulkTagEmailsParams): Promise<{ updated: number }> {
    return this.http.patch<{ updated: number }>("emails/tags", { body: params });
  }

  /**
   * Sets a mailbox's custom open/click tracking domain. The domain is sent as the
   * `domain` query parameter (the platform reads it from the query string, not the body).
   * @example
   * await warmbly.emails.track("mb_1", { domain: "track.warmbly.com" });
   */
  track(id: string, params: TrackParams): Promise<TrackingDomainStatus> {
    return this.http.patch<TrackingDomainStatus>(this.path("emails", id, "track"), {
      query: params,
    });
  }

  /**
   * Reads the mailbox's stored tracking-domain state plus the `CNAME` value this
   * deployment expects. Does no DNS work, so it is safe to call on every render.
   * @example
   * const { cname_target, status } = await warmbly.emails.getTrackingDomain("mb_1");
   */
  getTrackingDomain(id: string, opts?: RequestOptions): Promise<TrackingDomainStatus> {
    return this.http.get<TrackingDomainStatus>(this.path("emails", id, "track"), opts);
  }

  /**
   * Re-resolves the saved tracking domain and records the verdict, which is what makes
   * a record that has finished propagating start being used. Bodyless; needs no
   * `Idempotency-Key`.
   * @example
   * const { status } = await warmbly.emails.verifyTrackingDomain("mb_1");
   */
  verifyTrackingDomain(id: string, opts?: RequestOptions): Promise<TrackingDomainStatus> {
    return this.http.post<TrackingDomainStatus>(this.path("emails", id, "track", "verify"), opts);
  }

  /**
   * Takes the mailbox out of campaign sending until {@link Emails.release}. Warmup
   * keeps running, and the automatic rest logic never releases a hold. Idempotent.
   * @example
   * const { state } = await warmbly.emails.hold("mb_1"); // "reserve"
   */
  hold(id: string, opts?: RequestOptions): Promise<SendRotationState> {
    return this.http.post<SendRotationState>(this.path("emails", id, "hold"), opts);
  }

  /**
   * Puts a held or resting mailbox back into automatic management. It lands in
   * `active`, or `resting` when warmup still reports it as struggling. Idempotent.
   * @example
   * const { state } = await warmbly.emails.release("mb_1");
   */
  release(id: string, opts?: RequestOptions): Promise<SendRotationState> {
    return this.http.post<SendRotationState>(this.path("emails", id, "release"), opts);
  }

  /**
   * Reports the mailbox's inbound sync: backfill progress, whether fair use is holding
   * it, and the policy it runs under.
   * @example
   * const { state, policy } = await warmbly.emails.sync("mb_1");
   */
  sync(id: string, opts?: RequestOptions): Promise<EmailSyncStatus> {
    return this.http.get<EmailSyncStatus>(this.path("emails", id, "sync"), opts);
  }

  /**
   * Reads the mailbox's human sending behaviour profile: the ranges it rolls its
   * workday from. A 400 means the deployment has the feature off.
   * @example
   * const profile = await warmbly.emails.getBehavior("mb_1");
   */
  getBehavior(id: string, opts?: RequestOptions): Promise<SendingBehavior> {
    return this.http.get<SendingBehavior>(this.path("emails", id, "behavior"), opts);
  }

  /**
   * Updates the sending behaviour profile. Fields you omit are left alone.
   * @example
   * await warmbly.emails.updateBehavior("mb_1", { daily_limit_min: 30, daily_limit_max: 45 });
   */
  updateBehavior(id: string, params: UpdateSendingBehaviorParams): Promise<SendingBehavior> {
    return this.http.put<SendingBehavior>(this.path("emails", id, "behavior"), { body: params });
  }

  /**
   * Reads the workday the mailbox rolled for today, with what it has sent and may
   * still send.
   * @example
   * const { remaining_today } = await warmbly.emails.behaviorPlan("mb_1");
   */
  behaviorPlan(id: string, opts?: RequestOptions): Promise<DailySendingPlan> {
    return this.http.get<DailySendingPlan>(this.path("emails", id, "behavior", "plan"), opts);
  }

  /**
   * Verifies one or more mailbox addresses.
   * @example
   * const result = await warmbly.emails.verify({ emails: ["team@warmbly.com"] });
   */
  verify(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("emails/verify", { body: params });
  }

  /**
   * Runs a live SPF/DKIM/DMARC lookup on the mailbox's sending domain and reports it
   * without changing anything. To record the verdict and lift the send gate after a
   * DNS fix, use {@link Emails.recordAuthCheck}.
   * @example
   * const check = await warmbly.emails.authCheck("mb_1");
   */
  authCheck(id: string, opts?: RequestOptions): Promise<DomainAuthCheck> {
    return this.http.get<DomainAuthCheck>(this.path("emails", id, "auth-check"), opts);
  }

  /**
   * Runs the same lookup and records the verdict against every active mailbox on the
   * domain, which is what clears the send gate after a DNS fix. Needs `WRITE_EMAILS`.
   * No body and no `Idempotency-Key`: the result is derived from public DNS alone.
   * @example
   * const check = await warmbly.emails.recordAuthCheck("mb_1");
   */
  recordAuthCheck(id: string, opts?: RequestOptions): Promise<DomainAuthCheck> {
    return this.http.post<DomainAuthCheck>(this.path("emails", id, "auth-check"), opts);
  }

  /**
   * Returns the warmup ban status for a mailbox.
   * @example
   * const status = await warmbly.emails.warmupBanStatus("mb_1");
   */
  warmupBanStatus(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      this.path("emails", id, "warmup", "ban-status"),
      opts,
    );
  }

  /**
   * Controls a mailbox's warmup: start, pause, resume, stop, or appeal a ban.
   * @example
   * await warmbly.emails.warmup("mb_1", "pause");
   */
  warmup(
    id: string,
    action: WarmupAction,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("emails", id, "warmup", action), {
      body: params,
    });
  }

  /**
   * Sends a one-off email from a mailbox. Provide `body_html` and/or `body_plain`.
   * @example
   * await warmbly.emails.send("mb_1", {
   *   to: ["team@warmbly.com"],
   *   subject: "Hi",
   *   body_html: "<p>Hello from Warmbly</p>",
   * });
   */
  send(id: string, params: SendEmailParams): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("emails", id, "send"), {
      body: params,
    });
  }
}
