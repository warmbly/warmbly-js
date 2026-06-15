import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A Warmbly campaign. Shape is documented-but-open. */
export interface Campaign {
  id: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** A single step in a campaign sequence. */
export interface CampaignStep {
  id: string;
  campaign_id?: string;
  subject?: string;
  body?: string;
  delay_days?: number;
  position?: number;
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
  [key: string]: unknown;
}

/** A campaign log entry. */
export interface CampaignLog {
  [key: string]: unknown;
}

/** Body for creating a campaign. Open shape. */
export interface CreateCampaignParams {
  name?: string;
  [key: string]: unknown;
}

/** Body for updating a campaign. Open shape. */
export interface UpdateCampaignParams {
  [key: string]: unknown;
}

/** Query params for listing campaigns. */
export interface ListCampaignsParams {
  cursor?: string;
  limit?: number;
  status?: string;
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
   * Creates a campaign.
   * @example
   * const c = await warmbly.campaigns.create({ name: "Q3 outreach" });
   */
  create(params: CreateCampaignParams): Promise<Campaign> {
    return this.http.post<Campaign>("campaigns", { body: params });
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
   * Starts a campaign.
   * @example
   * await warmbly.campaigns.start("camp_1");
   */
  start(id: string, opts?: RequestOptions): Promise<Campaign> {
    return this.http.post<Campaign>(this.path("campaigns", id, "start"), opts);
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
   * Adds an attachment to a campaign.
   * @example
   * await warmbly.campaigns.createAttachment("camp_1", { file_id: "f_1" });
   */
  createAttachment(id: string, params: Record<string, unknown>): Promise<CampaignAttachment> {
    return this.http.post<CampaignAttachment>(this.path("campaigns", id, "attachments"), {
      body: params,
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
   * Adds a step to a campaign sequence.
   * @example
   * await warmbly.campaigns.createStep("camp_1", { subject: "Follow up" });
   */
  createStep(id: string, params: Record<string, unknown>): Promise<CampaignStep> {
    return this.http.post<CampaignStep>(this.path("campaigns", id, "steps"), { body: params });
  }

  /**
   * Updates a campaign step.
   * @example
   * await warmbly.campaigns.updateStep("camp_1", "step_1", { delay_days: 3 });
   */
  updateStep(id: string, stepId: string, params: Record<string, unknown>): Promise<CampaignStep> {
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
}
