import { afterEach, describe, expect, it } from "vitest";
import { WarmblyError } from "../core/errors";
import type { WebSocketCtor } from "./types";
import { resolveWebSocket } from "./websocket";

const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;

class FakeCtor {
  constructor(public url: string) {}
  send(): void {}
  close(): void {}
  readyState = 1;
  addEventListener(): void {}
}

afterEach(() => {
  if (originalWebSocket === undefined) {
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
  } else {
    (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
  }
});

describe("resolveWebSocket", () => {
  it("prefers an injected constructor", async () => {
    const injected = FakeCtor as unknown as WebSocketCtor;
    await expect(resolveWebSocket(injected)).resolves.toBe(injected);
  });

  it("falls back to the platform global", async () => {
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeCtor;
    const ctor = await resolveWebSocket();
    expect(ctor).toBe(FakeCtor as unknown as WebSocketCtor);
  });

  it("throws a helpful error when no implementation is available off Node", async () => {
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
    const proc = (globalThis as { process?: unknown }).process;
    delete (globalThis as { process?: unknown }).process;
    try {
      await expect(resolveWebSocket()).rejects.toBeInstanceOf(WarmblyError);
    } finally {
      (globalThis as { process?: unknown }).process = proc;
    }
  });
});
