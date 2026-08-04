import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/**
 * An organization playbook every AI feature follows: the assistant, campaign switches,
 * reply drafts, and compose drafts all read the enabled skills as extra instructions.
 */
export interface AISkill {
  id: string;
  org_id?: string;
  name?: string;
  description?: string;
  /** The playbook text handed to the model. */
  content?: string;
  /** Disabled skills stay saved but stop influencing generations. */
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link AISkills.create}. */
export interface CreateAISkillParams {
  name: string;
  description?: string;
  content?: string;
  /** Defaults to enabled. */
  enabled?: boolean;
  [key: string]: unknown;
}

/** Body for {@link AISkills.update}. Every field is optional. */
export interface UpdateAISkillParams {
  name?: string;
  description?: string;
  content?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * AI skills: the organization playbooks every AI surface follows. Reachable as
 * `warmbly.aiSkills`. Needs the `AI_AGENT` scope for API keys, or `manage_settings` for
 * dashboard users. Every mutation is audited.
 *
 * @example
 * await warmbly.aiSkills.create({
 *   name: "House style",
 *   content: "Never open with a compliment. Keep emails under 90 words.",
 * });
 */
export class AISkills extends APIResource {
  /**
   * Lists the organization's skills.
   * @example
   * const skills = await warmbly.aiSkills.list();
   */
  list(params?: Record<string, unknown>): Promise<AISkill[]> {
    return this.http
      .get<{ data: AISkill[] }>("ai/skills", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Creates a skill.
   * @example
   * const skill = await warmbly.aiSkills.create({ name: "Pricing rules", content: "..." });
   */
  create(params: CreateAISkillParams): Promise<AISkill> {
    return this.http.post<AISkill>("ai/skills", { body: params });
  }

  /**
   * Updates a skill. Flipping `enabled` is how you retire one without losing it.
   * @example
   * await warmbly.aiSkills.update("skill_1", { enabled: false });
   */
  update(id: string, params: UpdateAISkillParams): Promise<AISkill> {
    return this.http.patch<AISkill>(this.path("ai", "skills", id), { body: params });
  }

  /**
   * Deletes a skill.
   * @example
   * await warmbly.aiSkills.delete("skill_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(this.path("ai", "skills", id), opts);
  }
}
