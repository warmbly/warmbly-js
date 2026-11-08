import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/**
 * @deprecated The server no longer has campaign kinds: `kind` is gone from campaign
 * responses, create bodies and the list filter. Kept so existing imports compile.
 */
export type CampaignKind = "sequence" | "one_time";

/**
 * Which mailbox a lead's follow-ups leave from: `same` keeps the address that sent the
 * first email, `same_domain` rotates among mailboxes on that domain, `rotate` places
 * each step through the campaign rotation like a first email.
 */
export type CampaignFollowUpSender = "same" | "same_domain" | "rotate" | (string & {});

/** A Warmbly campaign. Shape is documented-but-open. */
export interface Campaign {
  id: string;
  name?: string;
  status?: string;
  /** Stop a lead's flow when the contact books a meeting. */
  stop_on_meeting?: boolean;
  /** The zone the schedule is read in. Empty means the campaign follows the workspace timezone. */
  timezone?: string;
  /** The zone in use, resolved on read (the campaign's own, else the workspace's). */
  effective_timezone?: string;
  /** Which mailbox a lead's follow-ups leave from. */
  follow_up_sender?: CampaignFollowUpSender;
  /** Holds a contact's first email back this many minutes after they enter; 0 is immediate. */
  entry_delay_minutes?: number;
  /** Keep running for new leads: out of leads, the campaign stays active and waits. */
  continuous?: boolean;
  /** Set while a continuous campaign is waiting for leads; null otherwise. */
  idle_since?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * What a sequence step does: send an email, run a side effect, or just wait.
 * Routing is identical whatever the kind.
 */
export type StepKind = "email" | "action" | "wait";

/**
 * The typed config of a non-email node. `type` is the switch; the rest are
 * type-scoped, and the shape stays open because the catalog grows.
 */
export interface StepAction {
  type:
    | "wait"
    | "add_tag"
    | "remove_tag"
    | "add_to_segment"
    | "remove_from_segment"
    | "label_email"
    | "unsubscribe"
    | "notify"
    | "create_task"
    | "create_deal"
    | "move_deal_stage"
    | "run_automation"
    | "fire_event"
    | "switch"
    | "ai_step"
    | "end"
    | (string & {});
  wait_minutes?: number;
  /** For `add_tag`/`remove_tag`: a contact category id (tags are categories). */
  category_id?: string;
  /** For `add_to_segment`/`remove_from_segment`: pins the contact in or out. */
  segment_id?: string;
  automation_id?: string;
  event_name?: string;
  [key: string]: unknown;
}

/**
 * One engagement predicate on a branch. Conditions on a branch are ANDed, so
 * every one must hold for the branch to match.
 */
export interface StepBranchCondition {
  /** The engagement signal, e.g. `opened`, `clicked`, `replied`, or a negation. */
  field: string;
  [key: string]: unknown;
}

/** A connection out of a step. A branch with no conditions is the catch-all. */
export interface StepBranch {
  /** A stable client-supplied id, for editor diffing. Any string. */
  branch_id?: string;
  /** The step to route to, or `null` to stop the flow for the contact. */
  target_step_id?: string | null;
  conditions?: StepBranchCondition[];
  /** On a reply branch, whether the chain fires the moment the contact replies. */
  instant?: boolean;
  [key: string]: unknown;
}

/**
 * A single step in a campaign sequence. Routing follows connections only: a step
 * whose `conditions` hold no branches ends the flow for the contact.
 */
export interface CampaignStep {
  id: string;
  campaign_id?: string;
  name?: string;
  kind?: StepKind;
  subject?: string;
  body_plain?: string;
  body_html?: string;
  body_sync?: boolean;
  body_code?: boolean;
  /** Days to wait before this step, counted from the contact's previous one (0..60). */
  wait_after?: number;
  /**
   * Send this step as a reply in the contact's existing conversation instead of opening
   * a new one. Defaults to true; only has an effect once the contact has had an email.
   */
  thread_reply?: boolean;
  position?: number;
  /** Canvas coordinates. Written only through {@link Campaigns.setStepLayout}. */
  x?: number;
  y?: number;
  /** The connections out of this step, evaluated in order. */
  conditions?: { branches?: StepBranch[]; [key: string]: unknown };
  /** Typed config for a non-email node; an empty object on an email step. */
  action?: StepAction;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Campaigns.updateStep}. Every field is optional. */
export interface UpdateCampaignStepParams {
  name?: string;
  kind?: StepKind;
  subject?: string;
  body_plain?: string;
  body_html?: string;
  body_sync?: boolean;
  body_code?: boolean;
  /** Days to wait before this step (0..60), not minutes. */
  wait_after?: number;
  /** Reply in the contact's existing conversation instead of opening a new thread. */
  thread_reply?: boolean;
  /** Replaces the step's outgoing connections. Send `{}` to leave it with none. */
  conditions?: { branches?: StepBranch[]; [key: string]: unknown };
  action?: StepAction;
  [key: string]: unknown;
}

/** An A/B test variant attached to a campaign. */
export interface CampaignAbVariant {
  id: string;
  [key: string]: unknown;
}

/** An attachment associated with a campaign. */
export interface CampaignAttachment {
  id: string;
  /** The one step that sends this file, or `null` when every step of the campaign does. */
  step_id: string | null;
  filename?: string;
  size?: number;
  mime_type?: string;
  /** A short-lived presigned download URL. */
  url?: string;
  [key: string]: unknown;
}

/** A campaign log entry. */
export interface CampaignLog {
  [key: string]: unknown;
}

/** Body for creating a campaign. Open shape. */
export interface CreateCampaignParams {
  name?: string;
  description?: string;
  stop_on_meeting?: boolean;
  /** Which mailbox follow-ups leave from. */
  follow_up_sender?: CampaignFollowUpSender;
  /** Hold each contact's first email back this many minutes after they enter. */
  entry_delay_minutes?: number;
  /** Keep running for new leads instead of finishing. Linking a segment turns it on. */
  continuous?: boolean;
  /** Initial steps in order; each routes to the next after its `wait_after` days. */
  steps?: Array<Record<string, unknown>>;
  utm_tracking?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  [key: string]: unknown;
}

/** Body for updating a campaign. Open shape. */
export interface UpdateCampaignParams {
  name?: string;
  description?: string;
  stop_on_meeting?: boolean;
  follow_up_sender?: CampaignFollowUpSender;
  entry_delay_minutes?: number;
  continuous?: boolean;
  /** Send `null` to clear the date and start now. */
  start_date?: string | null;
  /** Send `null` to run open-ended. */
  end_date?: string | null;
  utm_tracking?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  [key: string]: unknown;
}

/** Query params for listing campaigns. */
export interface ListCampaignsParams {
  cursor?: string;
  limit?: number;
  status?: string;
  /** Free-text search over campaign names. */
  q?: string;
  /** Restrict to one folder id. */
  folder?: string;
  [key: string]: unknown;
}

/** Body for {@link Campaigns.start}. */
export interface StartCampaignParams {
  /** Launch even though the list's projected bounce rate would be refused (`list_bounce_risk`). */
  acknowledge_list_risk?: boolean;
  [key: string]: unknown;
}

/** Body for {@link Campaigns.estimate}: an audience against a sender pool. */
export interface EstimateCampaignParams {
  /** The segments making up the audience, at most 20. */
  segment_ids: string[];
  /** Mailbox tags that resolve the pool. Omit or send `[]` for every active mailbox. */
  email_tag_ids?: string[];
  /** Per-mailbox campaign cap to apply (default 50). */
  daily_limit?: number;
  /** Weekday bitmask of sending days, bit 0 = Monday. Defaults to weekdays. */
  days?: number;
  /** IANA timezone the days are counted in. Defaults to UTC. */
  timezone?: string;
  /** RFC 3339. Omit for now. */
  start_date?: string;
  /** Daily sending window start, `HH:MM`. Omit for the scheduler's default window. */
  start_time?: string;
  /** Daily sending window end, `HH:MM`. */
  end_time?: string;
  /** Each follow-up's `wait_after` in days, in order. Empty or omitted is a single email. Max 30. */
  step_waits?: number[];
  /** Project a saved campaign, filling anything not sent from it. `segment_ids` may then be `[]`. */
  campaign_id?: string;
  [key: string]: unknown;
}

/** The warmup mail running beside a campaign, in a {@link CampaignEstimate}. */
export interface CampaignEstimateWarmup {
  mailboxes: number;
  per_day: number;
  /** What the same mailboxes warm at with no live campaign. */
  per_day_without: number;
  reply_rate: number;
  [key: string]: unknown;
}

/** One calendar day of a {@link CampaignEstimate} projection. */
export interface CampaignEstimateDay {
  /** `YYYY-MM-DD`. */
  date: string;
  sending_day: boolean;
  capacity: number;
  sends: number;
  first_emails: number;
  follow_ups: number;
  warmup: number;
  [key: string]: unknown;
}

/** One mailbox's part in a {@link CampaignEstimate}. */
export interface CampaignEstimateSender {
  id: string;
  email: string;
  provider: string;
  /** e.g. `ready`, `ramping`, `throttled`, `health_hold`, `domain_auth`, `resting`, `no_worker`. */
  state:
    | "ready"
    | "ramping"
    | "throttled"
    | "health_hold"
    | "domain_auth"
    | "resting"
    | "no_worker"
    | "send_recovery"
    | "send_cooldown"
    | "send_authority"
    | (string & {});
  first_day_cap: number;
  steady_cap: number;
  warmup_per_day: number;
  warmup_without: number;
  full_cap_at: string | null;
  [key: string]: unknown;
}

/** A change that would finish a send sooner, simulated the same way. */
export interface CampaignEstimateScenario {
  /** `replies`, `more_mailboxes` or `every_day`. */
  kind: "replies" | "more_mailboxes" | "every_day" | (string & {});
  /** The change's own figure: reply percent, mailboxes added, or sending days a week. */
  value: number;
  finish_at: string | null;
  [key: string]: unknown;
}

/** The result of {@link Campaigns.estimate}. */
export interface CampaignEstimate {
  recipients: number;
  mailboxes: number;
  daily_capacity: number;
  remaining_today: number;
  /** `null` when the audience is empty, the pool has no capacity, or the send takes over two years. */
  sending_days: number | null;
  estimated_finish_at: string | null;
  /** Emails each contact receives. */
  steps?: number;
  /** Recipients times steps, assuming nobody replies or unsubscribes. */
  total_sends?: number;
  /** The day the last contact gets their first email. */
  first_touch_finish_at?: string | null;
  /** The pool's sending-day capacity once every mailbox has graduated from warmup. */
  steady_capacity?: number;
  /** The first day the pool reaches steady capacity; `null` when it already has or never does. */
  full_capacity_at?: string | null;
  /** Mailboxes still climbing their graduation ceiling. */
  ramping?: number;
  /** Mailboxes that contribute nothing today. */
  held?: number;
  warmup?: CampaignEstimateWarmup;
  /** What the pool already sends for other campaigns on an average recent day. */
  other_campaigns_per_day?: number;
  /** The clamp costing the most sends on day one; empty when the mailbox caps are the limit. */
  bottleneck?: string;
  /** Day by day from the start, at most 120 days. */
  timeline?: CampaignEstimateDay[];
  /** The pool mailbox by mailbox, at most 200. */
  senders?: CampaignEstimateSender[];
  scenarios?: CampaignEstimateScenario[];
  [key: string]: unknown;
}

/** A segment linked to a campaign as a live audience source, with counts evaluated on read. */
export interface CampaignSegmentLink {
  segment_id: string;
  name?: string;
  color?: string;
  description?: string;
  /** Contacts the segment matches now. */
  contact_count?: number;
  /** How many of them are leads of this campaign. */
  lead_count?: number;
  /** Members who are not leads because they were removed from the campaign by hand. */
  held_out_count?: number;
  linked_at?: string;
  [key: string]: unknown;
}

/** What a campaign's recipients did with a form it links to. */
export interface CampaignFormStats {
  form_id: string;
  form_name?: string;
  public_id?: string;
  status?: string;
  /** Personalized links handed out. */
  links_sent?: number;
  viewers?: number;
  starters?: number;
  submissions?: number;
  share_url?: string;
  [key: string]: unknown;
}

/** One sequence step's canvas coordinates. */
export interface StepPosition {
  /** The step's id. */
  id: string;
  x: number;
  y: number;
}

/** Body for {@link Campaigns.setStepLayout}: a position-only update, max 1000 entries. */
export interface StepLayoutParams {
  positions: StepPosition[];
  [key: string]: unknown;
}

/** Where a lead hold came from. */
export type CampaignLeadHoldSource =
  | "manual"
  | "out_of_office"
  | "inbox_tagging"
  | "crm"
  | (string & {});

/** A hold on one lead's flow inside one campaign. */
export interface CampaignLeadHoldInfo {
  since: string;
  /** When the hold lifts. Absent for a hold with no end, which only a resume lifts. */
  until?: string;
  reason?: string;
  source: CampaignLeadHoldSource;
  [key: string]: unknown;
}

/** The answer of the lead hold, pause and resume endpoints. */
export interface CampaignLeadHold {
  campaign_id: string;
  contact_id: string;
  /** Absent when the lead is not held. */
  hold?: CampaignLeadHoldInfo;
  [key: string]: unknown;
}

/** Body for {@link Campaigns.pauseLead}. */
export interface PauseCampaignLeadParams {
  /** RFC 3339, in the future and within a year. Omit or `null` to hold with no end. */
  until?: string | null;
  /** Free text, trimmed to one short line by the server. */
  reason?: string;
  [key: string]: unknown;
}

/** Why a copied contact is or is not on the next email: only `active` is copied. */
export type CampaignLeadCCStatus =
  | "active"
  | "unsubscribed"
  | "bounced"
  | "undeliverable"
  | (string & {});

/** A contact copied on every email one campaign sends one lead. */
export interface CampaignLeadCC {
  contact_id: string;
  email: string;
  first_name: string;
  last_name: string;
  company?: string;
  status: CampaignLeadCCStatus;
  bounced_at?: string;
  [key: string]: unknown;
}

/** The answer of the lead CC read and write. */
export interface CampaignLeadCCList {
  campaign_id: string;
  contact_id: string;
  cc: CampaignLeadCC[];
  [key: string]: unknown;
}

/** A contact who looks like a colleague of the lead, offered when picking who to copy. */
export interface CampaignLeadCCSuggestion {
  contact_id: string;
  email: string;
  first_name: string;
  last_name: string;
  company?: string;
  /** `company` when the company names match, `domain` when only the email domain does. */
  reason: "company" | "domain" | (string & {});
  [key: string]: unknown;
}

/** One clamp in a send plan's waterfall and how many of today's emails it removed. */
export interface CampaignSendLimit {
  /** e.g. `campaign_daily_limit`, `campaign_ramp`, `warmup_graduation`, `workspace_risk`, `leads`. */
  kind: string;
  emails: number;
  /** Mailboxes the clamp touched. Absent for a campaign-level clamp. */
  mailboxes?: number;
  [key: string]: unknown;
}

/** The campaign's calendar for today. */
export interface CampaignSendWindow {
  sending_day: boolean;
  open_now: boolean;
  opens_at?: string;
  closes_at?: string;
  minutes_left: number;
  starts_at?: string;
  ends_at?: string;
  [key: string]: unknown;
}

/** The leads side of a send plan: mailboxes can only send to leads whose step is due. */
export interface CampaignLeadSupply {
  due_now: number;
  due_later_today: number;
  new_leads_due_today: number;
  waiting_on_step: number;
  waiting_on_condition: number;
  held: number;
  waiting_on_sender: number;
  new_leads_started_today: number;
  /** 0 when unlimited. */
  max_new_leads_per_day: number;
  next_due_at?: string;
  [key: string]: unknown;
}

/** One mailbox's day on a campaign. */
export interface CampaignMailboxPlan {
  id: string;
  email: string;
  provider: string;
  configured_cap: number;
  cap_today: number;
  /** The clamp that set `cap_today`, e.g. `mailbox_daily_cap`, `campaign_ramp`. */
  limited_by: string;
  sent_today: number;
  sent_by_other_campaigns: number;
  expected_remaining: number;
  /** Why the mailbox is or is not sending: `sending`, `budget_spent`, `hours_closed`, and more. */
  state: string;
  reopens_at?: string;
  /** The warmup health band when it is not healthy. */
  health?: string;
  min_gap_seconds: number;
  /** Set while the warmup graduation ceiling holds the mailbox below its own cap. */
  graduation?: {
    ceiling: number;
    mailbox_cap: number;
    days_to_full_cap: number;
    held: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** What one campaign will send today and why. Derived on read, never stored. */
export interface CampaignSendPlan {
  campaign_id: string;
  status: string;
  /** The UTC budget day the plan counts. */
  day: string;
  timezone: string;
  computed_at: string;
  /** True when served from a snapshot the campaign has since outrun; a fresh walk follows. */
  stale: boolean;
  configured_ceiling: number;
  projected_today: number;
  sent_today: number;
  expected_remaining: number;
  /** The limit that decides `projected_today`, or an empty string when nothing binds. */
  bottleneck: string;
  limits: CampaignSendLimit[];
  window: CampaignSendWindow;
  leads: CampaignLeadSupply;
  mailboxes: CampaignMailboxPlan[];
  /** The workspace's plan-level daily allowance. Absent when unlimited. */
  organization?: {
    daily_limit: number;
    sent_today: number;
    remaining: number;
    [key: string]: unknown;
  };
  next_wake_at?: string;
  [key: string]: unknown;
}

/** Where warmup threads opened with a piece of campaign copy landed. */
export interface CampaignWarmupPlacementCounts {
  sent: number;
  /** Sends whose recipient filed a receipt; landing rates are read over it. */
  reported: number;
  inbox: number;
  tabs: number;
  spam: number;
  rescued: number;
  [key: string]: unknown;
}

/** {@link CampaignWarmupPlacementCounts} for one recipient provider group. */
export interface CampaignWarmupGroupPlacement extends CampaignWarmupPlacementCounts {
  /** `google` (Google Workspace) or `microsoft` (Microsoft 365). */
  group: "google" | "microsoft" | (string & {});
}

/** Where one arm (the step itself or an A/B variant) of a campaign step landed in warmup. */
export interface CampaignWarmupStepPlacement {
  sequence_id: string;
  /** `null` for the step's own copy. */
  variant_id: string | null;
  placement: CampaignWarmupPlacementCounts;
  by_group: CampaignWarmupGroupPlacement[];
  [key: string]: unknown;
}

/** The result of {@link Campaigns.warmupPlacement}. */
export interface CampaignWarmupPlacement {
  data: CampaignWarmupStepPlacement[];
  /** How far back placement is read (30). */
  days: number;
  [key: string]: unknown;
}

/** Which seed panel a placement monitor tests against. */
export type CampaignPlacementPanel = "instance" | "workspace" | "cloud" | (string & {});

/** A campaign's scheduled placement test. */
export interface CampaignPlacementMonitor {
  id: string;
  campaign_id: string;
  created_by: string | null;
  enabled: boolean;
  interval_days: number;
  panel: CampaignPlacementPanel;
  /** Alert when the inbox rate falls below this percent. */
  alert_below: number;
  pause_on_alert: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_test_id: string | null;
  last_alert_at: string | null;
  last_error?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Body for {@link Campaigns.putPlacementMonitor}. Omitted keys keep their stored value. */
export interface PutCampaignPlacementMonitorParams {
  enabled?: boolean;
  /** 1..30 days. Default 7 on creation. */
  interval_days?: number;
  panel?: CampaignPlacementPanel;
  /** 0..100. Default 70 on creation. */
  alert_below?: number;
  pause_on_alert?: boolean;
  [key: string]: unknown;
}

/**
 * Manage campaigns and their steps, variants, attachments, senders, and lifecycle.
 * Reachable as `warmbly.campaigns`.
 *
 * @example
 * const page = await warmbly.campaigns.list({ status: "active" });
 * await warmbly.campaigns.start(page.data[0]!.id);
 */
export class Campaigns extends APIResource {
  /**
   * Lists campaigns, auto-paginating when iterated.
   * @example
   * for await (const c of await warmbly.campaigns.list()) console.log(c.name);
   */
  list(params?: ListCampaignsParams): Promise<Page<Campaign>> {
    return this.http.getPage<Campaign>("campaigns", { query: params });
  }

  /**
   * Returns the status-bucket and folder counts behind the campaigns browser. Lives at
   * the top level (`/campaigns-overview`) rather than under `/campaigns`, because it
   * takes no campaign id.
   *
   * @example
   * const overview = await warmbly.campaigns.overview();
   */
  overview(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("campaigns-overview", { query: params });
  }

  /**
   * Projects an audience against a sender pool before a campaign exists: how many
   * contacts the segments resolve to, how many mailboxes would send, and when the last
   * send is expected to land. Writes nothing.
   * @example
   * const est = await warmbly.campaigns.estimate({ segment_ids: ["seg_1"], daily_limit: 40 });
   */
  estimate(params: EstimateCampaignParams): Promise<CampaignEstimate> {
    return this.http.post<CampaignEstimate>("campaigns-estimate", { body: params });
  }

  /**
   * Creates a campaign.
   * @example
   * const c = await warmbly.campaigns.create({ name: "Q3 outreach" });
   */
  create(params: CreateCampaignParams): Promise<Campaign> {
    return this.http.post<Campaign>("campaigns", { body: params });
  }

  /**
   * Creates a new draft campaign from an existing one's configuration: settings, steps
   * with their branch graph, senders, variants, and attachments. Leads, progress, and
   * statistics are not copied. The name defaults to the source name plus ` (copy)`.
   * @example
   * const copy = await warmbly.campaigns.duplicate("camp_1", { name: "Q3 outbound, subject B" });
   */
  duplicate(id: string, params?: { name?: string; [key: string]: unknown }): Promise<Campaign> {
    return this.http.post<Campaign>(this.path("campaigns", id, "duplicate"), { body: params });
  }

  /**
   * Retrieves a campaign by id.
   * @example
   * const c = await warmbly.campaigns.get("camp_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Campaign> {
    return this.http.get<Campaign>(this.path("campaigns", id), opts);
  }

  /**
   * Updates a campaign.
   * @example
   * await warmbly.campaigns.update("camp_1", { name: "Renamed" });
   */
  update(id: string, params: UpdateCampaignParams): Promise<Campaign> {
    return this.http.patch<Campaign>(this.path("campaigns", id), { body: params });
  }

  /**
   * Deletes a campaign.
   * @example
   * await warmbly.campaigns.delete("camp_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("campaigns", id), opts);
  }

  /**
   * Fetches a campaign's advanced settings.
   * @example
   * const adv = await warmbly.campaigns.getAdvanced("camp_1");
   */
  getAdvanced(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("campaigns", id, "advanced"), opts);
  }

  /**
   * Updates a campaign's advanced settings.
   * @example
   * await warmbly.campaigns.updateAdvanced("camp_1", { daily_limit: 50 });
   */
  updateAdvanced(id: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>(this.path("campaigns", id, "advanced"), {
      body: params,
    });
  }

  /**
   * Starts a campaign. Works from draft, any paused status, or completed. A launch
   * refused on the list's projected bounce rate fails with `list_bounce_risk`; repeat
   * it with `acknowledge_list_risk: true` for a list verified elsewhere. A launch with
   * every remaining lead refused by verification fails with `leads_undeliverable`.
   * @example
   * await warmbly.campaigns.start("camp_1");
   * await warmbly.campaigns.start("camp_1", { acknowledge_list_risk: true });
   */
  start(id: string, params?: StartCampaignParams, opts?: RequestOptions): Promise<Campaign> {
    return this.http.post<Campaign>(this.path("campaigns", id, "start"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Stops a campaign.
   * @example
   * await warmbly.campaigns.stop("camp_1");
   */
  stop(id: string, opts?: RequestOptions): Promise<Campaign> {
    return this.http.post<Campaign>(this.path("campaigns", id, "stop"), opts);
  }

  /**
   * Lists a campaign's logs, auto-paginating when iterated.
   * @example
   * for await (const log of await warmbly.campaigns.logs("camp_1")) console.log(log);
   */
  logs(id: string, params?: Record<string, unknown>): Promise<Page<CampaignLog>> {
    return this.http.getPage<CampaignLog>(this.path("campaigns", id, "logs"), { query: params });
  }

  /**
   * Reports the forms this campaign links to and what its recipients did with them.
   * @example
   * const forms = await warmbly.campaigns.forms("camp_1");
   */
  forms(id: string, opts?: RequestOptions): Promise<CampaignFormStats[]> {
    return this.http
      .get<{ data: CampaignFormStats[] }>(this.path("campaigns", id, "forms"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Lists the segments linked to the campaign as live audience sources.
   * @example
   * const links = await warmbly.campaigns.listSegments("camp_1");
   */
  listSegments(id: string, opts?: RequestOptions): Promise<CampaignSegmentLink[]> {
    return this.http
      .get<{ data: CampaignSegmentLink[] }>(this.path("campaigns", id, "segments"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Atomically replaces the campaign's linked segments (up to 20). Every current member
   * of a newly linked segment is enrolled at once, and later joiners are enrolled
   * automatically. Send an empty array to detach every segment. Retries are safe.
   * Returns the resulting links plus how many leads this call enrolled.
   * @example
   * const { data, added } = await warmbly.campaigns.setSegments("camp_1", ["seg_1", "seg_2"]);
   */
  setSegments(
    id: string,
    segmentIds: string[],
  ): Promise<{ data: CampaignSegmentLink[]; added: number }> {
    return this.http.put<{ data: CampaignSegmentLink[]; added: number }>(
      this.path("campaigns", id, "segments"),
      { body: { segment_ids: segmentIds } },
    );
  }

  /**
   * Sends a test email for a campaign.
   * @example
   * await warmbly.campaigns.testEmail("camp_1", { to: "dev@warmbly.com" });
   */
  testEmail(id: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("campaigns", id, "test-email"), {
      body: params,
    });
  }

  /**
   * Lists A/B variants for a campaign.
   * @example
   * const variants = await warmbly.campaigns.listAbVariants("camp_1");
   */
  listAbVariants(id: string, opts?: RequestOptions): Promise<CampaignAbVariant[]> {
    return this.http.get<CampaignAbVariant[]>(this.path("campaigns", id, "ab-variants"), opts);
  }

  /**
   * Creates an A/B variant for a campaign.
   * @example
   * await warmbly.campaigns.createAbVariant("camp_1", { subject: "Hi" });
   */
  createAbVariant(id: string, params: Record<string, unknown>): Promise<CampaignAbVariant> {
    return this.http.post<CampaignAbVariant>(this.path("campaigns", id, "ab-variants"), {
      body: params,
    });
  }

  /**
   * Updates an A/B variant.
   * @example
   * await warmbly.campaigns.updateAbVariant("camp_1", "var_1", { subject: "Hey" });
   */
  updateAbVariant(
    id: string,
    variantId: string,
    params: Record<string, unknown>,
  ): Promise<CampaignAbVariant> {
    return this.http.patch<CampaignAbVariant>(
      this.path("campaigns", id, "ab-variants", variantId),
      { body: params },
    );
  }

  /**
   * Deletes an A/B variant.
   * @example
   * await warmbly.campaigns.deleteAbVariant("camp_1", "var_1");
   */
  deleteAbVariant(id: string, variantId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("campaigns", id, "ab-variants", variantId), opts);
  }

  /**
   * Lists attachments for a campaign.
   * @example
   * const files = await warmbly.campaigns.listAttachments("camp_1");
   */
  listAttachments(id: string, opts?: RequestOptions): Promise<CampaignAttachment[]> {
    return this.http.get<CampaignAttachment[]>(this.path("campaigns", id, "attachments"), opts);
  }

  /**
   * Uploads an attachment to a campaign as `multipart/form-data`. Pass the file as a
   * `Blob` or `File`; optionally scope it to a step and set the upload filename. Works in
   * any runtime with global `FormData`/`Blob` (Node 20+, Bun, Deno, browsers, the edge).
   * @example
   * const file = new Blob(["hello"], { type: "text/plain" });
   * await warmbly.campaigns.createAttachment("camp_1", file, { filename: "note.txt" });
   */
  createAttachment(
    id: string,
    file: Blob,
    params?: { step_id?: string; filename?: string },
    opts?: RequestOptions,
  ): Promise<CampaignAttachment> {
    const form = new FormData();
    // Append the filename only when there is one. Node, Bun and browsers all treat an
    // explicit undefined third argument as absent, per WebIDL, but a non-spec FormData
    // (React Native's, some polyfills) stringifies it into a file named "undefined".
    if (params?.filename !== undefined) form.append("file", file, params.filename);
    else form.append("file", file);
    if (params?.step_id !== undefined) form.append("step_id", params.step_id);
    return this.http.post<CampaignAttachment>(this.path("campaigns", id, "attachments"), {
      ...opts,
      body: form,
    });
  }

  /**
   * Removes an attachment from a campaign.
   * @example
   * await warmbly.campaigns.deleteAttachment("camp_1", "att_1");
   */
  deleteAttachment(id: string, attachmentId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("campaigns", id, "attachments", attachmentId), opts);
  }

  /**
   * Lists the sending accounts assigned to a campaign.
   * @example
   * const senders = await warmbly.campaigns.getSenders("camp_1");
   */
  getSenders(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("campaigns", id, "senders"), opts);
  }

  /**
   * Replaces the sending accounts assigned to a campaign.
   * @example
   * await warmbly.campaigns.setSenders("camp_1", { account_ids: ["acc_1"] });
   */
  setSenders(id: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>(this.path("campaigns", id, "senders"), {
      body: params,
    });
  }

  /**
   * Runs a preflight readiness check on a campaign.
   * @example
   * const result = await warmbly.campaigns.preflight("camp_1");
   */
  preflight(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("campaigns", id, "preflight"), {
      body: params,
    });
  }

  /**
   * Returns the A/B analysis for a campaign.
   * @example
   * const analysis = await warmbly.campaigns.abAnalysis("camp_1");
   */
  abAnalysis(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("campaigns", id, "ab-analysis"), {
      query: params,
    });
  }

  /**
   * Lists the steps in a campaign sequence.
   * @example
   * const steps = await warmbly.campaigns.listSteps("camp_1");
   */
  listSteps(id: string, opts?: RequestOptions): Promise<CampaignStep[]> {
    return this.http.get<CampaignStep[]>(this.path("campaigns", id, "steps"), opts);
  }

  /**
   * Adds a step to a campaign sequence and returns it. The body is optional and takes the
   * same fields as {@link Campaigns.updateStep}, applied to the new step; a refused body
   * leaves no blank step behind. Needs `WRITE_CAMPAIGNS`.
   * @example
   * const step = await warmbly.campaigns.createStep("camp_1", { subject: "Follow up", wait_after: 3 });
   */
  createStep(
    id: string,
    params?: UpdateCampaignStepParams | RequestOptions,
    opts?: RequestOptions,
  ): Promise<CampaignStep> {
    // Before step bodies existed the second argument was RequestOptions. Keep those calls
    // working: an object made only of request-option keys is options, not step data.
    if (!opts && params && isOnlyRequestOptions(params)) {
      return this.http.post<CampaignStep>(this.path("campaigns", id, "steps"), params);
    }
    return this.http.post<CampaignStep>(this.path("campaigns", id, "steps"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Updates a campaign step: its copy, its spacing, the connections out of it, or the
   * action a non-email node runs. Spacing belongs to the target step, and `wait_after`
   * is counted in days.
   * @example
   * await warmbly.campaigns.updateStep("camp_1", "step_1", {
   *   subject: "Following up",
   *   wait_after: 3,
   * });
   */
  updateStep(id: string, stepId: string, params: UpdateCampaignStepParams): Promise<CampaignStep> {
    return this.http.patch<CampaignStep>(this.path("campaigns", id, "steps", stepId), {
      body: params,
    });
  }

  /**
   * Deletes a campaign step.
   * @example
   * await warmbly.campaigns.deleteStep("camp_1", "step_1");
   */
  deleteStep(id: string, stepId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("campaigns", id, "steps", stepId), opts);
  }

  /**
   * Persists the canvas coordinates of sequence steps without touching their content.
   * Positions are last-write-wins, so retries are safe and no `Idempotency-Key` is
   * needed. Up to 1000 positions per call.
   *
   * @example
   * await warmbly.campaigns.setStepLayout("camp_1", {
   *   positions: [{ id: "step_1", x: 120, y: 40 }],
   * });
   */
  setStepLayout(id: string, params: StepLayoutParams): Promise<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(this.path("campaigns", id, "step-layout"), {
      body: params,
    });
  }

  /**
   * Re-checks the DNS records behind the campaign's custom tracking domain and returns
   * its verification status.
   *
   * @example
   * const status = await warmbly.campaigns.verifyTrackingDomain("camp_1");
   */
  verifyTrackingDomain(
    id: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      this.path("campaigns", id, "tracking-domain", "verify"),
      { body: params },
    );
  }

  /**
   * Reads whether one lead's flow is held. Needs `READ_CAMPAIGNS`.
   * @example
   * const { hold } = await warmbly.campaigns.getLeadHold("camp_1", "con_1");
   */
  getLeadHold(id: string, contactId: string, opts?: RequestOptions): Promise<CampaignLeadHold> {
    return this.http.get<CampaignLeadHold>(
      this.path("campaigns", id, "leads", contactId, "hold"),
      opts,
    );
  }

  /**
   * Parks one lead's flow in a campaign until a date, or with no end when `until` is
   * omitted. The contact stays subscribed and stays a lead. Replacing a live hold keeps
   * its start. Needs `WRITE_CAMPAIGNS`.
   * @example
   * await warmbly.campaigns.pauseLead("camp_1", "con_1", { until: "2026-12-01T00:00:00Z", reason: "on leave" });
   */
  pauseLead(
    id: string,
    contactId: string,
    params?: PauseCampaignLeadParams,
    opts?: RequestOptions,
  ): Promise<CampaignLeadHold> {
    return this.http.post<CampaignLeadHold>(
      this.path("campaigns", id, "leads", contactId, "pause"),
      {
        ...opts,
        body: params,
      },
    );
  }

  /**
   * Lifts a lead's hold now. Resuming a lead that is not held succeeds; a contact that is
   * not a lead of the campaign is a 404. The answer carries no `hold`. Needs `WRITE_CAMPAIGNS`.
   * @example
   * await warmbly.campaigns.resumeLead("camp_1", "con_1");
   */
  resumeLead(id: string, contactId: string, opts?: RequestOptions): Promise<CampaignLeadHold> {
    return this.http.post<CampaignLeadHold>(
      this.path("campaigns", id, "leads", contactId, "resume"),
      opts,
    );
  }

  /**
   * Lists the contacts copied on every email this campaign sends one lead. Needs
   * `READ_CAMPAIGNS` and `READ_CONTACTS`.
   * @example
   * const { cc } = await warmbly.campaigns.getLeadCC("camp_1", "con_1");
   */
  getLeadCC(id: string, contactId: string, opts?: RequestOptions): Promise<CampaignLeadCCList> {
    return this.http.get<CampaignLeadCCList>(
      this.path("campaigns", id, "leads", contactId, "cc"),
      opts,
    );
  }

  /**
   * Replaces the contacts copied on one lead with the given contact ids. An empty array
   * removes them all. Retries are safe. Needs `WRITE_CAMPAIGNS` and `READ_CONTACTS`.
   * @example
   * await warmbly.campaigns.setLeadCC("camp_1", "con_1", ["con_2", "con_3"]);
   */
  setLeadCC(
    id: string,
    contactId: string,
    contactIds: string[],
    opts?: RequestOptions,
  ): Promise<CampaignLeadCCList> {
    return this.http.put<CampaignLeadCCList>(this.path("campaigns", id, "leads", contactId, "cc"), {
      ...opts,
      body: { contact_ids: contactIds },
    });
  }

  /**
   * Offers the lead's likely colleagues to copy, company matches first. Needs
   * `READ_CAMPAIGNS` and `READ_CONTACTS`.
   * @example
   * const suggestions = await warmbly.campaigns.suggestLeadCC("camp_1", "con_1");
   */
  suggestLeadCC(
    id: string,
    contactId: string,
    opts?: RequestOptions,
  ): Promise<CampaignLeadCCSuggestion[]> {
    return this.http
      .get<{ data: CampaignLeadCCSuggestion[] }>(
        this.path("campaigns", id, "leads", contactId, "cc", "suggestions"),
        opts,
      )
      .then((r) => r.data ?? []);
  }

  /**
   * Returns today's sending plan: what will go out and every limit that decided it,
   * read through the scheduler's own gates. Needs `READ_CAMPAIGNS`.
   * @example
   * const plan = await warmbly.campaigns.sendPlan("camp_1");
   * console.log(plan.projected_today, plan.bottleneck);
   */
  sendPlan(id: string, opts?: RequestOptions): Promise<CampaignSendPlan> {
    return this.http.get<CampaignSendPlan>(this.path("campaigns", id, "send-plan"), opts);
  }

  /**
   * Reports where each arm of the campaign's opening steps landed when warmup carried it
   * over the last 30 days. Only arms warmup carried are listed. Needs `READ_CAMPAIGNS`.
   * @example
   * const { data, days } = await warmbly.campaigns.warmupPlacement("camp_1");
   */
  warmupPlacement(id: string, opts?: RequestOptions): Promise<CampaignWarmupPlacement> {
    return this.http.get<CampaignWarmupPlacement>(
      this.path("campaigns", id, "warmup-placement"),
      opts,
    );
  }

  /**
   * Returns the campaign's scheduled placement test, or `null` when it has none. Needs
   * `READ_CAMPAIGNS`.
   * @example
   * const monitor = await warmbly.campaigns.getPlacementMonitor("camp_1");
   */
  getPlacementMonitor(id: string, opts?: RequestOptions): Promise<CampaignPlacementMonitor | null> {
    return this.http
      .get<{ data: CampaignPlacementMonitor | null }>(
        this.path("campaigns", id, "placement-monitor"),
        opts,
      )
      .then((r) => r?.data ?? null);
  }

  /**
   * Creates or updates the campaign's scheduled placement test. Omitted keys keep their
   * stored value; a new monitor starts enabled, every 7 days, alerting below 70 percent.
   * The same body lands on the same state, so retries are safe. Needs `SEND_CAMPAIGNS`.
   * @example
   * await warmbly.campaigns.putPlacementMonitor("camp_1", { interval_days: 3, pause_on_alert: true });
   */
  putPlacementMonitor(
    id: string,
    params: PutCampaignPlacementMonitorParams,
    opts?: RequestOptions,
  ): Promise<CampaignPlacementMonitor> {
    return this.http
      .put<{ data: CampaignPlacementMonitor }>(this.path("campaigns", id, "placement-monitor"), {
        ...opts,
        body: params,
      })
      .then((r) => r.data);
  }

  /**
   * Removes the campaign's scheduled placement test (204). Needs `SEND_CAMPAIGNS`.
   * @example
   * await warmbly.campaigns.deletePlacementMonitor("camp_1");
   */
  deletePlacementMonitor(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("campaigns", id, "placement-monitor"), opts);
  }
}

const REQUEST_OPTION_KEYS = new Set([
  "query",
  "body",
  "headers",
  "idempotencyKey",
  "signal",
  "timeout",
  "maxRetries",
  "form",
]);

function isOnlyRequestOptions(value: object): value is RequestOptions {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => REQUEST_OPTION_KEYS.has(key));
}
