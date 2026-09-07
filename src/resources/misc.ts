import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A folder. Documented-but-open shape. */
export interface Folder {
  id: string;
  title?: string;
  [key: string]: unknown;
}

/** A tag. Documented-but-open shape. */
export interface Tag {
  id: string;
  title?: string;
  [key: string]: unknown;
}

/** A category. Documented-but-open shape. */
export interface Category {
  id: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * One entry's place in an ordered list, as returned by a reorder. The response is the
 * whole list's new order, not just the row that moved.
 */
export interface GroupOrder {
  id: string;
  position: number;
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
 * Who the active credential belongs to. Requires no specific permission, so it is the
 * right call for validating a connection and labelling it for a human.
 */
export interface Identity {
  user_id: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  /** The organization the credential acts on, when it is bound to one. */
  organization_id?: string;
  organization_name?: string;
  /** How the caller authenticated. */
  auth_type?: "api_key" | "oauth" | "jwt" | string;
  /** The scope strings the credential was granted. */
  scopes?: string[];
  [key: string]: unknown;
}

/**
 * Public deployment capabilities, from {@link Misc.authConfig}. On a self-hosted
 * instance this is the only way to discover the realtime gateway and dashboard URLs.
 */
export interface AuthConfig {
  captcha?: boolean;
  password_login?: boolean;
  login_code?: string;
  registration?: string;
  email_verification?: boolean;
  mail_delivers?: boolean;
  passkeys?: boolean;
  /** Browser sign-in providers this backend offers. */
  providers?: string[];
  provider_labels?: Record<string, string>;
  self_hosted?: boolean;
  /** False under `BILLING_PROVIDER=none`, where every feature is unlocked server-side. */
  billing_enabled?: boolean;
  /** True while the instance still needs its first-run claim. */
  setup_required?: boolean;
  invites_required?: boolean;
  docs_url?: string;
  /** The realtime gateway a client connects to. Omitted when the instance has none. */
  websocket_url?: string;
  /** The dashboard origin a client sends someone to. Omitted when the instance has none. */
  app_url?: string;
  [key: string]: unknown;
}

/** The kinds of deliverability signal {@link Misc.ingestDeliverabilityEvent} accepts. */
export type DeliverabilityEventType = string;

/**
 * Body for {@link Misc.ingestDeliverabilityEvent}: one bounce, complaint, or similar
 * signal from a downstream pipeline (an SES bounce processor, for example).
 */
export interface DeliverabilityEventParams {
  event_type: DeliverabilityEventType;
  recipient_email: string;
  campaign_id?: string;
  task_id?: string;
  contact_id?: string;
  provider?: string;
  reason?: string;
  /** Deduplicates repeated deliveries of the same upstream signal. */
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A send task that exhausted its retries and landed in the dead-letter queue. */
export interface TaskDeadLetter {
  id: string;
  [key: string]: unknown;
}

/** Query params for {@link Misc.deadLetters}. */
export interface ListDeadLettersParams {
  status?: string;
  /** Max rows, 1..200 (default 100). */
  limit?: number;
  [key: string]: unknown;
}

/**
 * Small standalone resources grouped together: caller identity, folders, tags,
 * categories, teams, audit logs, outreach settings, deliverability ingestion, the task
 * dead-letter queue, warmup routing, plans, and timezones.
 *
 * @example
 * const me = await warmbly.misc.me();
 * const folder = await warmbly.misc.createFolder({ title: "Prospects" });
 * const logs = await warmbly.misc.auditLogs();
 */
export class Misc extends APIResource {
  // --- Identity ---

  /**
   * Returns who the active credential belongs to, plus the scopes it was granted. Needs
   * no specific permission, so any valid API key, OAuth token, or session can call it —
   * which makes it the right way to validate a connection. Unlike `/auth/me` (JWT only),
   * it is reachable with an API key.
   *
   * @example
   * const me = await warmbly.misc.me();
   * console.log(`${me.email} @ ${me.organization_name} (${me.auth_type})`);
   */
  me(opts?: RequestOptions): Promise<Identity> {
    return this.http.get<Identity>("me", opts);
  }

  /**
   * Reads the deployment's public capabilities: sign-in methods, whether signups are
   * open, and on a self-hosted layout the `websocket_url` and `app_url` a client needs.
   * Public and unauthenticated, so it works before any credential exists.
   *
   * @example
   * const { websocket_url } = await warmbly.misc.authConfig();
   * const gw = warmbly.gateway({ url: websocket_url, orgId: "org_1" });
   */
  authConfig(opts?: RequestOptions): Promise<AuthConfig> {
    return this.http.get<AuthConfig>("auth/config", opts);
  }

  // --- Folders ---
  // The API exposes create/update/delete for folders, tags, and categories; there is no
  // list endpoint for any of the three (they are read through their owning resources).

  /** Creates a folder. The name goes in the `title` field. @example await warmbly.misc.createFolder({ title: "A" }); */
  createFolder(params: Record<string, unknown>): Promise<Folder> {
    return this.http.post<Folder>("folders", { body: params });
  }

  /** Updates a folder. @example await warmbly.misc.updateFolder("f_1", { title: "B" }); */
  updateFolder(id: string, params: Record<string, unknown>): Promise<Folder> {
    return this.http.patch<Folder>(this.path("folders", id), { body: params });
  }

  /**
   * Moves a folder to a position in the list, returning every folder's new order.
   * Last-write-wins, so retries are safe.
   * @example
   * const order = await warmbly.misc.moveFolder("f_1", 0);
   */
  moveFolder(id: string, position: number): Promise<GroupOrder[]> {
    return this.http.patch<GroupOrder[]>(this.path("folders", id, "move"), {
      body: { position },
    });
  }

  /** Deletes a folder. @example await warmbly.misc.deleteFolder("f_1"); */
  deleteFolder(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("folders", id), opts);
  }

  // --- Tags ---

  /** Creates a tag. The name goes in the `title` field. @example await warmbly.misc.createTag({ title: "hot" }); */
  createTag(params: Record<string, unknown>): Promise<Tag> {
    return this.http.post<Tag>("tags", { body: params });
  }

  /** Updates a tag. @example await warmbly.misc.updateTag("t_1", { title: "warm" }); */
  updateTag(id: string, params: Record<string, unknown>): Promise<Tag> {
    return this.http.patch<Tag>(this.path("tags", id), { body: params });
  }

  /**
   * Moves a tag to a position in the list, returning every tag's new order.
   * @example
   * const order = await warmbly.misc.moveTag("t_1", 2);
   */
  moveTag(id: string, position: number): Promise<GroupOrder[]> {
    return this.http.patch<GroupOrder[]>(this.path("tags", id, "move"), { body: { position } });
  }

  /** Deletes a tag. @example await warmbly.misc.deleteTag("t_1"); */
  deleteTag(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("tags", id), opts);
  }

  // --- Categories ---

  /** Creates a category. The name goes in the `title` field. @example await warmbly.misc.createCategory({ title: "VIP" }); */
  createCategory(params: Record<string, unknown>): Promise<Category> {
    return this.http.post<Category>("categories", { body: params });
  }

  /** Updates a category. @example await warmbly.misc.updateCategory("c_1", { title: "X" }); */
  updateCategory(id: string, params: Record<string, unknown>): Promise<Category> {
    return this.http.patch<Category>(this.path("categories", id), { body: params });
  }

  /**
   * Moves a category to a position in the list, returning every category's new order.
   * @example
   * const order = await warmbly.misc.moveCategory("c_1", 1);
   */
  moveCategory(id: string, position: number): Promise<GroupOrder[]> {
    return this.http.patch<GroupOrder[]>(this.path("categories", id, "move"), {
      body: { position },
    });
  }

  /** Deletes a category. @example await warmbly.misc.deleteCategory("c_1"); */
  deleteCategory(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("categories", id), opts);
  }

  // --- Teams ---

  /** Lists teams. @example const teams = await warmbly.misc.listTeams(); */
  listTeams(params?: Record<string, unknown>): Promise<Team[]> {
    return this.http.get<{ data: Team[] }>("teams", { query: params }).then((r) => r.data ?? []);
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
   * for await (const entry of await warmbly.misc.auditLogs()) console.log(entry.action);
   */
  auditLogs(params?: Record<string, unknown>): Promise<Page<AuditLogEntry>> {
    return this.http.getPage<AuditLogEntry>("audit-logs", { query: params });
  }

  // --- Outreach settings ---

  /** Reads outreach settings. @example const s = await warmbly.misc.getOutreachSettings(); */
  getOutreachSettings(opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("outreach/settings", opts);
  }

  /**
   * Updates outreach settings. The settings object must be wrapped under a `settings` key.
   * @example
   * await warmbly.misc.updateOutreachSettings({ settings: { daily_cap: 100 } });
   */
  updateOutreachSettings(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("outreach/settings", { body: params });
  }

  // --- Deliverability ingestion ---

  /**
   * Posts one deliverability signal (a bounce, a complaint, …) into the organization's
   * reputation data. API-key callable, so a downstream pipeline such as an SES bounce
   * processor can report without a human in the loop. Returns `202 Accepted` with no
   * body. Pass `idempotency_key` when the upstream may redeliver.
   *
   * @example
   * await warmbly.misc.ingestDeliverabilityEvent({
   *   event_type: "bounce",
   *   recipient_email: "jordan@acme.com",
   *   provider: "ses",
   *   reason: "550 mailbox not found",
   * });
   */
  ingestDeliverabilityEvent(params: DeliverabilityEventParams): Promise<void> {
    return this.http.post<void>("deliverability/events", { body: params });
  }

  // --- Task dead-letter queue ---

  /**
   * Lists send tasks that exhausted their retries. Requires `SEND_CAMPAIGNS`, because a
   * replay re-dispatches real mail.
   *
   * @example
   * const stuck = await warmbly.misc.deadLetters({ limit: 50 });
   */
  deadLetters(params?: ListDeadLettersParams): Promise<TaskDeadLetter[]> {
    return this.http
      .get<{ data: TaskDeadLetter[] }>("tasks/dlq", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Re-dispatches one dead-lettered task. This sends real mail.
   * @example
   * await warmbly.misc.replayDeadLetter("dl_1");
   */
  replayDeadLetter(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("tasks", "dlq", id, "replay"), {
      body: params,
    });
  }

  // --- Warmup routing ---

  /** Lists warmup routing rules. @example const rules = await warmbly.misc.listWarmupRouting(); */
  listWarmupRouting(params?: Record<string, unknown>): Promise<WarmupRoutingRule[]> {
    return this.http
      .get<{ rules: WarmupRoutingRule[] }>("warmup/routing", { query: params })
      .then((r) => r.rules ?? []);
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
    return this.http.get<{ plans: Plan[] }>("plans", opts).then((r) => r.plans ?? []);
  }

  /** Lists supported timezones. @example const tz = await warmbly.misc.timezones(); */
  timezones(opts?: RequestOptions): Promise<string[]> {
    return this.http.get<string[]>("timezones", opts);
  }
}
