import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Lifecycle status of an API key. */
export type ApiKeyStatus = "active" | "revoked" | "expired";

/**
 * A Warmbly API key. The `secret` field is only present on the create response and is
 * never returned again.
 */
export interface ApiKey {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  description?: string;
  key_prefix: string;
  key_suffix: string;
  /** Permission bitmask carried by the key. */
  permissions: number;
  allowed_ips: string[];
  allowed_email_accounts: string[];
  rate_limit_per_minute: number;
  status: ApiKeyStatus;
  last_used_at?: string | null;
  last_request_ip?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** An API key returned by create, including the one-time plaintext `secret`. */
export interface CreatedApiKey extends ApiKey {
  /** The full secret key, shown only once at creation time. */
  secret: string;
}

/** Body for creating an API key. */
export interface CreateApiKeyParams {
  name: string;
  description?: string;
  /** Permission bitmask. Pass a number or `Permissions` value coerced via `.value`. */
  permissions: number;
  allowed_ips?: string[];
  allowed_email_accounts?: string[];
  rate_limit_per_minute?: number;
  expires_at?: string | null;
  [key: string]: unknown;
}

/** Body for updating an API key. All fields optional. */
export interface UpdateApiKeyParams {
  name?: string;
  description?: string;
  permissions?: number;
  allowed_ips?: string[];
  allowed_email_accounts?: string[];
  rate_limit_per_minute?: number;
  expires_at?: string | null;
  [key: string]: unknown;
}

/** A single permission entry in the permissions catalog. */
export interface PermissionCatalogEntry {
  name: string;
  value: number;
  description: string;
  category: "read" | "write" | "bulk" | "special";
  [key: string]: unknown;
}

/** The live permissions catalog with the canonical bit values and preset masks. */
export interface PermissionCatalog {
  permissions: PermissionCatalogEntry[];
  presets: {
    read_only: number;
    full_access: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Aggregate usage summary across all of the organization's API keys. */
export interface ApiKeyUsageSummary {
  [key: string]: unknown;
}

/** Time-series usage analytics across all API keys. */
export interface ApiKeyUsageAnalytics {
  [key: string]: unknown;
}

/** Usage analytics for a single API key. */
export interface ApiKeyAnalytics {
  [key: string]: unknown;
}

/** A single request log line for an API key. */
export interface ApiKeyLog {
  [key: string]: unknown;
}

/** Query parameters for the usage analytics endpoints. */
export interface ApiKeyAnalyticsParams {
  /** Inclusive start of the window (RFC 3339 or date). */
  from?: string;
  /** Inclusive end of the window (RFC 3339 or date). */
  to?: string;
  /** Bucket granularity, e.g. `day` or `hour`. */
  interval?: string;
  [key: string]: unknown;
}

/** Query parameters for listing API keys. */
export interface ListApiKeysParams {
  cursor?: string;
  /** Page size (1..100, default 50). */
  limit?: number;
  [key: string]: unknown;
}

/** Query parameters for listing an API key's request logs. */
export interface ApiKeyLogsParams {
  cursor?: string;
  /** Page size (1..200 for logs, default 50). */
  limit?: number;
  [key: string]: unknown;
}

/**
 * Manage API keys: create, list, inspect, revoke, and read usage analytics and logs.
 * Reachable as `warmbly.apiKeys`.
 *
 * @example
 * const created = await warmbly.apiKeys.create({
 *   name: "ci",
 *   permissions: Permissions.readOnly().value,
 * });
 * console.log(created.secret); // shown once
 */
export class ApiKeys extends APIResource {
  /**
   * Lists API keys for the organization, auto-paginating when iterated.
   *
   * @example
   * for await (const key of await warmbly.apiKeys.list()) console.log(key.name);
   */
  list(params?: ListApiKeysParams): Promise<Page<ApiKey>> {
    return this.http.getPage<ApiKey>("api-keys", { query: params });
  }

  /**
   * Creates a new API key. The returned `secret` is shown only once.
   *
   * @example
   * const key = await warmbly.apiKeys.create({ name: "prod", permissions: 7 });
   */
  create(params: CreateApiKeyParams): Promise<CreatedApiKey> {
    return this.http.post<CreatedApiKey>("api-keys", { body: params });
  }

  /**
   * Fetches the live permissions catalog (canonical bit values, descriptions, presets).
   *
   * @example
   * const { permissions, presets } = await warmbly.apiKeys.permissions();
   */
  permissions(opts?: RequestOptions): Promise<PermissionCatalog> {
    return this.http.get<PermissionCatalog>("api-keys/permissions", opts);
  }

  /**
   * Retrieves a single API key by id.
   *
   * @example
   * const key = await warmbly.apiKeys.get("key_123");
   */
  get(id: string, opts?: RequestOptions): Promise<ApiKey> {
    return this.http.get<ApiKey>(this.path("api-keys", id), opts);
  }

  /**
   * Updates an API key's name, description, permissions, or limits.
   *
   * @example
   * await warmbly.apiKeys.update("key_123", { rate_limit_per_minute: 120 });
   */
  update(id: string, params: UpdateApiKeyParams): Promise<ApiKey> {
    return this.http.patch<ApiKey>(this.path("api-keys", id), { body: params });
  }

  /**
   * Revokes an API key, optionally recording a reason (sent as the `reason` query param).
   * Returns an acknowledgement (`{ status: "revoked" }`), not the key record.
   *
   * @example
   * const { status } = await warmbly.apiKeys.revoke("key_123", "leaked in a public repo");
   */
  revoke(id: string, reason?: string): Promise<{ status: string }> {
    return this.http.delete<{ status: string }>(this.path("api-keys", id), {
      query: reason !== undefined ? { reason } : undefined,
    });
  }

  /**
   * Returns the aggregate usage summary across all keys.
   *
   * @example
   * const summary = await warmbly.apiKeys.usageSummary();
   */
  usageSummary(opts?: RequestOptions): Promise<ApiKeyUsageSummary> {
    return this.http.get<ApiKeyUsageSummary>("api-keys/usage/summary", opts);
  }

  /**
   * Returns time-series usage analytics across all keys.
   *
   * @example
   * const usage = await warmbly.apiKeys.usageAnalytics({ interval: "day" });
   */
  usageAnalytics(params?: ApiKeyAnalyticsParams): Promise<ApiKeyUsageAnalytics> {
    return this.http.get<ApiKeyUsageAnalytics>("api-keys/usage/analytics", { query: params });
  }

  /**
   * Returns usage analytics for a single key.
   *
   * @example
   * const stats = await warmbly.apiKeys.keyAnalytics("key_123", { interval: "hour" });
   */
  keyAnalytics(id: string, params?: ApiKeyAnalyticsParams): Promise<ApiKeyAnalytics> {
    return this.http.get<ApiKeyAnalytics>(this.path("api-keys", id, "analytics"), {
      query: params,
    });
  }

  /**
   * Lists the request logs for a key, auto-paginating when iterated (limit up to 200).
   *
   * @example
   * for await (const line of await warmbly.apiKeys.logs("key_123")) console.log(line);
   */
  logs(id: string, params?: ApiKeyLogsParams): Promise<Page<ApiKeyLog>> {
    return this.http.getPage<ApiKeyLog>(this.path("api-keys", id, "logs"), { query: params });
  }
}
