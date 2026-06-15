import { describe, expect, it, vi } from "vitest";
import { WarmblyError } from "../core/errors";
import type { OAuthClient } from "./oauth";
import { createAutoRefreshingTokenProvider, MemoryTokenStore } from "./token-store";
import type { TokenSet } from "./types";

function makeTokenSet(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    accessToken: "wmat_old",
    tokenType: "Bearer",
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    refreshToken: "wmrt_old",
    scope: "read_campaigns",
    scopes: ["read_campaigns"],
    ...overrides,
  };
}

describe("MemoryTokenStore", () => {
  it("stores and returns the latest token set", () => {
    const store = new MemoryTokenStore();
    expect(store.get()).toBeUndefined();
    const token = makeTokenSet();
    store.set(token);
    expect(store.get()).toBe(token);
  });

  it("seeds from an initial token set", () => {
    const token = makeTokenSet();
    expect(new MemoryTokenStore(token).get()).toBe(token);
  });
});

describe("createAutoRefreshingTokenProvider", () => {
  it("returns the current token when it is still fresh", async () => {
    const store = new MemoryTokenStore(makeTokenSet());
    const oauth = { refresh: vi.fn() } as unknown as OAuthClient;
    const getToken = createAutoRefreshingTokenProvider({ oauth, store });
    expect(await getToken()).toBe("wmat_old");
    expect(oauth.refresh).not.toHaveBeenCalled();
  });

  it("refreshes and persists a rotated set when the token is near expiry", async () => {
    const store = new MemoryTokenStore(makeTokenSet({ expiresAt: new Date(Date.now() + 1000) }));
    const rotated = makeTokenSet({ accessToken: "wmat_new", refreshToken: "wmrt_new" });
    const refresh = vi.fn(async () => rotated);
    const oauth = { refresh } as unknown as OAuthClient;
    const getToken = createAutoRefreshingTokenProvider({ oauth, store });

    expect(await getToken()).toBe("wmat_new");
    expect(refresh).toHaveBeenCalledWith("wmrt_old");
    expect(store.get()).toBe(rotated);
  });

  it("coalesces concurrent refreshes into a single call", async () => {
    const store = new MemoryTokenStore(makeTokenSet({ expiresAt: new Date(Date.now() + 1000) }));
    const refresh = vi.fn(async () => makeTokenSet({ accessToken: "wmat_new" }));
    const oauth = { refresh } as unknown as OAuthClient;
    const getToken = createAutoRefreshingTokenProvider({ oauth, store });

    const [a, b] = await Promise.all([getToken(), getToken()]);
    expect(a).toBe("wmat_new");
    expect(b).toBe("wmat_new");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("throws when no token is stored", async () => {
    const store = new MemoryTokenStore();
    const oauth = { refresh: vi.fn() } as unknown as OAuthClient;
    const getToken = createAutoRefreshingTokenProvider({ oauth, store });
    await expect(getToken()).rejects.toBeInstanceOf(WarmblyError);
  });

  it("throws when the stored token cannot be refreshed", async () => {
    const store = new MemoryTokenStore(
      makeTokenSet({ expiresAt: new Date(Date.now() + 1000), refreshToken: undefined }),
    );
    const oauth = { refresh: vi.fn() } as unknown as OAuthClient;
    const getToken = createAutoRefreshingTokenProvider({ oauth, store });
    await expect(getToken()).rejects.toBeInstanceOf(WarmblyError);
  });
});
