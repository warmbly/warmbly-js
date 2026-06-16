import { describe, expect, it, vi } from "vitest";
import { Warmbly } from "./client";
import { GatewayError } from "./core/errors";
import type { FetchLike } from "./core/types";
import { Gateway } from "./gateway/gateway";
import type { WebSocketCtor, WebSocketLike } from "./gateway/types";
import { WS_READY_STATE } from "./gateway/types";
import { OAuthApplications } from "./oauth/applications";
import { OAuthClient } from "./oauth/oauth";
import {
  Analytics,
  ApiKeys,
  Campaigns,
  Contacts,
  Crm,
  Emails,
  Integrations,
  Misc,
  Templates,
  Unibox,
  Webhooks,
} from "./resources";

// Builds a Warmbly client whose fetch is a vi.fn returning a single canned JSON response.
function clientWith(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
  options: Record<string, unknown> = {},
): { warmbly: Warmbly; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...init.headers },
      }),
  );
  const warmbly = new Warmbly({
    apiKey: "wmbly_test",
    fetch: fetchMock as unknown as FetchLike,
    ...options,
  });
  return { warmbly, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

/** A controllable WebSocket that records its url and exposes hooks to drive events. */
class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  readyState = WS_READY_STATE.CONNECTING;
  readonly sent: string[] = [];
  readonly url: string;
  private readonly handlers = new Map<string, Array<(arg: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WS_READY_STATE.CLOSED;
  }

  addEventListener(type: string, listener: (arg: never) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(listener as (arg: unknown) => void);
    this.handlers.set(type, list);
  }

  fire(type: string, arg?: unknown): void {
    for (const listener of this.handlers.get(type) ?? []) listener(arg);
  }

  open(): void {
    this.readyState = WS_READY_STATE.OPEN;
    this.fire("open");
  }

  frames(): unknown[][] {
    return this.sent.map((raw) => JSON.parse(raw) as unknown[]);
  }
}

const FakeCtor = FakeWebSocket as unknown as WebSocketCtor;

/**
 * Starts a connect, drives the socket open so the org channel join is pushed, then returns
 * the socket so the URL (gateway base + token) and join topic (orgId) can be inspected.
 */
async function openedSocket(gw: Gateway): Promise<FakeWebSocket> {
  void gw.connect().catch(() => undefined);
  for (let i = 0; i < 50; i += 1) {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (socket) {
      socket.open();
      await Promise.resolve();
      gw.close();
      return socket;
    }
    await Promise.resolve();
  }
  throw new Error("no socket was created");
}

function joinTopic(socket: FakeWebSocket): string | undefined {
  const join = socket.frames().find((f) => f[3] === "phx_join");
  return join?.[2] as string | undefined;
}

describe("Warmbly construction", () => {
  it("resolves options and exposes an HttpClient", () => {
    const warmbly = new Warmbly({ apiKey: "wmbly_test" });
    expect(warmbly.options.baseUrl).toBe("https://api.warmbly.com/v1");
    expect(warmbly.options.gatewayUrl).toBe("wss://realtime.warmbly.com");
    expect(warmbly.http).toBeDefined();
  });

  it("constructs with no options at all", () => {
    const warmbly = new Warmbly();
    expect(warmbly.options).toBeDefined();
    expect(warmbly.http).toBeDefined();
  });

  it("resolves a token from apiKey", async () => {
    const warmbly = new Warmbly({ apiKey: "wmbly_key" });
    await expect(warmbly.options.getToken()).resolves.toBe("wmbly_key");
  });

  it("resolves a token from accessToken", async () => {
    const warmbly = new Warmbly({ accessToken: "wmat_token" });
    await expect(warmbly.options.getToken()).resolves.toBe("wmat_token");
  });

  it("resolves a token from a getToken provider", async () => {
    const warmbly = new Warmbly({ getToken: () => "dynamic_token" });
    await expect(warmbly.options.getToken()).resolves.toBe("dynamic_token");
  });

  it("instantiates every REST namespace", () => {
    const warmbly = new Warmbly({ apiKey: "wmbly_test" });
    expect(warmbly.apiKeys).toBeInstanceOf(ApiKeys);
    expect(warmbly.campaigns).toBeInstanceOf(Campaigns);
    expect(warmbly.contacts).toBeInstanceOf(Contacts);
    expect(warmbly.emails).toBeInstanceOf(Emails);
    expect(warmbly.unibox).toBeInstanceOf(Unibox);
    expect(warmbly.analytics).toBeInstanceOf(Analytics);
    expect(warmbly.templates).toBeInstanceOf(Templates);
    expect(warmbly.crm).toBeInstanceOf(Crm);
    expect(warmbly.integrations).toBeInstanceOf(Integrations);
    expect(warmbly.webhooks).toBeInstanceOf(Webhooks);
    expect(warmbly.misc).toBeInstanceOf(Misc);
    expect(warmbly.oauthApplications).toBeInstanceOf(OAuthApplications);
  });

  it("exposes the OAuthClient as the static OAuth member", () => {
    expect(Warmbly.OAuth).toBe(OAuthClient);
    const oauth = new Warmbly.OAuth({
      clientId: "wmcid_x",
      clientSecret: "wmcs_y",
      redirectUri: "https://app.warmbly.com/callback",
    });
    expect(oauth).toBeInstanceOf(OAuthClient);
  });
});

describe("Warmbly.request escape hatch", () => {
  it("delegates a GET to http.request with the path", async () => {
    const { warmbly, fetchMock } = clientWith({ data: [{ id: "tz_1" }] });
    const result = await warmbly.request<{ data: unknown }>("GET", "/timezones");
    expect(result.data).toEqual({ data: [{ id: "tz_1" }] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/timezones");
  });

  it("delegates a POST with a JSON body", async () => {
    const { warmbly, fetchMock } = clientWith({ ok: true });
    await warmbly.request("POST", "/custom", { body: { email: "casey@warmbly.com" } });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/custom");
    expect(JSON.parse(String(init.body))).toEqual({ email: "casey@warmbly.com" });
  });
});

describe("Warmbly.gateway", () => {
  it("returns a Gateway instance", () => {
    const { warmbly } = clientWith({});
    const gw = warmbly.gateway({ orgId: "org_1" });
    expect(gw).toBeInstanceOf(Gateway);
  });

  it("inherits the client token through the injected token provider", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith({}, {}, { apiKey: "wmbly_inherited" });
    const gw = warmbly.gateway({ orgId: "org_1", webSocket: FakeCtor });
    const socket = await openedSocket(gw);
    expect(socket.url).toContain("token=wmbly_inherited");
    expect(socket.url).toContain("wss://realtime.warmbly.com/socket/websocket");
    expect(joinTopic(socket)).toBe("org:org_1");
  });

  it("applies the client organizationId default when orgId is not passed", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith({}, {}, { apiKey: "wmbly_x", organizationId: "org_default" });
    const gw = warmbly.gateway({ webSocket: FakeCtor });
    const socket = await openedSocket(gw);
    expect(joinTopic(socket)).toBe("org:org_default");
  });

  it("lets an explicit orgId override the client organizationId", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith({}, {}, { apiKey: "wmbly_x", organizationId: "org_default" });
    const gw = warmbly.gateway({ orgId: "org_override", webSocket: FakeCtor });
    const socket = await openedSocket(gw);
    expect(joinTopic(socket)).toBe("org:org_override");
  });

  it("applies the client gatewayUrl default", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith(
      {},
      {},
      { apiKey: "wmbly_x", gatewayUrl: "wss://staging.warmbly.com" },
    );
    const gw = warmbly.gateway({ orgId: "org_1", webSocket: FakeCtor });
    const socket = await openedSocket(gw);
    expect(socket.url).toContain("wss://staging.warmbly.com/socket/websocket");
  });

  it("lets an explicit url override the client gatewayUrl", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith(
      {},
      {},
      { apiKey: "wmbly_x", gatewayUrl: "wss://staging.warmbly.com" },
    );
    const gw = warmbly.gateway({
      orgId: "org_1",
      url: "wss://explicit.warmbly.com",
      webSocket: FakeCtor,
    });
    const socket = await openedSocket(gw);
    expect(socket.url).toContain("wss://explicit.warmbly.com/socket/websocket");
  });

  it("lets an explicit token override the inherited provider", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith({}, {}, { apiKey: "wmbly_inherited" });
    const gw = warmbly.gateway({
      orgId: "org_1",
      token: "wmbly_explicit",
      webSocket: FakeCtor,
    });
    const socket = await openedSocket(gw);
    expect(socket.url).toContain("token=wmbly_explicit");
    expect(socket.url).not.toContain("wmbly_inherited");
  });

  it("lets an explicit getToken override the inherited provider", async () => {
    FakeWebSocket.instances = [];
    const { warmbly } = clientWith({}, {}, { apiKey: "wmbly_inherited" });
    const gw = warmbly.gateway({
      orgId: "org_1",
      getToken: () => "wmbly_caller_token",
      webSocket: FakeCtor,
    });
    const socket = await openedSocket(gw);
    expect(socket.url).toContain("token=wmbly_caller_token");
  });

  it("throws a GatewayError through the inherited provider when no credential is set", async () => {
    const warmbly = new Warmbly();
    const gw = warmbly.gateway({ orgId: "org_1", webSocket: FakeCtor });
    await expect(gw.connect()).rejects.toBeInstanceOf(GatewayError);
  });
});
