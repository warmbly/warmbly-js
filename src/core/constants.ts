/**
 * Default hosts and protocol constants for the Warmbly API.
 *
 * Every default here is overridable through {@link ClientOptions}, which makes the
 * SDK usable against staging, self-hosted, or proxied deployments.
 */

/** Default base URL for the REST API (already includes the `/v1` version prefix). */
export const DEFAULT_API_BASE_URL = "https://api.warmbly.com/v1";

/** Default base URL for the dashboard, used to build the OAuth authorize URL. */
export const DEFAULT_APP_BASE_URL = "https://app.warmbly.com";

/** Default base URL for the realtime gateway WebSocket. */
export const DEFAULT_GATEWAY_URL = "wss://realtime.warmbly.com";

/** Path of the Phoenix WebSocket transport, appended to the gateway base URL. */
export const GATEWAY_SOCKET_PATH = "/socket/websocket";

/** Phoenix channel serializer version negotiated on the gateway connection. */
export const PHOENIX_VSN = "1.0.0";

/** Header names used across the SDK. */
export const HEADER = {
  authorization: "Authorization",
  contentType: "Content-Type",
  accept: "Accept",
  userAgent: "User-Agent",
  idempotencyKey: "Idempotency-Key",
  requestId: "X-Request-Id",
  apiVersion: "API-Version",
  retryAfter: "Retry-After",
  rateLimitLimit: "X-RateLimit-Limit",
  rateLimitRemaining: "X-RateLimit-Remaining",
  rateLimitPolicy: "X-RateLimit-Policy",
} as const;

/**
 * Recognizable prefixes for Warmbly credentials. They exist for leak detection and
 * greppability; the SDK treats every credential as an opaque string and never relies
 * on these prefixes for validation.
 */
export const TOKEN_PREFIX = {
  apiKey: "wmbly_",
  accessToken: "wmat_",
  refreshToken: "wmrt_",
  authorizationCode: "wmac_",
  clientId: "wmcid_",
  clientSecret: "wmcs_",
  webhookSecret: "whsec_",
} as const;

/** Default per-request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** Default number of automatic retries for transient failures. */
export const DEFAULT_MAX_RETRIES = 2;
