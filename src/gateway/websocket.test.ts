import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("imports the ws package on Node when no global WebSocket exists", async () => {
    // ws is an installed optional peer, so the Node fallback resolves to its constructor.
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
    const ctor = await resolveWebSocket();
    expect(typeof ctor).toBe("function");
  });

  it("throws when the ws import fails on Node", async () => {
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
    vi.resetModules();
    vi.doMock("ws", () => {
      throw new Error("Cannot find module 'ws'");
    });
    const { resolveWebSocket: fresh } = await import("./websocket");
    await expect(fresh()).rejects.toThrow(/No WebSocket implementation/);
    vi.doUnmock("ws");
    vi.resetModules();
  });

  it("throws when the ws module export is not a constructor", async () => {
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
    vi.resetModules();
    vi.doMock("ws", () => ({ default: 42, WebSocket: undefined }));
    const { resolveWebSocket: fresh } = await import("./websocket");
    await expect(fresh()).rejects.toThrow(/No WebSocket implementation/);
    vi.doUnmock("ws");
    vi.resetModules();
  });
});
