import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A reply template. Documented-but-open shape. */
export interface Template {
  id: string;
  organization_id?: string;
  user_id?: string;
  name?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  position?: number;
  /** @deprecated The server has no `body` field; use `body_html` and `body_plain`. */
  body?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for creating a template. Only `name` is required (up to 255 characters). */
export interface CreateTemplateParams {
  name: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  [key: string]: unknown;
}

/** Body for updating a template. Every field is optional. */
export interface UpdateTemplateParams {
  name?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  [key: string]: unknown;
}

/** The copy to score or analyze. Provide a subject and/or a body. */
export interface TemplateContentParams {
  subject?: string;
  body_html?: string;
  body_plain?: string;
  [key: string]: unknown;
}

/** Where in the copy a finding sits. */
export type TemplateField = "subject" | "body" | (string & {});

/** One exact fragment that triggered a rules issue. */
export interface TemplateSpan {
  field: TemplateField;
  /** The fragment as written in the copy. */
  text: string;
  /** 1-based line within the field. */
  line?: number;
  /** The whole line, for context. */
  excerpt?: string;
  [key: string]: unknown;
}

/** An advisory content problem found by the rules pass. */
export interface TemplateRulesIssue {
  /** `warn` or `high`. */
  severity: "warn" | "high" | (string & {});
  code: string;
  message: string;
  /** Set when the issue lives in exactly one of subject and body. */
  field?: TemplateField;
  spans?: TemplateSpan[];
  suggestion?: string;
  [key: string]: unknown;
}

/** The rules-based deliverability score of a template. Advisory: it never blocks sending. */
export interface TemplateScore {
  /** 0..100, higher is safer. */
  score: number;
  issues: TemplateRulesIssue[];
  [key: string]: unknown;
}

/** One located problem found by the AI analysis, most severe first. */
export interface TemplateAnalysisFinding {
  /** `high`, `warn` or `info`. */
  severity: "high" | "warn" | "info" | (string & {});
  /** Empty when the finding is about the email as a whole. */
  field?: TemplateField;
  /** The exact fragment quoted from the copy. */
  text?: string;
  line?: number;
  excerpt?: string;
  /** Why it hurts deliverability. */
  issue: string;
  /** What to write instead. */
  suggestion?: string;
  /** `trigger_word`, `tone`, `formatting`, `links`, `structure` or `authenticity`. */
  category?: string;
  [key: string]: unknown;
}

/** How the copy reads to its recipient, judged by the copy judge. */
export interface TemplateJudgment {
  /** 0 reads as a personal note, 1 reads as bulk mail. */
  reads_as: number;
  personalization: number;
  /** `one_clear_ask`, `several_asks` or `no_ask`. */
  ask: string;
  /** How strongly the copy makes a claim a spam filter would object to. */
  spam_claim: number;
  confidence: number;
  model: string;
  input_tokens: number;
  [key: string]: unknown;
}

/**
 * The result of {@link Templates.analyze}. When no language model is configured the
 * analysis falls back to the rules score and the judgment, with empty `findings` and no
 * charge.
 */
export interface TemplateAnalysis {
  /** 0..100, higher is safer. */
  score: number;
  /** One plain sentence on how the email will land. */
  verdict: string;
  findings: TemplateAnalysisFinding[];
  /** A rewritten subject line; absent when the current one is fine. */
  suggested_subject?: string;
  /** Copy-level suggestions with nothing specific to quote. */
  improvements?: string[];
  /** The rules pass, scored from the same reading of the copy. */
  rules: TemplateScore;
  /** Absent when the judge is unconfigured or unavailable. */
  judgment?: TemplateJudgment;
  model: string;
  tokens_used: number;
  credits_remaining: number;
  /** 0 on the judgment-only fallback. */
  credits_charged: number;
  [key: string]: unknown;
}

/** Body for {@link Templates.campaignPreview}. */
export interface CampaignPreviewParams {
  subject?: string;
  body_html?: string;
  body_plain?: string;
  /** A sample contact to render with; fields you omit fall back to a built-in sample. */
  contact?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    company?: string;
    phone?: string;
    custom_fields?: Record<string, string>;
  };
  /** Render a real contact instead of the sample. */
  contact_id?: string;
  campaign_id?: string;
  /** The sending mailbox, for the signature. */
  account_id?: string;
  /** The campaign step whose attachments to list. */
  step_id?: string;
  [key: string]: unknown;
}

/** A reply template rendered with variables. */
export interface RenderedTemplate {
  subject: string;
  body_html: string;
  body_plain: string;
  [key: string]: unknown;
}

/** Query params for listing templates. */
export interface ListTemplatesParams {
  /** Full-text search across template name, subject, and body. */
  q?: string;
  [key: string]: unknown;
}

/**
 * Manage reply templates: list, create, duplicate, render, score, analyze, reorder, and
 * preview. Reachable as `warmbly.templates`. Reads need `READ_TEMPLATES` and writes need
 * `WRITE_TEMPLATES`.
 *
 * @example
 * const t = await warmbly.templates.create({ name: "Intro", subject: "Hi {{.FirstName}}" });
 * const rendered = await warmbly.templates.render(t.id, { variables: { FirstName: "Sam" } });
 */
export class Templates extends APIResource {
  /**
   * Lists templates. This endpoint is not paginated; it returns the full set, optionally
   * narrowed by the `q` search query.
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
   * await warmbly.templates.create({ name: "Intro" });
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
   * Renders a template with variables: expands `{{.Key}}` placeholders in the subject and
   * both bodies from the `variables` map. Needs `READ_TEMPLATES`.
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
   * Scores copy's deliverability with the rules pass: a 0..100 score and the issues found,
   * each located by field and the exact fragments. Advisory, and free. Needs `READ_TEMPLATES`.
   * @example
   * const { score, issues } = await warmbly.templates.score({
   *   subject: "Hi",
   *   body_plain: "Quick question...",
   * });
   */
  score(params: TemplateContentParams): Promise<TemplateScore> {
    return this.http.post<TemplateScore>("templates/score", { body: params });
  }

  /**
   * AI spam analysis of copy: which word or sentence hurts deliverability, whether it is in
   * the subject or the body, and what to write instead, together with the rules score and
   * how the copy reads to its recipient. Charges AI credits (2) unless the deployment has no
   * language model, in which case it answers with the rules score and the judgment for free.
   * Send an `Idempotency-Key` to make a retry safe. Needs `WRITE_TEMPLATES`, an
   * organization with a plan or trial that includes the writing assistant, and the AI
   * permission. A 503 `ai_not_configured` means the deployment has neither a model nor the
   * judge.
   * @example
   * const analysis = await warmbly.templates.analyze({
   *   subject: "Quick question",
   *   body_plain: "Hi {{.FirstName}}, ...",
   * });
   * for (const f of analysis.findings) console.log(f.severity, f.text, "->", f.suggestion);
   */
  analyze(params: TemplateContentParams, opts?: RequestOptions): Promise<TemplateAnalysis> {
    return this.http.post<TemplateAnalysis>("templates/analyze", { ...opts, body: params });
  }

  /**
   * Reorders templates: every id in `ids` is repositioned in the listed order, and templates
   * not listed are left untouched. Returns the full set in the new order.
   * @example
   * const templates = await warmbly.templates.reorder({ ids: ["tpl_2", "tpl_1"] });
   */
  reorder(params: { ids: string[] }): Promise<Template[]> {
    return this.http
      .patch<{ data: Template[] }>("templates/reorder", { body: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Renders a campaign step exactly as the send path would for a contact, returning the
   * output plus parse errors and unresolved tokens (`POST /campaign-template-preview`). With
   * `campaign_id` and `account_id` it also applies the mailbox signature and the opt-out
   * footer and lists the attachments the send carries. Rendering a real `contact_id` also
   * needs `READ_CONTACTS`. Writes nothing. Needs `READ_CAMPAIGNS`.
   * @example
   * const preview = await warmbly.templates.campaignPreview({
   *   subject: "Hi {{first_name}}",
   *   body_plain: "Hello {{first_name}}",
   *   campaign_id: "c_1",
   * });
   */
  campaignPreview(params: CampaignPreviewParams): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("campaign-template-preview", { body: params });
  }
}
