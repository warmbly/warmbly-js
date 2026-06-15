import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../core/http";
import { OAuthApplications } from "./applications";

/** Builds a stub HttpClient exposing only the methods OAuthApplications uses. */
function stubHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getPage: vi.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

describe("OAuthApplications.list", () => {
  it("returns a bare array unchanged", async () => {
    const get = vi.fn(async () => [{ id: "a" }, { id: "b" }]);
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([{ id: "a" }, { id: "b" }]);
    expect(get).toHaveBeenCalledWith("/oauth/applications");
  });

  it("unwraps a { data } envelope", async () => {
    const get = vi.fn(async () => ({ data: [{ id: "a" }] }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([{ id: "a" }]);
  });

  it("returns an empty array for an unexpected payload", async () => {
    const get = vi.fn(async () => null);
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([]);
  });
});

describe("OAuthApplications.create", () => {
  it("posts the write body and returns the secret-bearing app", async () => {
    const post = vi.fn(async () => ({ id: "x", client_secret: "wmcs_z" }));
    const apps = new OAuthApplications(stubHttp({ post }));
    const body = { name: "App", redirect_uris: ["https://e/cb"], scopes: 6 };
    const created = await apps.create(body);
    expect(created.client_secret).toBe("wmcs_z");
    expect(post).toHaveBeenCalledWith("/oauth/applications", { body });
  });
});

describe("OAuthApplications id-bound routes", () => {
  it("url-encodes the id in get/update/delete", async () => {
    const get = vi.fn(async () => ({ id: "a/b" }));
    const patch = vi.fn(async () => ({ id: "a/b" }));
    const del = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ get, patch, delete: del }));

    await apps.get("a/b");
    await apps.update("a/b", { name: "renamed" });
    await apps.delete("a/b");

    expect(get).toHaveBeenCalledWith("/oauth/applications/a%2Fb");
    expect(patch).toHaveBeenCalledWith("/oauth/applications/a%2Fb", { body: { name: "renamed" } });
    expect(del).toHaveBeenCalledWith("/oauth/applications/a%2Fb");
  });

  it("rotates secret and webhook secret on the documented paths", async () => {
    const post = vi.fn(async () => ({ client_secret: "wmcs_new", webhook_secret: "whsec_new" }));
    const apps = new OAuthApplications(stubHttp({ post }));
    await apps.rotateSecret("id1");
    await apps.rotateWebhookSecret("id1");
    expect(post).toHaveBeenNthCalledWith(1, "/oauth/applications/id1/rotate-secret");
    expect(post).toHaveBeenNthCalledWith(2, "/oauth/applications/id1/webhook-secret/rotate");
  });

  it("lists webhook deliveries as a page with query params", async () => {
    const getPage = vi.fn(async () => ({ data: [], pagination: {} }));
    const apps = new OAuthApplications(stubHttp({ getPage }));
    await apps.listWebhookDeliveries("id1", { status: "failed", limit: 10 });
    expect(getPage).toHaveBeenCalledWith("/oauth/applications/id1/webhook-deliveries", {
      query: { status: "failed", limit: 10 },
    });
  });
});

describe("OAuthApplications authorized apps", () => {
  it("lists and revokes authorized apps", async () => {
    const get = vi.fn(async () => [{ id: "auth1" }]);
    const del = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ get, delete: del }));

    expect(await apps.listAuthorizedApps()).toEqual([{ id: "auth1" }]);
    expect(get).toHaveBeenCalledWith("/oauth/authorized-apps");

    await apps.revokeAuthorizedApp("auth1");
    expect(del).toHaveBeenCalledWith("/oauth/authorized-apps/auth1");
  });
});
