import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** How urgent a finding is. */
export type AdvisorSeverity = "critical" | "high" | "medium" | "low";

/** What area of the workspace a finding is about. */
export type AdvisorCategory =
  | "deliverability"
  | "mailbox"
  | "warmup"
  | "campaign"
  | "copy"
  | "list";

/** Which dashboard surface a finding belongs on. */
export type AdvisorSurface =
  | "campaigns"
  | "emails"
  | "deliverability"
  | "contacts"
  | "analytics"
  | "settings";

/** Where a finding is in its lifecycle. */
export type AdvisorStatus = "open" | "snoozed" | "dismissed" | "applied" | "resolved";

/** One field a fix would change, for the before/after preview. */
export interface AdvisorPreviewChange {
  field: string;
  from: string;
  to: string;
  [key: string]: unknown;
}

/** The fix behind a finding: the tool it runs and what it would change. */
export interface AdvisorAction {
  /** The registry tool the fix calls. Its own permission gates the apply. */
  tool: string;
  args?: unknown;
  label?: string;
  /** Whether the fix applies without confirmation. */
  auto?: boolean;
  preview?: AdvisorPreviewChange[];
  undo?: { tool: string; args?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

/** One Advisor recommendation about the workspace's sending posture. */
export interface AdvisorFinding {
  id: string;
  organization_id?: string;
  detector_key?: string;
  category?: AdvisorCategory;
  severity?: AdvisorSeverity;
  surface?: AdvisorSurface;
  /** What the finding is about, e.g. a mailbox or campaign. */
  entity_type?: string;
  entity_id?: string;
  entity_label?: string;
  parent_type?: string;
  parent_id?: string;
  status?: AdvisorStatus;
  /** Estimated impact, used for ranking. */
  impact?: number;
  title?: string;
  group_title?: string;
  detail?: string;
  remedy?: string;
  steps?: string[];
  /** Whether an agent can fix this one (`POST /advisor/recommendations/:id/agent-fix`, JWT only). */
  agent_fixable?: boolean;
  snippets?: Record<string, unknown>[];
  narrated?: boolean;
  evidence?: unknown;
  action?: AdvisorAction | null;
  first_seen_at?: string;
  last_seen_at?: string;
  resolved_at?: string | null;
  snoozed_until?: string | null;
  dismissed_at?: string | null;
  dismiss_reason?: string;
  applied_at?: string | null;
  applied_by?: string | null;
  applied_result?: string;
  [key: string]: unknown;
}

/** Per-surface counts on the Advisor summary. */
export interface AdvisorSurfaceCount {
  surface: AdvisorSurface;
  total: number;
  critical: number;
  high: number;
  [key: string]: unknown;
}

/** The workspace's overall Advisor posture. */
export interface AdvisorSummary {
  /** A 0-100 health score. */
  score?: number;
  total?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  surfaces?: AdvisorSurfaceCount[];
  last_run_at?: string | null;
  [key: string]: unknown;
}

/** Query params for {@link Advisor.recommendations}. */
export interface ListAdvisorParams {
  surface?: AdvisorSurface;
  category?: AdvisorCategory;
  /** Narrow to findings about one entity, paired with `entity_id`. */
  entity_type?: string;
  entity_id?: string;
  /** One or more lifecycle states to include. */
  status?: AdvisorStatus | AdvisorStatus[];
  /** Max rows, 1..200. */
  limit?: number;
  [key: string]: unknown;
}

/**
 * The Advisor: continuous checks on the workspace's deliverability, mailbox
 * configuration, warmup, campaign performance, copy, and list quality. Reachable as
 * `warmbly.advisor`.
 *
 * Reads need `READ_ANALYTICS`. Applying or undoing a fix carries no scope of its own:
 * the change runs through the tool it actually uses and is refused if the credential
 * lacks that tool's permission, so a read-only key can see advice but not act on it.
 *
 * @example
 * const { score } = await warmbly.advisor.summary();
 * for (const f of await warmbly.advisor.recommendations({ surface: "emails" })) {
 *   console.log(f.severity, f.title, f.remedy);
 * }
 */
export class Advisor extends APIResource {
  /**
   * Lists open recommendations. Reads may kick off a background refresh when the
   * workspace's findings are stale.
   *
   * @example
   * const findings = await warmbly.advisor.recommendations({ surface: "deliverability" });
   */
  recommendations(params?: ListAdvisorParams): Promise<AdvisorFinding[]> {
    return this.http
      .get<{ data: AdvisorFinding[] }>("advisor/recommendations", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Returns the health score and per-surface counts.
   * @example
   * const summary = await warmbly.advisor.summary();
   */
  summary(opts?: RequestOptions): Promise<AdvisorSummary> {
    return this.http.get<AdvisorSummary>("advisor/summary", opts);
  }

  /**
   * Reads which checks are enabled for the workspace. Changing them is JWT-only
   * governance and is not reachable with an API key.
   *
   * @example
   * const settings = await warmbly.advisor.settings();
   */
  settings(opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("advisor/settings", opts);
  }

  /**
   * Forces an evaluation now and returns the fresh summary. The Advisor keeps itself
   * current on its own; this exists for the moment right after you fix something.
   *
   * @example
   * const summary = await warmbly.advisor.refresh();
   */
  refresh(params?: Record<string, unknown>): Promise<AdvisorSummary> {
    return this.http.post<AdvisorSummary>("advisor/refresh", { body: params });
  }

  /**
   * Applies a finding's fix and returns the updated finding. Applying twice is a no-op
   * that returns the first outcome, so retries are safe without an `Idempotency-Key`.
   * Requires whatever permission the underlying change needs.
   *
   * @example
   * const applied = await warmbly.advisor.apply("rec_1");
   */
  apply(id: string, params?: Record<string, unknown>): Promise<AdvisorFinding> {
    return this.http.post<AdvisorFinding>(this.path("advisor", "recommendations", id, "apply"), {
      body: params,
    });
  }

  /**
   * Reverts a previously applied fix.
   * @example
   * await warmbly.advisor.undo("rec_1");
   */
  undo(id: string, params?: Record<string, unknown>): Promise<AdvisorFinding> {
    return this.http.post<AdvisorFinding>(this.path("advisor", "recommendations", id, "undo"), {
      body: params,
    });
  }

  /**
   * Hides a finding for 1 to 90 days. An unbounded snooze is a dismissal wearing a
   * disguise, so it is rejected — use {@link Advisor.dismiss} instead.
   *
   * @example
   * await warmbly.advisor.snooze("rec_1", { days: 7 });
   */
  snooze(id: string, params: { days: number; [key: string]: unknown }): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.path("advisor", "recommendations", id, "snooze"), {
      body: params,
    });
  }

  /**
   * Tells the Advisor a finding is fine. The dismissal sticks until the condition clears
   * and later recurs, so you don't have to repeat it weekly.
   *
   * @example
   * await warmbly.advisor.dismiss("rec_1", { reason: "intentional" });
   */
  dismiss(
    id: string,
    params?: { reason?: string; [key: string]: unknown },
  ): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.path("advisor", "recommendations", id, "dismiss"), {
      body: params,
    });
  }

  /**
   * Rates whether a recommendation was helpful.
   * @example
   * await warmbly.advisor.feedback("rec_1", { helpful: false, reason: "already handled" });
   */
  feedback(
    id: string,
    params: { helpful: boolean; reason?: string; [key: string]: unknown },
  ): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      this.path("advisor", "recommendations", id, "feedback"),
      { body: params },
    );
  }
}
