import { DEFAULT_API_BASE_URL, DEFAULT_APP_BASE_URL } from "../core/constants";
import { OAuthError, WarmblyConnectionError } from "../core/errors";
import {
  buildQuery,
  encodeForm,
  fullJitterBackoff,
  joinUrl,
  resolveFetch,
  sleep,
} from "../core/fetch";
import type { FetchLike } from "../core/types";
import { Permissions } from "../permissions";
import { createCodeChallenge, generateCodeVerifier, randomState } from "./pkce";
import type {
  AuthorizationUrl,
  AuthorizationUrlParams,
  DiscoveryMetadata,
  OAuthClientOptions,
  ScopeInput,
  TokenResponse,
  TokenSet,
} from "./types";

/** Statuses safe to retry when talking to the token/revoke endpoints. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** Max automatic retries on transient failures for OAuth form posts. */
const MAX_OAUTH_RETRIES = 2;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Derives the discovery URL (`<origin>/.well-known/oauth-authorization-server`) from a base URL. */
function discoveryUrlFor(baseUrl: string): string {
  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}/.well-known/oauth-authorization-server`;
  } catch {
    // Fall back to a best-effort join if the base URL is not absolute.
    return joinUrl(baseUrl, "/.well-known/oauth-authorization-server");
  }
}

/** Resolves a scopes input into a single space-separated scope string. */
function resolveScopeString(scopes: AuthorizationUrlParams["scopes"]): string {
  if (!scopes) return "";
  if (scopes instanceof Permissions) return scopes.toScopes().join(" ");
  const parts: string[] = [];
  for (const scope of scopes) {
    parts.push(scopeInputToString(scope));
  }
  return parts.join(" ");
}

/** Converts a single scope input into its scope string. */
function scopeInputToString(scope: ScopeInput): string {
  return scope instanceof Permissions ? scope.toScopes().join(" ") : scope;
}

/** Maps a raw snake_case {@link TokenResponse} to a normalized {@link TokenSet}. */
function toTokenSet(raw: TokenResponse): TokenSet {
  const scope = raw.scope ?? "";
  const set: TokenSet = {
    accessToken: raw.access_token,
    tokenType: raw.token_type,
    expiresIn: raw.expires_in,
    expiresAt: new Date(Date.now() + raw.expires_in * 1000),
    scope,
    scopes: scope.split(" ").filter(Boolean),
  };
  if (raw.refresh_token !== undefined) set.refreshToken = raw.refresh_token;
  return set;
}

/**
 * The OAuth2 authorization-code client. Builds authorize URLs and exchanges, refreshes,
 * and revokes tokens against the Warmbly token endpoints. No bearer token is required;
 * the client authenticates with its `clientId`/`clientSecret` where applicable.
 *
 * @example
 * const oauth = new OAuthClient({ clientId: "wmcid_...", clientSecret: "wmcs_..." });
 * const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
 *   scopes: ["read_campaigns"],
 *   redirectUri: "https://app.example.com/callback",
 *   pkce: true,
 * });
 * // ...redirect the user, then on the callback:
 * const tokens = await oauth.exchangeCode({ code, codeVerifier });
 */
export class OAuthClient {
  private readonly clientId: string;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string | undefined;
  private readonly baseUrl: string;
  private readonly appBaseUrl: string;
  private readonly fetchImpl: FetchLike;
  private discoveryCache: DiscoveryMetadata | undefined;

  constructor(options: OAuthClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.baseUrl = stripTrailingSlash(options.baseUrl ?? DEFAULT_API_BASE_URL);
    this.appBaseUrl = stripTrailingSlash(options.appBaseUrl ?? DEFAULT_APP_BASE_URL);
    this.fetchImpl = resolveFetch(options.fetch);
  }

  /**
   * Builds the authorization URL to redirect the user to. Auto-generates a `state` when
   * absent, and when `pkce` is enabled generates (or reuses) a verifier and S256 challenge.
   *
   * @example
   * const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
   *   scopes: Permissions.from("READ_CAMPAIGNS"),
   *   pkce: true,
   * });
   */
  async createAuthorizationUrl(params: AuthorizationUrlParams = {}): Promise<AuthorizationUrl> {
    const redirectUri = params.redirectUri ?? this.redirectUri;
    const state = params.state ?? randomState();
    const scope = resolveScopeString(params.scopes);

    const query: Record<string, unknown> = {
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
    };
    if (scope) query.scope = scope;

    let codeVerifier: string | undefined;
    if (params.pkce) {
      codeVerifier =
        typeof params.pkce === "object" ? params.pkce.verifier : generateCodeVerifier();
      query.code_challenge = await createCodeChallenge(codeVerifier);
      query.code_challenge_method = "S256";
    }

    const url = joinUrl(this.appBaseUrl, "/oauth/authorize") + buildQuery(query);
    const result: AuthorizationUrl = { url, state };
    if (codeVerifier !== undefined) result.codeVerifier = codeVerifier;
    return result;
  }

  /**
   * Exchanges an authorization code for a token set (grant_type=authorization_code).
   *
   * @example
   * const tokens = await oauth.exchangeCode({ code: "wmac_...", codeVerifier });
   */
  async exchangeCode(params: {
    code: string;
    redirectUri?: string;
    codeVerifier?: string;
  }): Promise<TokenSet> {
    const body: Record<string, unknown> = {
      grant_type: "authorization_code",
      client_id: this.clientId,
      code: params.code,
      redirect_uri: params.redirectUri ?? this.redirectUri,
    };
    if (this.clientSecret !== undefined) body.client_secret = this.clientSecret;
    if (params.codeVerifier !== undefined) body.code_verifier = params.codeVerifier;
    const raw = await this.tokenRequest(body);
    return toTokenSet(raw);
  }

  /**
   * Exchanges a refresh token for a fresh token set (grant_type=refresh_token). The Warmbly
   * server rotates refresh tokens, so the returned set carries a new refresh token to persist.
   *
   * @example
   * const next = await oauth.refresh(tokens.refreshToken!);
   * await store.set(next); // persist the rotated pair
   */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const body: Record<string, unknown> = {
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: refreshToken,
    };
    if (this.clientSecret !== undefined) body.client_secret = this.clientSecret;
    const raw = await this.tokenRequest(body);
    return toTokenSet(raw);
  }

  /**
   * Revokes an access or refresh token (RFC 7009). Resolves even for an unknown token.
   *
   * @example
   * await oauth.revoke(tokens.accessToken);
   */
  async revoke(token: string): Promise<void> {
    const body: Record<string, unknown> = {
      token,
      client_id: this.clientId,
    };
    if (this.clientSecret !== undefined) body.client_secret = this.clientSecret;
    await this.formPost("/oauth/revoke", body);
  }

  /**
   * Fetches and caches the authorization server metadata (RFC 8414).
   *
   * @example
   * const meta = await oauth.discover();
   * console.log(meta.token_endpoint);
   */
  async discover(): Promise<DiscoveryMetadata> {
    if (this.discoveryCache) return this.discoveryCache;
    const url = discoveryUrlFor(this.baseUrl);
    const response = await this.fetchWithRetry(url, { method: "GET" });
    const json = (await response.json().catch(() => undefined)) as DiscoveryMetadata | undefined;
    if (!response.ok || !json) {
      throw new OAuthError("server_error", {
        description: "Failed to fetch OAuth discovery metadata.",
        status: response.status,
      });
    }
    this.discoveryCache = json;
    return json;
  }

  /** Posts to the token endpoint and parses the snake_case token response. */
  private async tokenRequest(body: Record<string, unknown>): Promise<TokenResponse> {
    return (await this.formPost("/oauth/token", body)) as TokenResponse;
  }

  /**
   * Posts a form-encoded body to an OAuth endpoint. On a non-2xx response it parses the
   * `{ error, error_description }` body and throws {@link OAuthError}; on a network failure
   * it throws {@link WarmblyConnectionError}.
   */
  private async formPost(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = joinUrl(this.baseUrl, path);
    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: encodeForm(body),
    });

    const json = (await response.json().catch(() => undefined)) as
      | Record<string, unknown>
      | undefined;

    if (!response.ok) {
      const error = typeof json?.error === "string" ? json.error : "server_error";
      const description =
        typeof json?.error_description === "string" ? json.error_description : undefined;
      throw new OAuthError(error, { description, status: response.status });
    }
    return json ?? {};
  }

  /** Performs a fetch with retry on network failures and retryable statuses (5xx/429/408). */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, init);
      } catch (cause) {
        if (attempt < MAX_OAUTH_RETRIES) {
          await sleep(fullJitterBackoff(attempt));
          attempt += 1;
          continue;
        }
        throw new WarmblyConnectionError("Network request to the Warmbly OAuth endpoint failed.", {
          cause,
        });
      }
      if (attempt < MAX_OAUTH_RETRIES && RETRYABLE_STATUS.has(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        await sleep(fullJitterBackoff(attempt));
        attempt += 1;
        continue;
      }
      return response;
    }
  }
}
