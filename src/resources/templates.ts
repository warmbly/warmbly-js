import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** An email template. Documented-but-open shape. */
export interface Template {
  id: string;
  name?: string;
  subject?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for creating a template. */
export interface CreateTemplateParams {
  name?: string;
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

/** Query params for listing templates. */
export interface ListTemplatesParams {
  cursor?: string;
  limit?: number;
  [key: string]: unknown;
}

/**
 * Manage email templates: list, create, duplicate, render, score, reorder, and preview.
 * Reachable as `warmbly.templates`.
 *
 * @example
 * const t = await warmbly.templates.create({ name: "Intro", subject: "Hi {{first_name}}" });
 * const rendered = await warmbly.templates.render(t.id, { variables: { first_name: "Sam" } });
 */
export class Templates extends APIResource {
  /**
   * Lists templates, auto-paginating when iterated.
   * @example
   * for await (const t of warmbly.templates.list()) console.log(t.name);
   */
  list(params?: ListTemplatesParams): Promise<Page<Template>> {
    return this.http.getPage<Template>("templates", { query: params });
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
  update(id: string, params: Record<string, unknown>): Promise<Template> {
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
   * Renders a template with variables.
   * @example
   * const out = await warmbly.templates.render("tpl_1", { variables: { name: "Sam" } });
   */
  render(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("templates", id, "render"), {
      body: params,
    });
  }

  /**
   * Scores a template's quality/deliverability.
   * @example
   * const score = await warmbly.templates.score({ subject: "Hi", body: "..." });
   */
  score(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("templates/score", { body: params });
  }

  /**
   * Reorders templates.
   * @example
   * await warmbly.templates.reorder({ order: ["tpl_2", "tpl_1"] });
   */
  reorder(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("templates/reorder", { body: params });
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
