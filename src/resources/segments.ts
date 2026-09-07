import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** How a segment combines its conditions. */
export type SegmentMatch = "all" | "any";

/** A manual membership override on one contact: pinned in, pinned out, or cleared. */
export type SegmentMemberMode = "include" | "exclude" | "auto";

/** The kind of a segment field, which decides the operators and value shape it accepts. */
export type SegmentFieldKind =
  | "text"
  | "enum"
  | "bool"
  | "date"
  | "number"
  | "category"
  | "campaign"
  | "segment"
  | (string & {});

/** One condition in a segment definition. Scalar operators take `value`, list operators `values`. */
export interface SegmentCondition {
  /** The field, e.g. `email_domain`, `last_opened_at`, or `custom.industry`. */
  field: string;
  /** The operator, e.g. `equals`, `contains`, `within_days`, `in`, `is_true`. */
  operator: string;
  /** The scalar operand, for text, date, and number operators. */
  value?: string;
  /** The list operand, for `in`/`not_in` operators. */
  values?: string[];
  [key: string]: unknown;
}

/** A saved contact audience: a condition list plus manual overrides, evaluated live. */
export interface Segment {
  id: string;
  organization_id?: string;
  created_by?: string;
  name: string;
  description?: string;
  /** A `#rrggbb` color. */
  color?: string;
  match?: SegmentMatch;
  conditions?: SegmentCondition[];
  /** Contacts matching right now (conditions plus overrides). */
  contact_count?: number;
  /** Contacts pinned in by hand. */
  included_count?: number;
  /** Contacts pinned out by hand. */
  excluded_count?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Segments.create}. Only `name` is required. */
export interface CreateSegmentParams {
  name: string;
  description?: string;
  /** A `#rrggbb` color. */
  color?: string;
  match?: SegmentMatch;
  conditions?: SegmentCondition[];
  [key: string]: unknown;
}

/** Body for {@link Segments.update}. Every field is optional. */
export interface UpdateSegmentParams {
  name?: string;
  description?: string;
  color?: string;
  match?: SegmentMatch;
  conditions?: SegmentCondition[];
  [key: string]: unknown;
}

/** Body for {@link Segments.preview}: an unsaved definition to count. */
export interface PreviewSegmentParams {
  /** Include this segment's manual overrides in the count, while editing it. */
  id?: string;
  match?: SegmentMatch;
  conditions: SegmentCondition[];
  [key: string]: unknown;
}

/** A field the segment builder can filter on, from {@link Segments.fields}. */
export interface SegmentField {
  field: string;
  label?: string;
  group?: string;
  kind?: SegmentFieldKind;
  /** The allowed values, for `enum` fields. */
  options?: string[];
  [key: string]: unknown;
}

/** Body for {@link Segments.setMembers}. */
export interface SetSegmentMembersParams {
  /** Contact ids, up to 1000 per call. Ids outside the organization are ignored. */
  contacts: string[];
  mode: SegmentMemberMode;
  [key: string]: unknown;
}

/** One pinned contact, from {@link Segments.overrides}. */
export interface SegmentOverride {
  contact_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  mode: SegmentMemberMode;
  created_at?: string;
  [key: string]: unknown;
}

/** The result of {@link Segments.addToCampaign}. */
export interface SegmentAddToCampaignResult {
  campaign_id: string;
  /** Leads created by this call. */
  added: number;
  /** Members the segment had at the time. */
  members: number;
  [key: string]: unknown;
}

/**
 * Saved contact audiences. A segment is a condition list plus per-contact manual
 * overrides, evaluated live on every read. Reads need `READ_CONTACTS`, writes
 * `WRITE_CONTACTS`; enrolling a segment into a campaign writes leads, so it takes
 * `WRITE_CAMPAIGNS`. Reachable as `warmbly.segments`.
 *
 * @example
 * const segment = await warmbly.segments.create({
 *   name: "Warm fintech leads",
 *   match: "all",
 *   conditions: [
 *     { field: "custom.industry", operator: "equals", value: "fintech" },
 *     { field: "last_opened_at", operator: "within_days", value: "30" },
 *   ],
 * });
 * await warmbly.segments.addToCampaign(segment.id, { campaign_id: "camp_1" });
 */
export class Segments extends APIResource {
  /**
   * Lists every segment with live counts. Not paginated (200 segments per workspace).
   * @example
   * const segments = await warmbly.segments.list();
   */
  list(opts?: RequestOptions): Promise<Segment[]> {
    return this.http.get<{ data: Segment[] }>("segments", opts).then((r) => r.data ?? []);
  }

  /**
   * Lists the fields a condition can name, with their kind and options. Custom fields
   * appear as `custom.<key>`.
   * @example
   * const fields = await warmbly.segments.fields();
   */
  fields(opts?: RequestOptions): Promise<SegmentField[]> {
    return this.http
      .get<{ data: SegmentField[] }>("segments/fields", opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Counts the contacts an unsaved definition would match. Pass `id` to keep that
   * segment's manual overrides in the count while editing it.
   * @example
   * const { contact_count } = await warmbly.segments.preview({ match: "all", conditions });
   */
  preview(params: PreviewSegmentParams): Promise<{ contact_count: number }> {
    return this.http.post<{ contact_count: number }>("segments/preview", { body: params });
  }

  /**
   * Creates a segment. A duplicate name is a 409.
   * @example
   * const s = await warmbly.segments.create({ name: "Replied last week" });
   */
  create(params: CreateSegmentParams): Promise<Segment> {
    return this.http.post<Segment>("segments", { body: params });
  }

  /**
   * Retrieves a segment by id.
   * @example
   * const s = await warmbly.segments.get("seg_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Segment> {
    return this.http.get<Segment>(this.path("segments", id), opts);
  }

  /**
   * Updates a segment. Fields you omit are left alone.
   * @example
   * await warmbly.segments.update("seg_1", { color: "#0284c7" });
   */
  update(id: string, params: UpdateSegmentParams): Promise<Segment> {
    return this.http.patch<Segment>(this.path("segments", id), { body: params });
  }

  /**
   * Deletes a segment. Refused with a 409 while another segment's conditions reference
   * it or a campaign has it linked as a live audience.
   * @example
   * await warmbly.segments.delete("seg_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("segments", id), opts);
  }

  /**
   * Pins contacts into (`include`) or out of (`exclude`) the segment, or clears their
   * override (`auto`). Up to 1000 ids per call. Returns how many rows changed.
   * @example
   * await warmbly.segments.setMembers("seg_1", { contacts: ["c_1"], mode: "include" });
   */
  setMembers(id: string, params: SetSegmentMembersParams): Promise<{ updated: number }> {
    return this.http.post<{ updated: number }>(this.path("segments", id, "members"), {
      body: params,
    });
  }

  /**
   * Looks up the manual override, if any, on each of the given contacts. Contacts with
   * no override are absent from the result.
   * @example
   * const modes = await warmbly.segments.memberModes("seg_1", ["c_1", "c_2"]);
   * // { c_1: "include" }
   */
  memberModes(
    id: string,
    contacts: string[],
  ): Promise<Record<string, Exclude<SegmentMemberMode, "auto">>> {
    return this.http
      .post<{ data: Record<string, Exclude<SegmentMemberMode, "auto">> }>(
        this.path("segments", id, "members", "lookup"),
        { body: { contacts } },
      )
      .then((r) => r.data ?? {});
  }

  /**
   * Lists every pinned contact, includes first, newest first, capped at 500.
   * @example
   * const pinned = await warmbly.segments.overrides("seg_1");
   */
  overrides(id: string, opts?: RequestOptions): Promise<SegmentOverride[]> {
    return this.http
      .get<{ data: SegmentOverride[] }>(this.path("segments", id, "overrides"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Enrolls every current member as a lead of the campaign, as a one-time snapshot.
   * Contacts already in the campaign are skipped, and a running campaign is woken.
   * Safe to retry. Requires `WRITE_CAMPAIGNS`. For a live link that keeps enrolling
   * new members, use `campaigns.setSegments`.
   * @example
   * const { added } = await warmbly.segments.addToCampaign("seg_1", { campaign_id: "camp_1" });
   */
  addToCampaign(
    id: string,
    params: { campaign_id: string; [key: string]: unknown },
  ): Promise<SegmentAddToCampaignResult> {
    return this.http.post<SegmentAddToCampaignResult>(
      this.path("segments", id, "add-to-campaign"),
      { body: params },
    );
  }
}
