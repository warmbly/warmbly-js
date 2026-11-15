import type { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Which CRM a workspace runs on. Unknown providers pass through. */
export type CrmProviderName = "native" | "hubspot" | "pipedrive" | (string & {});

/** Where a CRM record lives outside Warmbly. Present on records mirrored from a connected CRM. */
export interface CrmExternalRef {
  provider: CrmProviderName;
  external_id: string;
  url?: string;
  synced_at: string;
  /** The provider owner, when that owner is not a workspace member. */
  owner_name?: string;
  [key: string]: unknown;
}

/** A stage within a CRM pipeline. */
export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  /** A color string such as `#8b5cf6`. */
  color: string;
  position: number;
  /** Deals in the stage; omitted when zero. */
  deal_count?: number;
  created_at: string;
  updated_at: string;
  /** From a connected CRM's stage metadata; omitted when false. */
  closed?: boolean;
  won?: boolean;
  probability?: number;
  [key: string]: unknown;
}

/** A CRM pipeline. */
export interface Pipeline {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  /** Omitted when the pipeline has no stages. */
  stages?: PipelineStage[];
  created_at: string;
  updated_at: string;
  /** Set when the pipeline is managed in a connected CRM. */
  external?: CrmExternalRef;
  [key: string]: unknown;
}

/** A stage in the body of {@link Crm.createPipeline}. Both fields are required. */
export interface CreatePipelineStageParams {
  name: string;
  color: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.createPipeline}. */
export interface CreatePipelineParams {
  /** 1 to 255 characters. */
  name: string;
  stages?: CreatePipelineStageParams[];
  [key: string]: unknown;
}

/** Body for {@link Crm.updatePipeline}. */
export interface UpdatePipelineParams {
  name?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.createStage}. The server requires both fields. */
export interface CreateStageParams {
  name: string;
  color: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateStage}. The server binds only `name` and `color` (not `position`). */
export interface UpdateStageParams {
  name?: string;
  color?: string;
  [key: string]: unknown;
}

/** A deal's lifecycle status. Unknown values pass through. */
export type DealStatus = "open" | "won" | "lost" | (string & {});

/** A CRM deal. */
export interface Deal {
  id: string;
  organization_id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id?: string;
  name: string;
  value?: number;
  currency: string;
  status: DealStatus;
  expected_close_date?: string;
  won_at?: string;
  lost_at?: string;
  lost_reason?: string;
  /** The owning workspace member's user id. */
  assigned_to?: string;
  /** The campaign that produced the reply this deal came from (best guess). */
  campaign_id?: string;
  source_mailbox_id?: string;
  created_at: string;
  updated_at: string;
  /** Joined by list and search queries, not by single-row reads. */
  contact?: Record<string, unknown>;
  stage?: PipelineStage;
  campaign_name?: string;
  /** Set when the deal lives in a connected CRM. */
  external?: CrmExternalRef;
  [key: string]: unknown;
}

/** Query for {@link Crm.listDeals}. */
export interface ListDealsParams {
  pipeline_id?: string;
  stage_id?: string;
  /** `open`, `won`, or `lost`. */
  status?: DealStatus;
  /** Page size, 1 to 100 (default 50). */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.createDeal}. */
export interface CreateDealParams {
  pipeline_id: string;
  stage_id: string;
  /** 1 to 255 characters. */
  name: string;
  contact_id?: string;
  value?: number;
  currency?: string;
  /** RFC 3339 timestamp. */
  expected_close_date?: string;
  assigned_to?: string;
  campaign_id?: string;
  source_mailbox_id?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateDeal}. Every field is optional. */
export interface UpdateDealParams {
  stage_id?: string;
  contact_id?: string;
  name?: string;
  value?: number;
  currency?: string;
  /** `open`, `won`, or `lost`. */
  status?: DealStatus;
  expected_close_date?: string;
  lost_reason?: string;
  assigned_to?: string;
  [key: string]: unknown;
}

/** Faceted filter body for {@link Crm.searchDeals} and {@link Crm.dealsSummary}. Every facet is optional. */
export interface SearchDealsFilters {
  /** Matches the deal name. */
  query?: string;
  /** Any of `open`, `won`, `lost`. */
  statuses?: DealStatus[];
  pipeline_ids?: string[];
  stage_ids?: string[];
  /** Owner user ids. */
  assigned_to?: string[];
  campaign_ids?: string[];
  min_value?: number;
  max_value?: number;
  /** RFC 3339 timestamps. */
  close_after?: string;
  close_before?: string;
  created_after?: string;
  created_before?: string;
  /** `created_at`, `updated_at`, `value`, `expected_close_date`, or `name`. */
  sort_by?: string;
  /** `true` sorts ascending; the default is descending. */
  reverse?: boolean;
  [key: string]: unknown;
}

/** Paging query for the POST search routes. */
export interface SearchPageParams {
  /** Page size, 1 to 200 (default 50). */
  limit?: number;
  /** The opaque `next_cursor` of the previous page. */
  cursor?: string;
}

/** Per-stage totals in {@link DealsSummary}. */
export interface DealStageSummary {
  stage_id: string;
  count: number;
  value: number;
  [key: string]: unknown;
}

/** Server-side aggregates over the deals matching a filter. */
export interface DealsSummary {
  total: number;
  open_count: number;
  open_value: number;
  won_count: number;
  won_value: number;
  lost_count: number;
  lost_value: number;
  currency: string;
  stages: DealStageSummary[];
  /** True when matching deals span currencies, so the sums are not comparable. */
  mixed_currency: boolean;
  [key: string]: unknown;
}

/** A user-managed CRM task type (for example Call, Email, Meeting). */
export interface CrmTaskType {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.createTaskType}. */
export interface CreateTaskTypeParams {
  /** 1 to 60 characters. */
  name: string;
  color?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateTaskType}. */
export interface UpdateTaskTypeParams {
  name?: string;
  color?: string;
  position?: number;
  [key: string]: unknown;
}

/** A task's priority. Unknown values pass through. */
export type CrmTaskPriority = "low" | "medium" | "high" | "urgent" | (string & {});

/** A task's status. Unknown values pass through. */
export type CrmTaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | (string & {});

/** A CRM task. */
export interface CrmTask {
  id: string;
  organization_id: string;
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  assigned_team_id?: string;
  created_by: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: CrmTaskPriority;
  /** The task type's NAME (tasks reference a type by name, not id). */
  type: string;
  status: CrmTaskStatus;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  /** Set when the task lives in a connected CRM. */
  external?: CrmExternalRef;
  [key: string]: unknown;
}

/** Query for {@link Crm.listTasks}. */
export interface ListTasksParams {
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  status?: CrmTaskStatus;
  /** Page size, 1 to 100 (default 50). */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.createTask}. */
export interface CreateTaskParams {
  /** 1 to 255 characters. */
  title: string;
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  assigned_team_id?: string;
  description?: string;
  /** RFC 3339 timestamp. */
  due_date?: string;
  priority?: CrmTaskPriority;
  /** A task type name. */
  type?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateTask}. Every field is optional. */
export interface UpdateTaskParams {
  assigned_to?: string;
  assigned_team_id?: string;
  title?: string;
  description?: string;
  due_date?: string;
  priority?: CrmTaskPriority;
  type?: string;
  status?: CrmTaskStatus;
  [key: string]: unknown;
}

/** Faceted filter body for {@link Crm.searchTasks} and {@link Crm.tasksSummary}. Every facet is optional. */
export interface SearchTasksFilters {
  /** Matches the task title. */
  query?: string;
  statuses?: CrmTaskStatus[];
  priorities?: CrmTaskPriority[];
  /** Task type names. */
  types?: string[];
  /** Assignee user ids. */
  assigned_to?: string[];
  /** Matches the task's team, or an assignee who is a member of the team. */
  team_ids?: string[];
  contact_id?: string;
  deal_id?: string;
  /** RFC 3339 timestamps. */
  due_after?: string;
  due_before?: string;
  /** Only tasks past due and not completed or cancelled. */
  overdue?: boolean;
  /** `created_at`, `due_date`, `priority`, `title`, or `updated_at`. */
  sort_by?: string;
  /** `true` sorts ascending; the default is descending. */
  reverse?: boolean;
  [key: string]: unknown;
}

/** Server-side counts over the tasks matching a filter. */
export interface TasksSummary {
  total: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  cancelled_count: number;
  overdue_count: number;
  high_priority_count: number;
  [key: string]: unknown;
}

/**
 * Which tasks a bulk action applies to: an explicit id list, or (with `all`) every task
 * matching `filters` minus `exclude`. When both are given the server prefers the filter.
 * A selection over 50,000 tasks is refused.
 */
export interface TaskSelection {
  /** Task ids. */
  tasks?: string[];
  /** Switches the selection from `tasks` to `filters`. */
  all?: boolean;
  /** The same body {@link Crm.searchTasks} takes. */
  filters?: SearchTasksFilters;
  /** Ids to drop from the resolved set. Ignored unless `all` is set. */
  exclude?: string[];
  [key: string]: unknown;
}

/** Body for {@link Crm.bulkUpdateTasks}: a selection plus at least one of `status` or `priority`. */
export interface BulkUpdateTasksParams extends TaskSelection {
  status?: CrmTaskStatus;
  priority?: CrmTaskPriority;
}

/** How many tasks a bulk action touched. */
export interface BulkTasksResult {
  affected: number;
  [key: string]: unknown;
}

// --- Connected CRM (HubSpot / Pipedrive) ---

/** Which Warmbly activity is written to the provider timeline. */
export interface CrmActivityLog {
  sent: boolean;
  replies: boolean;
  bounces: boolean;
  unsubscribes: boolean;
  opens: boolean;
  clicks: boolean;
  meetings: boolean;
  [key: string]: unknown;
}

/** What a positive reply does in the provider. */
export interface CrmReplyOutcome {
  /** Written to the contact's lead status; empty leaves it alone. */
  lead_status: string;
  /** Written to the contact's lifecycle stage; empty leaves it alone. */
  lifecycle_stage: string;
  create_deal: boolean;
  /** Pipedrive only: add the person to the Leads Inbox. */
  create_lead?: boolean;
  /** Local (mirrored) ids. Required when `create_deal` is set. */
  deal_pipeline_id?: string;
  deal_stage_id?: string;
  [key: string]: unknown;
}

/** Rules that stop a contact's campaigns when the provider says they moved on. */
export interface CrmExitRules {
  deal_created: boolean;
  lifecycle_stages: string[];
  opted_out: boolean;
  [key: string]: unknown;
}

/** Contacts skipped at import and enrolment time. */
export interface CrmEnrollmentGuards {
  skip_lifecycle_stages: string[];
  skip_open_deals: boolean;
  skip_other_owners: boolean;
  skip_opted_out: boolean;
  [key: string]: unknown;
}

/** Every choice of the CRM setup wizard. */
export interface CrmProviderConfig {
  activity: CrmActivityLog;
  create_contacts: boolean;
  create_companies: boolean;
  write_properties: boolean;
  positive_reply: CrmReplyOutcome;
  exit_rules: CrmExitRules;
  guards: CrmEnrollmentGuards;
  /** Limits mirrored deals to these provider pipeline ids; empty means every pipeline. */
  deal_pipelines: string[];
  display_properties: string[];
  /** Warmbly contact field (`first_name`, `company`, `custom:x`) to provider property. */
  field_map: Record<string, string>;
  /** Per mapped field: `push`, `pull`, or `both`. */
  field_direction: Record<string, "push" | "pull" | "both" | (string & {})>;
  /** The provider these choices were made for. */
  for?: CrmProviderName;
  [key: string]: unknown;
}

/** The connected provider account. */
export interface CrmAccount {
  external_id: string;
  name: string;
  /** The provider's web app root, for "open in" links. */
  app_url: string;
  status: string;
  health: string;
  /** Permissions the connection lacks for full mode. */
  missing_scopes?: string[];
  [key: string]: unknown;
}

/** The workspace's CRM mode, as returned by {@link Crm.getSettings} and {@link Crm.updateSettings}. */
export interface CrmSettings {
  organization_id: string;
  provider: CrmProviderName;
  connection_id?: string;
  config: CrmProviderConfig;
  setup_completed_at?: string;
  updated_at: string;
  account?: CrmAccount;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateSettings}. Every field is optional. */
export interface UpdateCrmSettingsParams {
  provider?: CrmProviderName;
  connection_id?: string;
  config?: CrmProviderConfig;
  /** Stamps the setup wizard as finished. */
  complete_setup?: boolean;
  [key: string]: unknown;
}

/** A provider enum value with its label. */
export interface CrmOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

/** A provider contact property a field can map to. */
export interface CrmProperty {
  name: string;
  label: string;
  type: string;
  group_name: string;
  read_only: boolean;
  [key: string]: unknown;
}

/** The provider vocabulary the pickers render. */
export interface CrmMetadata {
  lifecycle_stages: CrmOption[];
  lead_statuses: CrmOption[];
  task_types: CrmOption[];
  properties: CrmProperty[];
  pipelines: CrmOption[];
  [key: string]: unknown;
}

/** A provider user who can own records. */
export interface CrmOwner {
  external_id: string;
  email: string;
  first_name: string;
  last_name: string;
  /** The workspace member this owner is matched to. */
  user_id?: string;
  /** True when the match was set by hand rather than by email. */
  user_pinned: boolean;
  archived: boolean;
  [key: string]: unknown;
}

/** A provider company reference. */
export interface CrmCompanyRef {
  external_id: string;
  name: string;
  domain?: string;
  url?: string;
  [key: string]: unknown;
}

/** One displayed provider property, labelled. */
export interface CrmPropertyView {
  name: string;
  label: string;
  value: string;
  [key: string]: unknown;
}

/** The provider side of a contact. */
export interface CrmContactView {
  provider: CrmProviderName;
  linked: boolean;
  external_id?: string;
  url?: string;
  owner?: CrmOwner;
  lifecycle_stage?: CrmOption;
  lead_status?: CrmOption;
  company?: CrmCompanyRef;
  opted_out: boolean;
  properties: CrmPropertyView[];
  synced_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateContact}. Each value is at most 100 characters. */
export interface UpdateCrmContactParams {
  /** The provider owner id. */
  owner_external_id?: string;
  lifecycle_stage?: string;
  lead_status?: string;
  [key: string]: unknown;
}

/** A provider contact list Warmbly can import from. */
export interface CrmList {
  external_id: string;
  name: string;
  size: number;
  dynamic: boolean;
  updated_at?: string;
  [key: string]: unknown;
}

/** Query for {@link Crm.listLists}. */
export interface ListCrmListsParams {
  /** Page size, 1 to 100 (default 25). */
  limit?: number;
  cursor?: string;
  /** Name search, at most 200 characters. */
  q?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.previewListImport} and {@link Crm.importList}. */
export interface CrmImportParams {
  /** The provider list id, at most 64 characters. */
  list_id: string;
  /** Drops contacts the workspace's enrolment guards exclude. */
  apply_guards?: boolean;
  [key: string]: unknown;
}

/** One skip reason and how many contacts it removed. */
export interface CrmImportSkip {
  reason: string;
  label: string;
  count: number;
  [key: string]: unknown;
}

/** A sample row of an import preview. */
export interface CrmImportPerson {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  [key: string]: unknown;
}

/** Who a list import would bring in and who it skips. */
export interface CrmImportPreview {
  list_name: string;
  total: number;
  included: number;
  skipped: CrmImportSkip[];
  sample: CrmImportPerson[];
  /** True when the list is larger than one import takes. */
  truncated: boolean;
  [key: string]: unknown;
}

/** The contact import draft a list import produced. */
export interface CrmImportResult {
  import_id: string;
  preview: CrmImportPreview;
  [key: string]: unknown;
}

/** Counts of Warmbly-only records a backfill would copy. */
export interface CrmBackfillPreview {
  deals: number;
  tasks: number;
  notes: number;
  [key: string]: unknown;
}

/** Body for {@link Crm.startBackfill}. */
export interface CrmBackfillParams {
  deals?: boolean;
  tasks?: boolean;
  notes?: boolean;
  [key: string]: unknown;
}

/** One sync job. */
export interface CrmSyncJob {
  id: string;
  organization_id: string;
  provider: CrmProviderName;
  kind: string;
  subject: string;
  status: string;
  attempts: number;
  next_attempt_at: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  finished_at?: string;
  [key: string]: unknown;
}

/** One incremental pull. */
export interface CrmSyncCursor {
  object_type: string;
  cursor_at?: string;
  last_run_at?: string;
  last_error?: string;
  [key: string]: unknown;
}

/** How much provider data the workspace mirrors. */
export interface CrmMirrorCounts {
  contacts: number;
  deals: number;
  tasks: number;
  pipelines: number;
  owners: number;
  [key: string]: unknown;
}

/** The sync health panel. */
export interface CrmSyncHealth {
  pending: number;
  failed: number;
  done_24h: number;
  last_synced_at?: string;
  cursors: CrmSyncCursor[];
  failures: CrmSyncJob[];
  counts: CrmMirrorCounts;
  [key: string]: unknown;
}

/** Body for {@link Crm.retrySyncFailures} and {@link Crm.discardSyncFailures}. */
export interface CrmSyncJobSelection {
  /** Up to 500 job ids. Omit to act on every failed job. */
  ids?: string[];
}

/** How many sync jobs were affected. */
export interface CrmSyncAffected {
  affected: number;
  [key: string]: unknown;
}

/**
 * The CRM: pipelines and stages, deals, task types, tasks, and the connected-CRM
 * (HubSpot / Pipedrive) settings, sync, owners, and list imports. Reachable as `warmbly.crm`.
 *
 * @example
 * const pipeline = await warmbly.crm.createPipeline({ name: "Sales" });
 * const deal = await warmbly.crm.createDeal({
 *   pipeline_id: pipeline.id,
 *   stage_id: pipeline.stages![0].id,
 *   name: "Acme",
 *   value: 5000,
 * });
 */
export class Crm extends APIResource {
  // --- Pipelines ---

  /**
   * Lists pipelines with their stages. The server returns every pipeline as a bare array.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const pipelines = await warmbly.crm.listPipelines();
   */
  listPipelines(opts?: RequestOptions): Promise<Pipeline[]> {
    return this.http.get<Pipeline[]>("crm/pipelines", opts);
  }

  /**
   * Creates a pipeline, optionally with its stages.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.createPipeline({ name: "Sales", stages: [{ name: "New", color: "#0ea5e9" }] });
   */
  createPipeline(params: CreatePipelineParams, opts?: RequestOptions): Promise<Pipeline> {
    return this.http.post<Pipeline>("crm/pipelines", { ...opts, body: params });
  }

  /**
   * Retrieves a pipeline by id.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const p = await warmbly.crm.getPipeline("pl_1");
   */
  getPipeline(id: string, opts?: RequestOptions): Promise<Pipeline> {
    return this.http.get<Pipeline>(this.path("crm", "pipelines", id), opts);
  }

  /**
   * Renames a pipeline.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.updatePipeline("pl_1", { name: "Renamed" });
   */
  updatePipeline(
    id: string,
    params: UpdatePipelineParams,
    opts?: RequestOptions,
  ): Promise<Pipeline> {
    return this.http.patch<Pipeline>(this.path("crm", "pipelines", id), {
      ...opts,
      body: params,
    });
  }

  /**
   * Deletes a pipeline. The server answers 204.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.deletePipeline("pl_1");
   */
  deletePipeline(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "pipelines", id), opts);
  }

  /**
   * Adds a stage to a pipeline. Both `name` and `color` are required.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.createStage("pl_1", { name: "Qualified", color: "#f59e0b" });
   */
  createStage(
    pipelineId: string,
    params: CreateStageParams,
    opts?: RequestOptions,
  ): Promise<PipelineStage> {
    return this.http.post<PipelineStage>(this.path("crm", "pipelines", pipelineId, "stages"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Updates a pipeline stage's `name` or `color`. The server ignores any other key.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.updateStage("pl_1", "st_1", { color: "#10b981" });
   */
  updateStage(
    pipelineId: string,
    stageId: string,
    params: UpdateStageParams,
    opts?: RequestOptions,
  ): Promise<PipelineStage> {
    return this.http.patch<PipelineStage>(
      this.path("crm", "pipelines", pipelineId, "stages", stageId),
      { ...opts, body: params },
    );
  }

  /**
   * Deletes a pipeline stage. The server answers 204.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.deleteStage("pl_1", "st_1");
   */
  deleteStage(pipelineId: string, stageId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(
      this.path("crm", "pipelines", pipelineId, "stages", stageId),
      opts,
    );
  }

  // --- Deals ---

  /**
   * Lists deals, newest first, one cursor page at a time. Iterate the page to walk them all.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * for await (const deal of await warmbly.crm.listDeals({ status: "open" })) console.log(deal.name);
   */
  listDeals(params?: ListDealsParams, opts?: RequestOptions): Promise<Page<Deal>> {
    return this.http.getPage<Deal>("crm/deals", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Creates a deal. `pipeline_id`, `stage_id`, and `name` are required.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.createDeal({ pipeline_id: "pl_1", stage_id: "st_1", name: "Acme", value: 1000 });
   */
  createDeal(params: CreateDealParams, opts?: RequestOptions): Promise<Deal> {
    return this.http.post<Deal>("crm/deals", { ...opts, body: params });
  }

  /**
   * Searches deals with the faceted filter body. Returns the `{ data, pagination }` envelope;
   * pass `page.cursor` from the previous `pagination.next_cursor` to continue.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const res = await warmbly.crm.searchDeals({ query: "acme", statuses: ["open"] }, { limit: 50 });
   */
  searchDeals(
    filters: SearchDealsFilters = {},
    page?: SearchPageParams,
    opts?: RequestOptions,
  ): Promise<ListResponse<Deal>> {
    return this.http.post<ListResponse<Deal>>("crm/deals/search", {
      ...opts,
      query: { ...opts?.query, ...page },
      body: filters,
    });
  }

  /**
   * Returns server-side totals over the deals matching a filter (the same body as search).
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const summary = await warmbly.crm.dealsSummary({ pipeline_ids: ["pl_1"] });
   */
  dealsSummary(filters: SearchDealsFilters = {}, opts?: RequestOptions): Promise<DealsSummary> {
    return this.http.post<DealsSummary>("crm/deals/summary", {
      ...opts,
      body: filters,
    });
  }

  /**
   * Retrieves a deal by id.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const deal = await warmbly.crm.getDeal("dl_1");
   */
  getDeal(id: string, opts?: RequestOptions): Promise<Deal> {
    return this.http.get<Deal>(this.path("crm", "deals", id), opts);
  }

  /**
   * Updates a deal.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.updateDeal("dl_1", { stage_id: "st_2", status: "won" });
   */
  updateDeal(id: string, params: UpdateDealParams, opts?: RequestOptions): Promise<Deal> {
    return this.http.patch<Deal>(this.path("crm", "deals", id), {
      ...opts,
      body: params,
    });
  }

  /**
   * Deletes a deal. The server answers 204.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.deleteDeal("dl_1");
   */
  deleteDeal(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "deals", id), opts);
  }

  // --- Task types ---

  /**
   * Lists CRM task types. The server wraps them as `{ data }`; this returns the array.
   * An organization's first listing seeds Call, Email, and Meeting.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const types = await warmbly.crm.listTaskTypes();
   */
  async listTaskTypes(opts?: RequestOptions): Promise<CrmTaskType[]> {
    const res = await this.http.get<{ data: CrmTaskType[] }>("crm/task-types", opts);
    return res.data;
  }

  /**
   * Creates a CRM task type.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.createTaskType({ name: "Call", color: "#8b5cf6" });
   */
  createTaskType(params: CreateTaskTypeParams, opts?: RequestOptions): Promise<CrmTaskType> {
    return this.http.post<CrmTaskType>("crm/task-types", {
      ...opts,
      body: params,
    });
  }

  /**
   * Updates a CRM task type.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.updateTaskType("tt_1", { name: "Phone call" });
   */
  updateTaskType(
    id: string,
    params: UpdateTaskTypeParams,
    opts?: RequestOptions,
  ): Promise<CrmTaskType> {
    return this.http.patch<CrmTaskType>(this.path("crm", "task-types", id), {
      ...opts,
      body: params,
    });
  }

  /**
   * Deletes a CRM task type. Existing tasks keep its name. The server answers 204.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.deleteTaskType("tt_1");
   */
  deleteTaskType(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "task-types", id), opts);
  }

  // --- Tasks ---

  /**
   * Lists CRM tasks one cursor page at a time. Iterate the page to walk them all.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const page = await warmbly.crm.listTasks({ status: "pending" });
   */
  listTasks(params?: ListTasksParams, opts?: RequestOptions): Promise<Page<CrmTask>> {
    return this.http.getPage<CrmTask>("crm/tasks", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Creates a CRM task. Only `title` is required.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.createTask({ title: "Follow up", contact_id: "c_1", type: "Call" });
   */
  createTask(params: CreateTaskParams, opts?: RequestOptions): Promise<CrmTask> {
    return this.http.post<CrmTask>("crm/tasks", { ...opts, body: params });
  }

  /**
   * Searches CRM tasks with the faceted filter body. Returns the `{ data, pagination }` envelope.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const res = await warmbly.crm.searchTasks({ statuses: ["pending"], overdue: true });
   */
  searchTasks(
    filters: SearchTasksFilters = {},
    page?: SearchPageParams,
    opts?: RequestOptions,
  ): Promise<ListResponse<CrmTask>> {
    return this.http.post<ListResponse<CrmTask>>("crm/tasks/search", {
      ...opts,
      query: { ...opts?.query, ...page },
      body: filters,
    });
  }

  /**
   * Returns server-side counts over the tasks matching a filter (the same body as search).
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const summary = await warmbly.crm.tasksSummary({ assigned_to: ["u_1"] });
   */
  tasksSummary(filters: SearchTasksFilters = {}, opts?: RequestOptions): Promise<TasksSummary> {
    return this.http.post<TasksSummary>("crm/tasks/summary", {
      ...opts,
      body: filters,
    });
  }

  /**
   * Writes one `status` and/or `priority` onto a whole selection of tasks.
   * Answers with the number of tasks touched.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.bulkUpdateTasks({ tasks: ["tk_1", "tk_2"], status: "completed" });
   */
  bulkUpdateTasks(params: BulkUpdateTasksParams, opts?: RequestOptions): Promise<BulkTasksResult> {
    return this.http.patch<BulkTasksResult>("crm/tasks", {
      ...opts,
      body: params,
    });
  }

  /**
   * Deletes a whole selection of tasks. Pass a bare array of task ids, or a selection object
   * (`{ all: true, filters, exclude }`). Answers with the number of tasks deleted.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.bulkDeleteTasks(["tk_1", "tk_2"]);
   */
  bulkDeleteTasks(
    selection: string[] | TaskSelection,
    opts?: RequestOptions,
  ): Promise<BulkTasksResult> {
    return this.http.delete<BulkTasksResult>("crm/tasks", {
      ...opts,
      body: selection,
    });
  }

  /**
   * Retrieves a CRM task by id.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const task = await warmbly.crm.getTask("tk_1");
   */
  getTask(id: string, opts?: RequestOptions): Promise<CrmTask> {
    return this.http.get<CrmTask>(this.path("crm", "tasks", id), opts);
  }

  /**
   * Updates a CRM task. Complete one with `{ status: "completed" }`.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.updateTask("tk_1", { status: "completed" });
   */
  updateTask(id: string, params: UpdateTaskParams, opts?: RequestOptions): Promise<CrmTask> {
    return this.http.patch<CrmTask>(this.path("crm", "tasks", id), {
      ...opts,
      body: params,
    });
  }

  /**
   * Deletes a CRM task. The server answers 204.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.deleteTask("tk_1");
   */
  deleteTask(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "tasks", id), opts);
  }

  // --- Connected CRM: settings, metadata, owners ---

  /**
   * Returns the workspace's CRM mode (Warmbly's own, HubSpot, or Pipedrive) and setup choices.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const settings = await warmbly.crm.getSettings();
   */
  getSettings(opts?: RequestOptions): Promise<CrmSettings> {
    return this.http.get<CrmSettings>("crm/settings", opts);
  }

  /**
   * Switches the CRM and stores the setup choices.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * await warmbly.crm.updateSettings({ provider: "hubspot", complete_setup: true });
   */
  updateSettings(params: UpdateCrmSettingsParams, opts?: RequestOptions): Promise<CrmSettings> {
    return this.http.put<CrmSettings>("crm/settings", {
      ...opts,
      body: params,
    });
  }

  /**
   * Returns the provider's lifecycle stages, lead statuses, task types, properties, and pipelines.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const meta = await warmbly.crm.getMetadata();
   */
  getMetadata(opts?: RequestOptions): Promise<CrmMetadata> {
    return this.http.get<CrmMetadata>("crm/metadata", opts);
  }

  /**
   * Lists the provider's owners and the workspace member each one is matched to.
   * The server wraps them as `{ data }`; this returns the array.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const owners = await warmbly.crm.listOwners();
   */
  async listOwners(opts?: RequestOptions): Promise<CrmOwner[]> {
    const res = await this.http.get<{ data: CrmOwner[] }>("crm/owners", opts);
    return res.data;
  }

  /**
   * Pins a provider owner to a workspace member, or clears the match with `userId: null`.
   * The server answers 204.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * await warmbly.crm.mapOwner("12345", "usr_1");
   */
  mapOwner(externalId: string, userId: string | null, opts?: RequestOptions): Promise<void> {
    return this.http.put<void>(this.path("crm", "owners", externalId), {
      ...opts,
      body: { user_id: userId },
    });
  }

  // --- Connected CRM: sync and backfill ---

  /**
   * Reports pending and failed sync jobs, freshness, and mirror counts.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const health = await warmbly.crm.getSyncHealth();
   */
  getSyncHealth(opts?: RequestOptions): Promise<CrmSyncHealth> {
    return this.http.get<CrmSyncHealth>("crm/sync", opts);
  }

  /**
   * Starts a full pull from the provider. The server answers 202 with no body.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * await warmbly.crm.syncNow();
   */
  syncNow(opts?: RequestOptions): Promise<void> {
    return this.http.post<void>("crm/sync", opts);
  }

  /**
   * Requeues failed sync jobs: the ids given, or every failed job when omitted.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * const { affected } = await warmbly.crm.retrySyncFailures();
   */
  retrySyncFailures(
    selection: CrmSyncJobSelection = {},
    opts?: RequestOptions,
  ): Promise<CrmSyncAffected> {
    return this.http.post<CrmSyncAffected>("crm/sync/retry", {
      ...opts,
      body: selection,
    });
  }

  /**
   * Drops failed sync jobs: the ids given, or every failed job when omitted.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * const { affected } = await warmbly.crm.discardSyncFailures({ ids: ["job_1"] });
   */
  discardSyncFailures(
    selection: CrmSyncJobSelection = {},
    opts?: RequestOptions,
  ): Promise<CrmSyncAffected> {
    return this.http.post<CrmSyncAffected>("crm/sync/discard", {
      ...opts,
      body: selection,
    });
  }

  /**
   * Counts the Warmbly-only deals, tasks, and notes a switch to a connected CRM would copy.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * const preview = await warmbly.crm.getBackfill();
   */
  getBackfill(opts?: RequestOptions): Promise<CrmBackfillPreview> {
    return this.http.get<CrmBackfillPreview>("crm/backfill", opts);
  }

  /**
   * Copies Warmbly's own deals, tasks, and notes into the connected CRM once. Idempotent on the
   * server. The server answers 202 with no body.
   *
   * Needs the `INTEGRATIONS` permission.
   * @example
   * await warmbly.crm.startBackfill({ deals: true, tasks: true, notes: false });
   */
  startBackfill(params: CrmBackfillParams, opts?: RequestOptions): Promise<void> {
    return this.http.post<void>("crm/backfill", { ...opts, body: params });
  }

  // --- Connected CRM: contacts ---

  /**
   * Returns the provider side of a contact: owner, lifecycle stage, lead status, company,
   * and chosen properties.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const view = await warmbly.crm.getContact("c_1");
   */
  getContact(contactId: string, opts?: RequestOptions): Promise<CrmContactView> {
    return this.http.get<CrmContactView>(this.path("crm", "contacts", contactId), opts);
  }

  /**
   * Edits a contact's provider owner, lifecycle stage, or lead status in place.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * await warmbly.crm.updateContact("c_1", { lead_status: "IN_PROGRESS" });
   */
  updateContact(
    contactId: string,
    params: UpdateCrmContactParams,
    opts?: RequestOptions,
  ): Promise<CrmContactView> {
    return this.http.patch<CrmContactView>(this.path("crm", "contacts", contactId), {
      ...opts,
      body: params,
    });
  }

  /**
   * Finds or creates the contact in the connected CRM.
   *
   * Needs the `WRITE_CRM` permission.
   * @example
   * const view = await warmbly.crm.linkContact("c_1");
   */
  linkContact(contactId: string, opts?: RequestOptions): Promise<CrmContactView> {
    return this.http.post<CrmContactView>(this.path("crm", "contacts", contactId, "link"), opts);
  }

  /**
   * Pulls a contact's provider record, deals, tasks, and notes now. Debounced per contact on
   * the server.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const view = await warmbly.crm.refreshContact("c_1");
   */
  refreshContact(contactId: string, opts?: RequestOptions): Promise<CrmContactView> {
    return this.http.post<CrmContactView>(this.path("crm", "contacts", contactId, "refresh"), opts);
  }

  // --- Connected CRM: list import ---

  /**
   * Lists the provider's contact lists available for import, one cursor page at a time.
   *
   * Needs the `READ_CRM` permission.
   * @example
   * const page = await warmbly.crm.listLists({ q: "customers" });
   */
  listLists(params?: ListCrmListsParams, opts?: RequestOptions): Promise<Page<CrmList>> {
    return this.http.getPage<CrmList>("crm/lists", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Counts who importing a provider list would bring in and who it would skip.
   *
   * Needs the `WRITE_CONTACTS` permission.
   * @example
   * const preview = await warmbly.crm.previewListImport({ list_id: "42", apply_guards: true });
   */
  previewListImport(params: CrmImportParams, opts?: RequestOptions): Promise<CrmImportPreview> {
    return this.http.post<CrmImportPreview>("crm/lists/preview", {
      ...opts,
      body: params,
    });
  }

  /**
   * Turns a provider list into a contact import draft (the server answers 201), finished in
   * the regular import review.
   *
   * Needs the `WRITE_CONTACTS` permission.
   * @example
   * const { import_id } = await warmbly.crm.importList({ list_id: "42" });
   */
  importList(params: CrmImportParams, opts?: RequestOptions): Promise<CrmImportResult> {
    return this.http.post<CrmImportResult>("crm/lists/import", {
      ...opts,
      body: params,
    });
  }
}
