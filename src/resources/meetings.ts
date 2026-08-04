import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Where a meeting is in its lifecycle. */
export type MeetingStatus = "booked" | "rescheduled" | "canceled" | "completed" | "no_show";

/** A booked call, captured from a scheduling provider or logged by hand. */
export interface Meeting {
  id: string;
  organization_id?: string;
  /** `"calendly"`, `"cal_com"`, or `"manual"`. */
  source?: string;
  external_event_id?: string;
  status?: MeetingStatus;
  invitee_email?: string;
  invitee_name?: string;
  event_name?: string;
  event_type?: string;
  scheduled_for?: string | null;
  end_time?: string | null;
  join_url?: string;
  location?: string;
  cancel_url?: string;
  reschedule_url?: string;
  canceled_reason?: string;
  contact_id?: string | null;
  campaign_id?: string | null;
  /** Joined for list display, not stored on the row. */
  contact_name?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Query params for {@link Meetings.list}. */
export interface ListMeetingsParams {
  /** Narrow to `"upcoming"` or `"past"`. Omit for both. */
  timeframe?: "upcoming" | "past";
  status?: MeetingStatus;
  /** Free-text search across the invitee and event name. */
  q?: string;
  /** Max rows, 1..200. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Body for {@link Meetings.create}: a call you schedule or log by hand. */
export interface CreateMeetingParams {
  /** Defaults to `"Call"` when omitted. */
  title?: string;
  /** A name or an email is required. */
  invitee_name?: string;
  invitee_email?: string;
  /** ISO-8601 start time. Required. */
  scheduled_for: string;
  duration_minutes?: number;
  location?: string;
  join_url?: string;
  /** Link the meeting to a specific contact. Otherwise it is matched by invitee email. */
  contact_id?: string;
  [key: string]: unknown;
}

/**
 * Booked calls from connected scheduling providers (Calendly, Cal.com), plus meetings
 * you log by hand. Reachable as `warmbly.meetings`. Reads need `READ_CONTACTS`; writes
 * need `WRITE_CONTACTS`.
 *
 * @example
 * for await (const m of await warmbly.meetings.list({ timeframe: "upcoming" })) {
 *   console.log(m.scheduled_for, m.invitee_email);
 * }
 */
export class Meetings extends APIResource {
  /**
   * Lists meetings, auto-paginating when iterated.
   * @example
   * const page = await warmbly.meetings.list({ timeframe: "past", q: "acme" });
   */
  list(params?: ListMeetingsParams): Promise<Page<Meeting>> {
    return this.http.getPage<Meeting>("meetings", { query: params });
  }

  /**
   * Returns the counts behind the Meetings page header.
   * @example
   * const summary = await warmbly.meetings.summary();
   */
  summary(opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("meetings/summary", opts);
  }

  /**
   * Logs a meeting by hand (source `"manual"`). Unlike an auto-captured booking it fires
   * no "a prospect booked a call" alerts back at you.
   *
   * @example
   * await warmbly.meetings.create({
   *   invitee_email: "jordan@acme.com",
   *   scheduled_for: "2026-08-10T15:00:00Z",
   *   duration_minutes: 30,
   * });
   */
  create(params: CreateMeetingParams): Promise<Meeting> {
    return this.http.post<Meeting>("meetings", { body: params });
  }

  /**
   * Deletes a meeting.
   * @example
   * await warmbly.meetings.delete("mtg_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(this.path("meetings", id), opts);
  }
}
