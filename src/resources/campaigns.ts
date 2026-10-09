import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/**
 * Whether a campaign is a multi-step sequence or a single one-time email.
 *
 * @deprecated The server dropped campaign kinds: it no longer returns `kind`, ignores the
 * `kind` filter on list, and no longer reports a `one_time` count on the overview.
 */
export type CampaignKind = "sequence" | "one_time";

/** A Warmbly campaign. Shape is documented-but-open. */
export interface Campaign {
  id: string;
  name?: string;
  status?: string;
  /**
   * @deprecated The server no longer returns a campaign kind or accepts `one_time`
   * campaigns. Kept so existing code still compiles; it is always absent.
   */
  kind?: CampaignKind;
  /** The zone the schedule is read in. Empty means the campaign follows the workspace zone. */
  timezone?: string;
  /** The zone actually in use, resolved on read: `timezone`, else the workspace's. */
  effective_timezone?: string;
  /** Holds a contact's first email back this many minutes after they enter the campaign. */
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
   * Send this step as a reply in the conversation the contact's earlier campaign email
   * started, instead of opening a new thread. Defaults to true; it only has an effect once
   * the contact has already received an email from the campaign.
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
  /** Reply in the contact's existing thread instead of opening a new one. */
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
  id?: string;
  campaign_id?: string;
  event_type?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

/** Body for creating a campaign. Open shape. */
export interface CreateCampaignParams {
  name?: string;
  /**
   * @deprecated The server no longer reads a campaign kind; this field is ignored.
   */
  kind?: CampaignKind;
  /** Keep running for new leads instead of finishing. Linking a segment turns it on. */
  continuous?: boolean;
  /** Hold each contact's first email back this many minutes after they enter the campaign. */
  entry_delay_minutes?: number;
  /**
   * Initial steps in order; each routes to the next after its `wait_after` days. A step
   * written here replies in the first email's thread (`thread_reply`) unless it carries
   * its own subject or you pass `thread_reply: false`.
   */
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
  continuous?: boolean;
  /** Hold each contact's first email back this many minutes after they enter the campaign. */
  entry_delay_minutes?: number;
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
  /** Text search over campaign names. */
  q?: string;
  /** Restrict to one folder. */
  folder?: string;
  status?: string;
  /** @deprecated The server ignores the `kind` filter. */
  kind?: CampaignKind;
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
  /** Each follow-up's `wait_after` in days, in order, at most 30. Empty is a single email. */
  step_waits?: number[];
  /** Project a saved campaign, filling anything not sent from it. */
  campaign_id?: string;
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
  /** How many emails each contact receives. */
  steps?: number;
  /** Recipients times steps, assuming nobody replies or unsubscribes. */
  total_sends?: number;
  /** The day the last contact gets their first email. */
  first_touch_finish_at?: string | null;
  /** The pool's sending-day capacity once every mailbox has graduated from warmup. */
  steady_capacity?: number;
  /** The first day the pool reaches `steady_capacity`; null when it already has or never does. */
  full_capacity_at?: string | null;
  /** Mailboxes still climbing their warmup graduation ceiling. */
  ramping?: number;
  /** Mailboxes contributing nothing today. */
  held?: number;
  warmup?: { mailboxes: number; per_day: number; [key: string]: unknown };
  /** What the pool already sends for other campaigns on an average recent day. */
  other_campaigns_per_day?: number;
  /** The clamp that costs the most sends on the first sending day; empty when mailbox caps are the limit. */
  bottleneck?: CampaignEstimateBottleneck;
  /** The projection day by day, at most 120 days. */
  timeline?: CampaignEstimateDay[];
  /** The pool mailbox by mailbox, at most 200. */
  senders?: CampaignEstimateSender[];
  [key: string]: unknown;
}

/** What limits a campaign estimate's first sending day. */
export type CampaignEstimateBottleneck =
  | ""
  | "campaign_limit"
  | "warmup_graduation"
  | "spacing"
  | "other_campaigns"
  | "health"
  | "held"
  | "workspace_risk"
  | "org_daily_limit"
  | "sending_behavior"
  | (string & {});

/** One calendar day of a campaign estimate's projection. */
export interface CampaignEstimateDay {
  date: string;
  sending_day: boolean;
  capacity: number;
  sends: number;
  first_emails: number;
  follow_ups: number;
  warmup: number;
  [key: string]: unknown;
}

/** One mailbox's part in a campaign estimate. */
export interface CampaignEstimateSender {
  id: string;
  email: string;
  provider: string;
  /** `ready`, `ramping`, `throttled`, `health_hold`, `domain_auth`, `resting` or `no_worker`. */
  state: string;
  first_day_cap: number;
  steady_cap: number;
  warmup_per_day: number;
  full_cap_at: string | null;
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

/** Why a lead's flow is held. */
export type CampaignLeadHoldSource =
  | "manual"
  | "out_of_office"
  | "inbox_tagging"
  | "cc"
  /** A CRM rule: a lead status, a conversion, or an open opportunity in Salesforce. */
  | "crm"
  | (string & {});

/**
 * One lead's flow parked inside one campaign. The contact stays subscribed and stays a
 * lead; this is not an unsubscribe. `until` is absent for a hold with no end, which only a
 * resume lifts.
 */
export interface CampaignLeadHold {
  since: string;
  until?: string;
  reason?: string;
  source: CampaignLeadHoldSource;
  [key: string]: unknown;
}

/** The answer of the lead hold endpoints. `hold` is absent when the lead is not held. */
export interface CampaignLeadHoldState {
  campaign_id: string;
  contact_id: string;
  hold?: CampaignLeadHold;
  [key: string]: unknown;
}

/** Body for {@link Campaigns.pauseLead}. Both fields are optional. */
export interface PauseLeadParams {
  /** RFC 3339. Omit or send `null` to hold with no end. */
  until?: string | null;
  reason?: string;
}

/** Whether a copied contact is on the lead's next email, and if not why. */
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
  /** Anything but `active` is left off the next email. */
  status: CampaignLeadCCStatus;
  bounced_at?: string;
  [key: string]: unknown;
}

/** The answer of the lead CC read and write. */
export interface CampaignLeadCCState {
  campaign_id: string;
  contact_id: string;
  cc: CampaignLeadCC[];
  [key: string]: unknown;
}

/** A contact who looks like a colleague of the lead, offered first when picking who to copy. */
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

/** Which seed panel a placement test runs against. */
export type CampaignPlacementPanel = "instance" | "workspace" | "cloud" | (string & {});

/** A campaign's scheduled placement test, which re-tests its first step on a schedule. */
export interface CampaignPlacementMonitor {
  id: string;
  campaign_id: string;
  created_by: string | null;
  enabled: boolean;
  /** Days between tests. */
  interval_days: number;
  panel: CampaignPlacementPanel;
  /** Alert when the inbox rate falls below this percentage (0..100). */
  alert_below: number;
  /** Pause the campaign when an alert fires. */
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

/**
 * Body for {@link Campaigns.putPlacementMonitor}. Every field is optional: a new monitor
 * starts enabled, and fields you omit keep their current value.
 */
export interface PutPlacementMonitorParams {
  enabled?: boolean;
  /** Days between tests, within the deployment's allowed band. */
  interval_days?: number;
  panel?: CampaignPlacementPanel;
  /** 0..100. */
  alert_below?: number;
  pause_on_alert?: boolean;
}

/** One clamp in a send plan's waterfall and how many of today's emails it removed. */
export interface CampaignSendLimit {
  /**
   * `campaign_daily_limit`, `campaign_ramp`, `warmup_graduation`, `workspace_risk`,
   * `domain_auth`, `resting`, `warmup_health_hold`, `other_campaigns`, `warmup_health_pace`,
   * `mailbox_hours`, `spacing`, `sending_window`, `not_running`, `org_daily_limit`,
   * `new_lead_cap`, `leads` or `sending_behavior`.
   */
  kind: string;
  /** How many sends this clamp removed from today's total. */
  emails: number;
  /** How many of the pool's mailboxes it touched. Absent for a campaign-level clamp. */
  mailboxes?: number;
  [key: string]: unknown;
}

/** The campaign's calendar for today. */
export interface CampaignSendWindow {
  /** False when the schedule has no window today. */
  sending_day: boolean;
  open_now: boolean;
  /** The next opening when the window is closed now; may be on a later day. */
  opens_at?: string;
  closes_at?: string;
  minutes_left: number;
  starts_at?: string;
  ends_at?: string;
  [key: string]: unknown;
}

/** How many leads are due, so the plan shows the other half of the number. */
export interface CampaignLeadSupply {
  due_now: number;
  due_later_today: number;
  new_leads_due_today: number;
  waiting_on_step: number;
  waiting_on_condition: number;
  /** Leads paused (out of office, or by hand). */
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
  /** `mailbox_daily_cap`, `campaign_daily_limit`, `campaign_ramp`, `warmup_graduation` or `workspace_risk`. */
  limited_by: string;
  sent_today: number;
  sent_by_other_campaigns: number;
  expected_remaining: number;
  /**
   * `sending`, `budget_spent`, `hours_closed`, `no_working_day`, `domain_auth`, `resting`,
   * `health_hold`, `window_closed` or `no_worker`.
   */
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

/**
 * What one campaign will send today and why. Derived on read through the scheduler's own
 * gates: `configured_ceiling` minus every `limits` entry minus `sent_today` equals
 * `expected_remaining`.
 */
export interface CampaignSendPlan {
  campaign_id: string;
  status: string;
  /** The UTC budget day the plan counts. */
  day: string;
  /** The campaign's own timezone, which the window's times are in. */
  timezone: string;
  computed_at: string;
  /** True when served from a snapshot the campaign has since outrun; a refreshed plan follows. */
  stale: boolean;
  configured_ceiling: number;
  /** Today's total: sent so far plus still expected. */
  projected_today: number;
  sent_today: number;
  expected_remaining: number;
  /** The limit that decides `projected_today`, `budget_spent`, or empty when nothing binds. */
  bottleneck: string;
  limits: CampaignSendLimit[];
  window: CampaignSendWindow;
  leads: CampaignLeadSupply;
  mailboxes: CampaignMailboxPlan[];
  /** The workspace's plan-level daily allowance. Absent when unlimited. */
  organization?: { daily_limit: number; sent_today: number; remaining: number };
  /** When the campaign's chain next runs. Absent when it has no pending wakeup. */
  next_wake_at?: string;
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
   * automatically. Send an empty array to detach every segment. Detaching a segment
   * withdraws the leads it brought, except those the campaign has already written to or
   * somebody added by hand. Retries are safe. Returns the resulting links, how many leads
   * this call enrolled (`added`), how many it withdrew (`withdrawn`), and how many of the
   * detached audience the campaign had already contacted and so kept (`contacted`).
   * @example
   * const { data, added, withdrawn } = await warmbly.campaigns.setSegments("camp_1", ["seg_1"]);
   */
  setSegments(
    id: string,
    segmentIds: string[],
  ): Promise<{
    data: CampaignSegmentLink[];
    added: number;
    withdrawn: number;
    contacted: number;
  }> {
    return this.http.put<{
      data: CampaignSegmentLink[];
      added: number;
      withdrawn: number;
      contacted: number;
    }>(this.path("campaigns", id, "segments"), { body: { segment_ids: segmentIds } });
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
   * Adds a step to a campaign sequence and returns it. The body is optional: send the same
   * fields {@link Campaigns.updateStep} takes (as `opts.body`) to fill the new step in one
   * call, in which case a body the server refuses leaves no blank step behind. Without a
   * body the step is created empty.
   * @example
   * const step = await warmbly.campaigns.createStep("camp_1");
   * await warmbly.campaigns.updateStep("camp_1", step.id, { subject: "Follow up" });
   *
   * @example
   * const step = await warmbly.campaigns.createStep("camp_1", {
   *   body: { subject: "Follow up", wait_after: 3 },
   * });
   */
  createStep(id: string, opts?: RequestOptions): Promise<CampaignStep> {
    return this.http.post<CampaignStep>(this.path("campaigns", id, "steps"), opts);
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
   * Returns today's sending plan: what the campaign will send today and every limit that
   * decided it, read through the scheduler's own gates. Needs `READ_CAMPAIGNS`.
   *
   * @example
   * const plan = await warmbly.campaigns.sendPlan("camp_1");
   * console.log(plan.projected_today, plan.bottleneck);
   */
  sendPlan(id: string, opts?: RequestOptions): Promise<CampaignSendPlan> {
    return this.http.get<CampaignSendPlan>(this.path("campaigns", id, "send-plan"), opts);
  }

  /**
   * Reads whether one lead's flow is currently held. The answer carries no `hold` when it
   * is not. Needs `READ_CAMPAIGNS`.
   *
   * @example
   * const { hold } = await warmbly.campaigns.getLeadHold("camp_1", "c_1");
   */
  getLeadHold(
    id: string,
    contactId: string,
    opts?: RequestOptions,
  ): Promise<CampaignLeadHoldState> {
    return this.http.get<CampaignLeadHoldState>(
      this.path("campaigns", id, "leads", contactId, "hold"),
      opts,
    );
  }

  /**
   * Parks one contact's flow inside one campaign until a date, or with no end. The
   * contact stays subscribed and stays a lead. Pausing an already held lead replaces the
   * hold and keeps its start. The body is an absolute state, so retries are safe. Needs
   * `WRITE_CAMPAIGNS`.
   *
   * @example
   * await warmbly.campaigns.pauseLead("camp_1", "c_1", {
   *   until: "2026-11-01T00:00:00Z",
   *   reason: "Back from leave",
   * });
   */
  pauseLead(
    id: string,
    contactId: string,
    params?: PauseLeadParams,
  ): Promise<CampaignLeadHoldState> {
    return this.http.post<CampaignLeadHoldState>(
      this.path("campaigns", id, "leads", contactId, "pause"),
      { body: params },
    );
  }

  /**
   * Lifts a lead's hold now. Resuming a lead that is not held succeeds; a contact that is
   * not a lead of the campaign is a 404. Needs `WRITE_CAMPAIGNS`.
   *
   * @example
   * await warmbly.campaigns.resumeLead("camp_1", "c_1");
   */
  resumeLead(id: string, contactId: string, opts?: RequestOptions): Promise<CampaignLeadHoldState> {
    return this.http.post<CampaignLeadHoldState>(
      this.path("campaigns", id, "leads", contactId, "resume"),
      opts,
    );
  }

  /**
   * Lists the contacts copied on every email this campaign sends one lead. Needs
   * `READ_CAMPAIGNS` and `READ_CONTACTS`.
   *
   * @example
   * const { cc } = await warmbly.campaigns.getLeadCC("camp_1", "c_1");
   */
  getLeadCC(id: string, contactId: string, opts?: RequestOptions): Promise<CampaignLeadCCState> {
    return this.http.get<CampaignLeadCCState>(
      this.path("campaigns", id, "leads", contactId, "cc"),
      opts,
    );
  }

  /**
   * Replaces the contacts copied on one lead, follow-ups included. An empty list removes
   * them all. The body is the whole list, so retries are safe. A copied contact who is also
   * a lead of the campaign has their own sequence held while any lead copies them. Needs
   * `WRITE_CAMPAIGNS` and `READ_CONTACTS`.
   *
   * @example
   * const { cc } = await warmbly.campaigns.setLeadCC("camp_1", "c_1", ["c_2", "c_3"]);
   */
  setLeadCC(id: string, contactId: string, contactIds: string[]): Promise<CampaignLeadCCState> {
    return this.http.put<CampaignLeadCCState>(
      this.path("campaigns", id, "leads", contactId, "cc"),
      { body: { contact_ids: contactIds } },
    );
  }

  /**
   * Offers the lead's likely colleagues to copy: contacts at the same company or email
   * domain. Needs `READ_CAMPAIGNS` and `READ_CONTACTS`.
   *
   * @example
   * const suggestions = await warmbly.campaigns.suggestLeadCC("camp_1", "c_1");
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
   * Reads the campaign's scheduled placement test, or `null` when it has none. Needs
   * `READ_CAMPAIGNS`.
   *
   * @example
   * const monitor = await warmbly.campaigns.getPlacementMonitor("camp_1");
   */
  getPlacementMonitor(id: string, opts?: RequestOptions): Promise<CampaignPlacementMonitor | null> {
    return this.http
      .get<{ data: CampaignPlacementMonitor | null }>(
        this.path("campaigns", id, "placement-monitor"),
        opts,
      )
      .then((r) => r.data ?? null);
  }

  /**
   * Creates or updates the campaign's scheduled placement test. A new or re-enabled
   * monitor runs its first test within minutes. The same body always lands on the same
   * state, so retries are safe. Needs `SEND_CAMPAIGNS`.
   *
   * @example
   * const monitor = await warmbly.campaigns.putPlacementMonitor("camp_1", {
   *   interval_days: 7,
   *   alert_below: 80,
   *   pause_on_alert: true,
   * });
   */
  putPlacementMonitor(
    id: string,
    params: PutPlacementMonitorParams = {},
  ): Promise<CampaignPlacementMonitor> {
    return this.http
      .put<{ data: CampaignPlacementMonitor }>(this.path("campaigns", id, "placement-monitor"), {
        body: params,
      })
      .then((r) => r.data);
  }

  /**
   * Removes the campaign's scheduled placement test. A 404 when it has none. Needs
   * `SEND_CAMPAIGNS`.
   *
   * @example
   * await warmbly.campaigns.deletePlacementMonitor("camp_1");
   */
  deletePlacementMonitor(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("campaigns", id, "placement-monitor"), opts);
  }
}
