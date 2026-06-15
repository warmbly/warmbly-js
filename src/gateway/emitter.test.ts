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
});
