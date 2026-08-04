import type { FetchLike } from "../core/types";
import type { Permissions, Scope } from "../permissions";

/** A scope accepted by the authorization helpers: a typed scope string, any string, or a {@link Permissions} set. */
export type ScopeInput = Scope | (string & {}) | Permissions;

/**
 * Options for constructing an {@link OAuthClient}.
 *
 * @example
 * const oauth = new OAuthClient({
 *   clientId: "wmcid_...",
 *   clientSecret: "wmcs_...",
 *   redirectUri: "https://app.example.com/callback",
 * });
 */
export interface OAuthClientOptions {
  /** The registered OAuth client id (`wmcid_...`). */
  clientId: string;
  /** The client secret (`wmcs_...`). Omit for public clients using PKCE only. */
  clientSecret?: string;
  /** The default redirect URI, used when a per-call value is not given. Must match a registered URI. */
  redirectUri?: string;
  /** REST/OAuth API base URL. Defaults to `https://api.warmbly.com/v1`. */
  baseUrl?: string;
  /** Dashboard base URL used to build the authorize URL. Defaults to `https://app.warmbly.com`. */
  appBaseUrl?: string;
  /** Custom `fetch` implementation. Defaults to the platform global. */
  fetch?: FetchLike;
}

/**
 * Parameters for {@link OAuthClient.createAuthorizationUrl}.
 *
 * @example
 * const params: AuthorizationUrlParams = {
 *   scopes: ["read_campaigns", "read_contacts"],
 *   pkce: true,
 * };
 */
export interface AuthorizationUrlParams {
  /** Scopes to request, as scope strings or a {@link Permissions} set. */
  scopes?: ScopeInput[] | Permissions;
  /** Redirect URI for this authorization. Falls back to the client's default. */
  redirectUri?: string;
  /** CSRF state value. Auto-generated when omitted. */
  state?: string;
  /** Enable PKCE. Pass `true` to generate a verifier, or `{ verifier }` to reuse one. */
  pkce?: boolean | { verifier: string };
}

/**
 * The result of building an authorization URL.
 *
 * @example
 * const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({ pkce: true });
 * // Persist `state` and `codeVerifier`, then redirect the user to `url`.
 */
export interface AuthorizationUrl {
  /** The fully built authorize URL to redirect the user to. */
  url: string;
  /** The CSRF state to persist and verify on the callback. */
  state: string;
  /** The PKCE code verifier to persist, present only when PKCE was enabled. */
  codeVerifier?: string;
}

/**
 * The raw, snake_case token response returned by the token endpoint.
 *
 * @example
 * const raw: TokenResponse = {
 *   access_token: "wmat_...",
 *   token_type: "Bearer",
 *   expires_in: 3600,
 *   refresh_token: "wmrt_...",
 *   scope: "read_campaigns read_contacts",
 * };
 */
export interface TokenResponse {
  /** The access token (`wmat_...`). */
  access_token: string;
  /** The token type, always `"Bearer"`. */
  token_type: string;
  /** Lifetime of the access token in seconds. */
  expires_in: number;
  /** The refresh token (`wmrt_...`), when issued. */
  refresh_token?: string;
  /** Space-separated granted scopes. */
  scope?: string;
  /** Forward-compatible: additional fields the server may add. */
  [key: string]: unknown;
}

/**
 * A normalized, camelCase token set with a computed expiry timestamp.
 *
 * @example
 * const tokens: TokenSet = await oauth.exchangeCode({ code });
 * if (tokens.expiresAt < new Date()) await oauth.refresh(tokens.refreshToken!);
 */
export interface TokenSet {
  /** The access token (`wmat_...`). */
  accessToken: string;
  /** The token type, always `"Bearer"`. */
  tokenType: string;
  /** Lifetime of the access token in seconds. */
  expiresIn: number;
  /** Absolute expiry, computed as now + `expiresIn` at issue time. */
  expiresAt: Date;
  /** The refresh token (`wmrt_...`), when issued. */
  refreshToken?: string;
  /** Space-separated granted scopes. */
  scope: string;
  /** Granted scopes as an array. */
  scopes: string[];
}

/**
 * Parameters for {@link OAuthClient.revoke}.
 *
 * @example
 * const params: RevokeParams = { token: "wmat_...", tokenTypeHint: "access_token" };
 */
export interface RevokeParams {
  /** The access or refresh token to revoke. */
  token: string;
  /** Optional hint about the token type, per RFC 7009. */
  tokenTypeHint?: "access_token" | "refresh_token";
}

/**
 * OAuth authorization server metadata (RFC 8414).
 *
 * @example
 * const meta: DiscoveryMetadata = await oauth.discover();
 * console.log(meta.token_endpoint);
 */
export interface DiscoveryMetadata {
  /** The authorization server's issuer identifier. */
  issuer: string;
  /** URL of the authorization endpoint. */
  authorization_endpoint: string;
  /** URL of the token endpoint. */
  token_endpoint: string;
  /** URL of the token revocation endpoint. */
  revocation_endpoint?: string;
  /** Supported `response_type` values. */
  response_types_supported?: string[];
  /** Supported grant types. */
  grant_types_supported?: string[];
  /** Supported PKCE code challenge methods. */
  code_challenge_methods_supported?: string[];
  /** Supported token endpoint client authentication methods. */
  token_endpoint_auth_methods_supported?: string[];
  /** Scopes the server advertises support for. */
  scopes_supported?: string[];
  /** Forward-compatible: additional metadata fields. */
  [key: string]: unknown;
}

/**
 * Client metadata for dynamic client registration (RFC 7591). Registration mints only a
 * `client_id` and grants no access on its own: a human still approves scopes at consent.
 *
 * @example
 * const client: DynamicClientRegistration = {
 *   client_name: "My MCP client",
 *   redirect_uris: ["http://127.0.0.1:8976/callback"],
 *   token_endpoint_auth_method: "none",
 * };
 */
export interface DynamicClientRegistration {
  /** The human-readable name shown on the consent screen. */
  client_name?: string;
  /** Allowed redirect URIs. Executable schemes are rejected on this open endpoint. */
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  /** `"none"` registers a public (PKCE, no-secret) client. Anything else is confidential. */
  token_endpoint_auth_method?: "none" | "client_secret_basic" | "client_secret_post" | string;
  /** Space-separated scopes to request. Capped server-side, then narrowed by the human. */
  scope?: string;
  client_uri?: string;
  logo_uri?: string;
  [key: string]: unknown;
}

/**
 * The RFC 7591 client-information response. `client_secret` is present only for a
 * confidential registration (`token_endpoint_auth_method` other than `"none"`).
 */
export interface RegisteredClient {
  client_id: string;
  client_secret?: string;
  /** Issue time, in seconds since the Unix epoch. */
  client_id_issued_at?: number;
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string;
  [key: string]: unknown;
}

/**
 * An OAuth application as returned by the management API (read shape).
 *
 * @example
 * const app: OAuthApplication = await warmbly.oauth.applications.get("wmcid_...");
 * console.log(app.name, app.status);
 */
export interface OAuthApplication {
  /** The application id. */
  id: string;
  /** The owning organization id. */
  organization_id: string;
  /** The user id that created the application. */
  created_by: string;
  /** The public client id (`wmcid_...`). */
  client_id: string;
  /** Display name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Optional logo URL. */
  logo_url?: string;
  /** Optional marketing/website URL. */
  website_url?: string;
  /** Registered redirect URIs (exact-match https; loopback http allowed). */
  redirect_uris: string[];
  /** Allowed webhook domains (bare host = exact; leading-dot = apex + subdomains). */
  allowed_webhook_domains?: string[];
  /** Webhook delivery URL. */
  webhook_url?: string;
  /** Subscribed webhook event types. */
  webhook_events?: string[];
  /** Requested scopes as a uint64 bitmask. */
  scopes: number;
  /** Lifecycle status. */
  status: string;
  /** ISO-8601 creation timestamp. */
  created_at: string;
  /** ISO-8601 last-update timestamp. */
  updated_at: string;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}

/**
 * The create/update body for an OAuth application (write shape).
 *
 * @example
 * const body: OAuthApplicationWrite = {
 *   name: "My App",
 *   redirect_uris: ["https://app.example.com/callback"],
 *   scopes: 6,
 * };
 */
export interface OAuthApplicationWrite {
  /** Display name. Required. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Optional logo URL. */
  logo_url?: string;
  /** Optional marketing/website URL. */
  website_url?: string;
  /** Registered redirect URIs (exact-match https; loopback http allowed). Required. */
  redirect_uris: string[];
  /** Allowed webhook domains (bare host = exact; leading-dot = apex + subdomains). */
  allowed_webhook_domains?: string[];
  /** Webhook delivery URL. */
  webhook_url?: string;
  /** Subscribed webhook event types. */
  webhook_events?: string[];
  /** Requested scopes as a uint64 bitmask. Required. */
  scopes: number;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}

/**
 * An OAuth application returned with its one-time client secret (on create / rotate).
 *
 * @example
 * const created: OAuthApplicationWithSecret = await warmbly.oauth.applications.create(body);
 * // Store `created.client_secret` now; it is never returned again.
 */
export interface OAuthApplicationWithSecret extends OAuthApplication {
  /** The client secret (`wmcs_...`), shown only once. */
  client_secret: string;
}

/**
 * Health information for a single webhook endpoint of an application.
 *
 * @example
 * const { endpoints } = await warmbly.oauth.applications.listWebhookEndpoints("wmcid_...");
 * for (const e of endpoints) console.log(e.url, e.healthy);
 */
export interface WebhookEndpointHealth {
  /** The endpoint URL. */
  url?: string;
  /** Whether the endpoint is currently considered healthy. */
  healthy?: boolean;
  /** HTTP status of the most recent delivery attempt. */
  last_status?: number;
  /** ISO-8601 timestamp of the most recent successful delivery. */
  last_success_at?: string;
  /** ISO-8601 timestamp of the most recent failed delivery. */
  last_failure_at?: string;
  /** Count of consecutive failures. */
  consecutive_failures?: number;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}

/**
 * A single webhook delivery record for an application.
 *
 * @example
 * for await (const d of await warmbly.oauth.applications.listWebhookDeliveries("wmcid_...")) {
 *   console.log(d.event_type, d.status);
 * }
 */
export interface WebhookDelivery {
  /** The delivery id. */
  id: string;
  /** The event type that was delivered. */
  event_type?: string;
  /** Delivery status, e.g. `"delivered"`, `"failed"`, `"pending"`. */
  status?: string;
  /** The destination URL. */
  url?: string;
  /** HTTP response status of the attempt. */
  response_status?: number;
  /** Number of attempts made. */
  attempts?: number;
  /** ISO-8601 creation timestamp. */
  created_at?: string;
  /** ISO-8601 timestamp of the last delivery attempt. */
  delivered_at?: string;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}

/**
 * An application a user has authorized, returned by the authorized-apps endpoint.
 *
 * @example
 * const apps: AuthorizedApp[] = await warmbly.oauth.applications.listAuthorizedApps();
 * for (const app of apps) console.log(app.name, app.scopes);
 */
export interface AuthorizedApp {
  /** The authorization (grant) id, used to revoke. */
  id: string;
  /** The application id. */
  application_id?: string;
  /** The application's client id (`wmcid_...`). */
  client_id?: string;
  /** The application display name. */
  name?: string;
  /** The application logo URL. */
  logo_url?: string;
  /** Granted scopes as scope strings. */
  scopes?: string[];
  /** ISO-8601 timestamp the authorization was granted. */
  authorized_at?: string;
  /** ISO-8601 timestamp the authorization was last used. */
  last_used_at?: string;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}
