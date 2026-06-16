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

describe("Gateway subscription surface", () => {
  it("supports once: fires a single time then unsubscribes", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const seen: number[] = [];
    gw.once("EMAIL_SENT", (e) => seen.push(e.seq ?? -1));
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
    expect(seen).toEqual([11]);
  });

  it("supports off with a specific listener", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const handler = vi.fn();
    gw.on("EMAIL_OPENED", handler);
    gw.off("EMAIL_OPENED", handler);
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_OPENED",
      { event_type: "EMAIL_OPENED", timestamp: "t", seq: 11 },
    ]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports off removing all listeners for an event", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const a = vi.fn();
    const b = vi.fn();
    gw.on("EMAIL_CLICKED", a);
    gw.on("EMAIL_CLICKED", b);
    gw.off("EMAIL_CLICKED");
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_CLICKED",
      { event_type: "EMAIL_CLICKED", timestamp: "t", seq: 11 },
    ]);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("supports onAny: receives every emitted event with its name", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const any = vi.fn();
    const off = gw.onAny(any);
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_SENT",
      { event_type: "EMAIL_SENT", timestamp: "t", seq: 11 },
    ]);
    expect(any).toHaveBeenCalledWith("EMAIL_SENT", expect.objectContaining({ seq: 11 }));
    off();
    any.mockClear();
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_SENT",
      { event_type: "EMAIL_SENT", timestamp: "t", seq: 12 },
    ]);
    expect(any).not.toHaveBeenCalled();
  });
});

describe("Gateway getters", () => {
  it("exposes helloPayload after HELLO", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    expect(gw.helloPayload).toBeUndefined();
    await connectReady(gw);
    expect(gw.helloPayload?.org_id).toBe("org_1");
    expect(gw.helloPayload?.heartbeat_interval_ms).toBe(25_000);
  });

  it("starts idle and exposes an empty presence map", () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    expect(gw.state).toBe("idle");
    expect(gw.presence).toEqual({});
    expect(gw.latestSeq).toBe(0);
  });
});

describe("Gateway connect guards", () => {
  it("rejects connect when no orgId is provided", async () => {
    const gw = new Gateway({ token: "t", webSocket: FakeCtor });
    await expect(gw.connect()).rejects.toBeInstanceOf(GatewayError);
  });

  it("is a no-op when already ready", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    await connectReady(gw);
    const countBefore = FakeWebSocket.instances.length;
    await gw.connect();
    expect(FakeWebSocket.instances.length).toBe(countBefore);
    expect(gw.state).toBe("ready");
  });

  it("emits an error event when no token is available", async () => {
    const gw = new Gateway({ orgId: "org_1", webSocket: FakeCtor });
    const error = vi.fn();
    gw.on("error", error);
    await expect(gw.connect()).rejects.toBeInstanceOf(GatewayError);
    expect(error).toHaveBeenCalledWith(expect.any(GatewayError));
  });
});

describe("Gateway channel joins", () => {
  function joinFrameFor(socket: FakeWebSocket, topic: string): unknown[] | undefined {
    return socket.frames().find((f) => f[3] === "phx_join" && f[2] === topic);
  }

  it("joinCampaign sends phx_join on the campaign topic", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    gw.joinCampaign("camp_1");
    expect(joinFrameFor(socket, "campaign:camp_1")).toBeDefined();
  });

  it("joinAccount sends phx_join on the account topic", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    gw.joinAccount("acct_1");
    expect(joinFrameFor(socket, "account:acct_1")).toBeDefined();
  });

  it("joinBulk sends phx_join on the bulk topic", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    gw.joinBulk("op_1");
    expect(joinFrameFor(socket, "bulk:op_1")).toBeDefined();
  });

  it("joinUser sends phx_join on the user topic", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    gw.joinUser("user_1");
    expect(joinFrameFor(socket, "user:user_1")).toBeDefined();
  });

  it("warns and does nothing when joining before ready", () => {
    const warn = vi.fn();
    const gw = new Gateway({
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
      logger: { warn },
    });
    gw.joinCampaign("camp_1");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("campaign:camp_1"));
  });
});

describe("Gateway updatePresence", () => {
  it("sends a presence update on the org topic when ready", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    gw.updatePresence({ page: "/inbox", resource: "thread_1", action: "replying" });
    const update = socket.frames().find((f) => f[2] === "org:org_1" && f[3] === "presence:update");
    expect(update).toBeDefined();
    expect(update?.[4]).toMatchObject({ action: "replying" });
  });

  it("is a no-op when not connected", () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    expect(() => gw.updatePresence({ action: "viewing" })).not.toThrow();
  });
});

describe("Gateway frame routing", () => {
  it("ignores phx_close, server heartbeat, and presence_diff routing", async () => {
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
    socket.message([
      null,
      null,
      "org:org_1",
      "presence_diff",
      { joins: { u_2: { metas: [{ phx_ref: "r2" }] } }, leaves: {} },
    ]);
    expect(Object.keys(gw.presence).sort()).toEqual(["u_1", "u_2"]);
    // These should not throw and produce no events.
    socket.message([null, null, "org:org_1", "phx_close", {}]);
    socket.message([null, null, "phoenix", "heartbeat", {}]);
    expect(gw.state).toBe("ready");
  });

  it("clears the heartbeat watchdog on a phoenix phx_reply", async () => {
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

    vi.advanceTimersByTime(1000); // sends heartbeat, marks pending
    // Acknowledge the heartbeat on the phoenix topic.
    socket.message([null, null, "phoenix", "phx_reply", { status: "ok" }]);
    vi.advanceTimersByTime(1000); // next tick: pending was cleared, so it sends again rather than closing
    expect(socket.closeCalls.some((c) => c.code === 4000)).toBe(false);
  });

  it("dispatches events with no seq without dedupe", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const seen = vi.fn();
    gw.on("CONTACTS_RELOAD", seen);
    socket.message([
      null,
      null,
      "org:org_1",
      "CONTACTS_RELOAD",
      { event_type: "CONTACTS_RELOAD", timestamp: "t" },
    ]);
    socket.message([
      null,
      null,
      "org:org_1",
      "CONTACTS_RELOAD",
      { event_type: "CONTACTS_RELOAD", timestamp: "t" },
    ]);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(gw.latestSeq).toBe(10);
  });
});

describe("Gateway join and channel errors", () => {
  it("emits a GatewayError on a join error reply with code and reason", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    socket.message([
      null,
      null,
      "campaign:camp_1",
      "phx_reply",
      { status: "error", response: { reason: "forbidden", code: 4010 } },
    ]);
    expect(error).toHaveBeenCalledWith(expect.any(GatewayError));
    const err = error.mock.calls[0][0] as GatewayError;
    expect(err.message).toBe("forbidden");
    expect(err.code).toBe(4010);
  });

  it("emits rateLimited on a join error reply with reason rate_limited", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const rate = vi.fn();
    gw.on("rateLimited", rate);
    socket.message([
      null,
      null,
      "campaign:camp_1",
      "phx_reply",
      { status: "error", response: { reason: "rate_limited", retry_after_ms: 500 } },
    ]);
    expect(rate).toHaveBeenCalledWith(expect.objectContaining({ reason: "rate_limited" }));
  });

  it("emits a GatewayError with a default message on a join error with no reason", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    socket.message([null, null, "campaign:camp_1", "phx_reply", { status: "error", response: {} }]);
    const err = error.mock.calls[0][0] as GatewayError;
    expect(err.message).toBe("Channel join was rejected.");
  });

  it("surfaces a phx_error and re-joins the org channel", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    const joinsBefore = socket
      .frames()
      .filter((f) => f[3] === "phx_join" && f[2] === "org:org_1").length;
    socket.message([null, null, "org:org_1", "phx_error", { reason: "channel crashed" }]);
    expect(error).toHaveBeenCalledWith(expect.any(GatewayError));
    const joinsAfter = socket
      .frames()
      .filter((f) => f[3] === "phx_join" && f[2] === "org:org_1").length;
    expect(joinsAfter).toBe(joinsBefore + 1);
  });

  it("surfaces a phx_error on a non-org channel without re-joining", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    const joinsBefore = socket
      .frames()
      .filter((f) => f[3] === "phx_join" && f[2] === "org:org_1").length;
    socket.message([null, null, "campaign:camp_1", "phx_error", {}]);
    const err = error.mock.calls[0][0] as GatewayError;
    expect(err.message).toBe("Channel error.");
    const joinsAfter = socket
      .frames()
      .filter((f) => f[3] === "phx_join" && f[2] === "org:org_1").length;
    expect(joinsAfter).toBe(joinsBefore);
  });
});

describe("Gateway resume defaults", () => {
  it("falls back to latestSeq when resumed omits fields", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const resumed = vi.fn();
    gw.on("resumed", resumed);
    socket.message([null, null, "org:org_1", "resumed", {}]);
    expect(resumed).toHaveBeenCalledWith({ ok: true, from: 10, current_seq: 10, replayed: 0 });
    expect(gw.latestSeq).toBe(10);
  });

  it("uses the default reason and keeps seq when resume_failed omits fields", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const failed = vi.fn();
    gw.on("resumeFailed", failed);
    socket.message([null, null, "org:org_1", "resume_failed", {}]);
    expect(failed).toHaveBeenCalledWith({ ok: false, reason: "invalid_resume", current_seq: 10 });
  });
});

describe("Gateway HELLO seq handling", () => {
  it("does not lower latestSeq when HELLO seq is below the current seq", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw); // seq 10
    socket.message([
      null,
      null,
      "org:org_1",
      "EMAIL_SENT",
      { event_type: "EMAIL_SENT", timestamp: "t", seq: 50 },
    ]);
    expect(gw.latestSeq).toBe(50);
    // A subsequent rejoin HELLO with a lower seq must not lower latestSeq.
    socket.message([null, null, "org:org_1", "phx_error", { reason: "x" }]); // triggers a re-join
    const ref = orgJoinRef(socket); // first join_ref; the rejoin reuses a new ref
    const rejoin = socket
      .frames()
      .filter((f) => f[3] === "phx_join" && f[2] === "org:org_1")
      .at(-1);
    const rejoinRef = rejoin?.[0] as string;
    socket.message([
      rejoinRef,
      rejoinRef,
      "org:org_1",
      "phx_reply",
      {
        status: "ok",
        response: {
          org_id: "org_1",
          role: "o",
          heartbeat_interval_ms: 25_000,
          server_timeout_ms: 60_000,
          seq: 5,
          resume_supported: true,
        },
      },
    ]);
    void ref;
    expect(gw.latestSeq).toBe(50);
  });
});

describe("Gateway close-code handling", () => {
  it("does not reconnect on a connection-limit close", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    socket.fire("close", { code: GatewayCloseCode.CONNECTION_LIMIT } satisfies WebSocketCloseEvent);
    expect(gw.state).toBe("closed");
    expect(error).toHaveBeenCalledWith(expect.any(GatewayError));
  });

  it("emits a rejection error on an auth-failed close and then reconnects", async () => {
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
          heartbeat_interval_ms: 25_000,
          server_timeout_ms: 60_000,
          seq: 1,
          resume_supported: true,
        },
      },
    ]);
    await ready;
    const error = vi.fn();
    gw.on("error", error);
    socket.fire("close", {
      code: GatewayCloseCode.AUTH_FAILED,
      reason: "expired",
    } satisfies WebSocketCloseEvent);
    expect(error).toHaveBeenCalledWith(expect.any(GatewayError));
    // AUTH_FAILED is a rejection but still triggers a reconnect attempt.
    expect(gw.state).toBe("reconnecting");
  });

  it("does not reconnect when autoReconnect is disabled", async () => {
    const gw = new Gateway({
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
      autoReconnect: false,
    });
    const socket = await connectReady(gw);
    const reconnecting = vi.fn();
    gw.on("reconnecting", reconnecting);
    socket.fire("close", { code: 1006 } satisfies WebSocketCloseEvent);
    expect(gw.state).toBe("closed");
    expect(reconnecting).not.toHaveBeenCalled();
  });

  it("emits a close event without a code when the code is absent", async () => {
    const gw = new Gateway({
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
      autoReconnect: false,
    });
    const socket = await connectReady(gw);
    const close = vi.fn();
    gw.on("close", close);
    socket.fire("close", {} satisfies WebSocketCloseEvent);
    expect(close).toHaveBeenCalledWith({});
  });
});

describe("Gateway connect rejection paths", () => {
  it("rejects the initial connect when the socket closes before ready", async () => {
    const gw = new Gateway({
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
      autoReconnect: false,
    });
    const ready = gw.connect();
    const socket = await nextSocket();
    socket.open();
    await Promise.resolve();
    socket.fire("close", {
      code: GatewayCloseCode.PERMISSION_DENIED,
    } satisfies WebSocketCloseEvent);
    await expect(ready).rejects.toBeInstanceOf(GatewayError);
  });

  it("rejects the initial connect on a transport error before ready", async () => {
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor });
    const ready = gw.connect();
    const socket = await nextSocket();
    socket.open();
    await Promise.resolve();
    socket.fire("error", new Error("boom"));
    await expect(ready).rejects.toThrow("boom");
  });
});

describe("Gateway transport error after ready", () => {
  it("surfaces a transport error to the error listener and logs it", async () => {
    const errorLog = vi.fn();
    const gw = new Gateway({
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
      logger: { error: errorLog },
    });
    const socket = await connectReady(gw);
    const error = vi.fn();
    gw.on("error", error);
    socket.fire("error", new Error("transient"));
    expect(error).toHaveBeenCalledWith(expect.any(Error));
    expect(errorLog).toHaveBeenCalled();
    // Still ready: a post-ready error does not reject anything.
    expect(gw.state).toBe("ready");
  });
});

describe("Gateway reconnect failure backoff", () => {
  it("backs off again when a reconnect attempt cannot open the socket", async () => {
    vi.useFakeTimers();
    const getToken = vi
      .fn<[], Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockRejectedValueOnce(new Error("mint failed"))
      .mockResolvedValue("third");
    const gw = new Gateway({ orgId: "org_1", getToken, webSocket: FakeCtor });
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
          heartbeat_interval_ms: 25_000,
          server_timeout_ms: 60_000,
          seq: 1,
          resume_supported: true,
        },
      },
    ]);
    await ready;

    const reconnecting = vi.fn();
    gw.on("reconnecting", reconnecting);
    gw.on("error", () => undefined); // swallow the mint error

    socket.fire("close", { code: 1006 } satisfies WebSocketCloseEvent);
    expect(reconnecting).toHaveBeenCalledTimes(1);

    // First reconnect attempt: openSocket rejects (mint failed) and schedules another backoff.
    await vi.advanceTimersByTimeAsync(31_000);
    expect(reconnecting.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getToken.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Gateway logging", () => {
  it("logs state transitions via the debug logger", async () => {
    const debug = vi.fn();
    const gw = new Gateway({ orgId: "org_1", token: "t", webSocket: FakeCtor, logger: { debug } });
    await connectReady(gw);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining("Gateway state ->"));
  });
});

describe("Gateway url normalization", () => {
  it("strips trailing slashes from the configured url", async () => {
    const gw = new Gateway({
      url: "wss://realtime.warmbly.com///",
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
    });
    const ready = gw.connect();
    const socket = await nextSocket();
    expect(socket.url).toBe("wss://realtime.warmbly.com/socket/websocket?vsn=1.0.0&token=t");
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
          heartbeat_interval_ms: 25_000,
          server_timeout_ms: 60_000,
          seq: 1,
          resume_supported: true,
        },
      },
    ]);
    await ready;
    gw.close();
  });
});

describe("Gateway heartbeat edge cases", () => {
  it("uses the default 25s interval when HELLO advertises a non-positive interval", async () => {
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
          heartbeat_interval_ms: 0,
          server_timeout_ms: 60_000,
          seq: 1,
          resume_supported: true,
        },
      },
    ]);
    await ready;
    const before = socket.sent.length;
    // No heartbeat before the default 25s cadence.
    vi.advanceTimersByTime(24_000);
    expect(socket.sent.length).toBe(before);
    vi.advanceTimersByTime(1_000);
    const heartbeat = socket.frames()[before];
    expect(heartbeat?.[2]).toBe("phoenix");
    gw.close();
  });

  it("skips a heartbeat tick when the socket is not open", async () => {
    vi.useFakeTimers();
    const gw = new Gateway({
      orgId: "org_1",
      token: "t",
      webSocket: FakeCtor,
      autoReconnect: false,
    });
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
    // Force the socket closed without going through the gateway timers staying alive:
    // mark readyState closed but keep the heartbeat timer running by not stopping it.
    (socket as unknown as { readyState: number }).readyState = WS_READY_STATE.CLOSED;
    const before = socket.sent.length;
    vi.advanceTimersByTime(1000);
    // Tick saw a closed socket and returned early; nothing was sent.
    expect(socket.sent.length).toBe(before);
    gw.close();
  });
});

describe("Gateway close during pending reconnect", () => {
  it("aborts a scheduled reconnect when close() is called first", async () => {
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
          heartbeat_interval_ms: 25_000,
          server_timeout_ms: 60_000,
          seq: 1,
          resume_supported: true,
        },
      },
    ]);
    await ready;
    socket.fire("close", { code: 1006 } satisfies WebSocketCloseEvent);
    expect(gw.state).toBe("reconnecting");
    const countBefore = FakeWebSocket.instances.length;
    gw.close();
    await vi.advanceTimersByTimeAsync(31_000);
    // No new socket was created because close() cleared the reconnect timer.
    expect(FakeWebSocket.instances.length).toBe(countBefore);
    expect(gw.state).toBe("closed");
  });
});
