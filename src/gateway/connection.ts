/**
 * The low-level Phoenix transport. Implements the serializer v1.0.0 5-element frame
 * `[join_ref, ref, topic, event, payload]`, owns the WebSocket, manages a monotonic ref
 * counter, and surfaces decoded frames through a callback. It knows nothing about events,
 * intents, or resume; the {@link Gateway} layers that on top.
 */

import type { WebSocketCloseEvent, WebSocketLike, WebSocketMessageEvent } from "./types";
import { WS_READY_STATE } from "./types";

/**
 * A decoded Phoenix frame. `join_ref` and `ref` are `null` for server pushes that are not
 * replies (such as broadcast events and presence).
 *
 * @example
 * if (frame.event === "phx_reply" && frame.ref === sentRef) handleReply(frame.payload);
 */
export interface PhoenixFrame {
  /** The ref used when joining the topic, or `null` for non-join frames. */
  join_ref: string | null;
  /** The per-message ref for replies, or `null` for server-initiated pushes. */
  ref: string | null;
  /** The channel topic, e.g. `org:org_1` or `phoenix`. */
  topic: string;
  /** The Phoenix or application event name. */
  event: string;
  /** The frame payload object. */
  payload: Record<string, unknown>;
}

/**
 * Encodes a Phoenix frame as the serializer v1.0.0 5-element JSON array string.
 *
 * @example
 * encodeFrame(["1", "2", "org:org_1", "phx_join", { intents: ["EMAIL"] }]);
 */
export function encodeFrame(
  frame: [
    joinRef: string | null,
    ref: string | null,
    topic: string,
    event: string,
    payload: Record<string, unknown>,
  ],
): string {
  return JSON.stringify(frame);
}

/**
 * Decodes a serializer v1.0.0 frame string into a {@link PhoenixFrame}. Throws on anything
 * that is not a 5-element array.
 *
 * @example
 * const frame = decodeFrame('[null,"3","phoenix","phx_reply",{"status":"ok"}]');
 */
export function decodeFrame(raw: string): PhoenixFrame {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new TypeError("Invalid Phoenix frame: expected a 5-element array.");
  }
  const [joinRef, ref, topic, event, payload] = parsed as [
    string | null,
    string | null,
    unknown,
    unknown,
    unknown,
  ];
  return {
    join_ref: joinRef ?? null,
    ref: ref ?? null,
    topic: String(topic),
    event: String(event),
    payload: (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>,
  };
}

/** Callbacks the {@link Connection} invokes for transport-level events. */
export interface ConnectionHandlers {
  /** The socket opened. */
  onOpen?: () => void;
  /** A frame was decoded. */
  onFrame?: (frame: PhoenixFrame) => void;
  /** The socket closed. */
  onClose?: (event: WebSocketCloseEvent) => void;
  /** A transport error occurred, or a frame failed to decode. */
  onError?: (error: Error) => void;
}

/**
 * Owns a single {@link WebSocketLike}, assigns monotonic refs, encodes outbound frames, and
 * decodes inbound ones. One {@link Connection} corresponds to one socket; reconnects create a
 * fresh instance.
 *
 * @example
 * const conn = new Connection(socket, { onFrame: (f) => console.log(f.event) });
 * const ref = conn.send("org:org_1", "phx_join", { intents: ["EMAIL"] }, true);
 */
export class Connection {
  private readonly socket: WebSocketLike;
  private readonly handlers: ConnectionHandlers;
  private refCounter = 0;

  constructor(socket: WebSocketLike, handlers: ConnectionHandlers = {}) {
    this.socket = socket;
    this.handlers = handlers;
    this.bind();
  }

  /** Returns the next monotonic ref as a string. */
  nextRef(): string {
    this.refCounter += 1;
    return String(this.refCounter);
  }

  /** The underlying socket's ready state. */
  get readyState(): number {
    return this.socket.readyState;
  }

  /** Whether the socket is open and ready to send. */
  get isOpen(): boolean {
    return this.socket.readyState === WS_READY_STATE.OPEN;
  }

  /**
   * Sends a frame and returns its ref. When `useJoinRef` is true the new ref is also used as
   * the `join_ref` (for `phx_join`); otherwise `join_ref` is the supplied one or `null`.
   */
  send(
    topic: string,
    event: string,
    payload: Record<string, unknown> = {},
    useJoinRef = false,
    joinRef: string | null = null,
  ): string {
    const ref = this.nextRef();
    const frameJoinRef = useJoinRef ? ref : joinRef;
    this.socket.send(encodeFrame([frameJoinRef, ref, topic, event, payload]));
    return ref;
  }

  /** Closes the socket with an optional code and reason. */
  close(code?: number, reason?: string): void {
    try {
      this.socket.close(code, reason);
    } catch (error) {
      this.handlers.onError?.(toError(error));
    }
  }

  private bind(): void {
    this.socket.addEventListener("open", () => {
      this.handlers.onOpen?.();
    });
    this.socket.addEventListener("message", (event: WebSocketMessageEvent) => {
      this.handleMessage(event);
    });
    this.socket.addEventListener("close", (event: WebSocketCloseEvent) => {
      this.handlers.onClose?.(event);
    });
    this.socket.addEventListener("error", (event: unknown) => {
      this.handlers.onError?.(toError(event));
    });
  }

  private handleMessage(event: WebSocketMessageEvent): void {
    const raw = typeof event.data === "string" ? event.data : stringifyData(event.data);
    if (raw === undefined) return;
    // Decode first so a malformed frame is always routed to onError, even when no onFrame
    // handler is set (optional-call would otherwise skip evaluating the decode entirely).
    let frame: PhoenixFrame;
    try {
      frame = decodeFrame(raw);
    } catch (error) {
      this.handlers.onError?.(toError(error));
      return;
    }
    this.handlers.onFrame?.(frame);
  }
}

/** Coerces binary or buffer-like socket data into a string, or `undefined` if not possible. */
function stringifyData(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
  if (data && typeof (data as { toString?: () => string }).toString === "function") {
    const text = String(data);
    return text === "[object Object]" ? undefined : text;
  }
  return undefined;
}

/** Normalizes an unknown thrown value or error event into an `Error`. */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  const maybe = value as { message?: unknown; error?: unknown };
  if (maybe && maybe.error instanceof Error) return maybe.error;
  if (maybe && typeof maybe.message === "string") return new Error(maybe.message);
  return new Error("WebSocket transport error");
}
