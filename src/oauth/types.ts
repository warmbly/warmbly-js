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
  /** Lifecycle status: `active` or `disabled`. */
  status: "active" | "disabled" | (string & {});
  /** A public client: PKCE, no secret. */
  is_public?: boolean;
  /** True for clients created through RFC 7591 dynamic registration. */
  dynamically_registered?: boolean;
  /** Set when an operator suspended the app; the owner cannot lift it. */
  suspended_at?: string;
  suspended_reason?: string;
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
 * Whether the workspace and caller may register or publish OAuth apps, reported
 * alongside the app list. When `blocked`, registering or publishing answers 403
 * `developer_access_blocked`.
 */
export interface OAuthDeveloperAccess {
  blocked: boolean;
  reason?: string;
}

/** The status of a directory listing. `hidden` listings were taken down by an operator. */
export type AppListingStatus = "published" | "featured" | "hidden" | (string & {});

/** An OAuth app's page in the community directory. */
export interface AppListing {
  application_id: string;
  organization_id: string;
  /** The link: 3 to 48 lowercase letters, numbers or single dashes. */
  slug: string;
  tagline: string;
  description: string;
  /** One of `crm`, `automation`, `notifications`, `meetings`, `data`, `verification`, `ai`, `other`. */
  category: string;
  install_url: string;
  support_url: string;
  privacy_url: string;
  status: AppListingStatus;
  /** Why an operator hid the listing. */
  status_note?: string;
  status_at?: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Body for publishing or replacing an app's directory listing. The whole listing is replaced. */
export interface AppListingWrite {
  /** 3 to 48 lowercase letters, numbers or single dashes, starting and ending with a letter or number. */
  slug: string;
  /** One line, at most 120 characters. */
  tagline: string;
  /** Optional, at most 2,000 characters. */
  description?: string;
  /** One of `crm`, `automation`, `notifications`, `meetings`, `data`, `verification`, `ai`, `other`. */
  category: string;
  /** Where Install takes people. Must be https. */
  install_url: string;
  /** Optional https link. */
  support_url?: string;
  /** Optional https link. */
  privacy_url?: string;
  [key: string]: unknown;
}

/**
 * A webhook endpoint of an application, with the health the platform tracks. The server
 * returns its endpoint rows as-is.
 *
 * @example
 * const { endpoints } = await warmbly.oauth.applications.listWebhookEndpoints("wmcid_...");
 * for (const e of endpoints) console.log(e.url, e.enabled, e.consecutive_failures);
 */
export interface WebhookEndpointHealth {
  id?: string;
  /** The workspace that installed the app. */
  organization_id?: string;
  /** The endpoint URL. */
  url?: string;
  enabled?: boolean;
  event_types?: string[];
  /** ISO-8601 timestamp of the most recent successful delivery. */
  last_success_at?: string;
  /** ISO-8601 timestamp of the most recent failed delivery. */
  last_failure_at?: string;
  last_failure_reason?: string;
  /** Count of consecutive failures. */
  consecutive_failures?: number;
  oauth_application_id?: string;
  verified_at?: string;
  ownership_confirmed?: boolean;
  /** Set when repeated failures disabled the endpoint. */
  auto_disabled_at?: string;
  disabled_reason?: string;
  created_at?: string;
  updated_at?: string;
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
  endpoint_id?: string;
  organization_id?: string;
  /** The event type that was delivered. */
  event_type?: string;
  event_id?: string;
  /** The JSON payload that was sent. */
  payload?: unknown;
  /** Delivery status: `pending`, `in_flight`, `delivered`, `failed` or `abandoned`. */
  status?: string;
  /** Number of attempts made. */
  attempt_count?: number;
  max_attempts?: number;
  next_attempt_at?: string;
  last_attempt_at?: string;
  /** HTTP response status of the last attempt. */
  response_status?: number;
  response_body_excerpt?: string;
  error_reason?: string;
  /** ISO-8601 creation timestamp. */
  created_at?: string;
  updated_at?: string;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}

/**
 * An application a user has authorized, returned by the authorized-apps endpoint.
 *
 * @example
 * const apps: AuthorizedApp[] = await warmbly.oauth.applications.listAuthorizedApps();
 * for (const app of apps) console.log(app.name, app.application_id);
 */
export interface AuthorizedApp {
  /** The application id. Pass it to `revokeAuthorizedApp`. */
  application_id: string;
  /** The application display name. */
  name?: string;
  /** The application logo URL. */
  logo_url?: string;
  website_url?: string;
  /** Granted scopes as a uint64 bitmask. */
  scopes?: number;
  /** ISO-8601 timestamp the authorization was granted. */
  authorized_at?: string;
  /** ISO-8601 timestamp the authorization was last used. */
  last_used_at?: string;
  /** Forward-compatible: additional fields. */
  [key: string]: unknown;
}

/**
 * One member's live authorization of an app, as a workspace admin sees it
 * (`GET /oauth/workspace-authorizations`).
 */
export interface WorkspaceAuthorization {
  application_id: string;
  name?: string;
  logo_url?: string;
  website_url?: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  /** Granted scopes as a uint64 bitmask. */
  scopes?: number;
  authorized_at?: string;
  last_used_at?: string;
  [key: string]: unknown;
}
