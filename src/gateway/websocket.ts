/**
 * Cross-runtime WebSocket constructor resolution. Prefers an injected constructor, then the
 * platform global, and only on Node falls back to a lazily imported `ws`. The `ws` import
 * is kept behind a function and only reached when no global exists, so browser and edge
 * bundlers never pull it in.
 */

import { WarmblyError } from "../core/errors";
import type { WebSocketCtor } from "./types";

/** Whether a value can plausibly act as a WebSocket constructor. */
function isWebSocketCtor(value: unknown): value is WebSocketCtor {
  return typeof value === "function";
}

/** Whether the current runtime is Node (and therefore can import `ws`). */
function isNodeRuntime(): boolean {
  const g = globalThis as { process?: { versions?: { node?: string } } };
  return typeof g.process?.versions?.node === "string";
}

/**
 * Resolves the WebSocket constructor to use, asynchronously so the Node `ws` fallback can be
 * lazily imported. The resolution order is: injected, then `globalThis.WebSocket`, then (Node
 * only) the `ws` package. Throws a helpful error when none is available.
 *
 * @example
 * const Ctor = await resolveWebSocket(options.webSocket);
 * const socket = new Ctor("wss://realtime.warmbly.com/socket/websocket?vsn=1.0.0&token=...");
 */
export async function resolveWebSocket(injected?: WebSocketCtor): Promise<WebSocketCtor> {
  if (injected) return injected;

  const platform = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (isWebSocketCtor(platform)) return platform;

  if (isNodeRuntime()) {
    const fromWs = await loadNodeWebSocket();
    if (fromWs) return fromWs;
  }

  throw new WarmblyError(
    "No WebSocket implementation was found. Use a runtime with a global `WebSocket` (Node 22+, Bun, Deno, browsers, edge), install the optional `ws` package on older Node, or pass a `webSocket` constructor in the gateway options.",
  );
}

/** Lazily imports `ws` on Node, returning its constructor or `undefined` if unavailable. */
async function loadNodeWebSocket(): Promise<WebSocketCtor | undefined> {
  try {
    // Indirect specifier keeps non-Node bundlers from statically resolving `ws`.
    const moduleName = "ws";
    const mod = (await import(/* @vite-ignore */ moduleName)) as {
      default?: unknown;
      WebSocket?: unknown;
    };
    const candidate = mod.default ?? mod.WebSocket ?? mod;
    return isWebSocketCtor(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}
