/**
 * OAuth2 authorization-code flow with PKCE, then an auto-refreshing client.
 * This sketches the two HTTP handlers an app needs: start and callback.
 */
import {
  createAutoRefreshingTokenProvider,
  MemoryTokenStore,
  Warmbly,
} from "warmbly";

const oauth = new Warmbly.OAuth({
  clientId: process.env.WARMBLY_CLIENT_ID!,
  clientSecret: process.env.WARMBLY_CLIENT_SECRET!,
  redirectUri: "https://yourapp.com/oauth/callback",
});

// GET /oauth/start: build the consent URL and stash state + verifier in the session.
export async function start() {
  const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
    scopes: ["read_campaigns", "read_contacts", "realtime_subscribe"],
    pkce: true,
  });
  // session.set({ state, codeVerifier });
  return url;
}

// GET /oauth/callback?code=...&state=...: verify state, exchange the code, store tokens.
export async function callback(code: string, codeVerifier: string) {
  const tokens = await oauth.exchangeCode({ code, codeVerifier });

  // Build a client that refreshes the access token on expiry, rotation-safe.
  const store = new MemoryTokenStore(tokens);
  const getToken = createAutoRefreshingTokenProvider({ oauth, store });
  const warmbly = new Warmbly({ getToken });

  // Calls now act on behalf of the connecting workspace.
  const page = await warmbly.campaigns.list();
  return page.data;
}
