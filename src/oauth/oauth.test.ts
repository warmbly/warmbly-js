import { describe, expect, it, vi } from "vitest";
import { WarmblyConnectionError } from "../core/errors";
import { Permissions } from "../permissions";
import { OAuthClient } from "./oauth";

/** Builds a mock Response with a JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeClient(fetchImpl: typeof fetch, opts: Record<string, unknown> = {}) {
  return new OAuthClient({
    clientId: "wmcid_abc",
    clientSecret: "wmcs_secret",
    redirectUri: "https://app.example.com/callback",
    fetch: fetchImpl,
    ...opts,
  });
}

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
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(parsed.searchParams.get("scope")).toBe("read_campaigns read_contacts");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(state).toBeTruthy();
    expect(codeVerifier).toBeUndefined();
  });

  it("accepts a Permissions instance and converts it to space-joined scopes", async () => {
    const oauth = makeClient(vi.fn());
    const { url } = await oauth.createAuthorizationUrl({
      scopes: Permissions.from("READ_CAMPAIGNS", "READ_CONTACTS"),
    });
    expect(new URL(url).searchParams.get("scope")).toBe("read_campaigns read_contacts");
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
    expect(tokens.refreshToken).toBe("wmrt_y");
    expect(tokens.scope).toBe("read_campaigns read_contacts");
    expect(tokens.scopes).toEqual(["read_campaigns", "read_contacts"]);
    expect(tokens.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);

    const [calledUrl, init] = fetchImpl.mock.calls[0]!;
    expect(calledUrl).toBe("https://api.warmbly.com/v1/oauth/token");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("wmcid_abc");
    expect(body.get("client_secret")).toBe("wmcs_secret");
    expect(body.get("code")).toBe("wmac_z");
    expect(body.get("code_verifier")).toBe("v".repeat(50));
    expect(body.get("redirect_uri")).toBe("https://app.example.com/callback");
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
    const body = new URLSearchParams((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("wmrt_old");
  });
});

describe("revoke", () => {
  it("posts to the revoke endpoint and resolves", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { revoked: true }));
    const oauth = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(oauth.revoke("wmat_x")).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.warmbly.com/v1/oauth/revoke");
  });

  it("wraps a network failure in WarmblyConnectionError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const oauth = makeClient(fetchImpl as unknown as typeof fetch, { maxRetries: 0 });
    await expect(oauth.revoke("wmat_x")).rejects.toBeInstanceOf(WarmblyConnectionError);
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
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://api.warmbly.com/.well-known/oauth-authorization-server",
    );
  });
});
