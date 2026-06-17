import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A unified-inbox conversation item. Documented-but-open shape. */
export interface UniboxItem {
  id: string;
  thread_id?: string;
  subject?: string;
  from?: string;
  seen?: boolean;
  snoozed_until?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

/** A scheduled (queued) unibox task. */
export interface UniboxScheduledTask {
  task_id: string;
  [key: string]: unknown;
}

/** Query params for listing the unibox. */
export interface ListUniboxParams {
  cursor?: string;
  limit?: number;
  status?: string;
  [key: string]: unknown;
}

/**
 * The unified inbox: list, count, thread reads, labels, seen state, replies, snoozes,
 * and scheduled sends. Reachable as `warmbly.unibox`.
 *
 * @example
 * const page = await warmbly.unibox.list({ status: "unread" });
 * await warmbly.unibox.reply({ thread_id: page.data[0]!.thread_id, body: "Thanks!" });
 */
export class Unibox extends APIResource {
  /**
   * Lists unibox conversations, auto-paginating when iterated.
   * @example
   * for await (const item of await warmbly.unibox.list()) console.log(item.subject);
   */
  list(params?: ListUniboxParams): Promise<Page<UniboxItem>> {
    return this.http.getPage<UniboxItem>("unibox", { query: params });
  }

  /**
   * Returns conversation counts (e.g. unread totals).
   * @example
   * const counts = await warmbly.unibox.count();
   */
  count(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/count", { query: params });
  }

  /**
   * Returns an inbox overview summary.
   * @example
   * const overview = await warmbly.unibox.overview();
   */
  overview(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/overview", { query: params });
  }

  /**
   * Retrieves a single unibox conversation by id.
   * @example
   * const item = await warmbly.unibox.get("ub_1");
   */
  get(id: string, opts?: RequestOptions): Promise<UniboxItem> {
    return this.http.get<UniboxItem>(this.path("unibox", id), opts);
  }

  /**
   * Fetches a full thread (via the `thread` query, e.g. by `thread_id`).
   * @example
   * const thread = await warmbly.unibox.thread({ thread_id: "t_1" });
   */
  thread(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/thread", { query: params });
  }

  /**
   * Reads the labels on a thread.
   * @example
   * const labels = await warmbly.unibox.getThreadLabels({ thread_id: "t_1" });
   */
  getThreadLabels(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/thread/labels", { query: params });
  }

  /**
   * Replaces the labels on a thread.
   * @example
   * await warmbly.unibox.setThreadLabels({ thread_id: "t_1", labels: ["lead"] });
   */
  setThreadLabels(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>("unibox/thread/labels", { body: params });
  }

  /**
   * Marks conversations as seen.
   * @example
   * await warmbly.unibox.markSeen({ ids: ["ub_1"], seen: true });
   */
  markSeen(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("unibox/seen", { body: params });
  }

  /**
   * Sends a reply within a thread.
   * @example
   * await warmbly.unibox.reply({ thread_id: "t_1", body: "Thanks!" });
   */
  reply(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("unibox/reply", { body: params });
  }

  /**
   * Lists active snoozes.
   * @example
   * const snoozes = await warmbly.unibox.listSnoozes();
   */
  listSnoozes(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/snoozes", { query: params });
  }

  /**
   * Snoozes a conversation until a given time.
   * @example
   * await warmbly.unibox.snooze({ thread_id: "t_1", until: "2026-07-01T09:00:00Z" });
   */
  snooze(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("unibox/snooze", { body: params });
  }

  /**
   * Removes a snooze. The thread is identified by the `thread_id` query parameter.
   * @example
   * await warmbly.unibox.unsnooze({ thread_id: "t_1" });
   */
  unsnooze(params: {
    thread_id: string;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    return this.http.delete<Record<string, unknown>>("unibox/snooze", { query: params });
  }

  /**
   * Lists scheduled (queued) sends.
   * @example
   * const scheduled = await warmbly.unibox.scheduled();
   */
  scheduled(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("unibox/scheduled", { query: params });
  }

  /**
   * Cancels a scheduled send by task id.
   * @example
   * await warmbly.unibox.cancelScheduled("task_1");
   */
  cancelScheduled(taskId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("unibox", "scheduled", taskId), opts);
  }
}
