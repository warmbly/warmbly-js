import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A Salesforce object the sync reads and writes. */
export type SalesforceObject = "Lead" | "Contact" | (string & {});

/** Which campaign event an activity row logs as a Salesforce Task. */
export type SalesforceActivityKind =
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "meeting_booked"
  | (string & {});

/** Where one activity row got to. */
export type SalesforceActivityStatus = "pending" | "synced" | "skipped" | "failed" | (string & {});

/** One pre-flight check on the connection, from {@link Salesforce.overview} with `checks`. */
export interface SalesforceCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
  [key: string]: unknown;
}

/** The connection's health page, from {@link Salesforce.overview}. */
export interface SalesforceOverview {
  connection_id: string;
  label: string;
  status: string;
  health: string;
  health_detail?: string;
  org: {
    /** The Salesforce org id. */
    id?: string;
    instance_url: string;
    /** `production` or `sandbox`. */
    environment: "production" | "sandbox" | (string & {});
    login_host: string;
    /** The connected Salesforce user. */
    user_id?: string;
    account?: string;
    [key: string]: unknown;
  };
  /** The org's API allocation as last seen, and what Warmbly used today. */
  api: {
    used: number;
    max: number;
    calls_today: number;
    /** Warmbly's own daily cap (see {@link SalesforceSettings.daily_api_budget}). */
    budget: number;
    [key: string]: unknown;
  };
  counts: {
    pending: number;
    synced_24h: number;
    failed: number;
    skipped_24h: number;
    linked_records: number;
    [key: string]: unknown;
  };
  last_pull_at?: string;
  last_pull_error?: string;
  settings_enabled: boolean;
  /** Present when the overview was asked for with `checks: true`. */
  checks?: SalesforceCheck[];
  [key: string]: unknown;
}

/** One Warmbly field paired with one Salesforce field. */
export interface SalesforceFieldRule {
  object: SalesforceObject;
  /** A Warmbly field key (`first_name`, `custom:<key>`, `engagement.last_sent_at`, ...). */
  warmbly: string;
  /** The Salesforce API field name. */
  salesforce: string;
  direction: "push" | "pull" | "both" | (string & {});
  /** `overwrite` writes every change; `if_empty` only fills a blank field. */
  policy: "overwrite" | "if_empty" | (string & {});
  [key: string]: unknown;
}

/**
 * One connection's sync configuration. {@link Salesforce.updateSettings} replaces the whole
 * document, so read it, change what you need, and write it back.
 */
export interface SalesforceSettings {
  /** The master switch for activity logging, writeback and the pull loop. Imports and the contact panel work regardless. */
  enabled: boolean;
  matching: {
    /** Which object wins when an address is both: `contact` or `lead`. */
    prefer: "contact" | "lead" | (string & {});
    /** When a missing person is created: `never`, `reply` or `send`. */
    create_when: "never" | "reply" | "send" | (string & {});
    create_as: "lead" | "contact" | (string & {});
    lead_source: string;
    lead_status: string;
    /** `connected_user`, `sender` or `fixed` (with `owner_id`). */
    owner: "connected_user" | "sender" | "fixed" | (string & {});
    owner_id?: string;
    run_assignment_rules: boolean;
    [key: string]: unknown;
  };
  /** Which campaign events become Tasks. */
  activity: {
    sent: boolean;
    replied: boolean;
    opened: boolean;
    clicked: boolean;
    bounced: boolean;
    unsubscribed: boolean;
    meeting_booked: boolean;
    include_body: boolean;
    /** `record_owner`, `sender` or `connected_user`. */
    assign_to: "record_owner" | "sender" | "connected_user" | (string & {});
    relate_to_opportunity: boolean;
    [key: string]: unknown;
  };
  /** Which Lead fields Warmbly moves. */
  writeback: {
    lead_status_on_sent: string;
    /** Reply intent (`positive`, `negative`, `neutral`, `question`, `out_of_office`, `any`) to a Lead status. */
    lead_status_on_reply: Record<string, string>;
    lead_status_on_meeting: string;
    never_move_backwards: boolean;
    [key: string]: unknown;
  };
  /** What a change in Salesforce does in Warmbly. */
  inbound: {
    opt_out: "both" | "to_salesforce" | "from_salesforce" | "off" | (string & {});
    pause_on_converted: boolean;
    pause_on_statuses: string[];
    pause_on_open_opportunity: boolean;
    [key: string]: unknown;
  };
  field_map: SalesforceFieldRule[];
  /** Calls Warmbly makes per day; 0 means a fifth of the org's daily allocation. */
  daily_api_budget: number;
  [key: string]: unknown;
}

/** The answer of {@link Salesforce.getSettings}: the settings plus what a form needs to edit them. */
export interface SalesforceSettingsResponse {
  settings: SalesforceSettings;
  /** The Warmbly side of a field rule. `custom:<key>` is also accepted. */
  warmbly_fields: Array<{ key: string; label: string; [key: string]: unknown }>;
  /** What a new connection starts with. */
  defaults: SalesforceSettings;
  [key: string]: unknown;
}

/** A picklist value. */
export interface SalesforcePickOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

/** A Lead or Contact field. */
export interface SalesforceFieldInfo {
  name: string;
  label: string;
  type: string;
  createable: boolean;
  updateable: boolean;
  calculated: boolean;
  custom: boolean;
  picklist?: SalesforcePickOption[];
  [key: string]: unknown;
}

/** Lead and Contact fields and the picklists the settings name, from {@link Salesforce.metadata}. */
export interface SalesforceMetadata {
  lead_fields: SalesforceFieldInfo[];
  contact_fields: SalesforceFieldInfo[];
  lead_statuses: SalesforcePickOption[];
  lead_sources: SalesforcePickOption[];
  [key: string]: unknown;
}

/** An active Salesforce user. */
export interface SalesforceUser {
  id: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

/** A Lead or Contact list view. */
export interface SalesforceListView {
  id: string;
  label: string;
  object: SalesforceObject;
  [key: string]: unknown;
}

/** A Salesforce Campaign, for the import picker. */
export interface SalesforceCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  member_count: number;
  [key: string]: unknown;
}

/** What an import reads: a Lead or Contact list view, or a Salesforce Campaign's members. */
export interface SalesforceImportSourceRef {
  source_kind: "list_view" | "campaign" | (string & {});
  /** `Lead` or `Contact` for a list view. Ignored for a campaign. */
  object?: SalesforceObject;
  /** The list view or Campaign id (15 or 18 characters). */
  source_id: string;
  [key: string]: unknown;
}

/** One sample row of {@link Salesforce.previewImport}. */
export interface SalesforceImportPreviewRow {
  record_id: string;
  object: string;
  name: string;
  email: string;
  company: string;
  title: string;
  owner_name: string;
  status: string;
  /** Already linked to a Warmbly contact. */
  already_linked: boolean;
  [key: string]: unknown;
}

/** The first rows of a list view or Campaign. */
export interface SalesforceImportPreview {
  total: number;
  sample: SalesforceImportPreviewRow[];
  [key: string]: unknown;
}

/** What one import run did. */
export interface SalesforceRunResult {
  read: number;
  imported: number;
  updated: number;
  linked: number;
  skipped: number;
  failed: number;
  /** Records with no address, which cannot be contacts. */
  no_email: number;
  /** People with Email Opt Out set, suppressed rather than imported. */
  opted_out: number;
  /** Set when the source held more than one run reads. */
  truncated?: boolean;
  [key: string]: unknown;
}

/** A saved list view or Campaign that feeds contacts into Warmbly. */
export interface SalesforceImportSource {
  id: string;
  organization_id: string;
  connection_id: string;
  created_by_user_id?: string;
  name: string;
  source_kind: "list_view" | "campaign" | (string & {});
  /** `Lead`, `Contact` or `CampaignMember`. */
  object: string;
  source_id: string;
  source_label: string;
  /** The Warmbly campaign imported people are added to. */
  campaign_id?: string;
  category_ids: string[];
  recurring: boolean;
  enabled: boolean;
  status: "idle" | "running" | "error" | (string & {});
  last_run_at?: string;
  last_result?: SalesforceRunResult;
  last_error?: string;
  total_imported: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Body for {@link Salesforce.createImportSource}. */
export interface CreateSalesforceImportSourceParams extends SalesforceImportSourceRef {
  name?: string;
  /** The list view or Campaign name, shown in Warmbly. */
  source_label?: string;
  /** A Warmbly campaign to add imported people to. */
  campaign_id?: string;
  category_ids?: string[];
  /** Re-run on a schedule to pick up new people. */
  recurring?: boolean;
  enabled?: boolean;
}

/** Body for {@link Salesforce.updateImportSource}. Absent fields stay as they are. */
export interface UpdateSalesforceImportSourceParams {
  name?: string;
  /** `null` clears the campaign target; absent leaves it. */
  campaign_id?: string | null;
  category_ids?: string[];
  recurring?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** One queued or processed activity: a campaign event to log as a Task, and what became of it. */
export interface SalesforceActivity {
  id: string;
  organization_id: string;
  connection_id: string;
  contact_id?: string;
  contact_email: string;
  kind: SalesforceActivityKind;
  payload?: Record<string, unknown>;
  status: SalesforceActivityStatus;
  attempts: number;
  next_attempt_at: string;
  /** The Lead or Contact the Task went on. */
  record_id?: string;
  /** The Salesforce Task id. */
  task_id?: string;
  /** Why the row was skipped or failed. */
  detail?: string;
  occurred_at: string;
  created_at: string;
  processed_at?: string;
  [key: string]: unknown;
}

/** Query params for {@link Salesforce.listActivity}. */
export interface ListSalesforceActivityParams {
  status?: SalesforceActivityStatus;
  contact_id?: string;
  cursor?: string;
  /** Page size (1..200, default 50). */
  limit?: number;
  [key: string]: unknown;
}

/** A Salesforce opportunity on a contact's linked record. */
export interface SalesforcePanelOpportunity {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  close_date?: string;
  is_closed: boolean;
  is_won: boolean;
  url: string;
  [key: string]: unknown;
}

/** A Salesforce Task on a contact's linked record. */
export interface SalesforcePanelTask {
  id: string;
  subject: string;
  date?: string;
  status: string;
  owner_name?: string;
  url: string;
  /** Logged by Warmbly. */
  from_warmbly: boolean;
  [key: string]: unknown;
}

/** One Lead or Contact a Warmbly contact is linked to. */
export interface SalesforcePanelRecord {
  /** The link's id, for {@link Contacts.unlinkSalesforce}. */
  link_id: string;
  connection_id: string;
  connection_label: string;
  object: SalesforceObject;
  /** The Salesforce record id. */
  id: string;
  url: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  owner?: { id: string; name: string; [key: string]: unknown };
  account?: { id: string; name: string; url: string; [key: string]: unknown };
  is_converted: boolean;
  opted_out: boolean;
  lead_source?: string;
  opportunities: SalesforcePanelOpportunity[];
  tasks: SalesforcePanelTask[];
  /** `match`, `created`, `import` or `manual`. */
  linked_by: "match" | "created" | "import" | "manual" | (string & {});
  last_synced_at?: string;
  last_pushed_at?: string;
  /** This contact's activity queue on the connection. */
  sync: {
    pending: number;
    failed: number;
    synced: number;
    last_error?: string;
    [key: string]: unknown;
  };
  /** Shown from the stored snapshot because Salesforce could not be read just now. */
  stale: boolean;
  error?: string;
  [key: string]: unknown;
}

/** A contact's Salesforce panel, from {@link Contacts.salesforce}. */
export interface ContactSalesforcePanel {
  connections: Array<{
    id: string;
    label: string;
    environment: string;
    instance_url: string;
    [key: string]: unknown;
  }>;
  records: SalesforcePanelRecord[];
  /** Whether the caller may push the contact to Salesforce. */
  can_sync: boolean;
  [key: string]: unknown;
}

/** Body for {@link Contacts.syncSalesforce}. Both fields are optional. */
export interface SyncContactSalesforceParams {
  /** The connection to sync to, when the workspace has more than one. */
  connection_id?: string;
  /** What to create when the person is in neither object. Defaults to the connection's setting. */
  create_as?: "lead" | "contact" | (string & {});
  [key: string]: unknown;
}

/**
 * The native Salesforce sync of one Salesforce connection: health, settings, field and
 * picklist metadata, imports from list views and Campaigns, and the activity log of
 * campaign events written to Salesforce as Tasks. Reachable as
 * `warmbly.integrations.salesforce`; every method takes the integration connection id.
 *
 * Every route needs the `INTEGRATIONS` scope. For a signed-in member, reads take
 * `manage_settings` or `use_integrations`, changing settings and import sources takes
 * `manage_settings`, and previewing, running an import and syncing now take
 * `use_integrations`.
 *
 * @example
 * const [conn] = await warmbly.integrations.listConnections({ provider: "salesforce" });
 * const overview = await warmbly.integrations.salesforce.overview(conn.id, { checks: true });
 * console.log(overview.health, overview.api.used, overview.counts.failed);
 */
export class Salesforce extends APIResource {
  /**
   * Returns the connection's health: org, API usage, the activity queue and the last pull.
   * Pass `checks: true` to also run the pre-flight checks (field access, Task subtype).
   * Needs `INTEGRATIONS`.
   *
   * @example
   * const o = await warmbly.integrations.salesforce.overview("conn_1", { checks: true });
   */
  overview(connectionId: string, params?: { checks?: boolean }): Promise<SalesforceOverview> {
    return this.http.get<SalesforceOverview>(this.sfPath(connectionId, "overview"), {
      query: { checks: params?.checks ? "1" : undefined },
    });
  }

  /**
   * Reads the sync settings, with the Warmbly field list and the defaults. Needs
   * `INTEGRATIONS`.
   *
   * @example
   * const { settings, warmbly_fields } = await warmbly.integrations.salesforce.getSettings("conn_1");
   */
  getSettings(connectionId: string, opts?: RequestOptions): Promise<SalesforceSettingsResponse> {
    return this.http.get<SalesforceSettingsResponse>(this.sfPath(connectionId, "settings"), opts);
  }

  /**
   * Replaces the sync settings with a whole document and returns what was saved. A setting
   * the sync cannot run is a 400 with code `invalid_salesforce_settings`. A PUT, so a retry
   * converges. Needs `INTEGRATIONS` (members: `manage_settings`).
   *
   * @example
   * const { settings } = await warmbly.integrations.salesforce.getSettings("conn_1");
   * await warmbly.integrations.salesforce.updateSettings("conn_1", {
   *   ...settings,
   *   activity: { ...settings.activity, opened: false },
   * });
   */
  updateSettings(
    connectionId: string,
    settings: SalesforceSettings,
    opts?: RequestOptions,
  ): Promise<SalesforceSettings> {
    return this.http
      .put<{ settings: SalesforceSettings }>(this.sfPath(connectionId, "settings"), {
        ...opts,
        body: settings,
      })
      .then((r) => r.settings);
  }

  /**
   * Lists Lead and Contact fields and the lead status and source picklists. Needs
   * `INTEGRATIONS`.
   *
   * @example
   * const { lead_statuses } = await warmbly.integrations.salesforce.metadata("conn_1");
   */
  metadata(connectionId: string, opts?: RequestOptions): Promise<SalesforceMetadata> {
    return this.http.get<SalesforceMetadata>(this.sfPath(connectionId, "metadata"), opts);
  }

  /**
   * Searches active Salesforce users, for a fixed record owner. Needs `INTEGRATIONS`.
   *
   * @example
   * const users = await warmbly.integrations.salesforce.users("conn_1", { q: "ana" });
   */
  users(connectionId: string, params?: { q?: string }): Promise<SalesforceUser[]> {
    return this.http
      .get<{ data: SalesforceUser[] }>(this.sfPath(connectionId, "users"), { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Lists the list views of `Lead` or `Contact`. Any other object is a 400. Needs
   * `INTEGRATIONS`.
   *
   * @example
   * const views = await warmbly.integrations.salesforce.listViews("conn_1", "Lead");
   */
  listViews(connectionId: string, object: "Lead" | "Contact"): Promise<SalesforceListView[]> {
    return this.http
      .get<{ data: SalesforceListView[] }>(this.sfPath(connectionId, "list-views"), {
        query: { object },
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Searches Salesforce Campaigns, for an import. Needs `INTEGRATIONS`.
   *
   * @example
   * const campaigns = await warmbly.integrations.salesforce.campaigns("conn_1", { q: "webinar" });
   */
  campaigns(connectionId: string, params?: { q?: string }): Promise<SalesforceCampaign[]> {
    return this.http
      .get<{ data: SalesforceCampaign[] }>(this.sfPath(connectionId, "campaigns"), {
        query: params,
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Reads the first rows of a list view or Campaign and counts it, without importing.
   * Read-only, so retries are safe. Needs `INTEGRATIONS` (members: `use_integrations`).
   *
   * @example
   * const { total, sample } = await warmbly.integrations.salesforce.previewImport("conn_1", {
   *   source_kind: "list_view",
   *   object: "Lead",
   *   source_id: "00B5g00000AbCdE",
   * });
   */
  previewImport(
    connectionId: string,
    source: SalesforceImportSourceRef,
    opts?: RequestOptions,
  ): Promise<SalesforceImportPreview> {
    return this.http.post<SalesforceImportPreview>(this.sfPath(connectionId, "import", "preview"), {
      ...opts,
      body: source,
    });
  }

  /**
   * Lists the connection's saved imports. Needs `INTEGRATIONS`.
   *
   * @example
   * const sources = await warmbly.integrations.salesforce.listImportSources("conn_1");
   */
  listImportSources(
    connectionId: string,
    opts?: RequestOptions,
  ): Promise<SalesforceImportSource[]> {
    return this.http
      .get<{ data: SalesforceImportSource[] }>(this.sfPath(connectionId, "import-sources"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Saves an import and starts its first run. People are deduplicated by address, so a
   * retried create only makes a second source whose run imports nothing new; pass
   * `idempotencyKey` to avoid even that. Needs `INTEGRATIONS` (members: `manage_settings`).
   *
   * @example
   * const source = await warmbly.integrations.salesforce.createImportSource(
   *   "conn_1",
   *   { source_kind: "campaign", source_id: "7015g000000AbCd", recurring: true },
   *   { idempotencyKey: "sf-import-webinar" },
   * );
   */
  createImportSource(
    connectionId: string,
    params: CreateSalesforceImportSourceParams,
    opts?: RequestOptions,
  ): Promise<SalesforceImportSource> {
    return this.http.post<SalesforceImportSource>(this.sfPath(connectionId, "import-sources"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Edits an import's name, campaign target, categories and schedule. Pass
   * `campaign_id: null` to clear the campaign target. Needs `INTEGRATIONS` (members:
   * `manage_settings`).
   *
   * @example
   * await warmbly.integrations.salesforce.updateImportSource("conn_1", "src_1", { recurring: false });
   */
  updateImportSource(
    connectionId: string,
    sourceId: string,
    params: UpdateSalesforceImportSourceParams,
  ): Promise<SalesforceImportSource> {
    return this.http.patch<SalesforceImportSource>(
      this.sfPath(connectionId, "import-sources", sourceId),
      { body: params },
    );
  }

  /**
   * Runs an import now and returns the source in its `running` state. A second run while
   * one is going is a 409 with code `import_running`, so retries cannot double-run it. Needs
   * `INTEGRATIONS` (members: `use_integrations`).
   *
   * @example
   * const source = await warmbly.integrations.salesforce.runImportSource("conn_1", "src_1");
   */
  runImportSource(
    connectionId: string,
    sourceId: string,
    opts?: RequestOptions,
  ): Promise<SalesforceImportSource> {
    return this.http.post<SalesforceImportSource>(
      this.sfPath(connectionId, "import-sources", sourceId, "run"),
      opts,
    );
  }

  /**
   * Removes an import. Contacts it brought in stay. Resolves with no body (204). Needs
   * `INTEGRATIONS` (members: `manage_settings`).
   *
   * @example
   * await warmbly.integrations.salesforce.deleteImportSource("conn_1", "src_1");
   */
  deleteImportSource(connectionId: string, sourceId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.sfPath(connectionId, "import-sources", sourceId), opts);
  }

  /**
   * Pages the activity log, newest first, auto-paginating when iterated. Filter by
   * `status` or `contact_id`. Needs `INTEGRATIONS`.
   *
   * @example
   * for await (const row of await warmbly.integrations.salesforce.listActivity("conn_1", {
   *   status: "failed",
   * })) {
   *   console.log(row.kind, row.contact_email, row.detail);
   * }
   */
  listActivity(
    connectionId: string,
    params?: ListSalesforceActivityParams,
  ): Promise<Page<SalesforceActivity>> {
    return this.http.getPage<SalesforceActivity>(this.sfPath(connectionId, "activity"), {
      query: params,
    });
  }

  /**
   * Re-queues failed or skipped activity rows, at most 500 ids per call. Re-queuing a row
   * that is already pending changes nothing, so retries are safe. Needs `INTEGRATIONS`
   * (members: `manage_settings`).
   *
   * @example
   * const { requeued } = await warmbly.integrations.salesforce.retryActivity("conn_1", ["act_1"]);
   */
  retryActivity(
    connectionId: string,
    ids: string[],
    opts?: RequestOptions,
  ): Promise<{ requeued: number }> {
    return this.http.post<{ requeued: number }>(this.sfPath(connectionId, "activity", "retry"), {
      ...opts,
      body: { ids },
    });
  }

  /**
   * Drains pending activity and pulls Salesforce changes now. Both passes are idempotent.
   * A connection with sync turned off is a 400 with code `salesforce_sync_off`. Needs
   * `INTEGRATIONS` (members: `use_integrations`).
   *
   * @example
   * await warmbly.integrations.salesforce.syncNow("conn_1");
   */
  syncNow(connectionId: string, opts?: RequestOptions): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.sfPath(connectionId, "sync-now"), opts);
  }

  private sfPath(connectionId: string, ...rest: string[]): string {
    return this.path("integrations", "salesforce", connectionId, ...rest);
  }
}
