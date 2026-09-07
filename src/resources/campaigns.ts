import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Whether a campaign is a multi-step sequence or a single one-time email. */
export type CampaignKind = "sequence" | "one_time";

/** A Warmbly campaign. Shape is documented-but-open. */
export interface Campaign {
  id: string;
  name?: string;
  status?: string;
  kind?: CampaignKind;
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
  /** `sequence` (default) or `one_time`. Fixed at creation. */
  kind?: CampaignKind;
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
   * Adds a step to a campaign sequence. The endpoint creates a new empty step for the
   * campaign and returns it; edit its content afterwards with {@link Campaigns.updateStep}.
   * @example
   * const step = await warmbly.campaigns.createStep("camp_1");
   * await warmbly.campaigns.updateStep("camp_1", step.id, { subject: "Follow up" });
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
}
