import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayError } from "../core/errors";
import { Gateway } from "./gateway";
import type {
  WebSocketCloseEvent,
  WebSocketCtor,
  WebSocketLike,
  WebSocketMessageEvent,
} from "./types";
import { GatewayCloseCode, WS_READY_STATE } from "./types";

/** A controllable WebSocket that records sends and exposes hooks to drive events. */
class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  readyState = WS_READY_STATE.CONNECTING;
  closeCalls: Array<{ code?: number; reason?: string }> = [];
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

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = WS_READY_STATE.CLOSED;
    // Mirror real sockets: a close() triggers a close event.
    this.fire("close", { code: code ?? 1000, reason });
  }

  addEventListener(type: string, listener: (arg: never) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(listener as (arg: unknown) => void);
    this.handlers.set(type, list);
  }

  fire(type: string, arg?: unknown): void {
    for (const listener of this.handlers.get(type) ?? []) listener(arg);
  }

  /** Drives the open handshake. */
  open(): void {
    this.readyState = WS_READY_STATE.OPEN;
    this.fire("open");
  }

  /** Delivers a decoded frame as a message event. */
  message(frame: unknown[]): void {
    const event: WebSocketMessageEvent = { data: JSON.stringify(frame) };
    this.fire("message", event);
  }

  /** Parses the frames sent on the socket. */
  frames(): unknown[][] {
    return this.sent.map((raw) => JSON.parse(raw) as unknown[]);
  }
}

const FakeCtor = FakeWebSocket as unknown as WebSocketCtor;

/** Returns the most recently created fake socket, waiting a microtask for async open. */
async function nextSocket(): Promise<FakeWebSocket> {
  for (let i = 0; i < 50; i += 1) {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (socket) return socket;
    await Promise.resolve();
  }
  throw new Error("no socket was created");
}

/** Finds the org join_ref the gateway used (the phx_join frame's join_ref). */
function orgJoinRef(socket: FakeWebSocket): string {
  const join = socket.frames().find((f) => f[3] === "phx_join");
  if (!join) throw new Error("no join frame");
  return join[0] as string;
}

/** Drives a full connect handshake and resolves once the gateway is ready. */
async function connectReady(gw: Gateway): Promise<FakeWebSocket> {
  const ready = gw.connect();
  const socket = await nextSocket();
  socket.open();
  await Promise.resolve();
  const ref = orgJoinRef(socket);
  socket.message([
    ref,
    ref,
    "org:org_1",
    "phx_reply",
    {
      status: "ok",
      response: {
        org_id: "org_1",
        role: "owner",
        heartbeat_interval_ms: 25_000,
        server_timeout_ms: 60_000,
        seq: 10,
        resume_supported: true,
      },
    },
  ]);
  await ready;
  return socket;
}

beforeEach(() => {
  FakeWebSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Gateway connect handshake", () => {
  it("opens, joins org with intents, receives HELLO, and becomes ready", async () => {
    const gw = new Gateway({
      orgId: "org_1",
      token: "wmbly_x",
      webSocket: FakeCtor,
      intents: ["email", "campaign"],
    });
    const states: string[] = [];
    gw.on("open", () => states.push("open"));
    gw.on("hello", () => states.push("hello"));
    gw.on("ready", () => states.push("ready"));

    const socket = await connectReady(gw);

    expect(socket.url).toContain("/socket/websocket?vsn=1.0.0&token=wmbly_x");
    const join = socket.frames().find((f) => f[3] === "phx_join");
    expect(join?.[2]).toBe("org:org_1");
    expect((join?.[4] as { intents: string[] }).intents).toEqual(["EMAIL", "CAMPAIGN"]);
    expect(states).toEqual(["open", "hello", "ready"]);
    expect(gw.state).toBe("ready");
    expect(gw.latestSeq).toBe(10);
  });

  it("rejects connect when no token is available", async () => {
    const gw = new Gateway({ orgId: "org_1", webSocket: FakeCtor });
    await expect(gw.connect()).rejects.toBeInstanceOf(GatewayError);
  });
});

describe("Gateway events", () => {
  it("dispatches application events by name and dedupes by seq", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const seen: number[] = [];
    gw.on("EMAIL_SENT", (e) => seen.push(e.seq ?? -1));

    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_SENT",
      { event_type: "EMAIL_SENT", timestamp: "t", seq: 11 },
    ]);
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_SENT",
      { event_type: "EMAIL_SENT", timestamp: "t", seq: 11 },
    ]);
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_SENT",
      { event_type: "EMAIL_SENT", timestamp: "t", seq: 12 },
    ]);

    expect(seen).toEqual([11, 12]);
    expect(gw.latestSeq).toBe(12);
  });

  it("emits CUSTOM_EVENT with its payload", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const custom = vi.fn();
    gw.on("CUSTOM_EVENT", custom);
    socket.message([
      null,
      null,
      "org:org_1",
      "CUSTOM_EVENT",
      {
        event_type: "CUSTOM_EVENT",
        name: "deal.won",
        payload: { id: 1 },
        timestamp: "t",
        seq: 11,
      },
    ]);
    expect(custom).toHaveBeenCalledWith(
      expect.objectContaining({ name: "deal.won", payload: { id: 1 } }),
    );
  });

  it("emits presence on presence_state and presence_diff", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const presence = vi.fn();
    gw.on("presence", presence);
    socket.message([
      null,
      null,
      "org:org_1",
      "presence_state",
      { u_1: { metas: [{ phx_ref: "r" }] } },
    ]);
    expect(presence).toHaveBeenCalledWith(expect.objectContaining({ u_1: expect.anything() }));
    expect(Object.keys(gw.presence)).toEqual(["u_1"]);
  });

  it("emits rateLimited on a rate_limited push", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const rate = vi.fn();
    gw.on("rateLimited", rate);
    socket.message([null, null, "org:org_1", "rate_limited", { retry_after_ms: 1000 }]);
    expect(rate).toHaveBeenCalledWith({ retry_after_ms: 1000 });
  });

  it("emits resumed and advances seq", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const resumed = vi.fn();
    gw.on("resumed", resumed);
    socket.message([
      null,
      null,
      "org:org_1",
      "resumed",
      { from: 10, current_seq: 14, replayed: 4 },
    ]);
    expect(resumed).toHaveBeenCalledWith({ ok: true, from: 10, current_seq: 14, replayed: 4 });
    expect(gw.latestSeq).toBe(14);
  });

  it("emits resumeFailed and keeps current_seq", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const failed = vi.fn();
    gw.on("resumeFailed", failed);
    socket.message([
      null,
      null,
      "org:org_1",
      "resume_failed",
      { reason: "buffer_evicted", current_seq: 99 },
    ]);
    expect(failed).toHaveBeenCalledWith({ ok: false, reason: "buffer_evicted", current_seq: 99 });
    expect(gw.latestSeq).toBe(99);
  });
});

describe("Gateway heartbeat", () => {
  it("sends a heartbeat each interval and force-reconnects on a missed reply", async () => {
    vi.useFakeTimers();
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const ready = gw.connect();
    const socket = await nextSocket();
    socket.open();
    await Promise.resolve();
    const ref = orgJoinRef(socket);
    socket.message([
      ref,
      ref,
      "org:org_1",
      "phx_reply",
      {
        status: "ok",
        response: {
          org_id: "org_1",
          role: "o",
          heartbeat_interval_ms: 1000,
          server_timeout_ms: 4000,
          seq: 1,
          resume_supported: true,
        },
      },
    ]);
    await ready;

    const before = socket.sent.length;
    vi.advanceTimersByTime(1000);
    const heartbeat = socket.frames()[before];
    expect(heartbeat?.[2]).toBe("phoenix");
    expect(heartbeat?.[3]).toBe("heartbeat");

    // No reply arrives; the next tick must force a reconnect close (4000).
    vi.advanceTimersByTime(1000);
    expect(socket.closeCalls.some((c) => c.code === 4000)).toBe(true);
  });
});

describe("Gateway reconnect and resume", () => {
  it("reconnects after an unexpected close and re-joins with a resume marker", async () => {
    vi.useFakeTimers();
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const ready = gw.connect();
    const first = await nextSocket();
    first.open();
    await Promise.resolve();
    const ref = orgJoinRef(first);
    first.message([
      ref,
      ref,
      "org:org_1",
      "phx_reply",
      {
        status: "ok",
        response: {
          org_id: "org_1",
          role: "o",
          heartbeat_interval_ms: 25_000,
          server_timeout_ms: 60_000,
          seq: 42,
          resume_supported: true,
        },
      },
    ]);
    await ready;

    const reconnecting = vi.fn();
    gw.on("reconnecting", reconnecting);

    // Unexpected close (code 1006), not deliberate.
    first.fire("close", { code: 1006 } satisfies WebSocketCloseEvent);
    expect(gw.state).toBe("reconnecting");
    expect(reconnecting).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1 }));

    await vi.advanceTimersByTimeAsync(31_000);
    const second = await nextSocket();
    expect(second).not.toBe(first);
    second.open();
    await Promise.resolve();
    const join = second.frames().find((f) => f[3] === "phx_join");
    expect((join?.[4] as { resume?: { last_seq: number } }).resume).toEqual({ last_seq: 42 });
  });

  it("does not reconnect on a permission-denied close", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    socket.fire("close", {
      code: GatewayCloseCode.PERMISSION_DENIED,
    } satisfies WebSocketCloseEvent);
    expect(gw.state).toBe("closed");
    expect(error).toHaveBeenCalledWith(expect.any(GatewayError));
  });

  it("close() shuts down cleanly without reconnecting", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const reconnecting = vi.fn();
    gw.on("reconnecting", reconnecting);
    gw.close();
    expect(gw.state).toBe("closed");
    expect(socket.closeCalls.some((c) => c.code === 1000)).toBe(true);
    expect(reconnecting).not.toHaveBeenCalled();
  });
});

describe("Gateway token provider", () => {
  it("uses getToken to build the socket URL", async () => {
    const getToken = vi.fn(async () => "minted_token");
    const gw = new Gateway({ orgId: "org_1", getToken, webSocket: FakeCtor });
    void gw.connect().catch(() => undefined);
    const socket = await nextSocket();
    expect(getToken).toHaveBeenCalled();
    expect(socket.url).toContain("token=minted_token");
    gw.close();
  });
});
