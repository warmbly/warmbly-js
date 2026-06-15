import { WarmblyError } from "../core/errors";
import type { OAuthClient } from "./oauth";
import type { TokenSet } from "./types";

/**
 * A pluggable store for a {@link TokenSet}. Implement this to persist tokens across
 * processes (database, encrypted file, secret manager). Methods may be sync or async.
 *
 * @example
 * const store: TokenStore = {
 *   get: () => db.loadTokens(),
 *   set: (t) => db.saveTokens(t),
 * };
 */
export interface TokenStore {
  /** Returns the current token set, or `undefined` when none is stored. */
  get(): TokenSet | undefined | Promise<TokenSet | undefined>;
  /** Persists a token set, replacing any previous one. */
  set(token: TokenSet): void | Promise<void>;
}

/**
 * An in-memory {@link TokenStore}. Suitable for a single process; tokens are lost on restart.
 *
 * @example
 * const store = new MemoryTokenStore(initialTokens);
 * await store.set(refreshedTokens);
 */
export class MemoryTokenStore implements TokenStore {
  private token: TokenSet | undefined;

  constructor(initial?: TokenSet) {
    this.token = initial;
  }

  /** Returns the in-memory token set, or `undefined`. */
  get(): TokenSet | undefined {
    return this.token;
  }

  /** Replaces the in-memory token set. */
  set(token: TokenSet): void {
    this.token = token;
  }
}

/** Options for {@link createAutoRefreshingTokenProvider}. */
export interface AutoRefreshingTokenProviderOptions {
  /** The OAuth client used to refresh tokens. */
  oauth: OAuthClient;
  /** The store holding (and persisting) the current token set. */
  store: TokenStore;
  /** Refresh this many milliseconds before the access token actually expires. Defaults to 60000. */
  refreshSkewMs?: number;
}

/**
 * Builds a `() => Promise<string>` that returns a valid access token, refreshing it via
 * `oauth.refresh` when it is expired or within `refreshSkewMs` of expiry. The rotated token
 * set is persisted back to the store, so this is safe to wire into `ClientOptions.getToken`.
 * Concurrent calls share a single in-flight refresh.
 *
 * @example
 * const getToken = createAutoRefreshingTokenProvider({ oauth, store });
 * const warmbly = new Warmbly({ getToken });
 */
export function createAutoRefreshingTokenProvider(
  options: AutoRefreshingTokenProviderOptions,
): () => Promise<string> {
  const { oauth, store } = options;
  const refreshSkewMs = options.refreshSkewMs ?? 60_000;
  let inFlight: Promise<TokenSet> | undefined;

  const isFresh = (token: TokenSet): boolean =>
    token.expiresAt.getTime() - refreshSkewMs > Date.now();

  return async function getToken(): Promise<string> {
    const current = await store.get();
    if (current && isFresh(current)) return current.accessToken;

    if (!current) {
      throw new WarmblyError(
        "No token set is available in the store. Complete the OAuth flow and store a token first.",
      );
    }
    if (!current.refreshToken) {
      throw new WarmblyError("The stored token set has no refresh token; cannot auto-refresh.");
    }

    // Coalesce concurrent refreshes so a rotated token is not consumed twice.
    if (!inFlight) {
      const refreshToken = current.refreshToken;
      inFlight = (async () => {
        try {
          const next = await oauth.refresh(refreshToken);
          await store.set(next);
          return next;
        } finally {
          inFlight = undefined;
        }
      })();
    }
    const refreshed = await inFlight;
    return refreshed.accessToken;
  };
}
