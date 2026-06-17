import { describe, expect, it, vi } from "vitest";
import { Connection, decodeFrame, encodeFrame } from "./connection";
import type { WebSocketCloseEvent, WebSocketLike, WebSocketMessageEvent } from "./types";
import { WS_READY_STATE } from "./types";

/** A minimal in-memory WebSocket that records sends and lets tests drive events. */
class FakeWebSocket implements WebSocketLike {
  readyState = WS_READY_STATE.OPEN;
  readonly sent: string[] = [];
  /** When set, `close` throws this so the onError catch branch is exercised. */
  closeError: Error | undefined;
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  private readonly handlers = new Map<string, Array<(arg: unknown) => void>>();

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    if (this.closeError) throw this.closeError;
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
}

describe("encodeFrame", () => {
  it("serializes a 5-element frame to a JSON array string", () => {
    const raw = encodeFrame(["1", "2", "org:org_1", "phx_join", { intents: ["EMAIL"] }]);
    expect(raw).toBe('["1","2","org:org_1","phx_join",{"intents":["EMAIL"]}]');
  });

  it("serializes null join_ref and ref", () => {
    const raw = encodeFrame([null, "9", "phoenix", "heartbeat", {}]);
    expect(JSON.parse(raw)).toEqual([null, "9", "phoenix", "heartbeat", {}]);
  });
});

describe("decodeFrame", () => {
  it("round-trips a 5-element Phoenix frame", () => {
    const raw = encodeFrame(["1", "2", "org:o", "phx_join", { intents: ["EMAIL"] }]);
    const frame = decodeFrame(raw);
    expect(frame).toEqual({
      join_ref: "1",
      ref: "2",
      topic: "org:o",
      event: "phx_join",
      payload: { intents: ["EMAIL"] },
    });
  });

  it("decodes null join_ref/ref for server pushes", () => {
    const frame = decodeFrame('[null,null,"org:o","EMAIL_SENT",{"seq":5}]');
    expect(frame.join_ref).toBeNull();
    expect(frame.ref).toBeNull();
    expect(frame.payload).toEqual({ seq: 5 });
  });

  it("throws on a non-5-element array", () => {
    expect(() => decodeFrame("[1,2,3]")).toThrow(TypeError);
    expect(() => decodeFrame("[1,2,3]")).toThrow("expected a 5-element array");
  });

  it("throws when the parsed value is not an array", () => {
    expect(() => decodeFrame('{"not":"an array"}')).toThrow(TypeError);
  });

  it("coerces a null payload to an empty object", () => {
    const frame = decodeFrame('[null,null,"org:o","E",null]');
    expect(frame.payload).toEqual({});
  });

  it("coerces a non-object payload to an empty object", () => {
    const frame = decodeFrame('[null,null,"org:o","E","just a string"]');
    expect(frame.payload).toEqual({});
  });

  it("stringifies non-string topic and event values", () => {
    const frame = decodeFrame("[null,null,42,7,{}]");
    expect(frame.topic).toBe("42");
    expect(frame.event).toBe("7");
  });
});

describe("Connection.send and nextRef", () => {
  it("assigns monotonic refs and uses the ref as join_ref when requested", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    const ref = conn.send("org:o", "phx_join", { a: 1 }, true);
    expect(ref).toBe("1");
    expect(JSON.parse(socket.sent[0] as string)).toEqual(["1", "1", "org:o", "phx_join", { a: 1 }]);

    const heartbeatRef = conn.send("phoenix", "heartbeat", {});
    expect(heartbeatRef).toBe("2");
    expect(JSON.parse(socket.sent[1] as string)).toEqual([null, "2", "phoenix", "heartbeat", {}]);
  });

  it("uses a supplied joinRef when useJoinRef is false", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    const ref = conn.send("org:o", "presence_track", { action: "viewing" }, false, "5");
    expect(ref).toBe("1");
    expect(JSON.parse(socket.sent[0] as string)).toEqual([
      "5",
      "1",
      "org:o",
      "presence_track",
      { action: "viewing" },
    ]);
  });

  it("defaults the payload to an empty object", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    conn.send("phoenix", "heartbeat");
    expect(JSON.parse(socket.sent[0] as string)).toEqual([null, "1", "phoenix", "heartbeat", {}]);
  });

  it("exposes nextRef as a public monotonic counter", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    expect(conn.nextRef()).toBe("1");
    expect(conn.nextRef()).toBe("2");
    expect(conn.nextRef()).toBe("3");
  });
});

describe("Connection readyState and isOpen", () => {
  it("reflects the socket ready state", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    expect(conn.readyState).toBe(WS_READY_STATE.OPEN);
    expect(conn.isOpen).toBe(true);
  });

  it("reports not open when the socket is not in the OPEN state", () => {
    const socket = new FakeWebSocket();
    socket.readyState = WS_READY_STATE.CONNECTING;
    const conn = new Connection(socket);
    expect(conn.isOpen).toBe(false);
    socket.readyState = WS_READY_STATE.CLOSED;
    expect(conn.readyState).toBe(WS_READY_STATE.CLOSED);
    expect(conn.isOpen).toBe(false);
  });
});

describe("Connection.close", () => {
  it("forwards the code and reason to the socket", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    conn.close(4000, "heartbeat timeout");
    expect(socket.closeCalls.at(-1)).toEqual({ code: 4000, reason: "heartbeat timeout" });
    expect(socket.readyState).toBe(WS_READY_STATE.CLOSED);
  });

  it("closes without arguments", () => {
    const socket = new FakeWebSocket();
    const conn = new Connection(socket);
    conn.close();
    expect(socket.closeCalls.at(-1)).toEqual({ code: undefined, reason: undefined });
  });

  it("routes a close failure to onError", () => {
    const socket = new FakeWebSocket();
    socket.closeError = new Error("already closing");
    const onError = vi.fn();
    const conn = new Connection(socket, { onError });
    conn.close();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe("already closing");
  });

  it("swallows a close failure when no onError handler is set", () => {
    const socket = new FakeWebSocket();
    socket.closeError = new Error("already closing");
    const conn = new Connection(socket);
    expect(() => conn.close()).not.toThrow();
  });
});

describe("Connection message handling", () => {
  it("surfaces decoded frames through onFrame", () => {
    const socket = new FakeWebSocket();
    const onFrame = vi.fn();
    new Connection(socket, { onFrame });
    const event: WebSocketMessageEvent = { data: '[null,null,"org:o","EMAIL_SENT",{"seq":1}]' };
    socket.fire("message", event);
    expect(onFrame).toHaveBeenCalledWith(
      expect.objectContaining({ event: "EMAIL_SENT", payload: { seq: 1 } }),
    );
  });

  it("decodes a Uint8Array message payload", () => {
    const socket = new FakeWebSocket();
    const onFrame = vi.fn();
    new Connection(socket, { onFrame });
    const data = new TextEncoder().encode('[null,null,"org:o","E",{"a":1}]');
    socket.fire("message", { data } satisfies WebSocketMessageEvent);
    expect(onFrame).toHaveBeenCalledWith(expect.objectContaining({ payload: { a: 1 } }));
  });

  it("decodes an ArrayBuffer message payload", () => {
    const socket = new FakeWebSocket();
    const onFrame = vi.fn();
    new Connection(socket, { onFrame });
    const data = new TextEncoder().encode('[null,null,"org:o","E",{"b":2}]').buffer;
    socket.fire("message", { data } satisfies WebSocketMessageEvent);
    expect(onFrame).toHaveBeenCalledWith(expect.objectContaining({ payload: { b: 2 } }));
  });

  it("decodes a buffer-like object via its toString", () => {
    const socket = new FakeWebSocket();
    const onFrame = vi.fn();
    new Connection(socket, { onFrame });
    const data = { toString: () => '[null,null,"org:o","E",{"c":3}]' };
    socket.fire("message", { data } satisfies WebSocketMessageEvent);
    expect(onFrame).toHaveBeenCalledWith(expect.objectContaining({ payload: { c: 3 } }));
  });

  it("ignores a plain object whose toString yields [object Object]", () => {
    const socket = new FakeWebSocket();
    const onFrame = vi.fn();
    const onError = vi.fn();
    new Connection(socket, { onFrame, onError });
    socket.fire("message", { data: { foo: "bar" } } satisfies WebSocketMessageEvent);
    expect(onFrame).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores message data that cannot be stringified", () => {
    const socket = new FakeWebSocket();
    const onFrame = vi.fn();
    const onError = vi.fn();
    new Connection(socket, { onFrame, onError });
    socket.fire("message", { data: null } satisfies WebSocketMessageEvent);
    socket.fire("message", { data: undefined } satisfies WebSocketMessageEvent);
    expect(onFrame).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("routes a decode failure to onError instead of throwing", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    socket.fire("message", { data: "not json" } satisfies WebSocketMessageEvent);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("decodes even when no onFrame handler is set and does not throw", () => {
    const socket = new FakeWebSocket();
    new Connection(socket);
    expect(() =>
      socket.fire("message", {
        data: '[null,null,"org:o","E",{}]',
      } satisfies WebSocketMessageEvent),
    ).not.toThrow();
  });

  it("does not throw on a decode failure when no onError handler is set", () => {
    const socket = new FakeWebSocket();
    new Connection(socket);
    expect(() =>
      socket.fire("message", { data: "not json" } satisfies WebSocketMessageEvent),
    ).not.toThrow();
  });
});

describe("Connection open and close events", () => {
  it("forwards open and close transport events", () => {
    const socket = new FakeWebSocket();
    const onOpen = vi.fn();
    const onClose = vi.fn();
    new Connection(socket, { onOpen, onClose });
    socket.fire("open");
    socket.fire("close", { code: 1000, reason: "bye" } satisfies WebSocketCloseEvent);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({ code: 1000, reason: "bye" });
  });

  it("does not throw on open or close when no handlers are set", () => {
    const socket = new FakeWebSocket();
    new Connection(socket);
    expect(() => socket.fire("open")).not.toThrow();
    expect(() => socket.fire("close", { code: 1006 } satisfies WebSocketCloseEvent)).not.toThrow();
  });
});

describe("Connection error events and toError normalization", () => {
  it("passes through an Error instance unchanged", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    const original = new Error("boom");
    socket.fire("error", original);
    expect(onError).toHaveBeenCalledWith(original);
  });

  it("unwraps a nested Error from an error event", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    const nested = new Error("inner");
    socket.fire("error", { error: nested });
    expect(onError).toHaveBeenCalledWith(nested);
  });

  it("builds an Error from a string message field", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    socket.fire("error", { message: "connection refused" });
    const err = onError.mock.calls[0]?.[0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("connection refused");
  });

  it("falls back to a generic transport error for unrecognized values", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    socket.fire("error", null);
    const err = onError.mock.calls[0]?.[0] as Error;
    expect(err.message).toBe("WebSocket transport error");
  });

  it("falls back to a generic transport error for an event with no usable fields", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    socket.fire("error", { type: "error" });
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe("WebSocket transport error");
  });

  it("does not throw on an error event when no onError handler is set", () => {
    const socket = new FakeWebSocket();
    new Connection(socket);
    expect(() => socket.fire("error", new Error("x"))).not.toThrow();
  });
});
