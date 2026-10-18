import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** The account an Apollo key acts as, and what the connection has done. */
export interface ApolloOverview {
  connection_id: string;
  label: string;
  /** For example `connected` or `reauth_required` (a rejected key). */
  status: string;
  health: string;
  health_detail?: string;
  account_name?: string;
  account_email?: string;
  /** Saved list imports. */
  sources: number;
  total_imported: number;
  last_run_at?: string;
  [key: string]: unknown;
}

/** A saved Apollo list of contacts. */
export interface ApolloList {
  id: string;
  name: string;
  count: number;
  [key: string]: unknown;
}

/** One sample person of a list preview. */
export interface ApolloPreviewRow {
  apollo_id: string;
  name: string;
  email: string;
  email_status: string;
  title: string;
  company: string;
  already_in_warmbly: boolean;
  will_import: boolean;
  [key: string]: unknown;
}

/** The first people of a list and how many it holds. */
export interface ApolloPreview {
  total: number;
  sample: ApolloPreviewRow[];
  [key: string]: unknown;
}

/** What one list import run did. */
export interface ApolloRunResult {
  read: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  no_email: number;
  /** Skipped because `verified_only` is on and Apollo has not verified the address. */
  unverified: number;
  suppressed: number;
  already_seen: number;
  truncated?: boolean;
  /** Where the next run resumes reading a list too long for one run. */
  next_page?: number;
  [key: string]: unknown;
}

/** A saved Apollo list that feeds contacts into Warmbly. */
export interface ApolloImportSource {
  id: string;
  organization_id: string;
  connection_id: string;
  created_by_user_id?: string;
  name: string;
  list_id: string;
  list_name: string;
  campaign_id?: string;
  category_ids: string[];
  verified_only: boolean;
  recurring: boolean;
  enabled: boolean;
  /** For example `idle`, `running`, `error`. */
  status: string;
  last_run_at?: string;
  last_result?: ApolloRunResult;
  last_error?: string;
  total_imported: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Body for {@link Apollo.createImportSource}. */
export interface CreateApolloImportSourceParams {
  /** The Apollo list id, up to 64 characters. */
  list_id: string;
  list_name?: string;
  /** Defaults to the list name. */
  name?: string;
  campaign_id?: string;
  category_ids?: string[];
  /** Import only addresses Apollo has verified. Defaults to on. */
  verified_only?: boolean;
  recurring?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Body for {@link Apollo.updateImportSource}. Send `campaign_id: null` to detach the campaign. */
export interface UpdateApolloImportSourceParams {
  name?: string;
  campaign_id?: string | null;
  category_ids?: string[];
  verified_only?: boolean;
  recurring?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Where an enrichment run stands. */
export type ApolloEnrichmentStatus = "queued" | "running" | "done" | "error" | (string & {});

/** One background request to enrich Warmbly contacts through Apollo's people match. */
export interface ApolloEnrichmentRun {
  id: string;
  organization_id: string;
  connection_id: string;
  requested_by_user_id?: string;
  /** Overwrite fields that already have a value. */
  overwrite: boolean;
  status: ApolloEnrichmentStatus;
  total: number;
  processed: number;
  enriched: number;
  not_found: number;
  failed: number;
  /** Apollo credits the run spent. */
  credits_consumed: number;
  last_error?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Body for {@link Apollo.startEnrichment}. Pick contacts by id (`contacts`), or by the
 * filter a list was showing (`all` plus `filters`, minus `exclude`). At most 5,000 per run.
 */
export interface StartApolloEnrichmentParams {
  /** Contact ids. */
  contacts?: string[];
  /** The older spelling of `contacts`, used when `contacts` is empty and `all` is off. */
  contact_ids?: string[];
  /** Switch the selection from the id list to `filters`. */
  all?: boolean;
  /** The same body `contacts.search` takes. */
  filters?: Record<string, unknown>;
  /** Ids to drop from the resolved set. Ignored unless `all` is set. */
  exclude?: string[];
  /** Replace values the contact already has. */
  overwrite?: boolean;
  [key: string]: unknown;
}

/**
 * Apollo: import saved lists into contacts and enrich existing contacts, through an Apollo
 * API key stored on an integration connection. `connectionId` is the id of an Apollo
 * connection. Reachable as `warmbly.integrations.apollo`.
 *
 * Every method needs `INTEGRATIONS`; starting an enrichment also needs `BULK_CONTACTS`
 * because it writes contacts and spends your Apollo credits. A rejected Apollo key is a
 * 422 with code `apollo_key_rejected`, a missing one `apollo_key_missing`, and Apollo's
 * own throttle a 429 `apollo_rate_limited`.
 *
 * @example
 * const lists = await warmbly.integrations.apollo.lists("conn_1");
 * const source = await warmbly.integrations.apollo.createImportSource("conn_1", {
 *   list_id: lists[0]!.id,
 *   recurring: true,
 * });
 */
export class Apollo extends APIResource {
  /**
   * The Apollo page header: the account the key acts as and what the connection has done.
   * Needs `INTEGRATIONS`.
   * @example
   * const overview = await warmbly.integrations.apollo.overview("conn_1");
   */
  overview(connectionId: string, opts?: RequestOptions): Promise<ApolloOverview> {
    return this.http.get<ApolloOverview>(this.base(connectionId), opts);
  }

  /**
   * Checks a new API key against Apollo and swaps it in (a PUT, so a retry converges),
   * then returns the refreshed overview.
   * Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.replaceKey("conn_1", { api_key: process.env.APOLLO_API_KEY! });
   */
  replaceKey(
    connectionId: string,
    params: { api_key: string },
    opts?: RequestOptions,
  ): Promise<ApolloOverview> {
    return this.http.put<ApolloOverview>(this.base(connectionId, "key"), { ...opts, body: params });
  }

  /**
   * Lists the account's saved contact lists.
   * Needs `INTEGRATIONS`.
   * @example
   * const lists = await warmbly.integrations.apollo.lists("conn_1");
   */
  lists(connectionId: string, opts?: RequestOptions): Promise<ApolloList[]> {
    return this.http
      .get<{ data: ApolloList[] }>(this.base(connectionId, "lists"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Reads the first people of a list without importing. Read-only. `verified_only`
   * defaults to on.
   * Needs `INTEGRATIONS`.
   * @example
   * const preview = await warmbly.integrations.apollo.previewImport("conn_1", { list_id: "lst_1" });
   */
  previewImport(
    connectionId: string,
    params: { list_id: string; verified_only?: boolean },
    opts?: RequestOptions,
  ): Promise<ApolloPreview> {
    return this.http.post<ApolloPreview>(this.base(connectionId, "import", "preview"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Lists the connection's saved list imports.
   * Needs `INTEGRATIONS`.
   * @example
   * const sources = await warmbly.integrations.apollo.importSources("conn_1");
   */
  importSources(connectionId: string, opts?: RequestOptions): Promise<ApolloImportSource[]> {
    return this.http
      .get<{ data: ApolloImportSource[] }>(this.base(connectionId, "import-sources"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Saves a list import and starts its first run (answers 201). People are deduplicated by
   * address, so a retried create makes a second source whose run imports nothing new; pass
   * an `idempotencyKey` in `opts` to replay the first response instead.
   * Needs `INTEGRATIONS`.
   * @example
   * const source = await warmbly.integrations.apollo.createImportSource("conn_1", { list_id: "lst_1" });
   */
  createImportSource(
    connectionId: string,
    params: CreateApolloImportSourceParams,
    opts?: RequestOptions,
  ): Promise<ApolloImportSource> {
    return this.http.post<ApolloImportSource>(this.base(connectionId, "import-sources"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Edits a list import's targets, filter and schedule. `campaign_id: null` detaches the
   * campaign; omitting it leaves it.
   * Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.updateImportSource("conn_1", "src_1", { verified_only: false });
   */
  updateImportSource(
    connectionId: string,
    sourceId: string,
    params: UpdateApolloImportSourceParams,
    opts?: RequestOptions,
  ): Promise<ApolloImportSource> {
    return this.http.patch<ApolloImportSource>(
      this.base(connectionId, "import-sources", sourceId),
      { ...opts, body: params },
    );
  }

  /**
   * Starts an import run now and returns the source. A second request while one runs is a
   * 409, so retries cannot double-run it.
   * Needs `INTEGRATIONS`.
   * @example
   * const source = await warmbly.integrations.apollo.runImportSource("conn_1", "src_1");
   */
  runImportSource(
    connectionId: string,
    sourceId: string,
    opts?: RequestOptions,
  ): Promise<ApolloImportSource> {
    return this.http.post<ApolloImportSource>(
      this.base(connectionId, "import-sources", sourceId, "run"),
      opts,
    );
  }

  /**
   * Removes a list import. Contacts it already brought in stay.
   * Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.deleteImportSource("conn_1", "src_1");
   */
  deleteImportSource(connectionId: string, sourceId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.base(connectionId, "import-sources", sourceId), opts);
  }

  /**
   * Lists the connection's recent enrichment runs (not paginated; `limit` is 1 to 100,
   * default 20).
   * Needs `INTEGRATIONS`.
   * @example
   * const runs = await warmbly.integrations.apollo.enrichments("conn_1", { limit: 5 });
   */
  enrichments(
    connectionId: string,
    params?: { limit?: number },
    opts?: RequestOptions,
  ): Promise<ApolloEnrichmentRun[]> {
    return this.http
      .get<{ data: ApolloEnrichmentRun[] }>(this.base(connectionId, "enrichments"), {
        ...opts,
        query: { ...opts?.query, limit: params?.limit },
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Queues a background enrichment of up to 5,000 contacts through Apollo's people match
   * and returns the run (answers 202). It spends your Apollo credits. Without an
   * idempotency key a retry queues a second run, which only rewrites the same fields; the
   * client sends one automatically when it may retry.
   * Needs `INTEGRATIONS` and `BULK_CONTACTS`.
   * @example
   * const run = await warmbly.integrations.apollo.startEnrichment("conn_1", {
   *   contacts: ["c_1", "c_2"],
   *   overwrite: false,
   * });
   */
  startEnrichment(
    connectionId: string,
    params: StartApolloEnrichmentParams,
    opts?: RequestOptions,
  ): Promise<ApolloEnrichmentRun> {
    return this.http.post<ApolloEnrichmentRun>(this.base(connectionId, "enrichments"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Reads one enrichment run's progress. Poll until `status` is `done` or `error`.
   * Needs `INTEGRATIONS`.
   * @example
   * const run = await warmbly.integrations.apollo.getEnrichment("conn_1", "run_1");
   */
  getEnrichment(
    connectionId: string,
    runId: string,
    opts?: RequestOptions,
  ): Promise<ApolloEnrichmentRun> {
    return this.http.get<ApolloEnrichmentRun>(this.base(connectionId, "enrichments", runId), opts);
  }

  private base(connectionId: string, ...rest: string[]): string {
    return this.path("integrations", "apollo", connectionId, ...rest);
  }
}
