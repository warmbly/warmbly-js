import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A CRM pipeline. Documented-but-open shape. */
export interface Pipeline {
  id: string;
  name?: string;
  stages?: PipelineStage[];
  created_at?: string;
  [key: string]: unknown;
}

/** A stage within a CRM pipeline. */
export interface PipelineStage {
  id: string;
  pipeline_id?: string;
  name?: string;
  position?: number;
  [key: string]: unknown;
}

/** A CRM deal. */
export interface Deal {
  id: string;
  pipeline_id?: string;
  stage_id?: string;
  contact_id?: string;
  value?: number;
  created_at?: string;
  [key: string]: unknown;
}

/** A CRM task type. */
export interface CrmTaskType {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** A CRM task. */
export interface CrmTask {
  id: string;
  task_type_id?: string;
  contact_id?: string;
  deal_id?: string;
  due_at?: string;
  completed?: boolean;
  [key: string]: unknown;
}

/**
 * The CRM: pipelines and stages, deals, task types, and tasks. Reachable as `warmbly.crm`.
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
   * Lists deals.
   * @example
   * const deals = await warmbly.crm.listDeals();
   */
  listDeals(params?: Record<string, unknown>): Promise<Deal[]> {
    return this.http.get<Deal[]>("crm/deals", { query: params });
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
   * Searches deals.
   * @example
   * const result = await warmbly.crm.searchDeals({ query: "acme" });
   */
  searchDeals(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("crm/deals/search", { body: params });
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
    return this.http.get<CrmTaskType[]>("crm/task-types", { query: params });
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
   * Lists CRM tasks.
   * @example
   * const tasks = await warmbly.crm.listTasks();
   */
  listTasks(params?: Record<string, unknown>): Promise<CrmTask[]> {
    return this.http.get<CrmTask[]>("crm/tasks", { query: params });
  }

  /**
   * Creates a CRM task.
   * @example
   * await warmbly.crm.createTask({ task_type_id: "tt_1", contact_id: "c_1" });
   */
  createTask(params: Record<string, unknown>): Promise<CrmTask> {
    return this.http.post<CrmTask>("crm/tasks", { body: params });
  }

  /**
   * Searches CRM tasks.
   * @example
   * const result = await warmbly.crm.searchTasks({ completed: false });
   */
  searchTasks(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("crm/tasks/search", { body: params });
  }

  /**
   * Returns a summary of CRM tasks.
   * @example
   * const summary = await warmbly.crm.tasksSummary();
   */
  tasksSummary(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
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
   * await warmbly.crm.updateTask("tk_1", { completed: true });
   */
  updateTask(id: string, params: Record<string, unknown>): Promise<CrmTask> {
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
}
