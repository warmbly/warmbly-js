import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** An available integration in the catalog. Documented-but-open shape. */
export interface IntegrationCatalogEntry {
  [key: string]: unknown;
}

/** A configured integration connection. */
export interface IntegrationConnection {
  id: string;
  provider?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** An event subscription on an integration connection. */
export interface IntegrationEvent {
  id: string;
  [key: string]: unknown;
}

/**
 * Manage third-party integrations: catalog, connections, events, field mappings, runs,
 * webhook secret, test/push, and bookings. Reachable as `warmbly.integrations`.
 *
 * @example
 * const catalog = await warmbly.integrations.catalog();
 * const conn = await warmbly.integrations.createConnection({ provider: "hubspot" });
 */
export class Integrations extends APIResource {
  /**
   * Lists available integrations.
   * @example
   * const catalog = await warmbly.integrations.catalog();
   */
  catalog(params?: Record<string, unknown>): Promise<IntegrationCatalogEntry[]> {
    return this.http.get<IntegrationCatalogEntry[]>("integrations/catalog", { query: params });
  }

  /**
   * Lists configured connections.
   * @example
   * const conns = await warmbly.integrations.listConnections();
   */
  listConnections(params?: Record<string, unknown>): Promise<IntegrationConnection[]> {
    return this.http.get<IntegrationConnection[]>("integrations/connections", { query: params });
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
   * Retrieves a connection by id.
   * @example
   * const conn = await warmbly.integrations.getConnection("conn_1");
   */
  getConnection(id: string, opts?: RequestOptions): Promise<IntegrationConnection> {
    return this.http.get<IntegrationConnection>(this.path("integrations", "connections", id), opts);
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
    return this.http.patch<IntegrationConnection>(
      this.path("integrations", "connections", id, "config"),
      { body: params },
    );
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
    return this.http.get<IntegrationEvent[]>(
      this.path("integrations", "connections", id, "events"),
      { query: params },
    );
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
  getFieldMappings(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      this.path("integrations", "connections", id, "field-mappings"),
      opts,
    );
  }

  /**
   * Replaces a connection's field mappings.
   * @example
   * await warmbly.integrations.setFieldMappings("conn_1", { mappings: [] });
   */
  setFieldMappings(id: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>(
      this.path("integrations", "connections", id, "field-mappings"),
      { body: params },
    );
  }

  /**
   * Lists sync runs for a connection.
   * @example
   * const runs = await warmbly.integrations.listRuns("conn_1");
   */
  listRuns(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      this.path("integrations", "connections", id, "runs"),
      { query: params },
    );
  }

  /**
   * Reveals a connection's webhook secret.
   * @example
   * const secret = await warmbly.integrations.getWebhookSecret("conn_1");
   */
  getWebhookSecret(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      this.path("integrations", "connections", id, "webhook-secret"),
      opts,
    );
  }

  /**
   * Runs a connection test.
   * @example
   * const result = await warmbly.integrations.testConnection("conn_1");
   */
  testConnection(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      this.path("integrations", "connections", id, "test"),
      { body: params },
    );
  }

  /**
   * Pushes data through a connection.
   * @example
   * await warmbly.integrations.pushConnection("conn_1", { contact_ids: ["c_1"] });
   */
  pushConnection(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      this.path("integrations", "connections", id, "push"),
      { body: params },
    );
  }

  /**
   * Lists meeting bookings synced from connected schedulers.
   * @example
   * const bookings = await warmbly.integrations.bookings();
   */
  bookings(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("integrations/bookings", { query: params });
  }
}
