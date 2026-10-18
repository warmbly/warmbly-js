import type { HttpClient } from "../core/http";
import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { Apollo } from "./apollo";
import { APIResource } from "./base";
import { Clay } from "./clay";
import { Salesforce } from "./salesforce";

/** An available integration in the catalog. Documented-but-open shape. */
export interface IntegrationCatalogEntry {
  /** Whether the instance has the provider's OAuth credentials (an unconfigured one is "coming soon"). */
  configured?: boolean;
  /** The provider's popularity on this instance, 1 being the most used. */
  rank?: number;
  [key: string]: unknown;
}

/** Where a community directory listing can be seen. */
export type AppListingStatus = "published" | "featured" | "hidden" | (string & {});

/**
 * A third-party app in the community directory, as a browsing workspace sees it: its public
 * face, publisher and reach, and whether this workspace already uses it. No credential,
 * redirect or webhook field is ever included.
 */
export interface CommunityApp {
  application_id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** `crm`, `automation`, `notifications`, `meetings`, `data`, `verification`, `ai` or `other`. */
  category: string;
  logo_url: string;
  website_url: string;
  install_url: string;
  support_url: string;
  privacy_url: string;
  /** The publishing workspace. */
  developer: string;
  /** The scopes the app requests, as a permission bitmask. */
  scopes: number;
  /** `scopes` spelled out. */
  permissions: Array<{
    name: string;
    value: number;
    description: string;
    category: string;
    [key: string]: unknown;
  }>;
  status: AppListingStatus;
  /** Shown in discovery, because it is featured or widely used. */
  listed: boolean;
  installs: number;
  /** Whether this workspace already authorized the app. */
  installed: boolean;
  published_at: string;
  [key: string]: unknown;
}

/** Query params for {@link Integrations.listCommunityApps}. */
export interface ListCommunityAppsParams {
  cursor?: string;
  /** Page size (1..200, default 100). */
  limit?: number;
  [key: string]: unknown;
}

/** A configured integration connection. Secrets are never serialized. */
export interface IntegrationConnection {
  id: string;
  organization_id?: string;
  provider?: string;
  label?: string;
  status?: string;
  auth_method?: string;
  display_fields?: unknown;
  /** The non-secret onboarding snapshot. The outbound `signing_secret` is always removed. */
  config_capabilities?: Record<string, unknown>;
  /** `push`, `pull` or `both`. */
  sync_direction?: string;
  external_account_id?: string;
  external_account_name?: string;
  granted_scopes?: string[];
  token_expires_at?: string;
  health?: string;
  health_detail?: string | null;
  health_checked_at?: string | null;
  last_synced_at?: string | null;
  last_error?: string | null;
  last_error_at?: string | null;
  created_at?: string;
  updated_at?: string;
  /**
   * Calendly, Cal.com and Clay connections only: the inbound path to paste into the
   * provider, such as `/api/v1/integrations/inbound/clay/<secret>`. Prefix it with your
   * API base URL. Returned on create, and again by {@link Integrations.rotateInboundUrl}
   * as its own field.
   */
  inbound_webhook_url?: string;
  [key: string]: unknown;
}

/** Body for {@link Integrations.pushConnection}: contacts to upsert into the connected CRM. */
export interface PushContactsParams {
  /** Contact ids (the original field). */
  contact_ids?: string[];
  /** The selection form: explicit ids. Equivalent to `contact_ids`. */
  contacts?: string[];
  /** Switches to `filters`, the "select all matching" form. */
  all?: boolean;
  /** The same body `contacts.search` takes. */
  filters?: Record<string, unknown>;
  /** Ids dropped from the resolved set. Ignored unless `all` is true. */
  exclude?: string[];
  [key: string]: unknown;
}

/** The result of {@link Integrations.pushConnection}. */
export interface PushContactsResult {
  provider: string;
  pushed: number;
  failed: number;
  results: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** The outbound signing secret of an automation connection. */
export interface WebhookSecret {
  signing_secret: string;
  /** `X-Warmbly-Signature`. */
  signature_header: string;
  /** A description of the signature scheme. */
  scheme: string;
  [key: string]: unknown;
}

/** An event subscription on an integration connection. */
export interface IntegrationEvent {
  id: string;
  [key: string]: unknown;
}

/** A connection plus its event subscriptions and recent sync runs, as returned by {@link Integrations.getConnection}. */
export interface IntegrationConnectionDetail extends IntegrationConnection {
  events?: IntegrationEvent[];
  runs?: Record<string, unknown>[];
}

/**
 * Manage third-party integrations: catalog, the community app directory, connections,
 * events, field mappings, runs, webhook secret, inbound signing key, test/push, bookings,
 * and the native Salesforce sync (`warmbly.integrations.salesforce`). Reachable as
 * `warmbly.integrations`. Reads need the `INTEGRATIONS` scope (or the matching dashboard
 * permissions); writes need `INTEGRATIONS`.
 *
 * @example
 * const catalog = await warmbly.integrations.catalog();
 * const conn = await warmbly.integrations.createConnection({ provider: "hubspot" });
 */
export class Integrations extends APIResource {
  /**
   * The native Salesforce sync of a Salesforce connection: health, settings, imports and
   * the activity log. See {@link Salesforce}.
   *
   * @example
   * const o = await warmbly.integrations.salesforce.overview("conn_1");
   */
  readonly salesforce: Salesforce;
  /**
   * The Apollo connection: API key, lists, imports and enrichment runs. See {@link Apollo}.
   *
   * @example
   * const lists = await warmbly.integrations.apollo.lists("conn_1");
   */
  readonly apollo: Apollo;
  /**
   * The Clay connection settings. See {@link Clay}.
   *
   * @example
   * const s = await warmbly.integrations.clay.settings("conn_1");
   */
  readonly clay: Clay;

  constructor(http: HttpClient) {
    super(http);
    this.salesforce = new Salesforce(http);
    this.apollo = new Apollo(http);
    this.clay = new Clay(http);
  }

  /**
   * Lists available integrations.
   * @example
   * const catalog = await warmbly.integrations.catalog();
   */
  catalog(params?: Record<string, unknown>): Promise<IntegrationCatalogEntry[]> {
    return this.http
      .get<{ catalog: IntegrationCatalogEntry[] }>("integrations/catalog", { query: params })
      .then((r) => r.catalog ?? []);
  }

  /**
   * Lists the community directory: featured apps first, then the most installed.
   * Auto-paginates when iterated. Needs `INTEGRATIONS` (members: `manage_settings` or
   * `use_integrations`).
   * @example
   * for await (const app of await warmbly.integrations.listCommunityApps()) {
   *   console.log(app.name, app.installs, app.installed);
   * }
   */
  listCommunityApps(params?: ListCommunityAppsParams): Promise<Page<CommunityApp>> {
    return this.http.getPage<CommunityApp>("integrations/community", { query: params });
  }

  /**
   * Opens one published app by its slug, listed in discovery or not. A hidden or unknown
   * slug is a 404. Needs `INTEGRATIONS`.
   * @example
   * const app = await warmbly.integrations.getCommunityApp("acme-sync");
   */
  getCommunityApp(slug: string, opts?: RequestOptions): Promise<CommunityApp> {
    return this.http.get<CommunityApp>(this.path("integrations", "community", slug), opts);
  }

  /**
   * Lists configured connections.
   * @example
   * const conns = await warmbly.integrations.listConnections();
   */
  listConnections(params?: Record<string, unknown>): Promise<IntegrationConnection[]> {
    return this.http
      .get<{ connections: IntegrationConnection[] }>("integrations/connections", { query: params })
      .then((r) => r.connections ?? []);
  }

  /**
   * Creates a connection.
   * @example
   * await warmbly.integrations.createConnection({ provider: "hubspot" });
   */
  createConnection(params: Record<string, unknown>): Promise<IntegrationConnection> {
    return this.http.post<IntegrationConnection>("integrations/connections", { body: params });
  }

  /**
   * Retrieves a connection by id, with its event subscriptions and recent runs attached
   * as `events` and `runs`.
   * @example
   * const conn = await warmbly.integrations.getConnection("conn_1");
   * console.log(conn.events, conn.runs);
   */
  getConnection(id: string, opts?: RequestOptions): Promise<IntegrationConnectionDetail> {
    return this.http
      .get<{
        connection: IntegrationConnection;
        events: IntegrationEvent[];
        runs: Record<string, unknown>[];
      }>(this.path("integrations", "connections", id), opts)
      .then((r) => ({ ...r.connection, events: r.events, runs: r.runs }));
  }

  /**
   * Updates a connection's config.
   * @example
   * await warmbly.integrations.updateConnectionConfig("conn_1", { api_key: "..." });
   */
  updateConnectionConfig(
    id: string,
    params: Record<string, unknown>,
  ): Promise<IntegrationConnection> {
    return this.http
      .patch<{ connection: IntegrationConnection }>(
        this.path("integrations", "connections", id, "config"),
        { body: params },
      )
      .then((r) => r.connection);
  }

  /**
   * Deletes a connection.
   * @example
   * await warmbly.integrations.deleteConnection("conn_1");
   */
  deleteConnection(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("integrations", "connections", id), opts);
  }

  /**
   * Lists event subscriptions on a connection.
   * @example
   * const events = await warmbly.integrations.listConnectionEvents("conn_1");
   */
  listConnectionEvents(id: string, params?: Record<string, unknown>): Promise<IntegrationEvent[]> {
    return this.http
      .get<{ events: IntegrationEvent[] }>(this.path("integrations", "connections", id, "events"), {
        query: params,
      })
      .then((r) => r.events ?? []);
  }

  /**
   * Adds an event subscription to a connection.
   * @example
   * await warmbly.integrations.createConnectionEvent("conn_1", { event_type: "contact.created" });
   */
  createConnectionEvent(id: string, params: Record<string, unknown>): Promise<IntegrationEvent> {
    return this.http.post<IntegrationEvent>(
      this.path("integrations", "connections", id, "events"),
      { body: params },
    );
  }

  /**
   * Removes an event subscription from a connection.
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
   * Reads a connection's field mappings.
   * @example
   * const mappings = await warmbly.integrations.getFieldMappings("conn_1");
   */
  getFieldMappings(id: string, opts?: RequestOptions): Promise<Record<string, unknown>[]> {
    return this.http
      .get<{ mappings: Record<string, unknown>[] }>(
        this.path("integrations", "connections", id, "field-mappings"),
        opts,
      )
      .then((r) => r.mappings ?? []);
  }

  /**
   * Replaces a connection's field mappings.
   * @example
   * await warmbly.integrations.setFieldMappings("conn_1", { mappings: [] });
   */
  setFieldMappings(
    id: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    return this.http
      .put<{ mappings: Record<string, unknown>[] }>(
        this.path("integrations", "connections", id, "field-mappings"),
        { body: params },
      )
      .then((r) => r.mappings ?? []);
  }

  /**
   * Lists sync runs for a connection.
   * @example
   * const runs = await warmbly.integrations.listRuns("conn_1");
   */
  listRuns(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.http
      .get<{ runs: Record<string, unknown>[] }>(
        this.path("integrations", "connections", id, "runs"),
        { query: params },
      )
      .then((r) => r.runs ?? []);
  }

  /**
   * Reveals an automation connection's outbound webhook signing secret (created on first
   * call). Needs `INTEGRATIONS`.
   * @example
   * const { signing_secret, signature_header } = await warmbly.integrations.getWebhookSecret("conn_1");
   */
  getWebhookSecret(id: string, opts?: RequestOptions): Promise<WebhookSecret> {
    return this.http.get<WebhookSecret>(
      this.path("integrations", "connections", id, "webhook-secret"),
      opts,
    );
  }

  /**
   * Sets the key a Calendly or Cal.com connection's inbound deliveries must be signed with,
   * on top of the secret in the inbound URL. An empty string removes the key and goes back
   * to the URL secret alone. The key must be 8 to 512 characters; any other provider is a
   * 400. Setting the same key again lands on the same state, so retries are safe. Returns
   * the updated connection. Needs `INTEGRATIONS`.
   * @example
   * const conn = await warmbly.integrations.setSigningKey("conn_1", "whsec_...");
   */
  setSigningKey(id: string, signingKey: string): Promise<IntegrationConnection> {
    return this.http
      .put<{ connection: IntegrationConnection }>(
        this.path("integrations", "connections", id, "signing-key"),
        { body: { signing_key: signingKey } },
      )
      .then((r) => r.connection);
  }

  /**
   * Mints a new inbound URL for a Calendly, Cal.com or Clay connection and returns its
   * path, which you prefix with your API base URL. The previous URL stops working
   * immediately, so update the provider's webhook before relying on it. Any other
   * provider is a 400. Needs `INTEGRATIONS`.
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
   * Fires a synthetic event through the connection's notify and webhook automations so you
   * can confirm the Zap, scenario or channel is wired. Returns how many deliveries were
   * sent. The platform ignores any request body. Needs `INTEGRATIONS`.
   * @example
   * const { sent } = await warmbly.integrations.testConnection("conn_1");
   */
  testConnection(id: string, params?: Record<string, unknown>): Promise<{ sent: number }> {
    return this.http.post<{ sent: number }>(this.path("integrations", "connections", id, "test"), {
      body: params,
    });
  }

  /**
   * Upserts contacts into the connected CRM, synchronously. Pass `contact_ids`, or the
   * selection form (`contacts`, or `all` plus `filters` and `exclude`). Capped at 500
   * contacts per push (`too_many_contacts`). A 409 means the connection must be
   * reconnected first. Needs `INTEGRATIONS`.
   * @example
   * const { pushed, failed } = await warmbly.integrations.pushConnection("conn_1", {
   *   contact_ids: ["c_1"],
   * });
   */
  pushConnection(id: string, params: PushContactsParams): Promise<PushContactsResult> {
    return this.http.post<PushContactsResult>(
      this.path("integrations", "connections", id, "push"),
      { body: params },
    );
  }

  /**
   * Lists meeting bookings synced from connected schedulers. Bookings carry invitee
   * details, so this needs `READ_CONTACTS` (members: `view_contacts`), not `INTEGRATIONS`.
   * @example
   * const bookings = await warmbly.integrations.bookings();
   */
  bookings(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("integrations/bookings", { query: params });
  }
}
