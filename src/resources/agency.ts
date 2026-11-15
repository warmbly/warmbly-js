import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";
import type { FormsDomainStatus } from "./forms";
import type {
  CreateToolMigrationParams,
  ListToolMigrationsParams,
  StartToolMigrationParams,
  ToolMigration,
  ToolMigrationProvider,
} from "./migrations";
import type { UniboxItem } from "./unibox";

// ---------------------------------------------------------------------------
// Agencies, staff and plans
// ---------------------------------------------------------------------------

/** A staff member's role in an agency. Unknown values pass through. */
export type AgencyRole = "owner" | "admin" | "member" | (string & {});

/** The agency subscription's state. Unknown values pass through. */
export type AgencySubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | (string & {});

/** A plan sold to agencies, from {@link Agency.plans} or joined on an {@link AgencyRecord}. */
export interface AgencyPlan {
  id: string;
  name?: string;
  /** Monthly price in dollars. */
  price?: number;
  /** Yearly price in dollars. Absent on a monthly-only plan. */
  price_yearly?: number;
  discounted_price?: number;
  /** `"month"` or `"year"`. */
  duration?: string;
  public?: boolean;
  /** The sends shared by every client each period. `0` is a pool with no cap. */
  monthly_send_pool?: number;
  /** What the plan refills the agency's shared AI balance to each period, in dollars. */
  agency_ai_allowance_usd?: number;
  monthly_allowance_usd?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** An operator's plan in force on an agency. */
export interface AgencyGrant {
  plan_id: string;
  /** When the grant ends; absent for one with no end. */
  until?: string;
  [key: string]: unknown;
}

/** One agency. Named `AgencyRecord` so it does not clash with the {@link Agency} resource. */
export interface AgencyRecord {
  id: string;
  name: string;
  owner_user_id: string;
  plan_id?: string;
  status: AgencySubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  /** The plan, when the agency has one. */
  plan?: AgencyPlan;
  /** The caller's role, when listed for a user. */
  role?: AgencyRole;
  client_count: number;
  /** Whether the agency has a billing customer, so the billing portal can open. */
  has_billing: boolean;
  /** Set while an operator's plan is in force. */
  granted?: AgencyGrant;
  /** `"month"` or `"year"` while a subscription is in force. */
  billing_interval?: "month" | "year" | (string & {});
  [key: string]: unknown;
}

/** The answer of {@link Agency.list}. */
export interface AgencyList {
  /** The caller's agencies. An agency key sees only its own. */
  data: AgencyRecord[];
  /** False on an instance without billing (`BILLING_PROVIDER=none`). */
  billing_enabled: boolean;
  [key: string]: unknown;
}

/** The answer of {@link Agency.plans}. */
export interface AgencyPlanList {
  data: AgencyPlan[];
  billing_enabled: boolean;
  [key: string]: unknown;
}

/** The answer of {@link Agency.get}. */
export interface AgencyDetail {
  agency: AgencyRecord;
  billing_enabled: boolean;
  [key: string]: unknown;
}

/** One agency staff member. */
export interface AgencyMember {
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  created_at: string;
  email: string;
  first_name: string;
  last_name: string;
  [key: string]: unknown;
}

/** Staff invited by an address no account uses yet. */
export interface AgencyInvitation {
  id: string;
  agency_id: string;
  email: string;
  role: AgencyRole;
  invited_by?: string;
  expires_at: string;
  created_at: string;
  [key: string]: unknown;
}

/** The answer of {@link Agency.members}. */
export interface AgencyMemberList {
  /** The staff. */
  data: AgencyMember[];
  /** Invitations still waiting for an account. */
  invitations: AgencyInvitation[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/** One client workspace of an agency. */
export interface AgencyClient {
  organization_id: string;
  agency_id: string;
  /** Sends per period this client may take from the pool; absent for no cap. */
  monthly_send_limit?: number;
  /** Dollars of the agency's AI balance this client may spend per period; absent for no cap. */
  monthly_ai_limit_usd?: number;
  added_at: string;
  added_by?: string;
  name: string;
  slug?: string;
  avatar_url?: string;
  owner_user_id: string;
  [key: string]: unknown;
}

/** Body of {@link AgencyClients.create}. */
export interface CreateAgencyClientParams {
  /** The new workspace's name. */
  name: string;
  /** IANA timezone, e.g. `"Europe/Dublin"`. */
  timezone?: string;
  [key: string]: unknown;
}

/** Body of {@link AgencyClients.update}. Only the fields sent change; send at least one. */
export interface UpdateAgencyClientParams {
  /** Sends per period, or `null` to remove the cap. */
  monthly_send_limit?: number | null;
  /** Dollars of the shared AI balance per period, or `null` to remove the cap. */
  monthly_ai_limit_usd?: number | null;
  [key: string]: unknown;
}

/** Body of {@link AgencyClients.transferAI}. */
export interface TransferAgencyAIParams {
  /** Dollars to move, $1 to $5,000. Read in whole cents. */
  amount_usd: number;
  [key: string]: unknown;
}

/** The answer of {@link AgencyClients.transferAI}, in dollars. */
export interface AgencyAITransferResult {
  amount_usd: number;
  /** What the agency balance holds after the move. */
  agency_balance_usd: number;
  /** What the client workspace's own balance holds after the move. */
  workspace_balance_usd: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Usage and AI balance
// ---------------------------------------------------------------------------

/** One client's use of the send pool this period. */
export interface AgencyClientUsage {
  organization_id: string;
  name: string;
  used: number;
  monthly_send_limit?: number;
  [key: string]: unknown;
}

/** The agency's shared send pool this period. */
export interface AgencyUsage {
  unlimited: boolean;
  period_start: string;
  period_end: string;
  days_left: number;
  pool_size: number;
  topups: number;
  /** `pool_size` plus `topups`. */
  total: number;
  used: number;
  remaining: number;
  /** This period's use extrapolated to its end. */
  projected: number;
  clients: AgencyClientUsage[];
  /** Sends in one top-up pack. */
  topup_sends: number;
  topup_price_cents: number;
  [key: string]: unknown;
}

/** One client's share of the agency AI balance this period. */
export interface AgencyAIClient {
  organization_id: string;
  name: string;
  spent_usd: number;
  moved_usd: number;
  monthly_ai_limit_usd?: number;
  [key: string]: unknown;
}

/** The range a purchase of agency AI balance may take. */
export interface AgencyAITopUpInfo {
  min_usd: number;
  max_usd: number;
  presets_usd: number[];
  default_usd: number;
  [key: string]: unknown;
}

/** The agency's shared AI balance this period, in dollars. */
export interface AgencyAIBalance {
  /** True on an instance that does not charge for AI, where the balance does not apply. */
  unmetered: boolean;
  period_start: string;
  period_end: string;
  allowance_usd: number;
  allowance_left_usd: number;
  /** Bought money, which never expires. */
  purchased_usd: number;
  bought_this_period_usd: number;
  spent_usd: number;
  /** Moved into client workspaces this period. */
  moved_usd: number;
  balance_usd: number;
  clients: AgencyAIClient[];
  top_up: AgencyAITopUpInfo;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Overview (agency home)
// ---------------------------------------------------------------------------

/** How much of a client workspace the caller reaches. Unknown values pass through. */
export type AgencyClientAccess = "full" | "restricted" | "none" | (string & {});

/** A problem on the agency home's attention list. Unknown values pass through. */
export type AgencyAttentionKind =
  | "mailbox_disconnected"
  | "mailbox_held"
  | "bounce_spike"
  | "campaigns_paused_limits"
  | "campaigns_paused_billing"
  | "client_cap_near"
  | "pool_low"
  | (string & {});

/** One item on the attention list, worst first. */
export interface AgencyAttention {
  kind: AgencyAttentionKind;
  severity: string;
  /** The client; absent for an item about the agency itself. */
  organization_id?: string;
  client_name?: string;
  count: number;
  /** The bounce rate for `bounce_spike`, the share of the cap used for `client_cap_near`. */
  rate?: number;
  [key: string]: unknown;
}

/** A client's campaign activity. */
export interface AgencyClientCampaigns {
  active: number;
  paused_by_limits: number;
  paused_by_billing: number;
  sent_today: number;
  sent_7d: number;
  bounced_7d: number;
  bounce_rate_7d: number;
  positive_replies_7d: number;
  [key: string]: unknown;
}

/** A client's unanswered human mail. */
export interface AgencyClientInbox {
  replies_waiting: number;
  [key: string]: unknown;
}

/** A client's mailbox health. */
export interface AgencyClientMailboxes {
  total: number;
  disconnected: number;
  erroring: number;
  watch: number;
  throttled: number;
  quarantined: number;
  blocked: number;
  [key: string]: unknown;
}

/** A client's open Advisor findings by severity. */
export interface AgencyClientAdvisor {
  critical: number;
  high: number;
  medium: number;
  low: number;
  [key: string]: unknown;
}

/**
 * One client on the agency home. A section is absent when the caller's own membership in
 * the workspace lacks its permission: `campaigns` and `mailboxes` need `view_campaigns`,
 * `inbox` needs `access_unibox`, `advisor` needs `view_analytics`.
 */
export interface AgencyOverviewClient {
  organization_id: string;
  name: string;
  avatar_url?: string;
  access: AgencyClientAccess;
  /** Whether the caller can connect and change mailboxes in the workspace. */
  manage_mailboxes: boolean;
  pool_used: number;
  monthly_send_limit?: number;
  campaigns?: AgencyClientCampaigns;
  inbox?: AgencyClientInbox;
  mailboxes?: AgencyClientMailboxes;
  advisor?: AgencyClientAdvisor;
  [key: string]: unknown;
}

/** What the caller can see, added up across clients. */
export interface AgencyOverviewTotals {
  clients: number;
  sent_today: number;
  replies_waiting: number;
  positive_replies_7d: number;
  active_campaigns: number;
  mailboxes: number;
  mailbox_problems: number;
  [key: string]: unknown;
}

/** The agency home: the pool, totals, problems first, then every client. */
export interface AgencyOverview {
  generated_at: string;
  /** The pool, as {@link Agency.usage} returns it. */
  usage: AgencyUsage | null;
  totals: AgencyOverviewTotals;
  attention: AgencyAttention[];
  clients: AgencyOverviewClient[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Mailboxes and brand
// ---------------------------------------------------------------------------

/** One client mailbox in the agency's mailbox list. */
export interface AgencyMailbox {
  id: string;
  organization_id: string;
  /** The client workspace's name. */
  client: string;
  email: string;
  name: string;
  provider: string;
  status: string;
  /** A connected mailbox with an unresolved critical error. */
  erroring: boolean;
  warmup: boolean;
  /** Set when held from warmup; absent in good standing. */
  warmup_state?: "watch" | "throttled" | "quarantined" | "blocked" | (string & {});
  /** The inbox vendor it was imported from, when there is one. */
  vendor?: string;
  campaign_limit: number;
  created_at: string;
  [key: string]: unknown;
}

/** Query params for {@link Agency.mailboxes}. */
export interface ListAgencyMailboxesParams {
  /** Client workspace ids to keep. An array is sent comma-separated. */
  client?: string | string[];
  /** Keep only disconnected, erroring or held mailboxes. */
  attention?: boolean;
  /** Part of an address. */
  q?: string;
  /** 1..200, default 50. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** An agency's stored brand. Empty strings mean unset. */
export interface AgencyBrandSettings {
  display_name: string;
  logo_url: string;
  accent_color: string;
  website_url: string;
  hide_powered_by: boolean;
  updated_at: string;
  updated_by?: string;
  [key: string]: unknown;
}

/** The portal theme. Every field is optional; a missing or empty one means the default. */
export interface AgencyPortalTheme {
  font?: "system" | "geometric" | "serif" | (string & {});
  corners?: "sharp" | "round" | (string & {});
  appearance?: "light" | "dark" | (string & {});
  sign_in_layout?: "split" | "cover" | (string & {});
  sign_in_background?: "accent" | "dark" | "image" | (string & {});
  sign_in_heading?: string;
  sign_in_message?: string;
  support_email?: string;
  support_url?: string;
  terms_url?: string;
  privacy_url?: string;
  [key: string]: unknown;
}

/** The answer of {@link Agency.brand}. */
export interface AgencyBrand {
  brand: AgencyBrandSettings;
  /** Whether the agency's plan includes full white-label. */
  full_white_label: boolean;
  /** Whether the caller is an owner or admin, who may change the brand. */
  can_manage: boolean;
  /** The portal domain's state, shaped like the forms domain status. */
  portal_domain: FormsDomainStatus;
  /** The verified portal domain as an origin, else the shared portal address; empty when none is configured. */
  portal_base_url: string;
  /** The deployment's attribution; absent when it configured none. */
  powered_by?: { name: string; url?: string; [key: string]: unknown };
  /** Where clients sign in to the portal domain. */
  portal_sign_in: "portal" | "warmbly" | (string & {});
  /** The uploaded tab icon; empty when none. */
  icon_url: string;
  /** The uploaded sign-in page image; empty when none. */
  sign_in_image_url: string;
  /** Always an object, `{}` when nothing is set. */
  theme: AgencyPortalTheme;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cross-client inbox
// ---------------------------------------------------------------------------

/** One conversation in the cross-client inbox: its newest message in scope. */
export interface AgencyInboxThread {
  /** The client workspace the conversation is in. */
  organization_id: string;
  id: string;
  /** The mailbox that holds the message. */
  email_id: string;
  thread_id: string;
  from_addr: string[];
  to_addr: string[];
  subject: string;
  snippet: string;
  internal_date: string;
  seen: boolean;
  message_count: number;
  has_unread: boolean;
  [key: string]: unknown;
}

/** Query params for {@link AgencyInbox.list}. */
export interface ListAgencyInboxParams {
  /** Client workspace ids to keep. An array is sent comma-separated. */
  client?: string | string[];
  unread?: boolean;
  needs_reply?: boolean;
  positive?: boolean;
  /** Search text. */
  q?: string;
  /** 1..100, default 30. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Query params for {@link AgencyInbox.thread}. */
export interface GetAgencyInboxThreadParams {
  /** The client workspace the conversation is in. */
  organization_id: string;
  thread_id: string;
  cursor?: string;
  [key: string]: unknown;
}

/** Query params for {@link AgencyInbox.message}. */
export interface GetAgencyInboxMessageParams {
  /** The client workspace the message is in. */
  organization_id: string;
  [key: string]: unknown;
}

/** One client message with its body, as `GET /unibox/:id` returns it. */
export interface AgencyInboxMessage {
  id: string;
  gmail_id?: string;
  uid?: number;
  /** The mailbox the message belongs to. */
  email_id: string;
  /** The canonical folder. */
  folder: string;
  parent_id?: string;
  thread_id: string;
  flags?: string[] | null;
  bcc?: string[] | null;
  cc?: string[] | null;
  date?: string;
  from: string[] | null;
  in_reply_to?: string[] | null;
  message_id?: string;
  /** Note the server's capitalized key. */
  ReplyTo?: string[] | null;
  to: string[] | null;
  subject: string;
  size?: number;
  internal_date: string;
  mod_seq?: number;
  body_plain: string;
  /** Sanitized for display. */
  body_html: string;
  /** True when the stored body could not be read and `body_plain` holds only the snippet. */
  body_truncated: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sub-resources
// ---------------------------------------------------------------------------

/** Joins an id list for the server's comma-separated `client` filter. */
function joinClients<T extends { client?: string | string[] }>(params?: T): T | undefined {
  if (!params || !Array.isArray(params.client)) return params;
  return { ...params, client: params.client.join(",") };
}

/**
 * An agency's client workspaces: list, create, attach, caps, detach and AI balance moves.
 * Reachable as `warmbly.agency.clients`.
 */
export class AgencyClients extends APIResource {
  /**
   * Lists the agency's clients with their caps. Needs `AGENCY_READ` on an agency API key.
   * @example
   * const clients = await warmbly.agency.clients.list("agency_1");
   */
  list(agencyId: string, opts?: RequestOptions): Promise<AgencyClient[]> {
    return this.http
      .get<{ data?: AgencyClient[] }>(this.path("agency", agencyId, "clients"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Creates a new client workspace (201). Honors `Idempotency-Key`. Needs
   * `AGENCY_MANAGE_CLIENTS` on an agency API key.
   * @example
   * const client = await warmbly.agency.clients.create("agency_1", { name: "Acme", timezone: "Europe/Dublin" });
   */
  create(
    agencyId: string,
    params: CreateAgencyClientParams,
    opts?: RequestOptions,
  ): Promise<AgencyClient> {
    return this.http.post<AgencyClient>(this.path("agency", agencyId, "clients"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Attaches a workspace the acting owner or admin owns (201). Honors `Idempotency-Key`.
   * Needs `AGENCY_MANAGE_CLIENTS` on an agency API key.
   * @example
   * await warmbly.agency.clients.attach("agency_1", "org_1");
   */
  attach(agencyId: string, organizationId: string, opts?: RequestOptions): Promise<AgencyClient> {
    return this.http.post<AgencyClient>(this.path("agency", agencyId, "clients", "attach"), {
      ...opts,
      body: { organization_id: organizationId },
    });
  }

  /**
   * Sets a client's monthly send cap and AI cap. Only the fields sent change; `null`
   * removes a cap, and a body with neither is refused. Needs `AGENCY_MANAGE_CLIENTS` on
   * an agency API key.
   * @example
   * await warmbly.agency.clients.update("agency_1", "org_1", {
   *   monthly_send_limit: 20000,
   *   monthly_ai_limit_usd: null,
   * });
   */
  update(
    agencyId: string,
    organizationId: string,
    params: UpdateAgencyClientParams,
    opts?: RequestOptions,
  ): Promise<AgencyClient> {
    return this.http.patch<AgencyClient>(this.path("agency", agencyId, "clients", organizationId), {
      ...opts,
      body: params,
    });
  }

  /**
   * Detaches a client workspace (204); its data stays. An agency key on it is cut off from
   * that workspace at once. Needs `AGENCY_MANAGE_CLIENTS` on an agency API key.
   * @example
   * await warmbly.agency.clients.detach("agency_1", "org_1");
   */
  detach(agencyId: string, organizationId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("agency", agencyId, "clients", organizationId), opts);
  }

  /**
   * Moves `amount_usd` ($1 to $5,000) from the agency's AI balance into the client
   * workspace's own. The money moves once per `Idempotency-Key`: one is generated per
   * call, so pass your own `idempotencyKey` to make a retry across calls safe. Answers
   * `402 agency_ai_balance_insufficient` when the agency balance holds less, `503
   * agency_billing_disabled` without billing. Needs `AGENCY_TRANSFER_AI` on an agency API key.
   * @example
   * const r = await warmbly.agency.clients.transferAI(
   *   "agency_1",
   *   "org_1",
   *   { amount_usd: 25 },
   *   { idempotencyKey: "move-2026-11-acme" },
   * );
   * console.log(r.agency_balance_usd, r.workspace_balance_usd);
   */
  transferAI(
    agencyId: string,
    organizationId: string,
    params: TransferAgencyAIParams,
    opts?: RequestOptions,
  ): Promise<AgencyAITransferResult> {
    return this.http.post<AgencyAITransferResult>(
      this.path("agency", agencyId, "clients", organizationId, "ai-balance"),
      { ...opts, body: params },
    );
  }
}

/**
 * The cross-client inbox, read-only: nothing it reads is marked read. Each client is read
 * through the acting staff member's own membership in it (`access_unibox`). Reachable as
 * `warmbly.agency.inbox`.
 */
export class AgencyInbox extends APIResource {
  /**
   * Lists conversations across every client whose inbox the caller reads, newest first,
   * auto-paginating when iterated. Needs `AGENCY_READ` and `READ_UNIBOX` on an agency API key.
   * @example
   * for await (const t of await warmbly.agency.inbox.list("agency_1", { needs_reply: true })) {
   *   console.log(t.organization_id, t.subject);
   * }
   */
  list(agencyId: string, params?: ListAgencyInboxParams): Promise<Page<AgencyInboxThread>> {
    return this.http.getPage<AgencyInboxThread>(this.path("agency", agencyId, "inbox"), {
      query: joinClients(params),
    });
  }

  /**
   * Reads one client conversation's messages, as `GET /unibox/thread` returns them,
   * auto-paginating when iterated. Needs `AGENCY_READ` and `READ_UNIBOX` on an agency API key.
   * @example
   * const page = await warmbly.agency.inbox.thread("agency_1", {
   *   organization_id: "org_1",
   *   thread_id: "t_1",
   * });
   */
  thread(agencyId: string, params: GetAgencyInboxThreadParams): Promise<Page<UniboxItem>> {
    return this.http.getPage<UniboxItem>(this.path("agency", agencyId, "inbox", "thread"), {
      query: params,
    });
  }

  /**
   * Reads one client message with its body, leaving it unread. Needs `AGENCY_READ` and
   * `READ_UNIBOX` on an agency API key.
   * @example
   * const msg = await warmbly.agency.inbox.message("agency_1", "msg_1", { organization_id: "org_1" });
   */
  message(
    agencyId: string,
    messageId: string,
    params: GetAgencyInboxMessageParams,
    opts?: RequestOptions,
  ): Promise<AgencyInboxMessage> {
    return this.http.get<AgencyInboxMessage>(
      this.path("agency", agencyId, "inbox", "messages", messageId),
      { ...opts, query: params },
    );
  }
}

/**
 * Agency migrations from another outreach tool, mapping each source workspace onto a
 * client. Reachable as `warmbly.agency.migrations`.
 */
export class AgencyMigrations extends APIResource {
  /**
   * Lists the tools an agency can migrate from. Needs `AGENCY_MIGRATE` on an agency API key.
   * @example
   * const providers = await warmbly.agency.migrations.providers("agency_1");
   */
  providers(agencyId: string, opts?: RequestOptions): Promise<ToolMigrationProvider[]> {
    return this.http
      .get<{ data?: ToolMigrationProvider[] }>(
        this.path("agency", agencyId, "migrations", "providers"),
        opts,
      )
      .then((r) => r.data ?? []);
  }

  /**
   * Lists the agency's migrations, newest first, auto-paginating when iterated. Needs
   * `AGENCY_MIGRATE` on an agency API key.
   * @example
   * for await (const m of await warmbly.agency.migrations.list("agency_1")) console.log(m.status);
   */
  list(agencyId: string, params?: ListToolMigrationsParams): Promise<Page<ToolMigration>> {
    return this.http.getPage<ToolMigration>(this.path("agency", agencyId, "migrations"), {
      query: params,
    });
  }

  /**
   * Checks every key and starts the scan (201). Honors `Idempotency-Key`. Needs
   * `AGENCY_MIGRATE` on an agency API key.
   * @example
   * const m = await warmbly.agency.migrations.create("agency_1", {
   *   provider: "instantly",
   *   credentials: [{ api_key: "inst_..." }],
   * });
   */
  create(
    agencyId: string,
    params: CreateToolMigrationParams,
    opts?: RequestOptions,
  ): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(this.path("agency", agencyId, "migrations"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Reads one migration with its `inventory` per source workspace and its `targets`.
   * Needs `AGENCY_MIGRATE` on an agency API key.
   * @example
   * const m = await warmbly.agency.migrations.get("agency_1", "mig_1");
   */
  get(agencyId: string, id: string, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.get<ToolMigration>(this.path("agency", agencyId, "migrations", id), opts);
  }

  /**
   * Starts bringing data over, one target per source workspace. A target that creates a
   * client also needs `AGENCY_MANAGE_CLIENTS`; the acting member needs a whole-workspace
   * membership in each client (`403 tool_migration_permission`). Needs `AGENCY_MIGRATE` on
   * an agency API key.
   * @example
   * await warmbly.agency.migrations.start("agency_1", "mig_1", {
   *   options: { kinds: ["blocklist", "campaigns", "leads"], in_flight: "skip" },
   *   targets: [{ workspace_id: "wrk_1", key: 0, organization_id: "org_1" }],
   * });
   */
  start(
    agencyId: string,
    id: string,
    params: StartToolMigrationParams,
    opts?: RequestOptions,
  ): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(this.path("agency", agencyId, "migrations", id, "start"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Cancels a migration. Needs `AGENCY_MIGRATE` on an agency API key.
   * @example
   * await warmbly.agency.migrations.cancel("agency_1", "mig_1");
   */
  cancel(agencyId: string, id: string, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(
      this.path("agency", agencyId, "migrations", id, "cancel"),
      opts,
    );
  }

  /**
   * Links source senders to mailboxes connected since the run, on the draft campaigns it
   * created. Needs `AGENCY_MIGRATE` on an agency API key.
   * @example
   * await warmbly.agency.migrations.linkSenders("agency_1", "mig_1");
   */
  linkSenders(agencyId: string, id: string, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(
      this.path("agency", agencyId, "migrations", id, "link-senders"),
      opts,
    );
  }

  /**
   * Removes a migration that is not running from the list (204); what it imported stays.
   * Needs `AGENCY_MIGRATE` on an agency API key.
   * @example
   * await warmbly.agency.migrations.delete("agency_1", "mig_1");
   */
  delete(agencyId: string, id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("agency", agencyId, "migrations", id), opts);
  }
}

// ---------------------------------------------------------------------------
// Agency
// ---------------------------------------------------------------------------

/**
 * The agency routes under `/v1/agency`: the agency, its staff, clients, send pool, AI
 * balance, home overview, mailboxes, brand, cross-client inbox and migrations. Reachable
 * as `warmbly.agency`. These routes take an agency API key (`wmagency_...`) for its own
 * agency, or a signed-in session; a workspace API key or OAuth token answers `403
 * agency_credential_required`. Each method names the agency bit a key needs. They take no
 * `Warmbly-Organization` header. Session-only agency routes (billing, staff writes, brand
 * writes, vendors, agency key management) are not covered.
 *
 * @example
 * const { data: [agency] } = await warmbly.agency.list();
 * const clients = await warmbly.agency.clients.list(agency!.id);
 * const usage = await warmbly.agency.usage(agency!.id);
 */
export class Agency extends APIResource {
  /** Client workspaces. */
  readonly clients = new AgencyClients(this.http);
  /** The cross-client inbox. */
  readonly inbox = new AgencyInbox(this.http);
  /** Migrations from other outreach tools. */
  readonly migrations = new AgencyMigrations(this.http);

  /**
   * Lists the caller's agencies (an agency key sees only its own) with `billing_enabled`.
   * Needs `AGENCY_READ` on an agency API key.
   * @example
   * const { data, billing_enabled } = await warmbly.agency.list();
   */
  list(opts?: RequestOptions): Promise<AgencyList> {
    return this.http.get<AgencyList>("agency", opts);
  }

  /**
   * Lists the agency plans with their `monthly_send_pool` and `agency_ai_allowance_usd`.
   * Needs `AGENCY_READ` on an agency API key.
   * @example
   * const { data: plans } = await warmbly.agency.plans();
   */
  plans(opts?: RequestOptions): Promise<AgencyPlanList> {
    return this.http.get<AgencyPlanList>("agency/plans", opts);
  }

  /**
   * Reads one agency, wrapped as `{ agency, billing_enabled }`. Needs `AGENCY_READ` on an
   * agency API key.
   * @example
   * const { agency } = await warmbly.agency.get("agency_1");
   */
  get(agencyId: string, opts?: RequestOptions): Promise<AgencyDetail> {
    return this.http.get<AgencyDetail>(this.path("agency", agencyId), opts);
  }

  /**
   * Lists the staff (`data`) and pending `invitations`. Needs `AGENCY_READ` on an agency
   * API key.
   * @example
   * const { data: staff, invitations } = await warmbly.agency.members("agency_1");
   */
  members(agencyId: string, opts?: RequestOptions): Promise<AgencyMemberList> {
    return this.http.get<AgencyMemberList>(this.path("agency", agencyId, "members"), opts);
  }

  /**
   * Reads the agency home: the pool, totals, the attention list and every client, with
   * only the sections the acting member's own membership in each client allows. Cached
   * for up to 20 seconds. Needs `AGENCY_READ` on an agency API key.
   * @example
   * const o = await warmbly.agency.overview("agency_1");
   * for (const a of o.attention) console.log(a.kind, a.client_name);
   */
  overview(agencyId: string, opts?: RequestOptions): Promise<AgencyOverview> {
    return this.http.get<AgencyOverview>(this.path("agency", agencyId, "overview"), opts);
  }

  /**
   * Lists mailboxes across the clients whose mailbox list the caller reads, newest first,
   * auto-paginating when iterated. A `client` that is not a client answers `404
   * agency_client_not_found`. Needs `AGENCY_READ` on an agency API key.
   * @example
   * for await (const mb of await warmbly.agency.mailboxes("agency_1", { attention: true })) {
   *   console.log(mb.client, mb.email, mb.status);
   * }
   */
  mailboxes(agencyId: string, params?: ListAgencyMailboxesParams): Promise<Page<AgencyMailbox>> {
    return this.http.getPage<AgencyMailbox>(this.path("agency", agencyId, "mailboxes"), {
      query: joinClients(params),
    });
  }

  /**
   * Reads the agency's brand, portal domain and portal theme. Needs `AGENCY_READ` on an
   * agency API key.
   * @example
   * const b = await warmbly.agency.brand("agency_1");
   * console.log(b.portal_base_url, b.theme.font);
   */
  brand(agencyId: string, opts?: RequestOptions): Promise<AgencyBrand> {
    return this.http.get<AgencyBrand>(this.path("agency", agencyId, "brand"), opts);
  }

  /**
   * Reads the shared send pool: size, top-ups, used, remaining, per-client use and caps,
   * days left and a projection. Needs `AGENCY_READ_USAGE` on an agency API key.
   * @example
   * const u = await warmbly.agency.usage("agency_1");
   * console.log(`${u.used}/${u.total}`);
   */
  usage(agencyId: string, opts?: RequestOptions): Promise<AgencyUsage> {
    return this.http.get<AgencyUsage>(this.path("agency", agencyId, "usage"), opts);
  }

  /**
   * Reads the shared AI balance this period. Needs `AGENCY_READ_USAGE` on an agency API key.
   * @example
   * const b = await warmbly.agency.aiBalance("agency_1");
   * if (!b.unmetered) console.log(b.balance_usd);
   */
  aiBalance(agencyId: string, opts?: RequestOptions): Promise<AgencyAIBalance> {
    return this.http.get<AgencyAIBalance>(this.path("agency", agencyId, "ai-balance"), opts);
  }
}
