import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";

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

/**
 * The CRM: pipelines and stages, deals, task types, and tasks. Reachable as `warmbly.crm`.
 * Reads need the `READ_CRM` scope and writes need `WRITE_CRM`.
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
