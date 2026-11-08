import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A connection's lifecycle state. Unknown values pass through. */
export type IntegrationStatus =
  | "pending"
  | "authorizing"
  | "connected"
  | "degraded"
  | "reauth_required"
  | (string & {});

/** How a connection is authenticated. Unknown values pass through. */
export type IntegrationAuthMethod = "oauth" | "api_key" | "webhook" | (string & {});

/** The direction data flows through a connection. Unknown values pass through. */
export type IntegrationSyncDirection = "push" | "pull" | "both" | (string & {});

/** An available integration in the catalog. */
export interface IntegrationCatalogEntry {
  /** Provider slug, e.g. `"hubspot"`, `"salesforce"`, `"apollo"`, `"clay"`. */
  provider?: string;
  name?: string;
  tagline?: string;
  /** e.g. `"crm"`, `"automation"`, `"notifications"`, `"meetings"`, `"data"`, `"verification"`. */
  category?: string;
  docs_url?: string;
  auth_method?: IntegrationAuthMethod;
  badge_color?: string;
  beta?: boolean;
  webhook_hint?: string;
  highlights?: string[];
  scopes?: string[];
  events?: string[];
  action_types?: string[];
  /** Whether contacts can be pushed to this provider with {@link Integrations.pushConnection}. */
  supports_push?: boolean;
  /** Configurable-action descriptor the onboarding UI renders from. */
  capability?: Record<string, unknown>;
  /** Whether the server has OAuth credentials wired for this provider. */
  configured?: boolean;
  /** Popularity on this instance, 1 being the most used. */
  rank?: number;
  [key: string]: unknown;
}

/** A configured integration connection. Secrets are never returned. */
export interface IntegrationConnection {
  id: string;
  organization_id?: string;
  provider?: string;
  label?: string;
  status?: IntegrationStatus;
  auth_method?: IntegrationAuthMethod;
  /** Non-secret display values for the connection (a JSON object). */
  display_fields?: Record<string, unknown> | null;
  /** The onboarding and capability snapshot. Any outbound signing secret is stripped. */
  config_capabilities?: Record<string, unknown>;
  sync_direction?: IntegrationSyncDirection;
  connected_by_user_id?: string;
  external_account_id?: string;
  external_account_name?: string;
  granted_scopes?: string[];
  token_expires_at?: string;
  /** `"unknown"`, `"healthy"`, `"degraded"`, or `"down"`. */
  health?: string;
  health_detail?: string;
  health_checked_at?: string;
  last_synced_at?: string;
  last_error?: string;
  last_error_at?: string;
  created_at?: string;
  updated_at?: string;
  /** Set only at create time for Calendly and Cal.com connections. */
  inbound_webhook_url?: string;
  [key: string]: unknown;
}

/** An event subscription on an integration connection. */
export interface IntegrationEvent {
  id: string;
  connection_id?: string;
  organization_id?: string;
  event_type?: string;
  /** The provider action to run, e.g. `"salesforce.upsert_contact"`, `"clay.send_row"`. */
  action?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
  /** What the automation is for, e.g. `"crm_sync"`, `"notify"`, `"custom"`. */
  use_case?: string;
  automation_id?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** One sync, dispatch, or refresh record against a connection. */
export interface IntegrationSyncRun {
  id: string;
  connection_id?: string;
  organization_id?: string;
  kind?: string;
  status?: string;
  detail?: string;
  records_processed?: number;
  started_at?: string;
  finished_at?: string;
  [key: string]: unknown;
}

/** A connection plus its event subscriptions and recent sync runs, as returned by {@link Integrations.getConnection}. */
export interface IntegrationConnectionDetail extends IntegrationConnection {
  events?: IntegrationEvent[];
  runs?: IntegrationSyncRun[];
}

/** Body for {@link Integrations.createConnection}. */
export interface CreateIntegrationConnectionParams {
  /** Provider slug. OAuth providers are rejected here; they connect through the dashboard flow. */
  provider: string;
  label?: string;
  /** Provider credentials (an API key, a webhook URL, ...). Sealed server side. */
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Body for {@link Integrations.updateConnectionConfig}. */
export interface UpdateIntegrationConnectionConfigParams {
  /** The capability snapshot: selected objects, enabled use cases, picker selections. */
  config_capabilities?: Record<string, unknown>;
  sync_direction?: IntegrationSyncDirection;
  [key: string]: unknown;
}

/** Body for {@link Integrations.createConnectionEvent}. */
export interface CreateIntegrationEventParams {
  event_type: string;
  action: string;
  config?: Record<string, unknown>;
  /** Defaults to `true`. */
  enabled?: boolean;
  [key: string]: unknown;
}

/** A field mapping row. */
export interface IntegrationFieldMapping {
  id?: string;
  connection_id?: string;
  organization_id?: string;
  subscription_id?: string;
  direction?: string;
  object_name?: string;
  warmbly_field: string;
  external_field: string;
  /** `"none"`, `"static"`, `"uppercase"`, `"lowercase"`, or `"trim"`. */
  transform?: string;
  static_value?: string;
  is_default?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

/** One mapping in {@link SetFieldMappingsParams}. */
export interface FieldMappingInput {
  /** Required unless `transform` is `"static"`. */
  warmbly_field?: string;
  /** The destination field. Required. */
  external_field: string;
  /** `"none"`, `"static"`, `"uppercase"`, `"lowercase"`, or `"trim"`. */
  transform?: string;
  /** Required when `transform` is `"static"`. */
  static_value?: string;
  [key: string]: unknown;
}

/** Body for {@link Integrations.setFieldMappings}. */
export interface SetFieldMappingsParams {
  /** The provider object the map applies to, e.g. `"contact"`. */
  object?: string;
  mappings: FieldMappingInput[];
  [key: string]: unknown;
}

/** The signing secret of an automation connection, from {@link Integrations.getWebhookSecret}. */
export interface IntegrationWebhookSecret {
  signing_secret: string;
  /** Always `"X-Warmbly-Signature"`. */
  signature_header: string;
  /** A description of the HMAC scheme. */
  scheme: string;
  [key: string]: unknown;
}

/** Result of {@link Integrations.testConnection}. */
export interface IntegrationTestResult {
  /** How many test events were dispatched. */
  sent: number;
  [key: string]: unknown;
}

/**
 * Body for {@link Integrations.pushConnection}. Name contacts with `contact_ids` or
 * `contacts`, or send `all` with `filters` for "select all matching". At most 500
 * contacts resolve per push.
 */
export interface PushConnectionParams {
  contact_ids?: string[];
  contacts?: string[];
  /** Resolve the selection from `filters` instead of the id list. */
  all?: boolean;
  /** The same body `contacts.search` takes. */
  filters?: Record<string, unknown>;
  /** Ids to drop from a select-all. */
  exclude?: string[];
  [key: string]: unknown;
}

/** The outcome for one contact in a push. */
export interface PushRecordResult {
  contact_id: string;
  email: string;
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Result of {@link Integrations.pushConnection}. */
export interface PushConnectionResult {
  provider: string;
  pushed: number;
  failed: number;
  results: PushRecordResult[];
  [key: string]: unknown;
}

/** A meeting synced from a connected scheduler (Calendly, Cal.com). */
export interface MeetingBooking {
  id: string;
  organization_id?: string;
  /** `"calendly"` or `"cal_com"`. */
  source?: string;
  external_event_id?: string;
  /** `"booked"`, `"rescheduled"`, `"canceled"`, `"completed"`, or `"no_show"`. */
  status?: string;
  invitee_email?: string;
  invitee_name?: string;
  event_name?: string;
  event_type?: string;
  scheduled_for?: string;
  end_time?: string;
  join_url?: string;
  location?: string;
  cancel_url?: string;
  reschedule_url?: string;
  canceled_reason?: string;
  contact_id?: string;
  campaign_id?: string;
  raw_payload?: unknown;
  contact_name?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** A listing in the community app directory. */
export interface CommunityApp {
  application_id: string;
  slug: string;
  name?: string;
  tagline?: string;
  description?: string;
  category?: string;
  logo_url?: string;
  website_url?: string;
  install_url?: string;
  support_url?: string;
  privacy_url?: string;
  developer?: string;
  /** The API permission bitmask the app asks for. */
  scopes?: number;
  /** The same permissions spelled out. */
  permissions?: Record<string, unknown>[];
  status?: string;
  /** Shown in discovery, because it is featured or widely used. */
  listed?: boolean;
  installs?: number;
  /** Whether this workspace already uses it. */
  installed?: boolean;
  published_at?: string;
  [key: string]: unknown;
}

/** Query params for {@link Integrations.community}. */
export interface ListCommunityAppsParams {
  /** Page size, 1..200. Defaults to 100. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Apollo
// ---------------------------------------------------------------------------

/** The Apollo page header: the account a key acts as and what the connection has done. */
export interface ApolloOverview {
  connection_id: string;
  label?: string;
  status?: IntegrationStatus;
  health?: string;
  health_detail?: string;
  account_name?: string;
  account_email?: string;
  sources?: number;
  total_imported?: number;
  last_run_at?: string;
  [key: string]: unknown;
}

/** A saved Apollo list. */
export interface ApolloList {
  id: string;
  name: string;
  count: number;
  [key: string]: unknown;
}

/** What one Apollo import run did. */
export interface ApolloRunResult {
  read: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  no_email: number;
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
  organization_id?: string;
  connection_id?: string;
  created_by_user_id?: string;
  name: string;
  list_id: string;
  list_name?: string;
  campaign_id?: string;
  category_ids: string[];
  verified_only: boolean;
  recurring: boolean;
  enabled: boolean;
  /** The run state, e.g. `"idle"`, `"running"`, `"error"`. Unknown values pass through. */
  status: string;
  last_run_at?: string;
  last_result?: ApolloRunResult;
  last_error?: string;
  total_imported: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link ApolloIntegration.previewImport}. */
export interface ApolloPreviewParams {
  list_id: string;
  /** Defaults to `true` on the server when omitted. */
  verified_only?: boolean;
  [key: string]: unknown;
}

/** One sample person of an Apollo list preview. */
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

/** The first people of an Apollo list and how many it holds. */
export interface ApolloPreview {
  total: number;
  sample: ApolloPreviewRow[];
  [key: string]: unknown;
}

/** Body for {@link ApolloIntegration.createImportSource}. */
export interface CreateApolloImportSourceParams {
  /** Apollo list id. Required. */
  list_id: string;
  /** Shown in the picker. Also the default `name`. */
  list_name?: string;
  name?: string;
  /** Campaign to enroll imported contacts into. */
  campaign_id?: string;
  /** Up to 50 tag ids. */
  category_ids?: string[];
  verified_only?: boolean;
  recurring?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Body for {@link ApolloIntegration.updateImportSource}. Omitted fields are left alone. */
export interface UpdateApolloImportSourceParams {
  name?: string;
  /** A campaign id, or `null` to clear the target. */
  campaign_id?: string | null;
  category_ids?: string[];
  verified_only?: boolean;
  recurring?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Status of an Apollo enrichment run. Unknown values pass through. */
export type ApolloEnrichmentStatus = "queued" | "running" | "done" | "error" | (string & {});

/** A background request to enrich contacts through Apollo's people match. */
export interface ApolloEnrichmentRun {
  id: string;
  organization_id?: string;
  connection_id?: string;
  requested_by_user_id?: string;
  overwrite: boolean;
  status: ApolloEnrichmentStatus;
  total: number;
  processed: number;
  enriched: number;
  not_found: number;
  failed: number;
  credits_consumed: number;
  last_error?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Body for {@link ApolloIntegration.startEnrichment}. Name contacts with `contact_ids` or
 * `contacts`, or send `all` with `filters`. At most 5,000 contacts per run.
 */
export interface StartApolloEnrichmentParams {
  contact_ids?: string[];
  contacts?: string[];
  all?: boolean;
  filters?: Record<string, unknown>;
  exclude?: string[];
  /** Replace fields that already hold a value. */
  overwrite?: boolean;
  [key: string]: unknown;
}

/**
 * Apollo list imports and contact enrichment on one connection. Reachable as
 * `warmbly.integrations.apollo`. The `connectionId` is the Apollo connection's id.
 */
export class ApolloIntegration extends APIResource {
  private base(connectionId: string, ...rest: string[]): string {
    return this.path("integrations", "apollo", connectionId, ...rest);
  }

  /**
   * Reads the Apollo page header. Needs `INTEGRATIONS`.
   * @example
   * const o = await warmbly.integrations.apollo.overview("conn_1");
   */
  overview(connectionId: string, opts?: RequestOptions): Promise<ApolloOverview> {
    return this.http.get<ApolloOverview>(this.base(connectionId), opts);
  }

  /**
   * Checks a new Apollo API key and swaps it in. Safe to retry. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.replaceKey("conn_1", "apollo-key");
   */
  replaceKey(connectionId: string, apiKey: string): Promise<ApolloOverview> {
    return this.http.put<ApolloOverview>(this.base(connectionId, "key"), {
      body: { api_key: apiKey },
    });
  }

  /**
   * Lists the account's saved Apollo contact lists. Needs `INTEGRATIONS`.
   * @example
   * const lists = await warmbly.integrations.apollo.lists("conn_1");
   */
  lists(connectionId: string, opts?: RequestOptions): Promise<ApolloList[]> {
    return this.http
      .get<{ data: ApolloList[] }>(this.base(connectionId, "lists"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Reads the first people of a list without importing. Needs `INTEGRATIONS`.
   * @example
   * const p = await warmbly.integrations.apollo.previewImport("conn_1", { list_id: "l1" });
   */
  previewImport(connectionId: string, params: ApolloPreviewParams): Promise<ApolloPreview> {
    return this.http.post<ApolloPreview>(this.base(connectionId, "import", "preview"), {
      body: params,
    });
  }

  /**
   * Lists the connection's saved list imports. Needs `INTEGRATIONS`.
   * @example
   * const sources = await warmbly.integrations.apollo.listImportSources("conn_1");
   */
  listImportSources(connectionId: string, opts?: RequestOptions): Promise<ApolloImportSource[]> {
    return this.http
      .get<{
        data: ApolloImportSource[];
      }>(this.base(connectionId, "import-sources"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Saves a list import and starts its first run. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.createImportSource("conn_1", { list_id: "l1" });
   */
  createImportSource(
    connectionId: string,
    params: CreateApolloImportSourceParams,
  ): Promise<ApolloImportSource> {
    return this.http.post<ApolloImportSource>(this.base(connectionId, "import-sources"), {
      body: params,
    });
  }

  /**
   * Edits a list import's targets, filter and schedule. Pass `campaign_id: null` to clear
   * the campaign target. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.updateImportSource("conn_1", "src_1", { enabled: false });
   */
  updateImportSource(
    connectionId: string,
    sourceId: string,
    params: UpdateApolloImportSourceParams,
  ): Promise<ApolloImportSource> {
    return this.http.patch<ApolloImportSource>(
      this.base(connectionId, "import-sources", sourceId),
      { body: params },
    );
  }

  /**
   * Removes a list import. Contacts it brought in stay. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.apollo.deleteImportSource("conn_1", "src_1");
   */
  deleteImportSource(connectionId: string, sourceId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.base(connectionId, "import-sources", sourceId), opts);
  }

  /**
   * Runs a list import now and returns the source. A run already in progress is refused
   * with a 409. Needs `INTEGRATIONS`.
   * @example
   * const src = await warmbly.integrations.apollo.runImportSource("conn_1", "src_1");
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
   * Lists the connection's recent enrichment runs. Needs `INTEGRATIONS`.
   * @example
   * const runs = await warmbly.integrations.apollo.listEnrichments("conn_1", { limit: 10 });
   */
  listEnrichments(
    connectionId: string,
    params?: { limit?: number },
  ): Promise<ApolloEnrichmentRun[]> {
    return this.http
      .get<{ data: ApolloEnrichmentRun[] }>(this.base(connectionId, "enrichments"), {
        query: params,
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Queues an enrichment run over a contact selection (202). It spends the customer's
   * Apollo credits. Needs `INTEGRATIONS` and `BULK_CONTACTS`.
   * @example
   * const run = await warmbly.integrations.apollo.startEnrichment("conn_1", {
   *   contact_ids: ["c_1"],
   * });
   */
  startEnrichment(
    connectionId: string,
    params: StartApolloEnrichmentParams,
  ): Promise<ApolloEnrichmentRun> {
    return this.http.post<ApolloEnrichmentRun>(this.base(connectionId, "enrichments"), {
      body: params,
    });
  }

  /**
   * Reads one enrichment run's progress. Needs `INTEGRATIONS`.
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
}

// ---------------------------------------------------------------------------
// Clay
// ---------------------------------------------------------------------------

/** How a Clay row that matches an existing contact is handled. Unknown values pass through. */
export type ClayDedupStrategy = "skip" | "update" | "create_duplicate" | (string & {});

/** Where rows a Clay table sends land. */
export interface ClayInboundDefaults {
  campaign_id?: string;
  category_ids: string[];
  segment_ids: string[];
  dedup: ClayDedupStrategy;
  subscribed: boolean;
  [key: string]: unknown;
}

/** The default Clay table Warmbly sends events to. The URL and token are never returned. */
export interface ClayOutbound {
  webhook_url_set: boolean;
  webhook_host?: string;
  auth_token_set: boolean;
  events: string[];
  [key: string]: unknown;
}

/** Counts of what the inbound URL has received. */
export interface ClayStats {
  received: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  last_received_at?: string;
  last_error?: string;
  [key: string]: unknown;
}

/** Everything the Clay page edits and shows. */
export interface ClaySettings {
  connection_id: string;
  label: string;
  status: IntegrationStatus;
  health: string;
  inbound_url_minted: boolean;
  defaults: ClayInboundDefaults;
  outbound: ClayOutbound;
  stats: ClayStats;
  available_events: string[];
  [key: string]: unknown;
}

/**
 * Body for {@link ClayIntegration.updateSettings}. An omitted or `null` field is left
 * alone; an empty `webhook_url` or `auth_token` clears it.
 */
export interface UpdateClaySettingsParams {
  defaults?: Partial<ClayInboundDefaults> | null;
  webhook_url?: string | null;
  auth_token?: string | null;
  events?: string[] | null;
  [key: string]: unknown;
}

/** Clay table settings on one connection. Reachable as `warmbly.integrations.clay`. */
export class ClayIntegration extends APIResource {
  /**
   * Reads everything the Clay page shows. Needs `INTEGRATIONS`.
   * @example
   * const s = await warmbly.integrations.clay.getSettings("conn_1");
   */
  getSettings(connectionId: string, opts?: RequestOptions): Promise<ClaySettings> {
    return this.http.get<ClaySettings>(this.path("integrations", "clay", connectionId), opts);
  }

  /**
   * Saves the inbound defaults, the outbound table and the events sent to it. Each field
   * replaces its value, so a retry converges. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.clay.updateSettings("conn_1", { events: ["reply.received"] });
   */
  updateSettings(connectionId: string, params: UpdateClaySettingsParams): Promise<ClaySettings> {
    return this.http.patch<ClaySettings>(this.path("integrations", "clay", connectionId), {
      body: params,
    });
  }
}

// ---------------------------------------------------------------------------
// Salesforce
// ---------------------------------------------------------------------------

/** One permission or setup probe in the Salesforce overview. */
export interface SalesforceCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
  [key: string]: unknown;
}

/** The Salesforce connection's health page. */
export interface SalesforceOverview {
  connection_id: string;
  label: string;
  status: string;
  health: string;
  health_detail?: string;
  org: {
    id?: string;
    instance_url: string;
    /** `"production"` or `"sandbox"`. */
    environment: string;
    login_host: string;
    user_id?: string;
    account?: string;
    [key: string]: unknown;
  };
  api: {
    used: number;
    max: number;
    calls_today: number;
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
  /** Present only when requested with `checks: true`. */
  checks?: SalesforceCheck[];
  [key: string]: unknown;
}

/** Which record wins and when a missing person is created. */
export interface SalesforceMatchingSettings {
  /** `"contact"` or `"lead"`. */
  prefer: string;
  /** `"never"`, `"reply"`, or `"send"`. */
  create_when: string;
  /** `"lead"` or `"contact"`. */
  create_as: string;
  lead_source: string;
  lead_status: string;
  /** `"connected_user"`, `"sender"`, or `"fixed"`. */
  owner: string;
  owner_id?: string;
  run_assignment_rules: boolean;
  [key: string]: unknown;
}

/** Which campaign events become Salesforce Tasks. */
export interface SalesforceActivitySettings {
  sent: boolean;
  replied: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  meeting_booked: boolean;
  include_body: boolean;
  /** `"record_owner"`, `"sender"`, or `"connected_user"`. */
  assign_to: string;
  relate_to_opportunity: boolean;
  [key: string]: unknown;
}

/** Which Lead and Contact fields Warmbly changes. */
export interface SalesforceWritebackSettings {
  lead_status_on_sent: string;
  /** Reply intent (`positive`, `negative`, `neutral`, `question`, `out_of_office`, `any`) to Lead status. */
  lead_status_on_reply: Record<string, string>;
  lead_status_on_meeting: string;
  never_move_backwards: boolean;
  [key: string]: unknown;
}

/** What a change in Salesforce does in Warmbly. */
export interface SalesforceInboundSettings {
  /** `"both"`, `"to_salesforce"`, `"from_salesforce"`, or `"off"`. */
  opt_out: string;
  pause_on_converted: boolean;
  pause_on_statuses: string[];
  pause_on_open_opportunity: boolean;
  [key: string]: unknown;
}

/** Syncs one Warmbly field with one Salesforce field. */
export interface SalesforceFieldRule {
  /** `"Lead"` or `"Contact"`. */
  object: string;
  warmbly: string;
  salesforce: string;
  /** `"push"`, `"pull"`, or `"both"`. */
  direction: string;
  /** `"overwrite"` or `"if_empty"`. */
  policy: string;
  [key: string]: unknown;
}

/** One connection's Salesforce sync configuration. */
export interface SalesforceSettings {
  /** Master switch for logging, writeback and the pull loop. */
  enabled: boolean;
  matching: SalesforceMatchingSettings;
  activity: SalesforceActivitySettings;
  writeback: SalesforceWritebackSettings;
  inbound: SalesforceInboundSettings;
  field_map: SalesforceFieldRule[];
  /** Daily call cap. 0 means a fifth of the org's daily allocation. */
  daily_api_budget: number;
  [key: string]: unknown;
}

/** Result of {@link SalesforceIntegration.getSettings}. */
export interface SalesforceSettingsResult {
  settings: SalesforceSettings;
  /** The Warmbly-side fields a rule may name (`custom:<key>` is also accepted). */
  warmbly_fields: Array<{ key: string; label: string; [key: string]: unknown }>;
  /** What a new connection starts with. */
  defaults: SalesforceSettings;
}

/** A Lead or Contact field, as the mapping editor shows it. */
export interface SalesforceFieldInfo {
  name: string;
  label: string;
  type: string;
  createable: boolean;
  updateable: boolean;
  calculated: boolean;
  custom: boolean;
  picklist?: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

/** Lead and Contact fields and picklists. */
export interface SalesforceMetadata {
  lead_fields: SalesforceFieldInfo[];
  contact_fields: SalesforceFieldInfo[];
  lead_statuses: Array<{ value: string; label: string }>;
  lead_sources: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

/** A Salesforce user for owner pickers. */
export interface SalesforceUser {
  id: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

/** A Lead or Contact list view for the import picker. */
export interface SalesforceListView {
  id: string;
  label: string;
  object: string;
  [key: string]: unknown;
}

/** A Salesforce Campaign for the import picker. */
export interface SalesforceCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  member_count: number;
  [key: string]: unknown;
}

/** What to read: a list view or a Salesforce Campaign. */
export interface SalesforceImportSourceRef {
  /** `"list_view"` or `"campaign"`. */
  source_kind: "list_view" | "campaign" | (string & {});
  /** `"Lead"` or `"Contact"` for a list view. Ignored for a campaign. */
  object?: string;
  /** The Salesforce id of the list view or campaign. */
  source_id: string;
  [key: string]: unknown;
}

/** One sample row of an import preview. */
export interface SalesforcePreviewRow {
  record_id: string;
  object: string;
  name: string;
  email: string;
  company: string;
  title: string;
  owner_name: string;
  status: string;
  already_linked: boolean;
  [key: string]: unknown;
}

/** The first rows of a source and how many it holds. */
export interface SalesforcePreview {
  total: number;
  sample: SalesforcePreviewRow[];
  [key: string]: unknown;
}

/** What one Salesforce import run did. */
export interface SalesforceRunResult {
  read: number;
  imported: number;
  updated: number;
  linked: number;
  skipped: number;
  failed: number;
  no_email: number;
  opted_out: number;
  truncated?: boolean;
  [key: string]: unknown;
}

/** A saved list view or Campaign that feeds contacts into Warmbly. */
export interface SalesforceImportSource {
  id: string;
  organization_id?: string;
  connection_id?: string;
  created_by_user_id?: string;
  name: string;
  source_kind: string;
  object: string;
  source_id: string;
  source_label: string;
  campaign_id?: string | null;
  category_ids: string[];
  recurring: boolean;
  enabled: boolean;
  status: string;
  last_run_at?: string;
  last_result?: SalesforceRunResult;
  last_error?: string;
  total_imported: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link SalesforceIntegration.createImportSource}. */
export interface CreateSalesforceImportSourceParams extends SalesforceImportSourceRef {
  name?: string;
  /** Display name of the list view or campaign. Also the default `name`. */
  source_label?: string;
  campaign_id?: string;
  /** Up to 50 tag ids. */
  category_ids?: string[];
  recurring?: boolean;
  enabled?: boolean;
}

/** Body for {@link SalesforceIntegration.updateImportSource}. Omitted fields are left alone. */
export interface UpdateSalesforceImportSourceParams {
  name?: string;
  /** A campaign id, or `null` to clear the target. */
  campaign_id?: string | null;
  category_ids?: string[];
  recurring?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Status of a queued Salesforce activity. Unknown values pass through. */
export type SalesforceActivityStatus = "pending" | "synced" | "skipped" | "failed" | (string & {});

/** One campaign event queued to be logged as a Salesforce Task, and what became of it. */
export interface SalesforceActivity {
  id: string;
  organization_id?: string;
  connection_id?: string;
  contact_id?: string;
  contact_email: string;
  /** `"sent"`, `"opened"`, `"clicked"`, `"replied"`, `"bounced"`, `"unsubscribed"`, or `"meeting_booked"`. */
  kind: string;
  payload?: Record<string, unknown>;
  status: SalesforceActivityStatus;
  attempts: number;
  next_attempt_at: string;
  record_id?: string;
  task_id?: string;
  detail?: string;
  occurred_at: string;
  created_at: string;
  processed_at?: string;
  [key: string]: unknown;
}

/** Query params for {@link SalesforceIntegration.listActivity}. */
export interface ListSalesforceActivityParams {
  /** Page size, 1..200. Defaults to 50. */
  limit?: number;
  status?: SalesforceActivityStatus;
  contact_id?: string;
  cursor?: string;
  [key: string]: unknown;
}

/** Native Salesforce sync on one connection. Reachable as `warmbly.integrations.salesforce`. */
export class SalesforceIntegration extends APIResource {
  private base(connectionId: string, ...rest: string[]): string {
    return this.path("integrations", "salesforce", connectionId, ...rest);
  }

  /**
   * Reads the connection's health page. Pass `checks: true` to also probe permissions.
   * Needs `INTEGRATIONS`.
   * @example
   * const o = await warmbly.integrations.salesforce.overview("conn_1", { checks: true });
   */
  overview(connectionId: string, params?: { checks?: boolean }): Promise<SalesforceOverview> {
    return this.http.get<SalesforceOverview>(this.base(connectionId, "overview"), {
      query: params?.checks ? { checks: "1" } : undefined,
    });
  }

  /**
   * Reads the sync settings, the Warmbly field vocabulary and the defaults. Needs `INTEGRATIONS`.
   * @example
   * const { settings } = await warmbly.integrations.salesforce.getSettings("conn_1");
   */
  getSettings(connectionId: string, opts?: RequestOptions): Promise<SalesforceSettingsResult> {
    return this.http.get<SalesforceSettingsResult>(this.base(connectionId, "settings"), opts);
  }

  /**
   * Validates and saves the whole settings document. Safe to retry. Returns the saved
   * settings. Needs `INTEGRATIONS`.
   * @example
   * const saved = await warmbly.integrations.salesforce.updateSettings("conn_1", settings);
   */
  updateSettings(connectionId: string, settings: SalesforceSettings): Promise<SalesforceSettings> {
    return this.http
      .put<{ settings: SalesforceSettings }>(this.base(connectionId, "settings"), {
        body: settings,
      })
      .then((r) => r.settings);
  }

  /**
   * Returns Lead and Contact fields and picklists. Needs `INTEGRATIONS`.
   * @example
   * const meta = await warmbly.integrations.salesforce.metadata("conn_1");
   */
  metadata(connectionId: string, opts?: RequestOptions): Promise<SalesforceMetadata> {
    return this.http.get<SalesforceMetadata>(this.base(connectionId, "metadata"), opts);
  }

  /**
   * Searches active Salesforce users by name or email (up to 50). Needs `INTEGRATIONS`.
   * @example
   * const users = await warmbly.integrations.salesforce.users("conn_1", { q: "ada" });
   */
  users(connectionId: string, params?: { q?: string }): Promise<SalesforceUser[]> {
    return this.http
      .get<{
        data: SalesforceUser[];
      }>(this.base(connectionId, "users"), { query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Lists the Lead or Contact list views. Needs `INTEGRATIONS`.
   * @example
   * const views = await warmbly.integrations.salesforce.listViews("conn_1", { object: "Lead" });
   */
  listViews(
    connectionId: string,
    params: { object: "Lead" | "Contact" },
  ): Promise<SalesforceListView[]> {
    return this.http
      .get<{ data: SalesforceListView[] }>(this.base(connectionId, "list-views"), {
        query: params,
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Searches Salesforce Campaigns by name. Needs `INTEGRATIONS`.
   * @example
   * const campaigns = await warmbly.integrations.salesforce.campaigns("conn_1", { q: "webinar" });
   */
  campaigns(connectionId: string, params?: { q?: string }): Promise<SalesforceCampaign[]> {
    return this.http
      .get<{ data: SalesforceCampaign[] }>(this.base(connectionId, "campaigns"), {
        query: params,
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Reads the first rows of a list view or Campaign without importing. Needs `INTEGRATIONS`.
   * @example
   * const p = await warmbly.integrations.salesforce.previewImport("conn_1", {
   *   source_kind: "list_view",
   *   object: "Lead",
   *   source_id: "00B000000000001",
   * });
   */
  previewImport(
    connectionId: string,
    params: SalesforceImportSourceRef,
  ): Promise<SalesforcePreview> {
    return this.http.post<SalesforcePreview>(this.base(connectionId, "import", "preview"), {
      body: params,
    });
  }

  /**
   * Lists the connection's saved imports. Needs `INTEGRATIONS`.
   * @example
   * const sources = await warmbly.integrations.salesforce.listImportSources("conn_1");
   */
  listImportSources(
    connectionId: string,
    opts?: RequestOptions,
  ): Promise<SalesforceImportSource[]> {
    return this.http
      .get<{
        data: SalesforceImportSource[];
      }>(this.base(connectionId, "import-sources"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Saves an import and starts its first run. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.salesforce.createImportSource("conn_1", {
   *   source_kind: "campaign",
   *   source_id: "701000000000001",
   * });
   */
  createImportSource(
    connectionId: string,
    params: CreateSalesforceImportSourceParams,
  ): Promise<SalesforceImportSource> {
    return this.http.post<SalesforceImportSource>(this.base(connectionId, "import-sources"), {
      body: params,
    });
  }

  /**
   * Edits an import's targets and schedule. Pass `campaign_id: null` to clear the campaign
   * target. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.salesforce.updateImportSource("conn_1", "src_1", { recurring: true });
   */
  updateImportSource(
    connectionId: string,
    sourceId: string,
    params: UpdateSalesforceImportSourceParams,
  ): Promise<SalesforceImportSource> {
    return this.http.patch<SalesforceImportSource>(
      this.base(connectionId, "import-sources", sourceId),
      { body: params },
    );
  }

  /**
   * Removes an import. Contacts it brought in stay. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.salesforce.deleteImportSource("conn_1", "src_1");
   */
  deleteImportSource(connectionId: string, sourceId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.base(connectionId, "import-sources", sourceId), opts);
  }

  /**
   * Runs an import now and returns the source. A run already in progress is refused with
   * a 409. Needs `INTEGRATIONS`.
   * @example
   * const src = await warmbly.integrations.salesforce.runImportSource("conn_1", "src_1");
   */
  runImportSource(
    connectionId: string,
    sourceId: string,
    opts?: RequestOptions,
  ): Promise<SalesforceImportSource> {
    return this.http.post<SalesforceImportSource>(
      this.base(connectionId, "import-sources", sourceId, "run"),
      opts,
    );
  }

  /**
   * Pages the activity log, newest first, auto-paginating when iterated. Needs `INTEGRATIONS`.
   * @example
   * for await (const a of await warmbly.integrations.salesforce.listActivity("conn_1", {
   *   status: "failed",
   * })) console.log(a.detail);
   */
  listActivity(
    connectionId: string,
    params?: ListSalesforceActivityParams,
  ): Promise<Page<SalesforceActivity>> {
    return this.http.getPage<SalesforceActivity>(this.base(connectionId, "activity"), {
      query: params,
    });
  }

  /**
   * Re-queues failed or skipped activity rows (up to 500 ids) and returns how many were
   * re-queued. Safe to retry. Needs `INTEGRATIONS`.
   * @example
   * const { requeued } = await warmbly.integrations.salesforce.retryActivity("conn_1", ["a_1"]);
   */
  retryActivity(connectionId: string, ids: string[]): Promise<{ requeued: number }> {
    return this.http.post<{ requeued: number }>(this.base(connectionId, "activity", "retry"), {
      body: { ids },
    });
  }

  /**
   * Drains pending activity and pulls changes at once. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.salesforce.syncNow("conn_1");
   */
  syncNow(connectionId: string, opts?: RequestOptions): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.base(connectionId, "sync-now"), opts);
  }
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

/**
 * Manage third-party integrations: catalog, connections, events, field mappings, runs,
 * webhook secret, test/push, bookings, the community directory, and the native Apollo,
 * Clay and Salesforce surfaces. Reachable as `warmbly.integrations`. Reads need
 * `INTEGRATIONS`; so do writes.
 *
 * @example
 * const catalog = await warmbly.integrations.catalog();
 * const conn = await warmbly.integrations.createConnection({ provider: "hubspot" });
 * const overview = await warmbly.integrations.salesforce.overview(conn.id);
 */
export class Integrations extends APIResource {
  /** Apollo list imports and enrichment. */
  readonly apollo = new ApolloIntegration(this.http);
  /** Clay table settings. */
  readonly clay = new ClayIntegration(this.http);
  /** Native Salesforce sync. */
  readonly salesforce = new SalesforceIntegration(this.http);

  /**
   * Lists available integrations. Needs `INTEGRATIONS`.
   * @example
   * const catalog = await warmbly.integrations.catalog();
   */
  catalog(opts?: RequestOptions): Promise<IntegrationCatalogEntry[]> {
    return this.http
      .get<{ catalog: IntegrationCatalogEntry[] }>("integrations/catalog", opts)
      .then((r) => r.catalog ?? []);
  }

  /**
   * Lists the community app directory, auto-paginating when iterated: featured apps first,
   * then most installed. Needs `INTEGRATIONS`.
   * @example
   * const page = await warmbly.integrations.community({ limit: 20 });
   */
  community(params?: ListCommunityAppsParams): Promise<Page<CommunityApp>> {
    return this.http.getPage<CommunityApp>("integrations/community", {
      query: params,
    });
  }

  /**
   * Opens a published community app by its link slug, listed or not. Needs `INTEGRATIONS`.
   * @example
   * const app = await warmbly.integrations.getCommunityApp("acme-sync");
   */
  getCommunityApp(slug: string, opts?: RequestOptions): Promise<CommunityApp> {
    return this.http.get<CommunityApp>(this.path("integrations", "community", slug), opts);
  }

  /**
   * Lists configured connections. Needs `INTEGRATIONS`.
   * @example
   * const conns = await warmbly.integrations.listConnections();
   */
  listConnections(opts?: RequestOptions): Promise<IntegrationConnection[]> {
    return this.http
      .get<{
        connections: IntegrationConnection[];
      }>("integrations/connections", opts)
      .then((r) => r.connections ?? []);
  }

  /**
   * Creates a credential-based connection (API key or webhook providers). OAuth providers
   * are rejected. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.createConnection({ provider: "slack_webhook", label: "Alerts" });
   */
  createConnection(params: CreateIntegrationConnectionParams): Promise<IntegrationConnection> {
    return this.http.post<IntegrationConnection>("integrations/connections", {
      body: params,
    });
  }

  /**
   * Retrieves a connection by id, with its event subscriptions and recent runs attached
   * as `events` and `runs`. Needs `INTEGRATIONS`.
   * @example
   * const conn = await warmbly.integrations.getConnection("conn_1");
   * console.log(conn.events, conn.runs);
   */
  getConnection(id: string, opts?: RequestOptions): Promise<IntegrationConnectionDetail> {
    return this.http
      .get<{
        connection: IntegrationConnection;
        events: IntegrationEvent[];
        runs: IntegrationSyncRun[];
      }>(this.path("integrations", "connections", id), opts)
      .then((r) => ({ ...r.connection, events: r.events, runs: r.runs }));
  }

  /**
   * Updates a connection's capability snapshot and sync direction. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.updateConnectionConfig("conn_1", { sync_direction: "push" });
   */
  updateConnectionConfig(
    id: string,
    params: UpdateIntegrationConnectionConfigParams,
  ): Promise<IntegrationConnection> {
    return this.http
      .patch<{
        connection: IntegrationConnection;
      }>(this.path("integrations", "connections", id, "config"), { body: params })
      .then((r) => r.connection);
  }

  /**
   * Deletes a connection. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.deleteConnection("conn_1");
   */
  deleteConnection(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("integrations", "connections", id), opts);
  }

  /**
   * Lists event subscriptions on a connection. Needs `INTEGRATIONS`.
   * @example
   * const events = await warmbly.integrations.listConnectionEvents("conn_1");
   */
  listConnectionEvents(id: string, opts?: RequestOptions): Promise<IntegrationEvent[]> {
    return this.http
      .get<{
        events: IntegrationEvent[];
      }>(this.path("integrations", "connections", id, "events"), opts)
      .then((r) => r.events ?? []);
  }

  /**
   * Adds an event subscription to a connection (201). Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.createConnectionEvent("conn_1", {
   *   event_type: "reply.received",
   *   action: "webhook.ping",
   * });
   */
  createConnectionEvent(
    id: string,
    params: CreateIntegrationEventParams,
  ): Promise<IntegrationEvent> {
    return this.http.post<IntegrationEvent>(
      this.path("integrations", "connections", id, "events"),
      { body: params },
    );
  }

  /**
   * Removes an event subscription from a connection. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.deleteConnectionEvent("conn_1", "ev_1");
   */
  deleteConnectionEvent(id: string, eventId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(
      this.path("integrations", "connections", id, "events", eventId),
      opts,
    );
  }

  /**
   * Reads a connection's field mappings. Needs `INTEGRATIONS`.
   * @example
   * const mappings = await warmbly.integrations.getFieldMappings("conn_1");
   */
  getFieldMappings(id: string, opts?: RequestOptions): Promise<IntegrationFieldMapping[]> {
    return this.http
      .get<{
        mappings: IntegrationFieldMapping[];
      }>(this.path("integrations", "connections", id, "field-mappings"), opts)
      .then((r) => r.mappings ?? []);
  }

  /**
   * Replaces a connection's field mappings for an object. Safe to retry. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.setFieldMappings("conn_1", {
   *   object: "contact",
   *   mappings: [{ warmbly_field: "first_name", external_field: "FirstName" }],
   * });
   */
  setFieldMappings(id: string, params: SetFieldMappingsParams): Promise<IntegrationFieldMapping[]> {
    return this.http
      .put<{
        mappings: IntegrationFieldMapping[];
      }>(this.path("integrations", "connections", id, "field-mappings"), { body: params })
      .then((r) => r.mappings ?? []);
  }

  /**
   * Lists the 50 most recent sync runs for a connection. Needs `INTEGRATIONS`.
   * @example
   * const runs = await warmbly.integrations.listRuns("conn_1");
   */
  listRuns(id: string, opts?: RequestOptions): Promise<IntegrationSyncRun[]> {
    return this.http
      .get<{
        runs: IntegrationSyncRun[];
      }>(this.path("integrations", "connections", id, "runs"), opts)
      .then((r) => r.runs ?? []);
  }

  /**
   * Reveals an automation connection's signing secret, generating it on first call.
   * Signed-in sessions must have re-authenticated recently; API keys and OAuth tokens
   * are not asked to. Needs `INTEGRATIONS`.
   * @example
   * const { signing_secret } = await warmbly.integrations.getWebhookSecret("conn_1");
   */
  getWebhookSecret(id: string, opts?: RequestOptions): Promise<IntegrationWebhookSecret> {
    return this.http.get<IntegrationWebhookSecret>(
      this.path("integrations", "connections", id, "webhook-secret"),
      opts,
    );
  }

  /**
   * Sets the key a Calendly or Cal.com connection's deliveries must be signed with. An
   * empty key goes back to the URL secret alone. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.setSigningKey("conn_1", "provider-signing-key");
   */
  setSigningKey(id: string, signingKey: string): Promise<IntegrationConnection> {
    return this.http
      .put<{
        connection: IntegrationConnection;
      }>(this.path("integrations", "connections", id, "signing-key"), {
        body: { signing_key: signingKey },
      })
      .then((r) => r.connection);
  }

  /**
   * Mints a new inbound URL for a Calendly or Cal.com connection. The previous URL stops
   * working at once. Returns the new URL. Needs `INTEGRATIONS`.
   * @example
   * const { inbound_webhook_url } = await warmbly.integrations.rotateInboundUrl("conn_1");
   */
  rotateInboundUrl(id: string, opts?: RequestOptions): Promise<{ inbound_webhook_url: string }> {
    return this.http.post<{ inbound_webhook_url: string }>(
      this.path("integrations", "connections", id, "rotate-inbound-url"),
      opts,
    );
  }

  /**
   * Fires a synthetic event through the connection's notify and webhook automations.
   * Needs `INTEGRATIONS`.
   * @example
   * const { sent } = await warmbly.integrations.testConnection("conn_1");
   */
  testConnection(id: string, opts?: RequestOptions): Promise<IntegrationTestResult> {
    return this.http.post<IntegrationTestResult>(
      this.path("integrations", "connections", id, "test"),
      opts,
    );
  }

  /**
   * Pushes contacts to the connected CRM synchronously (at most 500 per call). Needs
   * `INTEGRATIONS`.
   * @example
   * const res = await warmbly.integrations.pushConnection("conn_1", { contact_ids: ["c_1"] });
   */
  pushConnection(id: string, params: PushConnectionParams): Promise<PushConnectionResult> {
    return this.http.post<PushConnectionResult>(
      this.path("integrations", "connections", id, "push"),
      { body: params },
    );
  }

  /**
   * Lists the 50 most recent meeting bookings synced from connected schedulers. The server
   * takes no filters; for a searchable list use `warmbly.meetings`. Needs `READ_CONTACTS`.
   * @example
   * const bookings = await warmbly.integrations.bookings();
   */
  bookings(opts?: RequestOptions): Promise<MeetingBooking[]> {
    return this.http
      .get<{ bookings: MeetingBooking[] }>("integrations/bookings", opts)
      .then((r) => r.bookings ?? []);
  }
}
