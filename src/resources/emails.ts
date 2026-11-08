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
  /** The verified provider alias the mailbox sends from. Empty means its own address. */
  send_as_email?: string;
  /** Who hosts the mailbox (for example `google_workspace`, `microsoft365`); empty until known. */
  mail_host?: string;
  /** How the mailbox signs in: `password`, `app_password`, `oauth` or `delegated`; empty until known. */
  auth_method?: "password" | "app_password" | "oauth" | "delegated" | (string & {});
  avatar_url?: string;
  /** Whether hand-written unibox sends carry open and click tracking. */
  track_direct_mail?: boolean;
  /** Where warmup mail is filed: `folder`, `inbox` or `archive`. */
  warmup_placement?: "folder" | "inbox" | "archive" | (string & {});
  warmup_folder?: string;
  /** Days warmup mail is kept; 0 follows the instance setting. */
  warmup_retention_days?: number;
  /** Whether unibox Archive, Delete and Move to inbox are mirrored in the mailbox. */
  relay_folder_moves?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Emails.update}. Every field is optional; open shape. */
export interface UpdateEmailParams {
  name?: string;
  signature_plain?: string;
  signature_html?: string;
  signature_sync?: boolean;
  signature_code?: boolean;
  /** A verified provider alias to send as. An empty string clears it back to the mailbox address. */
  send_as_email?: string;
  /** `active` or `inactive` (`revoked` is accepted by the model but set by the platform). */
  status?: "active" | "inactive" | "revoked" | (string & {});
  /** Daily cold-campaign cap, 0..5000 (default 50). */
  campaign_limit?: number;
  min_wait_time?: number;
  reply_to?: string;
  warmup?: boolean;
  warmup_base?: number;
  warmup_max?: number;
  warmup_increase?: number;
  warmup_reply_rate?: number;
  warmup_tag?: string;
  warmup_start_time?: string;
  warmup_end_time?: string;
  warmup_days?: number;
  /** `folder`, `inbox` or `archive`. */
  warmup_placement?: "folder" | "inbox" | "archive" | (string & {});
  /** Destination for `folder` placement. An empty string restores the instance default. */
  warmup_folder?: string;
  /** Days to keep warmup mail; 0 goes back to the instance setting. */
  warmup_retention_days?: number;
  /** The mailbox's IANA zone. Send an empty string to clear it. */
  timezone?: string;
  /** SMTP/IMAP only: file a copy of each outbound message in the Sent folder (default true). */
  save_to_sent?: boolean;
  /** Mirror unibox Archive, Delete and Move to inbox in the mailbox itself (default true). */
  relay_folder_moves?: boolean;
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
    /** Folders the sync leaves alone (IMAP only). */
    skip_folders?: string[];
    [key: string]: unknown;
  };
  /** The stored skip list, the value {@link Emails.updateSync} writes. Never null. */
  skip_folders?: string[];
  /** Folders the worker last listed, INBOX first. Empty for Gmail and Outlook. */
  folders?: SyncFolder[];
  [key: string]: unknown;
}

/** One folder the sync has seen: the name to use in `skip_folders` and the canonical folder it files under. */
export interface SyncFolder {
  name: string;
  folder: string;
  [key: string]: unknown;
}

/** One address a mailbox may send as. */
export interface SendAsIdentity {
  email: string;
  name: string;
  is_primary: boolean;
  is_default: boolean;
  /** Unverified aliases are listed but the provider refuses to send as them. */
  verified: boolean;
  [key: string]: unknown;
}

/**
 * A mailbox's sending identity. Only Gmail exposes send-as addresses and a stored
 * signature; other providers answer `supported: false` with an empty list.
 */
export interface EmailSendIdentity {
  supported: boolean;
  provider: string;
  /** The address the mailbox authenticates as; what an empty `send_as_email` means. */
  mailbox_email: string;
  send_as_email: string;
  identities: SendAsIdentity[];
  synced_at?: string;
  /** `manual` or `provider`. */
  signature_source: "manual" | "provider" | (string & {});
  signature_imported_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Emails.refreshIdentity}. */
export interface RefreshEmailIdentityParams {
  /** Overwrite the stored signature with the provider's (default false). */
  import_signature?: boolean;
  [key: string]: unknown;
}

/** A certificate a mail server presented on the last connection check. */
export interface MailCertificate {
  /** SHA-256 of the leaf's SubjectPublicKeyInfo, lowercase hex. */
  fingerprint: string;
  subject?: string;
  issuer?: string;
  /** Expiry, RFC 3339. */
  not_after?: string;
  self_signed?: boolean;
  /** True when the chain also passes CA and host name verification. */
  trusted?: boolean;
  [key: string]: unknown;
}

/** One server's certificate policy on an SMTP/IMAP mailbox. */
export interface MailboxServerCertificate {
  host: string;
  port: number;
  /** The owner chose to trust this server on its pinned certificate instead of a CA. */
  tls_unverified: boolean;
  tls_pin?: string;
  /** What the server presented on a check; absent on a plain read. */
  observed?: MailCertificate;
  [key: string]: unknown;
}

/** An SMTP/IMAP mailbox's certificate policy per server. */
export interface MailboxCertificates {
  smtp: MailboxServerCertificate;
  imap: MailboxServerCertificate;
  [key: string]: unknown;
}

/** What {@link Emails.resumeSending} lifted. */
export interface ResumeSendingResult {
  /** A provider refusal hold was released. */
  hold_released: boolean;
  /** A timed provider pause was cleared. */
  cooldown_cleared: boolean;
  [key: string]: unknown;
}

/** One mailbox's outcome in a bulk call. */
export interface BulkEmailResult {
  id: string;
  ok: boolean;
  /** The error code the single-mailbox route would answer. Present when `ok` is false. */
  code?: string;
  /** The error message the single-mailbox route would answer. Present when `ok` is false. */
  message?: string;
  [key: string]: unknown;
}

/** The result of a bulk mailbox call. HTTP 200 even when some rows failed; check `results`. */
export interface BulkEmailsResult {
  succeeded: number;
  failed: number;
  /** One row per distinct id, in request order. */
  results: BulkEmailResult[];
  [key: string]: unknown;
}

/** Body for {@link Emails.bulkDelete}: 1..500 mailbox ids. */
export interface BulkDeleteEmailsParams {
  email_ids: string[];
  [key: string]: unknown;
}

/** Body for {@link Emails.bulkStatus}. */
export interface BulkStatusEmailsParams {
  /** 1..500 mailbox ids. */
  email_ids: string[];
  status: "active" | "inactive";
  [key: string]: unknown;
}

/** Body for {@link Emails.bulkWarmup}. */
export interface BulkWarmupEmailsParams {
  /** 1..500 mailbox ids. */
  email_ids: string[];
  /** Appeal is not available in bulk. */
  action: "start" | "pause" | "resume" | "stop";
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
   * const page = await warmbly.emails.list({ q: "team@", tag: "vip" });
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
   * await warmbly.emails.update("mb_1", { campaign_limit: 40 });
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
   * it, the policy it runs under, the folders the owner excluded, and the folders the
   * sync has seen. Needs `READ_EMAILS`.
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

  /**
   * Reads an SMTP/IMAP mailbox's certificate policy per server (host, port, whether it is
   * trusted on a pin). Stored state only; no connection is made. Needs `READ_EMAILS`.
   * @example
   * const { smtp, imap } = await warmbly.emails.certificates("mb_1");
   */
  certificates(id: string, opts?: RequestOptions): Promise<MailboxCertificates> {
    return this.http.get<MailboxCertificates>(this.path("emails", id, "certificates"), opts);
  }

  /**
   * Switches open and click tracking on or off for this mailbox's hand-written unibox
   * sends (off by default). Needs `WRITE_EMAILS`.
   * @example
   * const { track_direct_mail } = await warmbly.emails.setDirectTracking("mb_1", true);
   */
  setDirectTracking(
    id: string,
    enabled: boolean,
    opts?: RequestOptions,
  ): Promise<{ track_direct_mail: boolean }> {
    return this.http.patch<{ track_direct_mail: boolean }>(
      this.path("emails", id, "direct-tracking"),
      { ...opts, body: { enabled } },
    );
  }

  /**
   * Reports which addresses the mailbox may send as, which one it uses, and where its
   * signature came from. Stored state only; the provider is not called. Needs `READ_EMAILS`.
   * @example
   * const { identities, send_as_email } = await warmbly.emails.identity("mb_1");
   */
  identity(id: string, opts?: RequestOptions): Promise<EmailSendIdentity> {
    return this.http.get<EmailSendIdentity>(this.path("emails", id, "identity"), opts);
  }

  /**
   * Re-reads the mailbox's send-as addresses from the provider and stores them,
   * optionally importing the provider's signature (which overwrites the stored one).
   * Retry-safe. Needs `WRITE_EMAILS`.
   * @example
   * await warmbly.emails.refreshIdentity("mb_1", { import_signature: true });
   */
  refreshIdentity(
    id: string,
    params?: RefreshEmailIdentityParams,
    opts?: RequestOptions,
  ): Promise<EmailSendIdentity> {
    return this.http.post<EmailSendIdentity>(this.path("emails", id, "identity", "refresh"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Lifts a provider pause or refusal hold on sending. A no-op when nothing is held, so
   * retries are safe. An authentication hold needs a reconnect instead. Needs `WRITE_EMAILS`.
   * @example
   * const { hold_released, cooldown_cleared } = await warmbly.emails.resumeSending("mb_1");
   */
  resumeSending(id: string, opts?: RequestOptions): Promise<ResumeSendingResult> {
    return this.http.post<ResumeSendingResult>(this.path("emails", id, "resume-sending"), opts);
  }

  /**
   * Replaces the folders the mailbox's sync leaves alone (IMAP only; each name also
   * covers its subfolders). The list is the desired state, so a retry converges. Use the
   * `name` values from {@link Emails.sync}'s `folders`. Needs `WRITE_EMAILS`.
   * @example
   * const { skip_folders } = await warmbly.emails.updateSync("mb_1", ["Junk", "Newsletters"]);
   */
  updateSync(
    id: string,
    skipFolders: string[],
    opts?: RequestOptions,
  ): Promise<{ skip_folders: string[] }> {
    return this.http.put<{ skip_folders: string[] }>(this.path("emails", id, "sync"), {
      ...opts,
      body: { skip_folders: skipFolders },
    });
  }

  /**
   * Removes up to 500 mailboxes through the single delete path. Answers 200 with one row
   * per id; a mailbox already gone reports `not_found` in its row, so a retry is safe.
   * Needs `WRITE_EMAILS`.
   * @example
   * const { succeeded, failed, results } = await warmbly.emails.bulkDelete({
   *   email_ids: ["mb_1", "mb_2"],
   * });
   */
  bulkDelete(params: BulkDeleteEmailsParams, opts?: RequestOptions): Promise<BulkEmailsResult> {
    return this.http.post<BulkEmailsResult>("emails/bulk/delete", { ...opts, body: params });
  }

  /**
   * Switches up to 500 mailboxes `active` or `inactive`. Each call sets a state, so a
   * retry converges. Needs `WRITE_EMAILS`.
   * @example
   * await warmbly.emails.bulkStatus({ email_ids: ["mb_1"], status: "inactive" });
   */
  bulkStatus(params: BulkStatusEmailsParams, opts?: RequestOptions): Promise<BulkEmailsResult> {
    return this.http.post<BulkEmailsResult>("emails/bulk/status", { ...opts, body: params });
  }

  /**
   * Starts, pauses, resumes or stops warmup on up to 500 mailboxes (appeals are
   * single-mailbox only). Each action sets a state, so a retry converges. Needs
   * `WRITE_EMAILS`.
   * @example
   * await warmbly.emails.bulkWarmup({ email_ids: ["mb_1", "mb_2"], action: "pause" });
   */
  bulkWarmup(params: BulkWarmupEmailsParams, opts?: RequestOptions): Promise<BulkEmailsResult> {
    return this.http.post<BulkEmailsResult>("emails/bulk/warmup", { ...opts, body: params });
  }
}
