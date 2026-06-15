import { describe, expect, it, vi } from "vitest";
import { Connection, decodeFrame, encodeFrame } from "./connection";
import type { WebSocketCloseEvent, WebSocketLike, WebSocketMessageEvent } from "./types";
import { WS_READY_STATE } from "./types";

/** A minimal in-memory WebSocket that records sends and lets tests drive events. */
class FakeWebSocket implements WebSocketLike {
  readyState = WS_READY_STATE.OPEN;
  readonly sent: string[] = [];
  private readonly handlers = new Map<string, Array<(arg: unknown) => void>>();

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
}

describe("encodeFrame / decodeFrame", () => {
  it("round-trips a 5-element Phoenix frame", () => {
    const raw = encodeFrame(["1", "2", "org:o", "phx_join", { intents: ["EMAIL"] }]);
    expect(JSON.parse(raw)).toEqual(["1", "2", "org:o", "phx_join", { intents: ["EMAIL"] }]);
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

  it("throws on a non-5-element frame", () => {
    expect(() => decodeFrame("[1,2,3]")).toThrow(TypeError);
  });
});

describe("Connection", () => {
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

  it("routes a decode failure to onError instead of throwing", () => {
    const socket = new FakeWebSocket();
    const onError = vi.fn();
    new Connection(socket, { onError });
    socket.fire("message", { data: "not json" } satisfies WebSocketMessageEvent);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

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
});
