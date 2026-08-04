import { APIResource } from "./base";

/**
 * What every generation endpoint reports alongside its output: the real cost of the
 * call, settled against actual token usage rather than a flat label.
 */
export interface GenerationUsage {
  /** The organization's spendable credit balance after the call. */
  credits_remaining?: number;
  /** Credits this call actually cost, after the usage settle. */
  credits_charged?: number;
  tokens_used?: number;
  /** The model tier the call ran on. */
  model?: string;
  [key: string]: unknown;
}

/** The output of a generation call: the generated text plus its real cost. */
export interface GenerationResult extends GenerationUsage {
  /** The generated (or rewritten) text. */
  text?: string;
}

/** Body for {@link Generation.write}. */
export interface WriteParams {
  /** What to write. */
  prompt: string;
  /** An optional tone hint, e.g. `"friendly"` or `"formal"`. */
  tone?: string;
  [key: string]: unknown;
}

/** Body for {@link Generation.edit}: rewrite one passage under an instruction. */
export interface EditParams {
  /** The passage to rewrite. Fenced as untrusted content, so instructions inside it are ignored. */
  text: string;
  /** What to do to it, e.g. `"shorten"` or `"make it friendlier"`. */
  instruction: string;
  /** Surrounding copy, for continuity. Not rewritten. */
  context?: string;
  tone?: string;
  [key: string]: unknown;
}

/** Body for {@link Generation.aiVariable}: preview one per-recipient AI variable block. */
export interface AIVariableParams {
  /** `"instant"` resolves from the contact record; `"research"` looks the company up. */
  mode?: "instant" | "research";
  /** The block's instruction. */
  prompt: string;
  tone?: string;
  /** Whether to allow a web lookup about the contact's company. Costs an extra credit when results land. */
  web_search?: boolean;
  /** Resolve against this contact. Omit to render against a sample contact. */
  contact_id?: string;
  /** Copy before the block, for continuity. */
  context_before?: string;
  /** Copy after the block, for continuity. */
  context_after?: string;
  [key: string]: unknown;
}

/**
 * AI writing: compose new copy, rewrite a selection, and preview a per-recipient AI
 * variable. Reachable as `warmbly.generation`.
 *
 * Every call charges AI credits and reports the real cost in the response. Requires the
 * `WRITE_CAMPAIGNS` scope (and, for dashboard users, the "use AI" organization
 * permission).
 *
 * @example
 * const draft = await warmbly.generation.write({ prompt: "A short intro to a CTO", tone: "direct" });
 * console.log(draft.text, draft.credits_charged);
 */
export class Generation extends APIResource {
  /**
   * Writes new copy from a prompt.
   * @example
   * const out = await warmbly.generation.write({ prompt: "Follow-up after no reply" });
   */
  write(params: WriteParams): Promise<GenerationResult> {
    return this.http.post<GenerationResult>("generation/write", { body: params });
  }

  /**
   * Rewrites one passage under an instruction. The passage is fenced as untrusted
   * content, so prompt injection inside it is ignored. Idempotent, and refunded if the
   * provider fails.
   *
   * @example
   * const out = await warmbly.generation.edit({ text: selection, instruction: "shorten" });
   */
  edit(params: EditParams): Promise<GenerationResult> {
    return this.http.post<GenerationResult>("generation/edit", { body: params });
  }

  /**
   * Previews a per-recipient AI variable block against a sample or a specific contact —
   * the editor's "Preview" button. Same credit semantics as {@link Generation.write}.
   *
   * @example
   * const out = await warmbly.generation.aiVariable({
   *   mode: "instant",
   *   prompt: "One line about what their company does",
   *   contact_id: "c_1",
   * });
   */
  aiVariable(params: AIVariableParams): Promise<GenerationResult> {
    return this.http.post<GenerationResult>("generation/ai-variable", { body: params });
  }
}
