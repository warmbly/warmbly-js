/**
 * Next.js App Router OAuth callback route handler.
 *
 * Place this at app/oauth/callback/route.ts. It handles the redirect Warmbly
 * sends back to your registered redirect_uri after the user approves consent.
 * It verifies the CSRF state, exchanges the authorization code (with PKCE) for
 * tokens via new Warmbly.OAuth(...).exchangeCode(...), and stores the result.
 *
 * This file is illustrative and is NOT typechecked. It imports next/server.
 *
 * Setup (the start route, not shown here, persists `state` and `codeVerifier`
 * in cookies before redirecting the user to the consent URL):
 *   WARMBLY_CLIENT_ID=wmcid_...
 *   WARMBLY_CLIENT_SECRET=wmcs_...
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Warmbly } from "warmbly";

// One OAuth client per process is fine; it holds no per-request state.
const oauth = new Warmbly.OAuth({
  clientId: process.env.WARMBLY_CLIENT_ID,
  clientSecret: process.env.WARMBLY_CLIENT_SECRET,
  redirectUri: "https://yourapp.com/oauth/callback",
});

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // The user denied consent (or another OAuth error occurred).
  if (error) {
    return NextResponse.redirect(new URL(`/?oauth_error=${error}`, request.url));
  }

  // Read the values the start route stored before the redirect.
  const jar = await cookies();
  const expectedState = jar.get("wb_oauth_state")?.value;
  const codeVerifier = jar.get("wb_oauth_verifier")?.value;

  // Verify state to defend against CSRF. Reject on any mismatch.
  if (!code || !returnedState || returnedState !== expectedState) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  // Exchange the one-time code for a token set. Passing the PKCE codeVerifier
  // proves this is the same client that started the flow.
  const tokens = await oauth.exchangeCode({ code, codeVerifier });

  // Persist the tokens for this user. Use your real session/DB store here.
  // tokens has: accessToken, refreshToken, expiresAt (Date), scope, scopes.
  await saveTokensForCurrentUser({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt.toISOString(),
    scopes: tokens.scopes,
  });

  // Clear the one-time CSRF/PKCE cookies and send the user onward.
  const response = NextResponse.redirect(new URL("/connected", request.url));
  response.cookies.delete("wb_oauth_state");
  response.cookies.delete("wb_oauth_verifier");
  return response;
}

// Stand-in for your persistence layer (database, encrypted session, etc.).
async function saveTokensForCurrentUser(_tokens) {
  // store _tokens keyed by the signed-in user
}
