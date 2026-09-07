import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Whether a suppression entry is one address or a whole domain. */
export type SuppressionKind = "email" | "domain";

/** What put an entry on the suppression list. */
export type SuppressionSource =
  | "bounce"
  | "complaint"
  | "unsubscribe"
  | "manual"
  | "import"
  | (string & {});

/** One entry on the workspace suppression list: an address or domain no campaign will email. */
export interface Suppression {
  id: string;
  organization_id?: string;
  /** The address, or the bare host for a `domain` entry. */
  email: string;
  kind: SuppressionKind;
  reason?: string;
  source?: SuppressionSource;
  campaign_id?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Query params for {@link Suppressions.list}. */
export interface ListSuppressionsParams {
  /** Substring filter on the address or domain. */
  q?: string;
  /** Page size, 1..200 (default 50). */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** One value to suppress. A value with `@` is an address; a bare host (or `@host`) is a domain. */
export interface SuppressionEntryInput {
  value: string;
  /** Overrides the request-level `reason` for this entry. */
  reason?: string;
  [key: string]: unknown;
}

/** Body for {@link Suppressions.add}. At most 5000 entries per request. */
export interface AddSuppressionsParams {
  entries: SuppressionEntryInput[];
  /** Applied to every entry without its own reason. */
  reason?: string;
  [key: string]: unknown;
}

/** The result of {@link Suppressions.add}. */
export interface AddSuppressionsResult {
  added: number;
  /** Values that were neither an address nor a domain. They did not fail the request. */
  skipped: string[];
  [key: string]: unknown;
}

/**
 * The workspace suppression list: every address and domain no campaign will email,
 * whatever put it there. Reading needs `READ_CONTACTS`; adding or lifting an entry
 * changes who gets mail, so it needs `WRITE_CONTACTS`. Reachable as `warmbly.suppressions`.
 *
 * @example
 * await warmbly.suppressions.add({
 *   entries: [{ value: "dana@acme.com" }, { value: "competitor.io" }],
 *   reason: "Existing customers",
 * });
 * for await (const s of await warmbly.suppressions.list()) console.log(s.email, s.source);
 */
export class Suppressions extends APIResource {
  /**
   * Pages the suppression list, newest first. Expired entries are not returned.
   * @example
   * const page = await warmbly.suppressions.list({ q: "acme.com" });
   */
  list(params?: ListSuppressionsParams): Promise<Page<Suppression>> {
    return this.http.getPage<Suppression>("suppressions", { query: params });
  }

  /**
   * Adds addresses and domains. Existing values are updated in place, so the call is
   * safe to repeat. Adding an address also switches off the matching contact's
   * `subscribed` flag.
   * @example
   * const { added, skipped } = await warmbly.suppressions.add({ entries: [{ value: "x@y.com" }] });
   */
  add(params: AddSuppressionsParams): Promise<AddSuppressionsResult> {
    return this.http.post<AddSuppressionsResult>("suppressions", { body: params });
  }

  /**
   * Lifts one entry so campaigns can email the address (or domain) again, restoring the
   * matching contact's `subscribed` flag. Written to the audit log.
   * @example
   * await warmbly.suppressions.remove("sup_1");
   */
  remove(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("suppressions", id), opts);
  }
}
