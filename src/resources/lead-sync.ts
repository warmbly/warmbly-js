import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** What happens when an incoming row's email matches an existing contact. */
export type ImportDedupStrategy = "skip" | "update" | "create_duplicate";

/** Maps one spreadsheet or CSV column onto a contact field. */
export interface ImportColumnMapping {
  /** The column's zero-based position in the sheet. */
  index: number;
  /**
   * The contact field to write: `ignore`, `email`, `first_name`, `last_name`,
   * `company`, `phone`, `subscribed`, `categories`, `verification_status`, or
   * `custom` with the name in `custom_key`. `custom:<key>` is the older spelling and
   * is still accepted. Exactly one column must map to `email`.
   */
  target: string;
  /**
   * The custom-field key, split out so clients need not parse `target`. May use
   * letters, numbers, underscores, spaces, and dashes; anything else is a 400.
   */
  custom_key?: string;
  /**
   * On a `verification_status` column, the service whose vocabulary the cells are
   * written in (`zerobounce`, `millionverifier`, ...). Omit to recognise them
   * value by value.
   */
  verification_provider?: string;
  [key: string]: unknown;
}

/** Where a lead-sync source stands. */
export type LeadSyncStatus = string;

/** A saved Google Sheets source you re-run with "Sync now". */
export interface LeadSyncSource {
  id: string;
  organization_id?: string;
  created_by_user_id?: string;
  provider?: string;
  /** The integration connection the sheet is read through. */
  connection_id?: string;
  sheet_id?: string;
  sheet_title?: string;
  tab_title?: string;
  a1_range?: string;
  has_header?: boolean;
  column_mapping?: ImportColumnMapping[];
  dedup?: ImportDedupStrategy;
  /** Add synced contacts to this campaign. */
  target_campaign_id?: string | null;
  category_ids?: string[];
  subscribed_default?: boolean;
  label?: string;
  status?: LeadSyncStatus;
  last_synced_at?: string | null;
  /** Counts from the most recent run. */
  last_result?: Record<string, unknown> | null;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link LeadSync.createSource}. */
export interface CreateLeadSyncSourceParams {
  connection_id: string;
  sheet_id: string;
  sheet_title?: string;
  tab_title?: string;
  has_header?: boolean;
  column_mapping?: ImportColumnMapping[];
  dedup?: ImportDedupStrategy;
  target_campaign_id?: string | null;
  category_ids?: string[];
  subscribed_default?: boolean;
  label?: string;
  [key: string]: unknown;
}

/** Body for {@link LeadSync.updateSource}. Every field is optional. */
export type UpdateLeadSyncSourceParams = Partial<CreateLeadSyncSourceParams>;

/** Whether a Google account is connected for lead sync, and which one. */
export interface LeadSyncConnection {
  connected: boolean;
  connection: {
    id: string;
    external_account_name?: string;
    status?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

/**
 * On-demand Google Sheets to contacts sync. A saved source is re-run with "Sync now":
 * new rows create contacts and rows matched by email update. Reachable as
 * `warmbly.leadSync`. Gated on `WRITE_CONTACTS`, because it ultimately upserts contacts.
 *
 * Connect the Google account itself through the integrations OAuth flow with provider
 * `google_sheets` — that handshake is JWT-only.
 *
 * @example
 * const { connected } = await warmbly.leadSync.googleConnection();
 * if (connected) {
 *   const sources = await warmbly.leadSync.listSources();
 *   await warmbly.leadSync.syncNow(sources[0]!.id);
 * }
 */
export class LeadSync extends APIResource {
  /**
   * Reports whether a Google account is connected for lead sync.
   * @example
   * const { connected, connection } = await warmbly.leadSync.googleConnection();
   */
  googleConnection(opts?: RequestOptions): Promise<LeadSyncConnection> {
    return this.http.get<LeadSyncConnection>("lead-sync/google/connection", opts);
  }

  /**
   * Reads a spreadsheet's metadata (its tabs and their headers) so you can build a
   * column mapping.
   *
   * @example
   * const meta = await warmbly.leadSync.spreadsheet({ connection_id: "conn_1", sheet_id: "1AbC" });
   */
  spreadsheet(params: {
    connection_id: string;
    sheet_id: string;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("lead-sync/google/spreadsheet", {
      body: params,
    });
  }

  /**
   * Previews what a sync would import, without writing anything.
   * @example
   * const preview = await warmbly.leadSync.preview({
   *   connection_id: "conn_1",
   *   sheet_id: "1AbC",
   *   tab_title: "Leads",
   * });
   */
  preview(params: {
    connection_id: string;
    sheet_id: string;
    tab_title?: string;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("lead-sync/google/preview", { body: params });
  }

  /**
   * Lists the saved sync sources.
   * @example
   * const sources = await warmbly.leadSync.listSources();
   */
  listSources(params?: Record<string, unknown>): Promise<LeadSyncSource[]> {
    return this.http
      .get<{ data: LeadSyncSource[] }>("lead-sync/sources", { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Saves a new sync source.
   * @example
   * const source = await warmbly.leadSync.createSource({
   *   connection_id: "conn_1",
   *   sheet_id: "1AbC",
   *   tab_title: "Leads",
   *   has_header: true,
   *   dedup: "update",
   * });
   */
  createSource(params: CreateLeadSyncSourceParams): Promise<LeadSyncSource> {
    return this.http.post<LeadSyncSource>("lead-sync/sources", { body: params });
  }

  /**
   * Retrieves one sync source.
   * @example
   * const source = await warmbly.leadSync.getSource("ls_1");
   */
  getSource(id: string, opts?: RequestOptions): Promise<LeadSyncSource> {
    return this.http.get<LeadSyncSource>(this.path("lead-sync", "sources", id), opts);
  }

  /**
   * Updates a sync source.
   * @example
   * await warmbly.leadSync.updateSource("ls_1", { dedup: "skip" });
   */
  updateSource(id: string, params: UpdateLeadSyncSourceParams): Promise<LeadSyncSource> {
    return this.http.patch<LeadSyncSource>(this.path("lead-sync", "sources", id), { body: params });
  }

  /**
   * Deletes a sync source. Contacts it already imported are left alone.
   * @example
   * await warmbly.leadSync.deleteSource("ls_1");
   */
  deleteSource(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("lead-sync", "sources", id), opts);
  }

  /**
   * Runs a sync source now and returns the import result.
   * @example
   * const result = await warmbly.leadSync.syncNow("ls_1");
   */
  syncNow(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("lead-sync", "sources", id, "sync"), {
      body: params,
    });
  }
}
