/**
 * Types for the realtime gateway: connection options, the Phoenix HELLO payload,
 * the cross-runtime WebSocket interface, close codes, presence shapes, and channel
 * topic helpers. The transport itself is documented in `API_CONTRACT.md` section 6.
 */

/** A function that resolves a fresh gateway token, used to re-mint expired tokens. */
export type GatewayTokenProvider = () => string | Promise<string>;

/**
 * A minimal logger, injected so the gateway never calls `console.*` directly.
 * Each method is optional; missing methods are treated as no-ops.
 *
 * @example
 * const gw = new Gateway({ orgId: "org_1", token: "wmbly_x", logger: console });
 */
export interface GatewayLogger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
  error?(message: string, ...args: unknown[]): void;
}

/**
 * Options for constructing a {@link Gateway}.
 *
 * @example
 * const gw = new Gateway({
 *   url: "wss://realtime.warmbly.com",
 *   orgId: "org_123",
 *   token: "wmbly_...",
 *   intents: ["EMAIL", "CAMPAIGN", "CUSTOM"],
 * });
 */
export interface GatewayOptions {
  /** Gateway base URL. Defaults to `wss://realtime.warmbly.com`. */
  url?: string;
  /** A static token (API key with `REALTIME_SUBSCRIBE`, or an OAuth access token). */
  token?: string;
  /** A dynamic token provider, awaited before every connect and re-mint. Takes precedence over `token`. */
  getToken?: GatewayTokenProvider;
  /** Organization id to join (`org:<orgId>`). Required to connect. */
  orgId?: string;
  /** Intent families that filter the event stream. Empty or absent means the full stream. */
  intents?: string[];
  /** Custom WebSocket constructor. Defaults to the platform global, or lazy `ws` on Node. */
  webSocket?: WebSocketCtor;
  /** Whether to reconnect automatically on an unexpected close. Defaults to `true`. */
  autoReconnect?: boolean;
  /** Cap on the exponential reconnect backoff, in milliseconds. Defaults to 30000. */
  maxReconnectDelayMs?: number;
  /** Optional logger; defaults to a no-op so nothing is written to the console. */
  logger?: GatewayLogger;
}

/**
 * The HELLO payload delivered as the `org` channel join reply, advertising the
 * heartbeat cadence, server timeout, current sequence, and resume support.
 *
 * @example
 * gw.on("hello", (hello) => console.log(hello.heartbeat_interval_ms, hello.seq));
 */
export interface HelloPayload {
  /** The organization id the socket is bound to. */
  org_id: string;
  /** The caller's role within the organization. */
  role: string;
  /** Interval at which the client must send a heartbeat, in milliseconds. */
  heartbeat_interval_ms: number;
  /** How long the server waits before closing an idle socket, in milliseconds. */
  server_timeout_ms: number;
  /** The current per-org sequence number at the moment of join. */
  seq: number;
  /** Whether the server supports resuming a missed-event window by sequence. */
  resume_supported: boolean;
  [key: string]: unknown;
}

/**
 * The result of a resume attempt after a reconnect: either a successful replay or a
 * failure that requires a REST resync from `current_seq`.
 *
 * @example
 * gw.on("resumed", (r) => console.log(`replayed ${r.replayed} events`));
 * gw.on("resumeFailed", (r) => console.warn(r.reason));
 */
export type ResumeOutcome =
  | {
      /** A resume succeeded; the server replayed the missed window. */
      ok: true;
      /** The sequence the resume started from. */
      from: number;
      /** The sequence after the replayed window. */
      current_seq: number;
      /** Number of events replayed. */
      replayed: number;
    }
  | {
      /** A resume failed; the consumer should resync over REST and continue from `current_seq`. */
      ok: false;
      /** Why the resume failed. */
      reason: "buffer_evicted" | "invalid_resume" | (string & {});
      /** The live sequence to continue from after a REST resync. */
      current_seq: number;
    };

/**
 * The lifecycle state of a {@link Gateway}.
 *
 * @example
 * if (gw.state === "ready") gw.joinCampaign("camp_1");
 */
export type GatewayState =
  | "idle"
  | "connecting"
  | "open"
  | "identifying"
  | "ready"
  | "reconnecting"
  | "closed";

/**
 * A message event surfaced by a {@link WebSocketLike}. Mirrors the browser `MessageEvent`
 * shape, narrowed to the `data` field the gateway reads.
 */
export interface WebSocketMessageEvent {
  data: unknown;
}

/**
 * A close event surfaced by a {@link WebSocketLike}. Mirrors the browser `CloseEvent`
 * shape, narrowed to the fields the gateway reads.
 */
export interface WebSocketCloseEvent {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

/** Names of the events a {@link WebSocketLike} emits. */
export type WebSocketEventName = "open" | "message" | "close" | "error";

/**
 * The minimal, cross-runtime WebSocket surface the gateway depends on. Both the browser
 * `WebSocket` and the Node `ws` package satisfy this `addEventListener`-style interface.
 *
 * @example
 * const ws: WebSocketLike = new WebSocket(url);
 * ws.addEventListener("message", (e) => console.log(e.data));
 */
export interface WebSocketLike {
  /** Sends a text frame. */
  send(data: string): void;
  /** Closes the socket, optionally with a code and reason. */
  close(code?: number, reason?: string): void;
  /** The current ready state, matching the standard WebSocket constants. */
  readonly readyState: number;
  /** Subscribes to an event. */
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: WebSocketMessageEvent) => void): void;
  addEventListener(type: "close", listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: "error", listener: (event: unknown) => void): void;
  /** Unsubscribes from an event. */
  removeEventListener?(type: WebSocketEventName, listener: (...args: unknown[]) => void): void;
}

/**
 * A WebSocket constructor producing a {@link WebSocketLike}. Satisfied by the global
 * `WebSocket` and by the `ws` package's default export.
 *
 * @example
 * const ctor: WebSocketCtor = globalThis.WebSocket;
 * const socket = new ctor("wss://example.com");
 */
export interface WebSocketCtor {
  new (url: string, protocols?: string | string[]): WebSocketLike;
}

/** Standard WebSocket `readyState` values, redeclared so no DOM lib is required. */
export const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * Gateway close/reason codes surfaced on rejection. These map to the documented
 * connection-level and post-join rejection reasons.
 *
 * @example
 * gw.on("error", (err) => {
 *   if (err instanceof GatewayError && err.code === GatewayCloseCode.AUTH_FAILED) {
 *     // token expired; supply getToken to re-mint
 *   }
 * });
 */
export enum GatewayCloseCode {
  /** No token was supplied at the handshake. */
  NOT_AUTHENTICATED = 4003,
  /** The token was expired or invalid; re-mint and reconnect. */
  AUTH_FAILED = 4004,
  /** The connection was rate limited; back off before retrying. */
  RATE_LIMITED = 4007,
  /** The per-user or per-IP connection limit was exceeded; reduce sockets. */
  CONNECTION_LIMIT = 4009,
  /** Permission denied, or the source IP is not on the allowlist. */
  PERMISSION_DENIED = 4010,
}

/** The close code the client uses to force a reconnect after a heartbeat timeout. */
export const HEARTBEAT_TIMEOUT_CLOSE_CODE = 4000;

/** Whether a close code is a server rejection the consumer should be told about. */
export function isRejectionCloseCode(code: number | undefined): code is GatewayCloseCode {
  return (
    code === GatewayCloseCode.NOT_AUTHENTICATED ||
    code === GatewayCloseCode.AUTH_FAILED ||
    code === GatewayCloseCode.RATE_LIMITED ||
    code === GatewayCloseCode.CONNECTION_LIMIT ||
    code === GatewayCloseCode.PERMISSION_DENIED
  );
}

/** A human-readable explanation for a known gateway close code. */
export function describeCloseCode(code: number | undefined): string {
  switch (code) {
    case GatewayCloseCode.NOT_AUTHENTICATED:
      return "not authenticated: no token was supplied";
    case GatewayCloseCode.AUTH_FAILED:
      return "auth failed: token expired or invalid";
    case GatewayCloseCode.RATE_LIMITED:
      return "rate limited: back off before reconnecting";
    case GatewayCloseCode.CONNECTION_LIMIT:
      return "connection limit exceeded: reduce the number of sockets";
    case GatewayCloseCode.PERMISSION_DENIED:
      return "permission denied: grant REALTIME_SUBSCRIBE or fix the IP allowlist";
    default:
      return code !== undefined ? `closed with code ${code}` : "closed";
  }
}

/** A presence activity action reported by a workspace member. */
export type PresenceAction = "viewing" | "editing" | "replying" | "idle";

/**
 * Metadata for a single presence entry, as tracked by the org channel. The server may
 * strip or omit fields subject to workspace privacy.
 *
 * @example
 * gw.on("presence", (state) => {
 *   for (const [key, entry] of Object.entries(state)) {
 *     console.log(key, entry.metas[0]?.action);
 *   }
 * });
 */
export interface PresenceMeta {
  /** A per-connection ref used to reconcile diffs. */
  phx_ref?: string;
  /** The page or view the member is on. */
  page?: string;
  /** The resource the member is interacting with. */
  resource?: string;
  /** What the member is doing. */
  action?: PresenceAction;
  /** When the member came online, when provided. */
  online_at?: string;
  [key: string]: unknown;
}

/** A single presence entry: one key (often a user id) and its list of connection metas. */
export interface PresenceEntry {
  metas: PresenceMeta[];
  [key: string]: unknown;
}

/**
 * The full presence map for the org channel, keyed by presence key (often a user id).
 *
 * @example
 * const online = Object.keys(gw.presence).length;
 */
export type PresenceState = Record<string, PresenceEntry>;

/** The Phoenix `presence_diff` payload: members that joined and left since the last state. */
export interface PresenceDiff {
  joins: PresenceState;
  leaves: PresenceState;
  [key: string]: unknown;
}

/**
 * The payload pushed to update the caller's own activity on the org channel.
 *
 * @example
 * gw.updatePresence({ page: "/inbox", resource: "thread_1", action: "replying" });
 */
export interface PresenceUpdate {
  page?: string;
  resource?: string;
  action?: PresenceAction;
  [key: string]: unknown;
}

/**
 * Helpers that build the Phoenix topic strings for each joinable channel.
 *
 * @example
 * ChannelTopic.org("org_1");        // "org:org_1"
 * ChannelTopic.campaign("camp_1");  // "campaign:camp_1"
 */
export const ChannelTopic = {
  /** The org membership channel, filtered per-permission and per-intent. */
  org: (orgId: string): string => `org:${orgId}`,
  /** The caller's own user channel, always joinable. */
  user: (userId: string): string => `user:${userId}`,
  /** A single campaign's channel. */
  campaign: (campaignId: string): string => `campaign:${campaignId}`,
  /** A single email account's channel. */
  account: (accountId: string): string => `account:${accountId}`,
  /** A bulk operation's progress channel. */
  bulk: (operationId: string): string => `bulk:${operationId}`,
  /** The reserved Phoenix topic used for heartbeats. */
  phoenix: "phoenix" as const,
} as const;

/** A parsed channel topic: its kind and the id it refers to. */
export interface ParsedChannelTopic {
  kind: "org" | "user" | "campaign" | "account" | "bulk" | "phoenix" | "unknown";
  id: string | undefined;
}

/** Parses a `kind:id` topic string into its parts. */
export function parseChannelTopic(topic: string): ParsedChannelTopic {
  if (topic === ChannelTopic.phoenix) return { kind: "phoenix", id: undefined };
  const index = topic.indexOf(":");
  if (index === -1) return { kind: "unknown", id: undefined };
  const prefix = topic.slice(0, index);
  const id = topic.slice(index + 1);
  switch (prefix) {
    case "org":
    case "user":
    case "campaign":
    case "account":
    case "bulk":
      return { kind: prefix, id };
    default:
      return { kind: "unknown", id };
  }
}
