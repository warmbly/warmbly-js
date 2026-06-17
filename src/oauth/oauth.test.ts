import { afterEach, describe, expect, it, vi } from "vitest";
import { OAuthError, WarmblyConnectionError } from "../core/errors";
import { Permissions } from "../permissions";
import { OAuthClient } from "./oauth";

/** Builds a mock Response with a JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Builds a mock Response whose body is not valid JSON, so `.json()` rejects. */
function textResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { "content-type": "text/plain" } });
}

function makeClient(fetchImpl: typeof fetch, opts: Record<string, unknown> = {}) {
  return new OAuthClient({
    clientId: "wmcid_abc",
    clientSecret: "wmcs_secret",
    redirectUri: "https://app.warmbly.com/callback",
    fetch: fetchImpl,
    ...opts,
  });
}

/**
 * Drains the retry backoff loop while a fetch mock keeps returning retryable
 * results. `fetchWithRetry` awaits `sleep`, which uses `setTimeout`; with fake
 * timers installed we flush microtasks and advance the clock until settled.
 */
async function runWithRetries<T>(promise: Promise<T>): Promise<T> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10_000);
  }
  return promise;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createAuthorizationUrl", () => {
  it("builds the authorize URL with scopes and an auto-generated state", async () => {
    const oauth = makeClient(vi.fn());
    const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
      scopes: ["read_campaigns", "read_contacts"],
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://app.warmbly.com/oauth/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("wmcid_abc");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.warmbly.com/callback");
    expect(parsed.searchParams.get("scope")).toBe("read_campaigns read_contacts");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(state).toBeTruthy();
    expect(codeVerifier).toBeUndefined();
  });

  it("defaults to no params and omits scope when none are requested", async () => {
    const oauth = new OAuthClient({ clientId: "wmcid_abc", fetch: vi.fn() });
    const { url, state, codeVerifier } = await oauth.createAuthorizationUrl();
    const parsed = new URL(url);
    expect(parsed.searchParams.has("scope")).toBe(false);
    // No redirectUri configured and none passed: the param is absent (nullish skipped).
    expect(parsed.searchParams.has("redirect_uri")).toBe(false);
    expect(state).toBeTruthy();
    expect(codeVerifier).toBeUndefined();
  });

  it("uses an explicit state and a per-call redirectUri", async () => {
    const oauth = makeClient(vi.fn());
    const { url, state } = await oauth.createAuthorizationUrl({
      state: "explicit-state",
      redirectUri: "https://app.warmbly.com/other",
    });
    expect(state).toBe("explicit-state");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe("explicit-state");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.warmbly.com/other");
  });

  it("accepts a Permissions instance and converts it to space-joined scopes", async () => {
    const oauth = makeClient(vi.fn());
    const { url } = await oauth.createAuthorizationUrl({
      scopes: Permissions.from("READ_CAMPAIGNS", "READ_CONTACTS"),
    });
    expect(new URL(url).searchParams.get("scope")).toBe("read_campaigns read_contacts");
  });

  it("accepts a mixed array of scope strings and a Permissions element", async () => {
    const oauth = makeClient(vi.fn());
    const { url } = await oauth.createAuthorizationUrl({
      scopes: ["read_campaigns", Permissions.from("WRITE_CONTACTS")],
    });
    expect(new URL(url).searchParams.get("scope")).toBe("read_campaigns write_contacts");
  });

  it("adds an S256 challenge when pkce is enabled and returns the verifier", async () => {
    const oauth = makeClient(vi.fn());
    const { url, codeVerifier } = await oauth.createAuthorizationUrl({ pkce: true });
    const parsed = new URL(url);
    expect(codeVerifier).toBeTruthy();
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("reuses a supplied pkce verifier", async () => {
    const oauth = makeClient(vi.fn());
    const verifier = "a".repeat(50);
    const { codeVerifier } = await oauth.createAuthorizationUrl({ pkce: { verifier } });
    expect(codeVerifier).toBe(verifier);
  });

  it("strips a trailing slash from a custom appBaseUrl", async () => {
    const oauth = makeClient(vi.fn(), { appBaseUrl: "https://login.warmbly.com/" });
    const { url } = await oauth.createAuthorizationUrl();
    expect(new URL(url).origin + new URL(url).pathname).toBe(
      "https://login.warmbly.com/oauth/authorize",
    );
  });
});

describe("exchangeCode", () => {
  it("posts a form-encoded authorization_code grant and maps the token set", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        access_token: "wmat_x",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "wmrt_y",
        scope: "read_campaigns read_contacts",
      }),
    );
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const before = Date.now();
    const tokens = await oauth.exchangeCode({ code: "wmac_z", codeVerifier: "v".repeat(50) });

    expect(tokens.accessToken).toBe("wmat_x");
    expect(tokens.tokenType).toBe("Bearer");
    expect(tokens.expiresIn).toBe(3600);
    expect(tokens.refreshToken).toBe("wmrt_y");
    expect(tokens.scope).toBe("read_campaigns read_contacts");
    expect(tokens.scopes).toEqual(["read_campaigns", "read_contacts"]);
    expect(tokens.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);

    const [calledUrl, init] = fetchImpl.mock.calls[0]!;
    expect(calledUrl).toBe("https://api.warmbly.com/v1/oauth/token");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers.Accept).toBe("application/json");
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("wmcid_abc");
    expect(body.get("client_secret")).toBe("wmcs_secret");
    expect(body.get("code")).toBe("wmac_z");
    expect(body.get("code_verifier")).toBe("v".repeat(50));
    expect(body.get("redirect_uri")).toBe("https://app.warmbly.com/callback");
  });

  it("omits client_secret and code_verifier for a public client without PKCE", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "wmat_p", token_type: "Bearer", expires_in: 60 }),
    );
    const oauth = new OAuthClient({
      clientId: "wmcid_public",
      redirectUri: "https://app.warmbly.com/cb",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const tokens = await oauth.exchangeCode({ code: "wmac_z" });
    // No scope on the response: scope is "" and scopes is empty.
    expect(tokens.scope).toBe("");
    expect(tokens.scopes).toEqual([]);
    // No refresh_token issued: the field is absent.
    expect(tokens.refreshToken).toBeUndefined();
    const body = new URLSearchParams((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.has("client_secret")).toBe(false);
    expect(body.has("code_verifier")).toBe(false);
    expect(body.get("client_id")).toBe("wmcid_public");
  });

  it("uses a per-call redirectUri over the client default", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "wmat_x", token_type: "Bearer", expires_in: 60 }),
    );
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await oauth.exchangeCode({ code: "wmac_z", redirectUri: "https://app.warmbly.com/cb2" });
    const body = new URLSearchParams((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.get("redirect_uri")).toBe("https://app.warmbly.com/cb2");
  });

  it("throws OAuthError on a non-2xx { error, error_description } response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { error: "invalid_grant", error_description: "code expired" }),
    );
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(oauth.exchangeCode({ code: "bad" })).rejects.toMatchObject({
      name: "OAuthError",
      error: "invalid_grant",
      errorDescription: "code expired",
      status: 400,
    });
  });

  it("defaults to a server_error code when the error body has no error field", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { detail: "nope" }));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await oauth.exchangeCode({ code: "bad" }).catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect((err as OAuthError).error).toBe("server_error");
    expect((err as OAuthError).errorDescription).toBeUndefined();
    expect((err as OAuthError).status).toBe(400);
  });

  it("throws OAuthError with server_error when the error body is not JSON", async () => {
    const fetchImpl = vi.fn(async () => textResponse(400, "<html>bad</html>"));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await oauth.exchangeCode({ code: "bad" }).catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect((err as OAuthError).error).toBe("server_error");
    expect((err as OAuthError).status).toBe(400);
  });
});

describe("refresh", () => {
  it("posts a refresh_token grant and returns the rotated set", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        access_token: "wmat_new",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "wmrt_new",
        scope: "read_campaigns",
      }),
    );
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const tokens = await oauth.refresh("wmrt_old");
    expect(tokens.accessToken).toBe("wmat_new");
    expect(tokens.refreshToken).toBe("wmrt_new");
    expect(tokens.scopes).toEqual(["read_campaigns"]);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("client_id")).toBe("wmcid_abc");
    expect(body.get("client_secret")).toBe("wmcs_secret");
    expect(body.get("refresh_token")).toBe("wmrt_old");
  });

  it("omits client_secret for a public client", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "wmat_n", token_type: "Bearer", expires_in: 60 }),
    );
    const oauth = new OAuthClient({
      clientId: "wmcid_public",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await oauth.refresh("wmrt_old");
    const body = new URLSearchParams((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.has("client_secret")).toBe(false);
  });

  it("throws OAuthError when the server rejects the refresh token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { error: "invalid_grant", error_description: "refresh token revoked" }),
    );
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(oauth.refresh("wmrt_bad")).rejects.toMatchObject({
      name: "OAuthError",
      error: "invalid_grant",
    });
  });
});

describe("revoke", () => {
  it("posts to the revoke endpoint and resolves", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { revoked: true }));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(oauth.revoke("wmat_x")).resolves.toBeUndefined();
    const [calledUrl, init] = fetchImpl.mock.calls[0]!;
    expect(calledUrl).toBe("https://api.warmbly.com/v1/oauth/revoke");
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("token")).toBe("wmat_x");
    expect(body.get("client_id")).toBe("wmcid_abc");
    expect(body.get("client_secret")).toBe("wmcs_secret");
  });

  it("resolves when the revoke response has an empty (non-JSON) body", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(oauth.revoke("wmat_x")).resolves.toBeUndefined();
  });

  it("omits client_secret for a public client", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const oauth = new OAuthClient({
      clientId: "wmcid_public",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await oauth.revoke("wmat_x");
    const body = new URLSearchParams((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.has("client_secret")).toBe(false);
  });

  it("wraps a network failure in WarmblyConnectionError after exhausting retries", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await runWithRetries(oauth.revoke("wmat_x").catch((e) => e));
    expect(err).toBeInstanceOf(WarmblyConnectionError);
    // 1 initial attempt + MAX_OAUTH_RETRIES (2) retries.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries on a network failure and then succeeds", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("transient");
      return jsonResponse(200, { revoked: true });
    });
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(runWithRetries(oauth.revoke("wmat_x"))).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("discover", () => {
  it("fetches the well-known metadata from the API origin and caches it", async () => {
    const meta = {
      issuer: "https://api.warmbly.com",
      authorization_endpoint: "https://app.warmbly.com/oauth/authorize",
      token_endpoint: "https://api.warmbly.com/v1/oauth/token",
    };
    const fetchImpl = vi.fn(async () => jsonResponse(200, meta));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);

    const first = await oauth.discover();
    const second = await oauth.discover();
    expect(first.token_endpoint).toBe(meta.token_endpoint);
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0]!;
    expect(calledUrl).toBe("https://api.warmbly.com/.well-known/oauth-authorization-server");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("falls back to a joined discovery URL when the base URL is not absolute", async () => {
    const meta = { issuer: "rel", authorization_endpoint: "a", token_endpoint: "t" };
    const fetchImpl = vi.fn(async () => jsonResponse(200, meta));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch, { baseUrl: "/relative/base" });
    await oauth.discover();
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "/relative/base/.well-known/oauth-authorization-server",
    );
  });

  it("throws OAuthError when the discovery response is not ok", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, { error: "not_found" }));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await oauth.discover().catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect((err as OAuthError).error).toBe("server_error");
    expect((err as OAuthError).status).toBe(404);
  });

  it("throws OAuthError when the discovery body is not JSON", async () => {
    const fetchImpl = vi.fn(async () => textResponse(200, "not json"));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await oauth.discover().catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect((err as OAuthError).error).toBe("server_error");
  });

  it("retries on a retryable status and then succeeds", async () => {
    vi.useFakeTimers();
    const meta = { issuer: "i", authorization_endpoint: "a", token_endpoint: "t" };
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(503, { error: "unavailable" });
      return jsonResponse(200, meta);
    });
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const result = await runWithRetries(oauth.discover());
    expect(result.token_endpoint).toBe("t");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops retrying retryable statuses after the cap and surfaces the error", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: "server_error" }));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await runWithRetries(oauth.discover().catch((e) => e));
    expect(err).toBeInstanceOf(OAuthError);
    expect((err as OAuthError).status).toBe(500);
    // 1 initial + 2 retries, then it returns the 500 and discover throws.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
