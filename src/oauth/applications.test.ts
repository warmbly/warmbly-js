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

  it("unwraps an { applications } envelope", async () => {
    const get = vi.fn(async () => ({ applications: [{ id: "app1" }, { id: "app2" }] }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([{ id: "app1" }, { id: "app2" }]);
    expect(get).toHaveBeenCalledWith("/oauth/applications");
  });

  it("prefers data over applications when both are present", async () => {
    const get = vi.fn(async () => ({ data: [{ id: "d" }], applications: [{ id: "a" }] }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([{ id: "d" }]);
  });

  it("returns an empty array for an undefined payload", async () => {
    const get = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([]);
  });

  it("returns an empty array for a null payload", async () => {
    const get = vi.fn(async () => null);
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([]);
  });

  it("returns an empty array for an envelope with no known keys", async () => {
    const get = vi.fn(async () => ({ unexpected: [{ id: "z" }] }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.list()).toEqual([]);
  });
});

describe("OAuthApplications.create", () => {
  it("posts the write body and returns the secret-bearing app", async () => {
    const post = vi.fn(async () => ({ id: "x", client_secret: "wmcs_z" }));
    const apps = new OAuthApplications(stubHttp({ post }));
    const body = {
      name: "App",
      redirect_uris: ["https://app.warmbly.com/callback"],
      scopes: 6,
    };
    const created = await apps.create(body);
    expect(created.client_secret).toBe("wmcs_z");
    expect(post).toHaveBeenCalledWith("/oauth/applications", { body });
  });
});

describe("OAuthApplications.get", () => {
  it("gets a single application by url-encoded id", async () => {
    const get = vi.fn(async () => ({ id: "wmcid_1" }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.get("wmcid_1")).toEqual({ id: "wmcid_1" });
    expect(get).toHaveBeenCalledWith("/oauth/applications/wmcid_1");
  });

  it("url-encodes ids with special characters", async () => {
    const get = vi.fn(async () => ({ id: "a/b" }));
    const apps = new OAuthApplications(stubHttp({ get }));
    await apps.get("a/b");
    expect(get).toHaveBeenCalledWith("/oauth/applications/a%2Fb");
  });
});

describe("OAuthApplications.update", () => {
  it("patches the body on the url-encoded id path", async () => {
    const patch = vi.fn(async () => ({ id: "a/b", name: "renamed" }));
    const apps = new OAuthApplications(stubHttp({ patch }));
    const result = await apps.update("a/b", { name: "renamed" });
    expect(result).toEqual({ id: "a/b", name: "renamed" });
    expect(patch).toHaveBeenCalledWith("/oauth/applications/a%2Fb", { body: { name: "renamed" } });
  });
});

describe("OAuthApplications.delete", () => {
  it("deletes the url-encoded id path", async () => {
    const del = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ delete: del }));
    await apps.delete("a/b");
    expect(del).toHaveBeenCalledWith("/oauth/applications/a%2Fb");
  });
});

describe("OAuthApplications.rotateSecret", () => {
  it("posts to the rotate-secret path and returns the new secret", async () => {
    const post = vi.fn(async () => ({ id: "id1", client_secret: "wmcs_new" }));
    const apps = new OAuthApplications(stubHttp({ post }));
    const result = await apps.rotateSecret("id1");
    expect(result.client_secret).toBe("wmcs_new");
    expect(post).toHaveBeenCalledWith("/oauth/applications/id1/rotate-secret");
  });
});

describe("OAuthApplications.getWebhookSecret", () => {
  it("gets the webhook secret on the documented path", async () => {
    const get = vi.fn(async () => ({ webhook_secret: "whsec_abc" }));
    const apps = new OAuthApplications(stubHttp({ get }));
    const result = await apps.getWebhookSecret("id1");
    expect(result).toEqual({ webhook_secret: "whsec_abc" });
    expect(get).toHaveBeenCalledWith("/oauth/applications/id1/webhook-secret");
  });
});

describe("OAuthApplications.rotateWebhookSecret", () => {
  it("posts to the webhook-secret rotate path", async () => {
    const post = vi.fn(async () => ({ webhook_secret: "whsec_new" }));
    const apps = new OAuthApplications(stubHttp({ post }));
    const result = await apps.rotateWebhookSecret("id1");
    expect(result).toEqual({ webhook_secret: "whsec_new" });
    expect(post).toHaveBeenCalledWith("/oauth/applications/id1/webhook-secret/rotate");
  });
});

describe("OAuthApplications.listWebhookEndpoints", () => {
  it("gets the webhook endpoints health list", async () => {
    const endpoints = [{ url: "https://hooks.warmbly.com/e", healthy: true }];
    const get = vi.fn(async () => ({ endpoints }));
    const apps = new OAuthApplications(stubHttp({ get }));
    const result = await apps.listWebhookEndpoints("id1");
    expect(result.endpoints).toEqual(endpoints);
    expect(get).toHaveBeenCalledWith("/oauth/applications/id1/webhook-endpoints");
  });
});

describe("OAuthApplications.listWebhookDeliveries", () => {
  it("returns a page with the provided query params", async () => {
    const page = { data: [{ id: "d1" }], pagination: {} };
    const getPage = vi.fn(async () => page);
    const apps = new OAuthApplications(stubHttp({ getPage }));
    const result = await apps.listWebhookDeliveries("id1", {
      status: "failed",
      event_type: "delivery.failed",
      limit: 10,
      cursor: "c1",
    });
    expect(result).toBe(page);
    expect(getPage).toHaveBeenCalledWith("/oauth/applications/id1/webhook-deliveries", {
      query: { status: "failed", event_type: "delivery.failed", limit: 10, cursor: "c1" },
    });
  });

  it("passes an empty query object when no params are given", async () => {
    const getPage = vi.fn(async () => ({ data: [], pagination: {} }));
    const apps = new OAuthApplications(stubHttp({ getPage }));
    await apps.listWebhookDeliveries("id1");
    expect(getPage).toHaveBeenCalledWith("/oauth/applications/id1/webhook-deliveries", {
      query: {},
    });
  });

  it("url-encodes the id in the deliveries path", async () => {
    const getPage = vi.fn(async () => ({ data: [], pagination: {} }));
    const apps = new OAuthApplications(stubHttp({ getPage }));
    await apps.listWebhookDeliveries("a/b");
    expect(getPage).toHaveBeenCalledWith("/oauth/applications/a%2Fb/webhook-deliveries", {
      query: {},
    });
  });
});

describe("OAuthApplications.listAuthorizedApps", () => {
  it("returns a bare array unchanged", async () => {
    const get = vi.fn(async () => [{ id: "auth1" }]);
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.listAuthorizedApps()).toEqual([{ id: "auth1" }]);
    expect(get).toHaveBeenCalledWith("/oauth/authorized-apps");
  });

  it("unwraps a { data } envelope", async () => {
    const get = vi.fn(async () => ({ data: [{ id: "auth1" }] }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.listAuthorizedApps()).toEqual([{ id: "auth1" }]);
  });

  it("unwraps an { authorized_apps } envelope", async () => {
    const get = vi.fn(async () => ({ authorized_apps: [{ id: "auth1" }, { id: "auth2" }] }));
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.listAuthorizedApps()).toEqual([{ id: "auth1" }, { id: "auth2" }]);
  });

  it("returns an empty array for an undefined payload", async () => {
    const get = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ get }));
    expect(await apps.listAuthorizedApps()).toEqual([]);
  });
});

describe("OAuthApplications.revokeAuthorizedApp", () => {
  it("deletes the authorized app by url-encoded id", async () => {
    const del = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ delete: del }));
    await apps.revokeAuthorizedApp("auth1");
    expect(del).toHaveBeenCalledWith("/oauth/authorized-apps/auth1");
  });

  it("url-encodes ids with special characters", async () => {
    const del = vi.fn(async () => undefined);
    const apps = new OAuthApplications(stubHttp({ delete: del }));
    await apps.revokeAuthorizedApp("a/b");
    expect(del).toHaveBeenCalledWith("/oauth/authorized-apps/a%2Fb");
  });
});
