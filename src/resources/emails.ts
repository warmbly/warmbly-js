import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A connected sending mailbox (email account). Documented-but-open shape. */
export interface EmailAccount {
  id: string;
  email?: string;
  provider?: "gmail" | "outlook" | "smtp_imap" | (string & {});
  status?: "active" | "inactive" | "revoked" | (string & {});
  /** The sender name. */
  name?: string;
  /**
   * @deprecated The server never sends this field. Read `warmup` instead: a timestamp
   * while warmup is on, `null` when it is off.
   */
  warmup_enabled?: boolean;
  /** When warmup was started; `null` when warmup is off. */
  warmup?: string | null;
  /** When warmup was paused; `null` unless paused. */
  warmup_paused_at?: string | null;
  /** Daily cold-campaign cap. */
  campaign_limit?: number;
  /** The inbox vendor the mailbox was imported from, when it was. */
  vendor?: string;
  /** Tag ids on the mailbox. */
  tags?: string[];
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
  /** Replaces the mailbox's tag ids. */
  tags?: string[];
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
 * Starts warmup on a mailbox as it connects. Omitted numbers keep the mailbox defaults.
 * `start`, `max` and `increase` are at least 1; `reply_rate` is 1..100.
 */
export interface MailboxConnectWarmup {
  enabled: boolean;
  /** Warmup emails on the first day. */
  start?: number;
  /** The daily warmup ceiling. */
  max?: number;
  /** How many more warmup emails each day. */
  increase?: number;
  /** Percent of warmup emails that get a reply. */
  reply_rate?: number;
  [key: string]: unknown;
}

/** How a mail server connection is secured. `none` is only accepted for a loopback host. */
export type MailServerSecurity = "tls" | "starttls" | "none" | (string & {});

/** One SMTP or IMAP server a mailbox signs in to. */
export interface MailServerSettings {
  username: string;
  password: string;
  host: string;
  port: number;
  /** Empty or omitted infers the mode from the port. */
  security?: MailServerSecurity;
  /** Trust this server on its pinned certificate (`tls_pin`) instead of a certificate authority. */
  tls_unverified?: boolean;
  /** SHA-256 of the leaf certificate's SubjectPublicKeyInfo, lowercase hex. */
  tls_pin?: string;
  [key: string]: unknown;
}

/** One SMTP/IMAP mailbox to connect. */
export interface SmtpImapAccountParams {
  email: string;
  /** The sender name. */
  name?: string;
  smtp: MailServerSettings;
  imap: MailServerSettings;
  [key: string]: unknown;
}

/** Body for {@link Emails.connectSmtpImap}. */
export interface ConnectSmtpImapParams extends SmtpImapAccountParams {
  /** Start warmup as the mailbox connects. */
  warmup?: MailboxConnectWarmup;
}

/** Body for {@link Emails.connectSmtpImapBulk}. */
export interface ConnectSmtpImapBulkParams {
  /** 1..50 mailboxes. */
  accounts: SmtpImapAccountParams[];
  /** One warmup setting applied to every mailbox that connects. */
  warmup?: MailboxConnectWarmup;
  [key: string]: unknown;
}

/** A mailbox a connect call created or renewed. */
export interface ConnectedMailbox {
  mailbox: EmailAccount;
  /** Set by {@link Emails.connectOAuth}: true when the sign-in replaced the token of a mailbox the workspace already had. */
  renewed?: boolean;
  /** What of the requested warmup did not apply. Empty when everything did. */
  warmup_note: string;
  [key: string]: unknown;
}

/** One row's outcome in a bulk connect. */
export type MailboxBulkRowStatus = "connected" | "skipped" | "renewed" | "failed" | (string & {});

/** One row of a bulk connect answer. */
export interface MailboxBulkRow {
  /** The row's position in the request. */
  row: number;
  email: string;
  status: MailboxBulkRowStatus;
  /** Why the row failed. */
  code?: string;
  /** The failure message, or on a connected row what of the warmup did not apply. */
  message?: string;
  /** The mailbox id, when one was connected or renewed. */
  id?: string;
  [key: string]: unknown;
}

/** The answer of {@link Emails.connectSmtpImapBulk}. HTTP 200 even when rows failed. */
export interface MailboxBulkResult {
  data: MailboxBulkRow[];
  summary: {
    total: number;
    connected: number;
    skipped: number;
    failed: number;
    [key: string]: unknown;
  };
  /** The workspace's mailbox allowance after the batch. */
  allowance?: MailboxAllowance;
  [key: string]: unknown;
}

/** A mailbox provider a workspace OAuth app or sign-in link serves. */
export type MailboxOAuthProvider = "gmail" | "outlook" | (string & {});

/**
 * A sign-in the workspace's own OAuth app already completed: a `refresh_token`, or an
 * authorization `code` with the `redirect_uri` (and `code_verifier`) it was issued for.
 */
export interface MailboxOAuthGrant {
  provider: MailboxOAuthProvider;
  refresh_token?: string;
  code?: string;
  redirect_uri?: string;
  /** The PKCE verifier, when the sign-in used one. */
  code_verifier?: string;
  /** When set, the address the sign-in must belong to. */
  email?: string;
  [key: string]: unknown;
}

/** Body for {@link Emails.connectOAuth}. */
export interface ConnectOAuthParams extends MailboxOAuthGrant {
  /** Start warmup on a new mailbox. A renewed mailbox keeps its warmup. */
  warmup?: MailboxConnectWarmup;
}

/** Body for {@link Emails.connectOAuthBulk}. */
export interface ConnectOAuthBulkParams {
  /** 1..50 sign-ins. */
  grants: MailboxOAuthGrant[];
  warmup?: MailboxConnectWarmup;
  [key: string]: unknown;
}

/** The answer of {@link Emails.connectOAuthBulk}. HTTP 200 even when sign-ins failed. */
export interface GrantBulkResult {
  data: MailboxBulkRow[];
  summary: {
    total: number;
    connected: number;
    renewed: number;
    failed: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Where a single-use sign-in link stands. A pending link past `expires_at` reads `expired`. */
export type MailboxConnectLinkStatus =
  | "pending"
  | "connecting"
  | "connected"
  | "failed"
  | "revoked"
  | "expired"
  | (string & {});

/** A single-use sign-in link a mailbox owner opens to connect one mailbox. */
export interface MailboxConnectLink {
  id: string;
  organization_id: string;
  created_by: string;
  provider: MailboxOAuthProvider;
  /** The address the sign-in must belong to, when one was named. */
  email?: string;
  warmup: MailboxConnectWarmup;
  return_url?: string;
  status: MailboxConnectLinkStatus;
  /** Why the connect failed, on a `failed` link. */
  error_code?: string;
  /** The mailbox the link connected. */
  email_account_id?: string;
  expires_at: string;
  created_at: string;
  completed_at?: string;
  /** The link to hand out. Returned once, by {@link Emails.createConnectLink}. */
  url?: string;
  [key: string]: unknown;
}

/** Body for {@link Emails.createConnectLink}. */
export interface CreateMailboxConnectLinkParams {
  provider: MailboxOAuthProvider;
  /** The address the sign-in must belong to. */
  email?: string;
  warmup?: MailboxConnectWarmup;
  /** An https URL the owner is sent back to afterwards. */
  return_url?: string;
  /** 1..168 hours (default 72). */
  expires_in_hours?: number;
  [key: string]: unknown;
}

/** Query params for {@link Emails.listConnectLinks}. */
export interface ListMailboxConnectLinksParams {
  cursor?: string;
  /** 1..100 (default 25). */
  limit?: number;
  [key: string]: unknown;
}

/** A workspace's own OAuth client for one mailbox provider. The secret is never returned. */
export interface MailboxOAuthApp {
  id: string;
  organization_id: string;
  provider: MailboxOAuthProvider;
  client_id: string;
  /** False after an import that carried no secret; save the secret again. */
  has_secret: boolean;
  app_name: string;
  /** The callback the client must register with the provider. */
  redirect_url: string;
  /** True when the workspace chose `redirect_url` itself. */
  custom_redirect: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  /** Mailboxes whose grant this client issued. */
  mailboxes: number;
  [key: string]: unknown;
}

/** The answer of {@link Emails.listOAuthApps}. */
export interface MailboxOAuthAppList {
  data: MailboxOAuthApp[];
  /** The default redirect URI each provider's client must register, keyed by provider. */
  callbacks: Record<string, string>;
  [key: string]: unknown;
}

/** Body for {@link Emails.putOAuthApp}. */
export interface PutMailboxOAuthAppParams {
  client_id: string;
  /** Empty or omitted keeps the stored secret for the same `client_id`. */
  client_secret?: string;
  app_name?: string;
  /** A custom callback; omit for the deployment's default. */
  redirect_url?: string;
  [key: string]: unknown;
}

/** Where a client connect link stands. */
export type ClientConnectLinkStatus =
  | "active"
  | "expired"
  | "revoked"
  | "exhausted"
  | (string & {});

/** A way a client may connect through a client connect link. `vendor` is an inbox vendor account. */
export type ClientConnectLinkProvider =
  | "gmail"
  | "outlook"
  | "smtp_imap"
  | "vendor"
  | (string & {});

/** A link a client uses to connect mailboxes into the workspace without an account. */
export interface ClientConnectLink {
  id: string;
  organization_id: string;
  /** `null` once the member who created it has left; such a link reads `revoked`. */
  created_by: string | null;
  label: string;
  allowed_providers: ClientConnectLinkProvider[];
  max_mailboxes: number;
  mailboxes_connected: number;
  /** Mailbox tags applied to every mailbox connected through the link. */
  tag_ids: string[];
  /** Whether connected mailboxes start warmup. */
  warmup: boolean;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
  status: ClientConnectLinkStatus;
  [key: string]: unknown;
}

/** Body for {@link Emails.createClientLink}. */
export interface CreateClientConnectLinkParams {
  label?: string;
  /** At least one. */
  providers: ClientConnectLinkProvider[];
  /** 1..500. */
  max_mailboxes: number;
  /** 1..90 days (default 7). */
  expires_in_days?: number;
  /** Up to 20 of the workspace's mailbox tag ids. */
  tag_ids?: string[];
  /** Start warmup on each mailbox the client connects. */
  warmup?: boolean;
  [key: string]: unknown;
}

/** The answer of {@link Emails.createClientLink}. The URL is never returned again. */
export interface CreatedClientConnectLink {
  link: ClientConnectLink;
  url: string;
  [key: string]: unknown;
}

/** Query params for {@link Emails.listClientLinks}. */
export interface ListClientConnectLinksParams {
  cursor?: string;
  /** 1..100 (default 50). */
  limit?: number;
  [key: string]: unknown;
}

/** One mailbox a client connected through a client connect link. */
export interface ClientConnectLinkUse {
  id: string;
  link_id: string;
  /** `null` once the mailbox was removed. */
  email_account_id: string | null;
  email: string;
  provider: string;
  connected_at: string;
  [key: string]: unknown;
}

/** A mailbox's warmup filter tag: the code added as the last line of warmup mail it receives. */
export interface WarmupFilterTag {
  /** `null` when the tag is off. */
  tag: string | null;
  [key: string]: unknown;
}

/** Body for {@link Emails.setWarmupFilterTag}. */
export interface SetWarmupFilterTagParams {
  /**
   * The code to use: 6..40 letters, digits, spaces, hyphens or underscores, and no
   * wording that calls the mail warmup, automated or a test. Omit for a random code.
   */
  tag?: string;
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

  /**
   * Connects one SMTP/IMAP mailbox with its credentials and optionally starts its warmup
   * (201). `warmup_note` says what of the warmup did not apply. Partnership plan only
   * (`403 partnership_plan_required` otherwise). Needs `CONNECT_EMAILS`.
   * @example
   * const { mailbox, warmup_note } = await warmbly.emails.connectSmtpImap({
   *   email: "team@warmbly.com",
   *   smtp: { username: "team@warmbly.com", password: "secret", host: "smtp.warmbly.com", port: 587 },
   *   imap: { username: "team@warmbly.com", password: "secret", host: "imap.warmbly.com", port: 993 },
   *   warmup: { enabled: true, max: 40 },
   * });
   */
  connectSmtpImap(params: ConnectSmtpImapParams, opts?: RequestOptions): Promise<ConnectedMailbox> {
    return this.http.post<ConnectedMailbox>("emails/connect/smtp-imap", { ...opts, body: params });
  }

  /**
   * Connects up to 50 SMTP/IMAP mailboxes with one warmup setting. Answers 200 with a
   * status per row; a mailbox already connected is `skipped`, so a repeated batch is
   * safe. Partnership plan only. Needs `CONNECT_EMAILS`.
   * @example
   * const { summary, data } = await warmbly.emails.connectSmtpImapBulk({
   *   accounts: [{ email: "a@warmbly.com", smtp, imap }],
   *   warmup: { enabled: true },
   * });
   */
  connectSmtpImapBulk(
    params: ConnectSmtpImapBulkParams,
    opts?: RequestOptions,
  ): Promise<MailboxBulkResult> {
    return this.http.post<MailboxBulkResult>("emails/connect/smtp-imap/bulk", {
      ...opts,
      body: params,
    });
  }

  /**
   * Hands over a sign-in the workspace's own OAuth app completed, so the mailbox owner
   * signs in only once. Answers 201 for a new mailbox, or 200 with `renewed: true` when it
   * replaced the token of a mailbox the workspace already had (whose warmup it leaves
   * alone). No token is returned. Partnership plan only. Needs `CONNECT_EMAILS`.
   * @example
   * const { mailbox, renewed } = await warmbly.emails.connectOAuth({
   *   provider: "gmail",
   *   refresh_token: "1//0g...",
   *   email: "team@warmbly.com",
   * });
   */
  connectOAuth(params: ConnectOAuthParams, opts?: RequestOptions): Promise<ConnectedMailbox> {
    return this.http.post<ConnectedMailbox>("emails/connect/oauth", { ...opts, body: params });
  }

  /**
   * Hands over up to 50 completed sign-ins with one warmup setting. Answers 200 with a
   * status per sign-in (`connected`, `renewed` or `failed`). Partnership plan only.
   * Needs `CONNECT_EMAILS`.
   * @example
   * const { summary } = await warmbly.emails.connectOAuthBulk({
   *   grants: [{ provider: "outlook", refresh_token: "M.R3..." }],
   * });
   */
  connectOAuthBulk(
    params: ConnectOAuthBulkParams,
    opts?: RequestOptions,
  ): Promise<GrantBulkResult> {
    return this.http.post<GrantBulkResult>("emails/connect/oauth/bulk", { ...opts, body: params });
  }

  /**
   * Mints a single-use sign-in link a mailbox owner opens to connect one Google or
   * Microsoft mailbox (201). The `url` is returned only here. Creating a link is not
   * idempotent on the server: a retried create can mint a second link, and the unused one
   * simply expires. Partnership plan only. Needs `CONNECT_EMAILS`.
   * @example
   * const { url } = await warmbly.emails.createConnectLink({
   *   provider: "gmail",
   *   email: "owner@warmbly.com",
   *   expires_in_hours: 24,
   * });
   */
  createConnectLink(
    params: CreateMailboxConnectLinkParams,
    opts?: RequestOptions,
  ): Promise<MailboxConnectLink> {
    return this.http.post<MailboxConnectLink>("emails/connect/links", { ...opts, body: params });
  }

  /**
   * Lists the workspace's sign-in links newest first, auto-paginating when iterated.
   * Partnership plan only. Needs `CONNECT_EMAILS`.
   * @example
   * for await (const link of await warmbly.emails.listConnectLinks({ limit: 50 })) {
   *   console.log(link.status);
   * }
   */
  listConnectLinks(params?: ListMailboxConnectLinksParams): Promise<Page<MailboxConnectLink>> {
    return this.http.getPage<MailboxConnectLink>("emails/connect/links", { query: params });
  }

  /**
   * Retrieves one sign-in link. Partnership plan only. Needs `CONNECT_EMAILS`.
   * @example
   * const link = await warmbly.emails.getConnectLink("link_1");
   */
  getConnectLink(id: string, opts?: RequestOptions): Promise<MailboxConnectLink> {
    return this.http.get<MailboxConnectLink>(this.path("emails", "connect", "links", id), opts);
  }

  /**
   * Ends a sign-in link that has not connected and answers with the link; a link that
   * already connected is left as it is. Repeating it is safe. Partnership plan only.
   * Needs `CONNECT_EMAILS`.
   * @example
   * const { status } = await warmbly.emails.revokeConnectLink("link_1");
   */
  revokeConnectLink(id: string, opts?: RequestOptions): Promise<MailboxConnectLink> {
    return this.http.delete<MailboxConnectLink>(this.path("emails", "connect", "links", id), opts);
  }

  /**
   * Lists the workspace's own Google and Microsoft OAuth clients (never the secrets) and
   * the redirect URI each provider must register. Needs `CONNECT_EMAILS`.
   * @example
   * const { data, callbacks } = await warmbly.emails.listOAuthApps();
   */
  listOAuthApps(opts?: RequestOptions): Promise<MailboxOAuthAppList> {
    return this.http.get<MailboxOAuthAppList>("emails/oauth-apps", opts);
  }

  /**
   * Saves the workspace's own OAuth client for `gmail` or `outlook`, after checking the
   * pair with the provider. States an absolute value, so a retry lands on the same state.
   * A different `client_id` is refused with `409 oauth_app_in_use` while mailboxes are
   * signed in through the app. Partnership plan only. Needs `CONNECT_EMAILS`.
   * @example
   * await warmbly.emails.putOAuthApp("gmail", {
   *   app_name: "Warmbly Agency",
   *   client_id: "1234.apps.googleusercontent.com",
   *   client_secret: "GOCSPX-...",
   * });
   */
  putOAuthApp(
    provider: MailboxOAuthProvider,
    params: PutMailboxOAuthAppParams,
    opts?: RequestOptions,
  ): Promise<MailboxOAuthApp> {
    return this.http.put<MailboxOAuthApp>(this.path("emails", "oauth-apps", provider), {
      ...opts,
      body: params,
    });
  }

  /**
   * Removes the workspace's OAuth client for a provider (204). Refused with
   * `409 oauth_app_in_use` while mailboxes hold grants from it. Needs `CONNECT_EMAILS`.
   * @example
   * await warmbly.emails.deleteOAuthApp("outlook");
   */
  deleteOAuthApp(provider: MailboxOAuthProvider, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("emails", "oauth-apps", provider), opts);
  }

  /**
   * Creates a client connect link a client uses to connect mailboxes into the workspace
   * without an account (201). The `url` appears in this response only; the SDK's
   * `Idempotency-Key` makes a retry replay the same link. Needs `WRITE_EMAILS`.
   * @example
   * const { link, url } = await warmbly.emails.createClientLink({
   *   label: "Acme mailboxes",
   *   providers: ["gmail", "outlook"],
   *   max_mailboxes: 10,
   *   warmup: true,
   * });
   */
  createClientLink(
    params: CreateClientConnectLinkParams,
    opts?: RequestOptions,
  ): Promise<CreatedClientConnectLink> {
    return this.http.post<CreatedClientConnectLink>("emails/client-links", {
      ...opts,
      body: params,
    });
  }

  /**
   * Lists client connect links newest first, auto-paginating when iterated. Needs
   * `READ_EMAILS`.
   * @example
   * for await (const link of await warmbly.emails.listClientLinks()) console.log(link.status);
   */
  listClientLinks(params?: ListClientConnectLinksParams): Promise<Page<ClientConnectLink>> {
    return this.http.getPage<ClientConnectLink>("emails/client-links", { query: params });
  }

  /**
   * Lists the mailboxes a client connect link connected. Needs `READ_EMAILS`.
   * @example
   * const uses = await warmbly.emails.listClientLinkUses("link_1");
   */
  listClientLinkUses(id: string, opts?: RequestOptions): Promise<ClientConnectLinkUse[]> {
    return this.http
      .get<{ data: ClientConnectLinkUse[] }>(this.path("emails", "client-links", id, "uses"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Turns a client connect link off. A repeat returns the already revoked link, so a
   * retry is safe. Needs `WRITE_EMAILS`.
   * @example
   * const link = await warmbly.emails.revokeClientLink("link_1");
   */
  revokeClientLink(id: string, opts?: RequestOptions): Promise<ClientConnectLink> {
    return this.http.post<ClientConnectLink>(
      this.path("emails", "client-links", id, "revoke"),
      opts,
    );
  }

  /**
   * Reads the mailbox's warmup filter tag, the code added as the last line of every
   * warmup email it receives so the owner can filter warmup out. `tag` is `null` when
   * off. Needs `READ_EMAILS`.
   * @example
   * const { tag } = await warmbly.emails.getWarmupFilterTag("mb_1");
   */
  getWarmupFilterTag(id: string, opts?: RequestOptions): Promise<WarmupFilterTag> {
    return this.http.get<WarmupFilterTag>(this.path("emails", id, "warmup-filter-tag"), opts);
  }

  /**
   * Turns the warmup filter tag on. With no `tag` the server issues a new random code
   * (such as `k7q2-mx94-ab3d`) replacing any earlier one; the SDK's `Idempotency-Key`
   * keeps a retry from issuing a second code. A refused tag is `400 invalid_filter_tag`.
   * Needs `WRITE_EMAILS`.
   * @example
   * const { tag } = await warmbly.emails.setWarmupFilterTag("mb_1");
   * await warmbly.emails.setWarmupFilterTag("mb_1", { tag: "acme-filter-01" });
   */
  setWarmupFilterTag(
    id: string,
    params?: SetWarmupFilterTagParams,
    opts?: RequestOptions,
  ): Promise<WarmupFilterTag> {
    return this.http.put<WarmupFilterTag>(this.path("emails", id, "warmup-filter-tag"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Turns the warmup filter tag off and answers with `tag: null`. Needs `WRITE_EMAILS`.
   * @example
   * await warmbly.emails.clearWarmupFilterTag("mb_1");
   */
  clearWarmupFilterTag(id: string, opts?: RequestOptions): Promise<WarmupFilterTag> {
    return this.http.delete<WarmupFilterTag>(this.path("emails", id, "warmup-filter-tag"), opts);
  }
}
