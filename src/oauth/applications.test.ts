import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
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

describe("OAuthApplications.uploadLogo", () => {
  it("posts multipart form data to the id-less logo path", async () => {
    const post = vi.fn(async () => ({ logo_url: "https://cdn.warmbly.com/logo.png" }));
    const apps = new OAuthApplications(stubHttp({ post }));
    const file = new Blob(["png-bytes"], { type: "image/png" });

    const result = await apps.uploadLogo(file, "logo.png");
    expect(result.logo_url).toBe("https://cdn.warmbly.com/logo.png");

    // The path carries no app id: the logo is uploaded before the app exists.
    const [path, opts] = post.mock.calls[0] as unknown as [string, { body: FormData }];
    expect(path).toBe("/oauth/application-logo");
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get("file")).toBeInstanceOf(Blob);
  });
});

describe("OAuthApplications logo, listing and developer access", () => {
  // These use a real HttpClient over a mocked fetch, so method, path and body are asserted
  // as they go on the wire.
  function realClient(responses: Array<{ body: unknown; status?: number }>) {
    let i = 0;
    const fetchMock = vi.fn(async () => {
      const next = responses[Math.min(i, responses.length - 1)];
      i += 1;
      const status = next?.status ?? 200;
      return new Response(status === 204 ? null : JSON.stringify(next?.body), {
        status,
        headers: { "content-type": "application/json" },
      });
    });
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as typeof fetch }),
    );
    return { apps: new OAuthApplications(http), fetchMock };
  }

  function call(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
    const c = fetchMock.mock.calls[index];
    return { url: new URL(String(c?.[0])), init: (c?.[1] ?? {}) as RequestInit };
  }

  const app = {
    id: "app_1",
    organization_id: "org_1",
    created_by: "user_1",
    client_id: "wmcid_abc",
    name: "Acme Sync",
    logo_url: "https://cdn.warmbly.com/oauth-app-logos/app_1-1.png",
    redirect_uris: ["https://acme.example.com/cb"],
    scopes: 6,
    status: "active",
    is_public: false,
    dynamically_registered: false,
    suspended_at: "2026-10-01T00:00:00Z",
    suspended_reason: "Phishing reports",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  const listing = {
    application_id: "app_1",
    organization_id: "org_1",
    slug: "acme-sync",
    tagline: "Two-way sync with Acme",
    description: "",
    category: "crm",
    install_url: "https://acme.example.com/install",
    support_url: "",
    privacy_url: "",
    status: "published",
    submitted_at: "2026-09-02T00:00:00Z",
    created_at: "2026-09-02T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
  };

  it("listWithAccess returns the apps and developer_access", async () => {
    const { apps, fetchMock } = realClient([
      {
        body: {
          applications: [app],
          developer_access: { blocked: true, reason: "Under review" },
        },
      },
    ]);
    const out = await apps.listWithAccess();
    expect(call(fetchMock).init.method).toBe("GET");
    expect(call(fetchMock).url.pathname).toBe("/v1/oauth/applications");
    expect(out.applications[0]?.suspended_reason).toBe("Phishing reports");
    expect(out.developer_access).toEqual({ blocked: true, reason: "Under review" });
  });

  it("listWithAccess defaults developer_access when the server omits it", async () => {
    const { apps } = realClient([{ body: { applications: [] } }]);
    expect((await apps.listWithAccess()).developer_access).toEqual({ blocked: false });
  });

  it("setLogo POSTs multipart to the app's logo route and decodes the app", async () => {
    const { apps, fetchMock } = realClient([{ body: app }]);
    const out = await apps.setLogo("app_1", new Blob(["png"], { type: "image/png" }), {
      filename: "logo.png",
    });
    const { url, init } = call(fetchMock);
    expect(init.method).toBe("POST");
    expect(url.pathname).toBe("/v1/oauth/applications/app_1/logo");
    expect(init.body).toBeInstanceOf(FormData);
    const part = (init.body as FormData).get("file");
    expect(part).toBeInstanceOf(Blob);
    expect((part as File).name).toBe("logo.png");
    // The runtime sets the multipart boundary; the SDK must not force a content type.
    expect(
      Object.keys((init.headers ?? {}) as Record<string, string>).some(
        (h) => h.toLowerCase() === "content-type",
      ),
    ).toBe(false);
    expect(out.logo_url).toContain("oauth-app-logos");
  });

  it("removeLogo DELETEs the logo and decodes the updated app", async () => {
    const { apps, fetchMock } = realClient([{ body: { ...app, logo_url: "" } }]);
    const out = await apps.removeLogo("app_1");
    expect(call(fetchMock).init.method).toBe("DELETE");
    expect(call(fetchMock).url.pathname).toBe("/v1/oauth/applications/app_1/logo");
    expect(out.logo_url).toBe("");
  });

  it("getListing unwraps the listing, and null when unpublished", async () => {
    const { apps, fetchMock } = realClient([{ body: { listing } }, { body: { listing: null } }]);
    const got = await apps.getListing("app_1");
    expect(call(fetchMock).init.method).toBe("GET");
    expect(call(fetchMock).url.pathname).toBe("/v1/oauth/applications/app_1/listing");
    expect(got?.slug).toBe("acme-sync");
    expect(await apps.getListing("app_1")).toBeNull();
  });

  it("saveListing PUTs the listing and unwraps it", async () => {
    const { apps, fetchMock } = realClient([{ body: { listing } }]);
    const body = {
      slug: "acme-sync",
      tagline: "Two-way sync with Acme",
      category: "crm",
      install_url: "https://acme.example.com/install",
    };
    const out = await apps.saveListing("app_1", body);
    const { url, init } = call(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url.pathname).toBe("/v1/oauth/applications/app_1/listing");
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(out.status).toBe("published");
  });

  it("deleteListing DELETEs the listing", async () => {
    const { apps, fetchMock } = realClient([{ body: { deleted: true } }]);
    expect(await apps.deleteListing("app_1")).toEqual({ deleted: true });
    expect(call(fetchMock).init.method).toBe("DELETE");
    expect(call(fetchMock).url.pathname).toBe("/v1/oauth/applications/app_1/listing");
  });
});
