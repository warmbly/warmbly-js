/**
 * Authorization-code + PKCE flow wired into an auto-refreshing client.
 *
 * Demonstrates the two halves of the OAuth2 authorization-code flow as standalone functions
 * (a `start` that builds the consent URL with PKCE, and a `callback` that exchanges the code),
 * then wires a `MemoryTokenStore` plus `createAutoRefreshingTokenProvider` into a Warmbly client
 * so REST calls always carry a fresh access token. Finishes by showing a manual refresh and a
 * revoke.
 *
 * Building authorize URLs and exchanging codes needs no token: the OAuth client authenticates
 * with its own `clientId`/`clientSecret`.
 *
 * Run with tsx:
 *   WARMBLY_CLIENT_ID=wmcid_... WARMBLY_CLIENT_SECRET=wmcs_... npx tsx examples/oauth-auto-refresh.ts
 */
import {
  createAutoRefreshingTokenProvider,
  MemoryTokenStore,
  type TokenSet,
  Warmbly,
} from "warmbly";

// The OAuth helper is exposed as `Warmbly.OAuth`. `clientId` is required, so we fall back to an
// empty string when the env var is absent (keeps this example typechecking without an assertion).
const oauth = new Warmbly.OAuth({
  clientId: process.env.WARMBLY_CLIENT_ID ?? "",
  clientSecret: process.env.WARMBLY_CLIENT_SECRET,
  redirectUri: "https://yourapp.com/oauth/callback",
});

/**
 * Step 1: build the consent URL.
 *
 * `createAuthorizationUrl` with `pkce: true` generates a code verifier and the matching S256
 * challenge for you. It returns the `url` to redirect the user to, a CSRF `state`, and the
 * `codeVerifier`. Persist `state` and `codeVerifier` (for example in the user's session),
 * then send the user to `url`.
 */
async function start(): Promise<{ url: string; state: string; codeVerifier: string }> {
  const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
    scopes: ["read_campaigns", "read_contacts", "read_analytics"],
    pkce: true,
  });

  // `codeVerifier` is only present when PKCE is enabled; guard so the return type is exact.
  if (!codeVerifier) {
    throw new Error("Expected a PKCE code verifier; was PKCE enabled?");
  }

  return { url, state, codeVerifier };
}

/**
 * Step 2: handle the redirect back to `redirectUri?code=...&state=...`.
 *
 * After verifying that the returned `state` matches the one you persisted, exchange the code
 * for a token set. Pass back the `codeVerifier` you stored in `start()` so the server can
 * complete the PKCE check.
 */
async function callback(params: {
  code: string;
  returnedState: string;
  expectedState: string;
  codeVerifier: string;
}): Promise<TokenSet> {
  // Always check the CSRF state before trusting the callback.
  if (params.returnedState !== params.expectedState) {
    throw new Error("OAuth state mismatch; possible CSRF. Aborting.");
  }

  const tokens = await oauth.exchangeCode({
    code: params.code,
    codeVerifier: params.codeVerifier,
  });

  // `tokens` is normalized: accessToken, refreshToken, expiresAt (a Date), scope, scopes.
  return tokens;
}

// --- Demo wiring (in a real app `start` and `callback` are two separate HTTP handlers) ---

// 1. Begin the flow. In production you would redirect the browser to `authorize.url`.
const authorize = await start();
console.log("Redirect the user to:", authorize.url);

// 2. The provider redirects back with a code and state. Those values come off the request;
// here we read them from the environment so the example can run unattended.
const tokens = await callback({
  code: process.env.WARMBLY_AUTH_CODE ?? "wmac_example_code",
  returnedState: authorize.state,
  expectedState: authorize.state,
  codeVerifier: authorize.codeVerifier,
});
console.log("Exchanged code. Token expires at:", tokens.expiresAt.toISOString());
console.log("Granted scopes:", tokens.scopes.join(", "));

// 3. Store the tokens and build an auto-refreshing token provider.
// `MemoryTokenStore` keeps the current token set in memory (swap in a DB-backed store for
// production). `createAutoRefreshingTokenProvider` returns a `() => Promise<string>` that
// hands back a valid access token, refreshing (and persisting the rotated pair) when the
// current token is within the skew window of expiry.
const store = new MemoryTokenStore(tokens);
const getToken = createAutoRefreshingTokenProvider({
  oauth,
  store,
  // Refresh a little early so a request never goes out with a token about to expire.
  refreshSkewMs: 120_000,
});

// 4. Plug the provider into the client via `getToken`. Every REST call now resolves a fresh
// token first, refreshing transparently on expiry. No manual token juggling in call sites.
const warmbly = new Warmbly({ getToken });

// These calls act on behalf of the workspace that authorized the app.
const campaigns = await warmbly.campaigns.list();
console.log(`Fetched ${campaigns.data.length} campaign(s) using an auto-refreshed token.`);

// 5. Manual refresh, when you want to rotate ahead of expiry yourself.
// The server rotates refresh tokens, so the returned set carries a NEW refresh token to keep.
if (tokens.refreshToken) {
  const next = await oauth.refresh(tokens.refreshToken);
  // Persist the rotated pair so the old refresh token (now dead) is never reused.
  await store.set(next);
  console.log("Manually refreshed. New token expires at:", next.expiresAt.toISOString());
}

// 6. Revoke when you are done (for example on user disconnect). Revoke resolves even for an
// already-unknown token. Revoke the current access token from the store.
const current = await store.get();
if (current) {
  await oauth.revoke(current.accessToken);
  console.log("Revoked the active access token.");
}
