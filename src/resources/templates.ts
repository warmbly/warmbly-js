import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A reply template. The copy lives in `body_html` and `body_plain`, not a single `body`. */
export interface Template {
  id: string;
  organization_id?: string;
  user_id?: string;
  name?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  /** 1-based order within the workspace, set by {@link Templates.reorder}. */
  position?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for creating a template. */
export interface CreateTemplateParams {
  /** Required, up to 255 characters. */
  name: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  [key: string]: unknown;
}

/** Body for updating a template. Omitted fields are left as they are. */
export interface UpdateTemplateParams {
  name?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  [key: string]: unknown;
}

/** Query params for listing templates. */
export interface ListTemplatesParams {
  /** Case-insensitive search across template name and subject. */
  q?: string;
  [key: string]: unknown;
}

/** The subject and bodies to evaluate, for {@link Templates.score} and {@link Templates.analyze}. */
export interface TemplateContentParams {
  subject?: string;
  body_html?: string;
  body_plain?: string;
  [key: string]: unknown;
}

/** A fragment of the copy that triggered a content issue. Open: the span shape may grow. */
export interface TemplateIssueSpan {
  [key: string]: unknown;
}

/** One issue the rules-based content score found. */
export interface TemplateScoreIssue {
  /** `warn` or `high`. */
  severity: "warn" | "high" | (string & {});
  code: string;
  message: string;
  /** `subject` or `body` when the issue lives in exactly one; empty when it spans both. */
  field?: string;
  spans?: TemplateIssueSpan[];
  /** The concrete fix, in one line. */
  suggestion?: string;
  [key: string]: unknown;
}

/** The advisory, rules-based content score. Never blocks sending. */
export interface TemplateScore {
  /** 0-100, higher is safer. */
  score: number;
  issues: TemplateScoreIssue[];
  [key: string]: unknown;
}

/** A located problem in the copy found by AI spam analysis. */
export interface TemplateAnalysisFinding {
  /** `high`, `warn` or `info`. */
  severity: "high" | "warn" | "info" | (string & {});
  /** `subject` or `body`; empty when nothing could be anchored in the copy. */
  field?: string;
  /** The exact fragment quoted from the copy. */
  text?: string;
  /** The 1-based line of that field the fragment sits on. */
  line?: number;
  /** The whole line, for context. */
  excerpt?: string;
  /** Why it hurts deliverability. */
  issue: string;
  /** What to write instead. */
  suggestion?: string;
  /** e.g. `trigger_word`, `tone`, `formatting`, `links`, `structure`, `authenticity`. */
  category?: string;
  [key: string]: unknown;
}

/** How the copy reads to its recipient, judged by TypeSafe. Costs no credits. */
export interface TemplateJudgment {
  reads_as: number;
  personalization: number;
  /** Whether the copy asks for one clear thing, none, or several. */
  ask: string;
  spam_claim: number;
  /** The lowest confidence across the scores and the choice. */
  confidence: number;
  model: string;
  input_tokens: number;
  [key: string]: unknown;
}

/** The result of {@link Templates.analyze}. */
export interface TemplateAnalysis {
  /** Overall 0-100 deliverability score, higher is safer. */
  score: number;
  /** A one-line reading of the copy. */
  verdict: string;
  /** Located problems, most severe first. Empty when only the judgment ran. */
  findings: TemplateAnalysisFinding[];
  /** A rewritten subject line; absent when the current one is fine. */
  suggested_subject?: string;
  /** Copy-level suggestions with nothing specific to quote. */
  improvements?: string[];
  /** The rules pass over the same copy, as {@link Templates.score} returns. */
  rules: TemplateScore;
  /** Present when the copy judge ran. */
  judgment?: TemplateJudgment;
  model: string;
  tokens_used: number;
  /** Credits this call cost (0 when only the judgment ran). */
  credits_charged: number;
  credits_remaining: number;
  charged_usd: number;
  balance_usd: number;
  [key: string]: unknown;
}

/** The result of {@link Templates.render}. */
export interface RenderedTemplate {
  subject: string;
  body_html: string;
  body_plain: string;
  [key: string]: unknown;
}

/**
 * Manage email templates: list, create, duplicate, render, score, reorder, and preview.
 * Reachable as `warmbly.templates`.
 *
 * @example
 * const t = await warmbly.templates.create({ name: "Intro", subject: "Hi {{.FirstName}}" });
 * const rendered = await warmbly.templates.render(t.id, { variables: { FirstName: "Sam" } });
 */
export class Templates extends APIResource {
  /**
   * Lists templates in position order. This endpoint is not paginated; it returns the full
   * set, optionally narrowed by the `q` search query (name and subject).
   * @example
   * for (const t of await warmbly.templates.list()) console.log(t.name);
   */
  list(params?: ListTemplatesParams): Promise<Template[]> {
    return this.http
      .get<{ data: Template[] }>("templates", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Creates a template.
   * @example
   * await warmbly.templates.create({ name: "Intro", subject: "Hi", body_plain: "Hello" });
   */
  create(params: CreateTemplateParams): Promise<Template> {
    return this.http.post<Template>("templates", { body: params });
  }

  /**
   * Retrieves a template by id.
   * @example
   * const t = await warmbly.templates.get("tpl_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Template> {
    return this.http.get<Template>(this.path("templates", id), opts);
  }

  /**
   * Updates a template.
   * @example
   * await warmbly.templates.update("tpl_1", { subject: "New subject" });
   */
  update(id: string, params: UpdateTemplateParams): Promise<Template> {
    return this.http.patch<Template>(this.path("templates", id), { body: params });
  }

  /**
   * Deletes a template.
   * @example
   * await warmbly.templates.delete("tpl_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("templates", id), opts);
  }

  /**
   * Duplicates a template.
   * @example
   * const copy = await warmbly.templates.duplicate("tpl_1");
   */
  duplicate(id: string, params?: Record<string, unknown>): Promise<Template> {
    return this.http.post<Template>(this.path("templates", id, "duplicate"), { body: params });
  }

  /**
   * Expands `{{.Key}}` placeholders in a template's subject and bodies from a variable
   * map. The body is optional; with none, every placeholder renders empty.
   * @example
   * const out = await warmbly.templates.render("tpl_1", { variables: { FirstName: "Sam" } });
   */
  render(
    id: string,
    params?: { variables?: Record<string, string>; [key: string]: unknown },
  ): Promise<RenderedTemplate> {
    return this.http.post<RenderedTemplate>(this.path("templates", id, "render"), {
      body: params,
    });
  }

  /**
   * Scores a draft's subject and bodies with the rules-based content check (0-100,
   * higher is safer). Advisory only; never blocks sending. Needs `READ_TEMPLATES`.
   * @example
   * const { score, issues } = await warmbly.templates.score({ subject: "Hi", body_plain: "..." });
   */
  score(params: TemplateContentParams): Promise<TemplateScore> {
    return this.http.post<TemplateScore>("templates/score", { body: params });
  }

  /**
   * Runs an AI spam analysis on a draft: which word or sentence hurts deliverability,
   * whether it is in the subject or the body, and what to write instead. The rules score
   * comes back under `rules` and TypeSafe's reading under `judgment`. Metered: the call
   * reserves credits first and settles real usage (see `credits_charged`). Fails with
   * `ai_not_configured` (503) on a deployment without AI. At least one of the three
   * fields must be non-empty and the total is capped at 60,000 characters. Needs
   * `WRITE_TEMPLATES` (the API-key scope) and the `use_ai` permission for members.
   * @example
   * const a = await warmbly.templates.analyze({ subject: "Act now!!!", body_plain: "Free money" });
   * for (const f of a.findings) console.log(f.severity, f.text, f.suggestion);
   */
  analyze(params: TemplateContentParams, opts?: RequestOptions): Promise<TemplateAnalysis> {
    return this.http.post<TemplateAnalysis>("templates/analyze", { ...opts, body: params });
  }

  /**
   * Reassigns positions across the workspace's templates in the listed order (1-indexed).
   * Templates not listed are left untouched. Returns the full ordered set.
   * @example
   * const { data } = await warmbly.templates.reorder({ ids: ["tpl_2", "tpl_1"] });
   */
  reorder(params: { ids: string[]; [key: string]: unknown }): Promise<{ data: Template[] }> {
    return this.http.patch<{ data: Template[] }>("templates/reorder", { body: params });
  }

  /**
   * Previews a campaign template (`POST /campaign-template-preview`).
   * @example
   * const preview = await warmbly.templates.campaignPreview({ campaign_id: "c_1" });
   */
  campaignPreview(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("campaign-template-preview", { body: params });
  }
}
