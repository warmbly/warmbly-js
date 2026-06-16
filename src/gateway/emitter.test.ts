import { describe, expect, it, vi } from "vitest";
import { TypedEmitter } from "./emitter";

interface Events {
  ping: void;
  data: { value: number };
}

describe("TypedEmitter", () => {
  it("delivers payloads to listeners and supports unsubscribe", () => {
    const emitter = new TypedEmitter<Events>();
    const seen: number[] = [];
    const off = emitter.on("data", (d) => seen.push(d.value));

    emitter.emit("data", { value: 1 });
    emitter.emit("data", { value: 2 });
    off();
    emitter.emit("data", { value: 3 });

    expect(seen).toEqual([1, 2]);
    expect(emitter.listenerCount("data")).toBe(0);
  });

  it("calls void-payload listeners with no argument", () => {
    const emitter = new TypedEmitter<Events>();
    const cb = vi.fn();
    emitter.on("ping", cb);
    emitter.emit("ping");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  it("once fires exactly once", () => {
    const emitter = new TypedEmitter<Events>();
    const cb = vi.fn();
    emitter.once("data", cb);
    emitter.emit("data", { value: 1 });
    emitter.emit("data", { value: 2 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("forwards every event to catch-all listeners", () => {
    const emitter = new TypedEmitter<Events>();
    const calls: Array<[keyof Events, unknown]> = [];
    const off = emitter.onAny((name, payload) => calls.push([name, payload]));

    emitter.emit("ping");
    emitter.emit("data", { value: 7 });
    off();
    emitter.emit("ping");

    expect(calls).toEqual([
      ["ping", undefined],
      ["data", { value: 7 }],
    ]);
  });

  it("off without a listener removes every listener for the event", () => {
    const emitter = new TypedEmitter<Events>();
    emitter.on("data", vi.fn());
    emitter.on("data", vi.fn());
    emitter.off("data");
    expect(emitter.listenerCount("data")).toBe(0);
  });

  it("lets a listener unsubscribe itself during dispatch without skipping others", () => {
    const emitter = new TypedEmitter<Events>();
    const second = vi.fn();
    const off = emitter.on("data", () => off());
    emitter.on("data", second);
    expect(() => emitter.emit("data", { value: 1 })).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("supports multiple listeners on the same event and reuses the set", () => {
    const emitter = new TypedEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on("data", a);
    emitter.on("data", b);
    expect(emitter.listenerCount("data")).toBe(2);
    emitter.emit("data", { value: 5 });
    expect(a).toHaveBeenCalledWith({ value: 5 });
    expect(b).toHaveBeenCalledWith({ value: 5 });
  });

  it("off with a specific listener removes only that listener", () => {
    const emitter = new TypedEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on("data", a);
    emitter.on("data", b);
    emitter.off("data", a);
    expect(emitter.listenerCount("data")).toBe(1);
    emitter.emit("data", { value: 9 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("removing the last listener deletes the event entry", () => {
    const emitter = new TypedEmitter<Events>();
    const a = vi.fn();
    emitter.on("data", a);
    emitter.off("data", a);
    expect(emitter.listenerCount("data")).toBe(0);
  });

  it("off for a specific listener on an unknown event is a safe no-op", () => {
    const emitter = new TypedEmitter<Events>();
    expect(() => emitter.off("data", vi.fn())).not.toThrow();
    expect(emitter.listenerCount("data")).toBe(0);
  });

  it("unsubscribe is safe to call more than once", () => {
    const emitter = new TypedEmitter<Events>();
    const off = emitter.on("data", vi.fn());
    off();
    expect(() => off()).not.toThrow();
    expect(emitter.listenerCount("data")).toBe(0);
  });

  it("once returns an unsubscribe that cancels before firing", () => {
    const emitter = new TypedEmitter<Events>();
    const cb = vi.fn();
    const off = emitter.once("data", cb);
    off();
    emitter.emit("data", { value: 1 });
    expect(cb).not.toHaveBeenCalled();
  });

  it("offAny removes a catch-all listener", () => {
    const emitter = new TypedEmitter<Events>();
    const cb = vi.fn();
    emitter.onAny(cb);
    emitter.offAny(cb);
    emitter.emit("ping");
    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple catch-all listeners", () => {
    const emitter = new TypedEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.onAny(a);
    emitter.onAny(b);
    emitter.emit("data", { value: 3 });
    expect(a).toHaveBeenCalledWith("data", { value: 3 });
    expect(b).toHaveBeenCalledWith("data", { value: 3 });
  });

  it("emitting with no listeners at all does nothing and does not throw", () => {
    const emitter = new TypedEmitter<Events>();
    expect(() => emitter.emit("data", { value: 1 })).not.toThrow();
    expect(() => emitter.emit("ping")).not.toThrow();
  });

  it("removeAllListeners clears both named and catch-all listeners", () => {
    const emitter = new TypedEmitter<Events>();
    const named = vi.fn();
    const any = vi.fn();
    emitter.on("data", named);
    emitter.onAny(any);
    emitter.removeAllListeners();
    expect(emitter.listenerCount("data")).toBe(0);
    emitter.emit("data", { value: 1 });
    expect(named).not.toHaveBeenCalled();
    expect(any).not.toHaveBeenCalled();
  });

  it("lets a catch-all listener unsubscribe itself during dispatch without skipping others", () => {
    const emitter = new TypedEmitter<Events>();
    const second = vi.fn();
    const off = emitter.onAny(() => off());
    emitter.onAny(second);
    expect(() => emitter.emit("ping")).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
