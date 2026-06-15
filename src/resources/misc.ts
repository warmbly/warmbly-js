import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A folder. Documented-but-open shape. */
export interface Folder {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** A tag. Documented-but-open shape. */
export interface Tag {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** A category. Documented-but-open shape. */
export interface Category {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** A team. Documented-but-open shape. */
export interface Team {
  id: string;
  name?: string;
  members?: unknown[];
  created_at?: string;
  [key: string]: unknown;
}

/** An audit log entry. */
export interface AuditLogEntry {
  id?: string;
  action?: string;
  actor_id?: string;
  resource_type?: string;
  resource_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** A billing plan. */
export interface Plan {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

/** A warmup routing rule. */
export interface WarmupRoutingRule {
  id: string;
  [key: string]: unknown;
}

/**
 * Small standalone resources grouped together: folders, tags, categories, teams,
 * audit logs, outreach settings, warmup routing, plans, and timezones.
 *
 * @example
 * const folder = await warmbly.misc.createFolder({ name: "Prospects" });
 * const logs = await warmbly.misc.auditLogs();
 */
export class Misc extends APIResource {
  // --- Folders ---

  /** Lists folders. @example const folders = await warmbly.misc.listFolders(); */
  listFolders(params?: Record<string, unknown>): Promise<Folder[]> {
    return this.http.get<Folder[]>("folders", { query: params });
  }

  /** Creates a folder. @example await warmbly.misc.createFolder({ name: "A" }); */
  createFolder(params: Record<string, unknown>): Promise<Folder> {
    return this.http.post<Folder>("folders", { body: params });
  }

  /** Updates a folder. @example await warmbly.misc.updateFolder("f_1", { name: "B" }); */
  updateFolder(id: string, params: Record<string, unknown>): Promise<Folder> {
    return this.http.patch<Folder>(this.path("folders", id), { body: params });
  }

  /** Deletes a folder. @example await warmbly.misc.deleteFolder("f_1"); */
  deleteFolder(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("folders", id), opts);
  }

  // --- Tags ---

  /** Lists tags. @example const tags = await warmbly.misc.listTags(); */
  listTags(params?: Record<string, unknown>): Promise<Tag[]> {
    return this.http.get<Tag[]>("tags", { query: params });
  }

  /** Creates a tag. @example await warmbly.misc.createTag({ name: "hot" }); */
  createTag(params: Record<string, unknown>): Promise<Tag> {
    return this.http.post<Tag>("tags", { body: params });
  }

  /** Updates a tag. @example await warmbly.misc.updateTag("t_1", { name: "warm" }); */
  updateTag(id: string, params: Record<string, unknown>): Promise<Tag> {
    return this.http.patch<Tag>(this.path("tags", id), { body: params });
  }

  /** Deletes a tag. @example await warmbly.misc.deleteTag("t_1"); */
  deleteTag(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("tags", id), opts);
  }

  // --- Categories ---

  /** Lists categories. @example const cats = await warmbly.misc.listCategories(); */
  listCategories(params?: Record<string, unknown>): Promise<Category[]> {
    return this.http.get<Category[]>("categories", { query: params });
  }

  /** Creates a category. @example await warmbly.misc.createCategory({ name: "VIP" }); */
  createCategory(params: Record<string, unknown>): Promise<Category> {
    return this.http.post<Category>("categories", { body: params });
  }

  /** Updates a category. @example await warmbly.misc.updateCategory("c_1", { name: "X" }); */
  updateCategory(id: string, params: Record<string, unknown>): Promise<Category> {
    return this.http.patch<Category>(this.path("categories", id), { body: params });
  }

  /** Deletes a category. @example await warmbly.misc.deleteCategory("c_1"); */
  deleteCategory(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("categories", id), opts);
  }

  // --- Teams ---

  /** Lists teams. @example const teams = await warmbly.misc.listTeams(); */
  listTeams(params?: Record<string, unknown>): Promise<Team[]> {
    return this.http.get<Team[]>("teams", { query: params });
  }

  /** Creates a team. @example await warmbly.misc.createTeam({ name: "Sales" }); */
  createTeam(params: Record<string, unknown>): Promise<Team> {
    return this.http.post<Team>("teams", { body: params });
  }

  /** Retrieves a team by id. @example const team = await warmbly.misc.getTeam("tm_1"); */
  getTeam(id: string, opts?: RequestOptions): Promise<Team> {
    return this.http.get<Team>(this.path("teams", id), opts);
  }

  /** Updates a team. @example await warmbly.misc.updateTeam("tm_1", { name: "X" }); */
  updateTeam(id: string, params: Record<string, unknown>): Promise<Team> {
    return this.http.patch<Team>(this.path("teams", id), { body: params });
  }

  /** Deletes a team. @example await warmbly.misc.deleteTeam("tm_1"); */
  deleteTeam(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("teams", id), opts);
  }

  /** Adds a member to a team. @example await warmbly.misc.addTeamMember("tm_1", { user_id: "u_1" }); */
  addTeamMember(id: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("teams", id, "members"), {
      body: params,
    });
  }

  /** Removes a member from a team. @example await warmbly.misc.removeTeamMember("tm_1", "u_1"); */
  removeTeamMember(id: string, userId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("teams", id, "members", userId), opts);
  }

  // --- Audit logs ---

  /**
   * Lists audit log entries, auto-paginating when iterated.
   * @example
   * for await (const entry of warmbly.misc.auditLogs()) console.log(entry.action);
   */
  auditLogs(params?: Record<string, unknown>): Promise<Page<AuditLogEntry>> {
    return this.http.getPage<AuditLogEntry>("audit-logs", { query: params });
  }

  // --- Outreach settings ---

  /** Reads outreach settings. @example const s = await warmbly.misc.getOutreachSettings(); */
  getOutreachSettings(opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("outreach/settings", opts);
  }

  /** Updates outreach settings. @example await warmbly.misc.updateOutreachSettings({ daily_cap: 100 }); */
  updateOutreachSettings(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("outreach/settings", { body: params });
  }

  // --- Warmup routing ---

  /** Lists warmup routing rules. @example const rules = await warmbly.misc.listWarmupRouting(); */
  listWarmupRouting(params?: Record<string, unknown>): Promise<WarmupRoutingRule[]> {
    return this.http.get<WarmupRoutingRule[]>("warmup/routing", { query: params });
  }

  /** Creates a warmup routing rule. @example await warmbly.misc.createWarmupRouting({}); */
  createWarmupRouting(params: Record<string, unknown>): Promise<WarmupRoutingRule> {
    return this.http.post<WarmupRoutingRule>("warmup/routing", { body: params });
  }

  /** Updates a warmup routing rule. @example await warmbly.misc.updateWarmupRouting("wr_1", {}); */
  updateWarmupRouting(id: string, params: Record<string, unknown>): Promise<WarmupRoutingRule> {
    return this.http.patch<WarmupRoutingRule>(this.path("warmup", "routing", id), {
      body: params,
    });
  }

  /** Deletes a warmup routing rule. @example await warmbly.misc.deleteWarmupRouting("wr_1"); */
  deleteWarmupRouting(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("warmup", "routing", id), opts);
  }

  // --- Plans & timezones ---

  /** Lists available plans. @example const plans = await warmbly.misc.plans(); */
  plans(opts?: RequestOptions): Promise<Plan[]> {
    return this.http.get<Plan[]>("plans", opts);
  }

  /** Lists supported timezones. @example const tz = await warmbly.misc.timezones(); */
  timezones(opts?: RequestOptions): Promise<string[]> {
    return this.http.get<string[]>("timezones", opts);
  }
}
