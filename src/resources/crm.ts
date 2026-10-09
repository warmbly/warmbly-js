import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** The system of record for a workspace's CRM: Warmbly's own, or a connected one. */
export type CrmProvider = "native" | "hubspot" | "pipedrive" | (string & {});

/** Where a CRM record lives outside Warmbly, on deals, tasks, notes and pipelines read in provider mode. */
export interface CrmExternalRef {
  provider: CrmProvider;
  external_id: string;
  url?: string;
  synced_at: string;
  /** The provider owner, when that owner is not a workspace member. */
  owner_name?: string;
  [key: string]: unknown;
}

/** A CRM pipeline. Documented-but-open shape. */
export interface Pipeline {
  id: string;
  organization_id?: string;
  name?: string;
  position?: number;
  /** Present on a list or a single read; omitted when the pipeline has no stages. */
  stages?: PipelineStage[];
  created_at?: string;
  updated_at?: string;
  /** Set when the pipeline is managed in a connected CRM. */
  external?: CrmExternalRef;
  [key: string]: unknown;
}

/** A stage within a CRM pipeline. */
export interface PipelineStage {
  id: string;
  pipeline_id?: string;
  name?: string;
  color?: string;
  position?: number;
  deal_count?: number;
  created_at?: string;
  updated_at?: string;
  /** From a connected CRM's stage metadata: a closed stage. */
  closed?: boolean;
  /** From a connected CRM's stage metadata: a won stage. */
  won?: boolean;
  /** From a connected CRM's stage metadata: the win probability. */
  probability?: number;
  [key: string]: unknown;
}

/** A deal's lifecycle status. */
export type DealStatus = "open" | "won" | "lost" | (string & {});

/** A CRM deal. */
export interface Deal {
  id: string;
  organization_id?: string;
  pipeline_id?: string;
  stage_id?: string;
  contact_id?: string;
  name?: string;
  value?: number;
  currency?: string;
  status?: DealStatus;
  expected_close_date?: string;
  won_at?: string;
  lost_at?: string;
  lost_reason?: string;
  assigned_to?: string;
  /** The campaign that produced the reply this deal came from. */
  campaign_id?: string;
  source_mailbox_id?: string;
  created_at?: string;
  updated_at?: string;
  /** Joined by the list and search queries only. */
  contact?: Record<string, unknown>;
  stage?: PipelineStage;
  campaign_name?: string;
  /** Set when the deal lives in a connected CRM. */
  external?: CrmExternalRef;
  [key: string]: unknown;
}

/** A CRM task type. Tasks reference their type by name. */
export interface CrmTaskType {
  id: string;
  organization_id?: string;
  name?: string;
  color?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** A task's lifecycle status. */
export type CrmTaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | (string & {});

/** A task's priority. */
export type CrmTaskPriority = "low" | "medium" | "high" | "urgent" | (string & {});

/** A CRM task. */
export interface CrmTask {
  id: string;
  organization_id?: string;
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  assigned_team_id?: string;
  created_by?: string;
  title?: string;
  description?: string;
  due_date?: string;
  priority?: CrmTaskPriority;
  /** The task type's name (see {@link CrmTaskType}). */
  type?: string;
  status?: CrmTaskStatus;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  /** Set when the task lives in a connected CRM. */
  external?: CrmExternalRef;
  [key: string]: unknown;
}

/** Body for {@link Crm.createTask}. Only `title` is required. */
export interface CreateCrmTaskParams {
  /** 1..255 characters. */
  title: string;
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  assigned_team_id?: string;
  description?: string;
  /** RFC 3339. */
  due_date?: string;
  priority?: CrmTaskPriority;
  /** A task type name. */
  type?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateTask}. Every field is optional. */
export interface UpdateCrmTaskParams {
  title?: string;
  assigned_to?: string;
  assigned_team_id?: string;
  description?: string;
  due_date?: string;
  priority?: CrmTaskPriority;
  type?: string;
  status?: CrmTaskStatus;
  [key: string]: unknown;
}

/** Query params for listing deals. */
export interface ListDealsParams {
  pipeline_id?: string;
  stage_id?: string;
  /** `open`, `won` or `lost`. */
  status?: string;
  cursor?: string;
  /** Page size (1..100, default 50). */
  limit?: number;
  [key: string]: unknown;
}

/** Query params for listing tasks. */
export interface ListCrmTasksParams {
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  status?: CrmTaskStatus;
  cursor?: string;
  /** Page size (1..100, default 50). */
  limit?: number;
  [key: string]: unknown;
}

/** Paging query for the search endpoints, whose filters travel in the body. */
export interface SearchPagingParams {
  /** The opaque `pagination.next_cursor` of the previous page. */
  cursor?: string;
  /** Page size (default 50; tasks allow up to 200). */
  limit?: number;
  [key: string]: unknown;
}

/**
 * The faceted filter body shared by {@link Crm.searchTasks}, {@link Crm.tasksSummary}, and
 * the `filters` of a task selection. Every facet is optional; an empty body matches every
 * task in the organization.
 */
export interface CrmTaskFilters {
  /** Title substring match. */
  query?: string;
  /** Any of `pending`, `in_progress`, `completed`, `cancelled`. */
  statuses?: string[];
  /** Any of `low`, `medium`, `high`, `urgent`. */
  priorities?: string[];
  /** Task type names, any of. */
  types?: string[];
  /** Assignee user ids, any of. A malformed id is a 400. */
  assigned_to?: string[];
  team_ids?: string[];
  contact_id?: string;
  deal_id?: string;
  due_after?: string;
  due_before?: string;
  /** Due in the past and not completed or cancelled. */
  overdue?: boolean;
  /** `created_at`, `due_date`, `priority`, `title` or `updated_at`. */
  sort_by?: string;
  /** Ascending when true; the default is descending. */
  reverse?: boolean;
  [key: string]: unknown;
}

/**
 * The tasks a bulk action applies to: an explicit id list, or every task a search matches
 * (`all` plus `filters`) minus the ids in `exclude`. A selection naming both prefers the
 * filter. A select-all is refused above 50,000 tasks.
 */
export interface CrmTaskSelection {
  /** Explicit task ids. */
  tasks?: string[];
  /** Switches the selection from `tasks` to `filters`. */
  all?: boolean;
  /** The same body {@link Crm.searchTasks} takes. */
  filters?: CrmTaskFilters;
  /** Ids dropped from the resolved set. Ignored unless `all` is true. */
  exclude?: string[];
  [key: string]: unknown;
}

/** Body for {@link Crm.bulkUpdateTasks}: a selection plus at least one field to write. */
export interface BulkUpdateCrmTasksParams extends CrmTaskSelection {
  status?: CrmTaskStatus;
  priority?: CrmTaskPriority;
}

/** The count a bulk task action touched. */
export interface BulkCrmTasksResult {
  affected: number;
  [key: string]: unknown;
}

/** A provider enum value with its label (lifecycle stage, lead status, task type, pipeline). */
export interface CrmOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

/** Which Warmbly activity is written to the provider's timeline. */
export interface CrmActivityLog {
  sent: boolean;
  replies: boolean;
  bounces: boolean;
  unsubscribes: boolean;
  /** Off by default: machine opens make them noise. */
  opens: boolean;
  clicks: boolean;
  meetings: boolean;
  [key: string]: unknown;
}

/**
 * Every choice the CRM setup asks, as stored for the connected provider. Field names follow
 * the provider (HubSpot property names, Pipedrive field keys).
 */
export interface CrmProviderConfig {
  activity: CrmActivityLog;
  /** Create a provider contact for someone Warmbly emails who is not in the CRM yet. */
  create_contacts: boolean;
  /** Create and associate a company from the contact's domain. */
  create_companies: boolean;
  /** Keep the "Warmbly" property group on contacts current. */
  write_properties: boolean;
  /** What a positive ("interested") reply does in the provider. */
  positive_reply: {
    lead_status: string;
    lifecycle_stage: string;
    create_deal: boolean;
    /** Pipedrive only: add the person to the Leads Inbox. */
    create_lead?: boolean;
    /** A local (mirrored) pipeline id, required with `create_deal`. */
    deal_pipeline_id?: string;
    deal_stage_id?: string;
    [key: string]: unknown;
  };
  /** Stop a contact's campaigns when the provider says they moved on. */
  exit_rules: {
    deal_created: boolean;
    lifecycle_stages: string[];
    opted_out: boolean;
    [key: string]: unknown;
  };
  /** Skip contacts at import and enrolment time. */
  guards: {
    skip_lifecycle_stages: string[];
    skip_open_deals: boolean;
    skip_other_owners: boolean;
    skip_opted_out: boolean;
    [key: string]: unknown;
  };
  /** Provider pipeline ids to mirror; empty mirrors every pipeline. */
  deal_pipelines: string[];
  /** Extra contact properties shown in the contact panel. */
  display_properties: string[];
  /** Warmbly field (`first_name`, `last_name`, `email`, `company`, `phone`, `custom:<key>`) to provider property. */
  field_map: Record<string, string>;
  /** Per mapped field: `push`, `pull` or `both` (the most recent change wins). */
  field_direction: Record<string, "push" | "pull" | "both" | (string & {})>;
  /** The provider these choices were made for. */
  for?: CrmProvider;
  [key: string]: unknown;
}

/** The connected provider account. */
export interface CrmAccount {
  external_id: string;
  name: string;
  /** The provider's web app root for this account, for "Open in" links. */
  app_url: string;
  status: string;
  health: string;
  /** Permissions the connection lacks for full provider mode; reconnect to grant them. */
  missing_scopes?: string[];
  [key: string]: unknown;
}

/** The workspace's CRM mode, from {@link Crm.getSettings}. */
export interface CrmSettings {
  organization_id: string;
  provider: CrmProvider;
  /** The integration connection the provider runs on. */
  connection_id?: string;
  config: CrmProviderConfig;
  setup_completed_at?: string;
  updated_at: string;
  account?: CrmAccount;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateSettings}. Every field is optional. */
export interface UpdateCrmSettingsParams {
  /** Switch the CRM. A provider needs `connection_id` of a live connection for it. */
  provider?: CrmProvider;
  connection_id?: string;
  config?: CrmProviderConfig;
  /** Stamp the setup as finished. */
  complete_setup?: boolean;
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

/** The provider vocabulary the pickers render, from {@link Crm.metadata}. */
export interface CrmMetadata {
  lifecycle_stages: CrmOption[];
  lead_statuses: CrmOption[];
  task_types: CrmOption[];
  properties: CrmProperty[];
  pipelines: CrmOption[];
  [key: string]: unknown;
}

/** A provider user who can own records, and the member it is matched to. */
export interface CrmOwner {
  external_id: string;
  email: string;
  first_name: string;
  last_name: string;
  /** The matched workspace member, when there is one. */
  user_id?: string;
  /** The match was set by hand with {@link Crm.mapOwner}, not by email. */
  user_pinned: boolean;
  archived: boolean;
  [key: string]: unknown;
}

/** One failed or pending CRM sync job. */
export interface CrmSyncJob {
  id: string;
  organization_id: string;
  provider: CrmProvider;
  /** `log_email`, `log_event`, `contact_props`, `push_contact`, `push_deal`, ... */
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

/** The sync health panel, from {@link Crm.syncHealth}. */
export interface CrmSyncHealth {
  pending: number;
  failed: number;
  done_24h: number;
  last_synced_at?: string;
  cursors: CrmSyncCursor[];
  failures: CrmSyncJob[];
  /** How much provider data the workspace mirrors. */
  counts: {
    contacts: number;
    deals: number;
    tasks: number;
    pipelines: number;
    owners: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** The provider side of one Warmbly contact, from {@link Crm.getContactRecord}. */
export interface CrmContactView {
  provider: CrmProvider;
  /** Whether the contact is linked to a provider record. */
  linked: boolean;
  external_id?: string;
  url?: string;
  owner?: CrmOwner;
  lifecycle_stage?: CrmOption;
  lead_status?: CrmOption;
  company?: {
    external_id: string;
    name: string;
    domain?: string;
    url?: string;
    [key: string]: unknown;
  };
  opted_out: boolean;
  /** The workspace's display properties, labelled. */
  properties: Array<{ name: string; label: string; value: string; [key: string]: unknown }>;
  synced_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Crm.updateContactRecord}: the sales fields edited in place. */
export interface UpdateCrmContactParams {
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
  /** An active (filter-based) list rather than a static one. */
  dynamic: boolean;
  updated_at?: string;
  [key: string]: unknown;
}

/** Query params for {@link Crm.listLists}. */
export interface ListCrmListsParams {
  /** A name search, up to 200 characters. */
  q?: string;
  cursor?: string;
  /** Page size (1..100, default 25). */
  limit?: number;
  [key: string]: unknown;
}

/** Body for {@link Crm.previewListImport} and {@link Crm.importList}. */
export interface CrmListImportParams {
  /** The provider list id. */
  list_id: string;
  /** Drop contacts the workspace's enrolment guards exclude. */
  apply_guards?: boolean;
  [key: string]: unknown;
}

/** Who a list import would bring in and who it skips. */
export interface CrmImportPreview {
  list_name: string;
  total: number;
  included: number;
  skipped: Array<{ reason: string; label: string; count: number; [key: string]: unknown }>;
  sample: Array<{
    email: string;
    first_name: string;
    last_name: string;
    company: string;
    [key: string]: unknown;
  }>;
  /** Set when the list is larger than one import takes. */
  truncated: boolean;
  [key: string]: unknown;
}

/** The contact import draft a list import produced. Finish it with the contact import endpoints. */
export interface CrmImportResult {
  import_id: string;
  preview: CrmImportPreview;
  [key: string]: unknown;
}

/** What a one-time copy of Warmbly's own CRM data into the provider would copy, or should. */
export interface CrmBackfill {
  deals: number;
  tasks: number;
  notes: number;
  [key: string]: unknown;
}

/** Body for {@link Crm.startBackfill}: which kinds of record to copy. */
export interface StartCrmBackfillParams {
  deals?: boolean;
  tasks?: boolean;
  notes?: boolean;
  [key: string]: unknown;
}

/**
 * The CRM: pipelines and stages, deals, task types, and tasks, plus the CRM mode and the
 * sync with a connected CRM (HubSpot or Pipedrive): settings, metadata, owners, sync
 * health, per-contact records, list imports, and the one-time backfill. Reachable as
 * `warmbly.crm`. Reads need the `READ_CRM` scope and writes need `WRITE_CRM`; changing the
 * CRM mode or running a sync needs `INTEGRATIONS`, and list imports need `WRITE_CONTACTS`.
 * While a provider is the CRM, pipelines, stages and task types are managed there, so
 * changing them here is a 409 with code `crm_managed_externally`.
 *
 * @example
 * const pipeline = await warmbly.crm.createPipeline({ name: "Sales" });
 * const deal = await warmbly.crm.createDeal({ pipeline_id: pipeline.id, value: 5000 });
 */
export class Crm extends APIResource {
  // --- Pipelines ---

  /**
   * Lists pipelines.
   * @example
   * const pipelines = await warmbly.crm.listPipelines();
   */
  listPipelines(params?: Record<string, unknown>): Promise<Pipeline[]> {
    return this.http.get<Pipeline[]>("crm/pipelines", { query: params });
  }

  /**
   * Creates a pipeline.
   * @example
   * await warmbly.crm.createPipeline({ name: "Sales" });
   */
  createPipeline(params: Record<string, unknown>): Promise<Pipeline> {
    return this.http.post<Pipeline>("crm/pipelines", { body: params });
  }

  /**
   * Retrieves a pipeline by id.
   * @example
   * const p = await warmbly.crm.getPipeline("pl_1");
   */
  getPipeline(id: string, opts?: RequestOptions): Promise<Pipeline> {
    return this.http.get<Pipeline>(this.path("crm", "pipelines", id), opts);
  }

  /**
   * Updates a pipeline.
   * @example
   * await warmbly.crm.updatePipeline("pl_1", { name: "Renamed" });
   */
  updatePipeline(id: string, params: Record<string, unknown>): Promise<Pipeline> {
    return this.http.patch<Pipeline>(this.path("crm", "pipelines", id), { body: params });
  }

  /**
   * Deletes a pipeline.
   * @example
   * await warmbly.crm.deletePipeline("pl_1");
   */
  deletePipeline(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "pipelines", id), opts);
  }

  /**
   * Adds a stage to a pipeline.
   * @example
   * await warmbly.crm.createStage("pl_1", { name: "Qualified" });
   */
  createStage(pipelineId: string, params: Record<string, unknown>): Promise<PipelineStage> {
    return this.http.post<PipelineStage>(this.path("crm", "pipelines", pipelineId, "stages"), {
      body: params,
    });
  }

  /**
   * Updates a pipeline stage.
   * @example
   * await warmbly.crm.updateStage("pl_1", "st_1", { position: 2 });
   */
  updateStage(
    pipelineId: string,
    stageId: string,
    params: Record<string, unknown>,
  ): Promise<PipelineStage> {
    return this.http.patch<PipelineStage>(
      this.path("crm", "pipelines", pipelineId, "stages", stageId),
      { body: params },
    );
  }

  /**
   * Deletes a pipeline stage.
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
   * Lists deals, auto-paginating when iterated. Needs `READ_CRM`.
   * @example
   * for await (const deal of await warmbly.crm.listDeals({ status: "open" })) console.log(deal.name);
   */
  listDeals(params?: ListDealsParams): Promise<Page<Deal>> {
    return this.http.getPage<Deal>("crm/deals", { query: params });
  }

  /**
   * Creates a deal.
   * @example
   * await warmbly.crm.createDeal({ pipeline_id: "pl_1", value: 1000 });
   */
  createDeal(params: Record<string, unknown>): Promise<Deal> {
    return this.http.post<Deal>("crm/deals", { body: params });
  }

  /**
   * Searches deals with the faceted filter body (`query`, `statuses`, `pipeline_ids`,
   * `stage_ids`, `assigned_to`, `campaign_ids`, `min_value`, `max_value`, ...). The filters
   * travel in the body; `limit` and the opaque `cursor` are query parameters, so pass them
   * in `paging`. Auto-paginates when iterated. Needs `READ_CRM`.
   * @example
   * for await (const deal of await warmbly.crm.searchDeals({ query: "acme" })) console.log(deal.name);
   */
  searchDeals(
    params: Record<string, unknown> = {},
    paging?: SearchPagingParams,
  ): Promise<Page<Deal>> {
    return this.searchPage<Deal>("crm/deals/search", params, paging);
  }

  /**
   * Returns a summary of deals.
   * @example
   * const summary = await warmbly.crm.dealsSummary({ pipeline_id: "pl_1" });
   */
  dealsSummary(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("crm/deals/summary", { body: params });
  }

  /**
   * Retrieves a deal by id.
   * @example
   * const deal = await warmbly.crm.getDeal("dl_1");
   */
  getDeal(id: string, opts?: RequestOptions): Promise<Deal> {
    return this.http.get<Deal>(this.path("crm", "deals", id), opts);
  }

  /**
   * Updates a deal.
   * @example
   * await warmbly.crm.updateDeal("dl_1", { stage_id: "st_2" });
   */
  updateDeal(id: string, params: Record<string, unknown>): Promise<Deal> {
    return this.http.patch<Deal>(this.path("crm", "deals", id), { body: params });
  }

  /**
   * Deletes a deal.
   * @example
   * await warmbly.crm.deleteDeal("dl_1");
   */
  deleteDeal(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "deals", id), opts);
  }

  // --- Task types ---

  /**
   * Lists CRM task types.
   * @example
   * const types = await warmbly.crm.listTaskTypes();
   */
  listTaskTypes(params?: Record<string, unknown>): Promise<CrmTaskType[]> {
    return this.http
      .get<{ data: CrmTaskType[] }>("crm/task-types", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Creates a CRM task type.
   * @example
   * await warmbly.crm.createTaskType({ name: "Call" });
   */
  createTaskType(params: Record<string, unknown>): Promise<CrmTaskType> {
    return this.http.post<CrmTaskType>("crm/task-types", { body: params });
  }

  /**
   * Updates a CRM task type.
   * @example
   * await warmbly.crm.updateTaskType("tt_1", { name: "Phone call" });
   */
  updateTaskType(id: string, params: Record<string, unknown>): Promise<CrmTaskType> {
    return this.http.patch<CrmTaskType>(this.path("crm", "task-types", id), { body: params });
  }

  /**
   * Deletes a CRM task type.
   * @example
   * await warmbly.crm.deleteTaskType("tt_1");
   */
  deleteTaskType(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "task-types", id), opts);
  }

  // --- Tasks ---

  /**
   * Lists CRM tasks, auto-paginating when iterated. Needs `READ_CRM`.
   * @example
   * for await (const task of await warmbly.crm.listTasks({ status: "pending" })) console.log(task.title);
   */
  listTasks(params?: ListCrmTasksParams): Promise<Page<CrmTask>> {
    return this.http.getPage<CrmTask>("crm/tasks", { query: params });
  }

  /**
   * Creates a CRM task.
   * @example
   * await warmbly.crm.createTask({ title: "Call back", type: "Call", contact_id: "c_1" });
   */
  createTask(params: CreateCrmTaskParams): Promise<CrmTask> {
    return this.http.post<CrmTask>("crm/tasks", { body: params });
  }

  /**
   * Searches CRM tasks with the faceted filter body. `limit` (up to 200) and the opaque
   * `cursor` are query parameters, so pass them in `paging`. Auto-paginates when
   * iterated. Needs `READ_CRM`.
   * @example
   * const page = await warmbly.crm.searchTasks({ statuses: ["pending"], overdue: true });
   */
  searchTasks(params: CrmTaskFilters = {}, paging?: SearchPagingParams): Promise<Page<CrmTask>> {
    return this.searchPage<CrmTask>("crm/tasks/search", params, paging);
  }

  /**
   * Returns a summary of CRM tasks.
   * @example
   * const summary = await warmbly.crm.tasksSummary();
   */
  tasksSummary(params?: CrmTaskFilters): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("crm/tasks/summary", { body: params });
  }

  /**
   * Retrieves a CRM task by id.
   * @example
   * const task = await warmbly.crm.getTask("tk_1");
   */
  getTask(id: string, opts?: RequestOptions): Promise<CrmTask> {
    return this.http.get<CrmTask>(this.path("crm", "tasks", id), opts);
  }

  /**
   * Updates a CRM task.
   * @example
   * await warmbly.crm.updateTask("tk_1", { status: "completed" });
   */
  updateTask(id: string, params: UpdateCrmTaskParams): Promise<CrmTask> {
    return this.http.patch<CrmTask>(this.path("crm", "tasks", id), { body: params });
  }

  /**
   * Deletes a CRM task.
   * @example
   * await warmbly.crm.deleteTask("tk_1");
   */
  deleteTask(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("crm", "tasks", id), opts);
  }

  /**
   * Writes one `status` and/or `priority` onto a whole selection: the ids you ticked, or
   * every task a filter matches (`all` plus `filters`) minus `exclude`. At least one field
   * is required. Returns the count, not the rows. Needs `WRITE_CRM`.
   *
   * @example
   * const { affected } = await warmbly.crm.bulkUpdateTasks({
   *   tasks: ["tk_1", "tk_2"],
   *   status: "completed",
   * });
   *
   * @example
   * await warmbly.crm.bulkUpdateTasks({
   *   all: true,
   *   filters: { overdue: true },
   *   exclude: ["tk_9"],
   *   priority: "high",
   * });
   */
  bulkUpdateTasks(params: BulkUpdateCrmTasksParams): Promise<BulkCrmTasksResult> {
    return this.http.patch<BulkCrmTasksResult>("crm/tasks", { body: params });
  }

  /**
   * Deletes a whole selection of tasks. Pass a bare array of task ids, or the selection
   * object (`all` plus `filters` and `exclude`) the Tasks page sends for "select all
   * matching". Returns the count deleted. Needs `WRITE_CRM`.
   *
   * @example
   * const { affected } = await warmbly.crm.bulkDeleteTasks(["tk_1", "tk_2"]);
   */
  bulkDeleteTasks(selection: string[] | CrmTaskSelection): Promise<BulkCrmTasksResult> {
    return this.http.delete<BulkCrmTasksResult>("crm/tasks", { body: selection });
  }

  // --- CRM mode and sync with a connected CRM ---

  /**
   * Returns the workspace's CRM mode (`native`, `hubspot` or `pipedrive`), its setup
   * choices, and the connected account. Needs `READ_CRM` (members: `view_contacts`).
   * @example
   * const { provider, account } = await warmbly.crm.getSettings();
   */
  getSettings(opts?: RequestOptions): Promise<CrmSettings> {
    return this.http.get<CrmSettings>("crm/settings", opts);
  }

  /**
   * Switches the CRM and stores the setup choices. Needs `INTEGRATIONS` (members:
   * `manage_settings`).
   * @example
   * await warmbly.crm.updateSettings({ provider: "hubspot", connection_id: "conn_1", complete_setup: true });
   */
  updateSettings(params: UpdateCrmSettingsParams, opts?: RequestOptions): Promise<CrmSettings> {
    return this.http.put<CrmSettings>("crm/settings", { ...opts, body: params });
  }

  /**
   * Returns the provider's lifecycle stages, lead statuses, task types, contact properties
   * and pipelines. On a workspace not in provider mode this is a 409 with code
   * `crm_not_connected`. Needs `READ_CRM`.
   * @example
   * const { lifecycle_stages } = await warmbly.crm.metadata();
   */
  metadata(opts?: RequestOptions): Promise<CrmMetadata> {
    return this.http.get<CrmMetadata>("crm/metadata", opts);
  }

  /**
   * Lists the provider's owners and the member each one is matched to. Needs `READ_CRM`.
   * @example
   * const owners = await warmbly.crm.listOwners();
   */
  listOwners(opts?: RequestOptions): Promise<CrmOwner[]> {
    return this.http.get<{ data: CrmOwner[] }>("crm/owners", opts).then((r) => r.data ?? []);
  }

  /**
   * Pins a provider owner to a workspace member, or clears the match with `null`. Resolves
   * with no body (204). Needs `INTEGRATIONS` (members: `manage_settings`).
   * @example
   * await warmbly.crm.mapOwner("12345", "user_1");
   */
  mapOwner(externalId: string, userId: string | null, opts?: RequestOptions): Promise<void> {
    return this.http.put<void>(this.path("crm", "owners", externalId), {
      ...opts,
      body: { user_id: userId },
    });
  }

  /**
   * Reports what is waiting, what failed, and when each incremental pull last ran. Needs
   * `READ_CRM`.
   * @example
   * const health = await warmbly.crm.syncHealth();
   * console.log(health.pending, health.failed, health.failures.length);
   */
  syncHealth(opts?: RequestOptions): Promise<CrmSyncHealth> {
    return this.http.get<CrmSyncHealth>("crm/sync", opts);
  }

  /**
   * Starts a full pull from the provider. Accepted (202) with no body; the pull runs in the
   * background and `CRM_SYNCED` gateway events follow. Called again within 30 seconds
   * (HubSpot) or a minute (Pipedrive) it is a 429 with code `crm_sync_running`. Needs
   * `INTEGRATIONS` (members: `manage_settings`).
   * @example
   * await warmbly.crm.syncNow();
   */
  syncNow(opts?: RequestOptions): Promise<void> {
    return this.http.post<void>("crm/sync", opts);
  }

  /**
   * Requeues failed sync jobs: the ids given (up to 500), or every failure when `ids` is
   * omitted. Requeueing is idempotent. Needs `INTEGRATIONS` (members: `manage_settings`).
   * @example
   * const { affected } = await warmbly.crm.retrySyncFailures();
   */
  retrySyncFailures(ids?: string[], opts?: RequestOptions): Promise<{ affected: number }> {
    return this.http.post<{ affected: number }>("crm/sync/retry", {
      ...opts,
      body: ids ? { ids } : {},
    });
  }

  /**
   * Drops failed sync jobs: the ids given (up to 500), or every failure when `ids` is
   * omitted. Needs `INTEGRATIONS` (members: `manage_settings`).
   * @example
   * const { affected } = await warmbly.crm.discardSyncFailures(["job_1"]);
   */
  discardSyncFailures(ids?: string[], opts?: RequestOptions): Promise<{ affected: number }> {
    return this.http.post<{ affected: number }>("crm/sync/discard", {
      ...opts,
      body: ids ? { ids } : {},
    });
  }

  /**
   * Counts the Warmbly-only deals, tasks and notes a backfill would copy into the
   * provider. Needs `INTEGRATIONS` (members: `manage_settings`).
   * @example
   * const { deals, tasks, notes } = await warmbly.crm.backfillPreview();
   */
  backfillPreview(opts?: RequestOptions): Promise<CrmBackfill> {
    return this.http.get<CrmBackfill>("crm/backfill", opts);
  }

  /**
   * Copies Warmbly's own deals, tasks and notes into the provider once. Accepted (202) with
   * no body. Idempotent: a second call while one runs folds into it, and copied records are
   * never copied twice. Needs `INTEGRATIONS` (members: `manage_settings`).
   * @example
   * await warmbly.crm.startBackfill({ deals: true, tasks: true, notes: true });
   */
  startBackfill(params: StartCrmBackfillParams, opts?: RequestOptions): Promise<void> {
    return this.http.post<void>("crm/backfill", { ...opts, body: params });
  }

  /**
   * Returns the provider side of a contact: owner, lifecycle stage, lead status, company
   * and the chosen properties. Needs `READ_CRM` (members: `view_contacts`).
   * @example
   * const record = await warmbly.crm.getContactRecord("c_1");
   * if (record.linked) console.log(record.url, record.lifecycle_stage?.label);
   */
  getContactRecord(contactId: string, opts?: RequestOptions): Promise<CrmContactView> {
    return this.http.get<CrmContactView>(this.path("crm", "contacts", contactId), opts);
  }

  /**
   * Pulls a contact's provider record, deals, tasks and notes now, and returns the fresh
   * view. Debounced per contact, so it is safe to call whenever a panel opens. Needs
   * `READ_CRM`.
   * @example
   * const record = await warmbly.crm.refreshContactRecord("c_1");
   */
  refreshContactRecord(contactId: string, opts?: RequestOptions): Promise<CrmContactView> {
    return this.http.post<CrmContactView>(this.path("crm", "contacts", contactId, "refresh"), opts);
  }

  /**
   * Finds the contact in the provider, or creates it there, and links the two. A 404 with
   * code `crm_contact_missing` means creating contacts is turned off in the CRM settings.
   * Needs `WRITE_CRM` (members: `manage_contacts`).
   * @example
   * const record = await warmbly.crm.linkContactRecord("c_1", { idempotencyKey: "link-c_1" });
   */
  linkContactRecord(contactId: string, opts?: RequestOptions): Promise<CrmContactView> {
    return this.http.post<CrmContactView>(this.path("crm", "contacts", contactId, "link"), opts);
  }

  /**
   * Edits the contact's owner, lifecycle stage or lead status in the provider, and returns
   * the updated view. The change is written to the provider first. Needs `WRITE_CRM`
   * (members: `manage_contacts`).
   * @example
   * await warmbly.crm.updateContactRecord("c_1", { lifecycle_stage: "salesqualifiedlead" });
   */
  updateContactRecord(
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
   * Lists the provider's contact lists for import, auto-paginating when iterated. Needs
   * `READ_CRM` (members: `manage_contacts`).
   * @example
   * for await (const list of await warmbly.crm.listLists({ q: "webinar" })) {
   *   console.log(list.name, list.size);
   * }
   */
  listLists(params?: ListCrmListsParams): Promise<Page<CrmList>> {
    return this.http.getPage<CrmList>("crm/lists", { query: params });
  }

  /**
   * Counts who importing a provider list would bring in and who it skips, with a sample.
   * Read-only. Needs `WRITE_CONTACTS` (members: `manage_contacts`).
   * @example
   * const preview = await warmbly.crm.previewListImport({ list_id: "42", apply_guards: true });
   */
  previewListImport(params: CrmListImportParams, opts?: RequestOptions): Promise<CrmImportPreview> {
    return this.http.post<CrmImportPreview>("crm/lists/preview", { ...opts, body: params });
  }

  /**
   * Turns a provider list into a contact import draft (201) and returns its id. Finish it
   * with `warmbly.contacts.startImport`. Pass `idempotencyKey` so a retry does not make a
   * second draft. Needs `WRITE_CONTACTS` (members: `manage_contacts`).
   * @example
   * const { import_id } = await warmbly.crm.importList(
   *   { list_id: "42", apply_guards: true },
   *   { idempotencyKey: "crm-list-42" },
   * );
   */
  importList(params: CrmListImportParams, opts?: RequestOptions): Promise<CrmImportResult> {
    return this.http.post<CrmImportResult>("crm/lists/import", { ...opts, body: params });
  }

  // The search endpoints take their filters in the body and their paging in the query
  // string, and answer with the standard data + pagination envelope.
  private async searchPage<T>(
    path: string,
    body: Record<string, unknown>,
    paging?: SearchPagingParams,
  ): Promise<Page<T>> {
    const response = await this.http.post<ListResponse<T>>(path, { body, query: paging });
    const fetchNext = (cursor: string): Promise<Page<T>> =>
      this.searchPage<T>(path, body, { ...paging, cursor });
    return new Page<T>(response, fetchNext);
  }
}
