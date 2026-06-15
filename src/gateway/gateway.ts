/**
 * The high-level realtime gateway client. Wraps the Phoenix transport in an ergonomic,
 * strongly-typed surface: typed `on`/`once`/`off`, a catch-all `onAny`, lifecycle events,
 * automatic join + HELLO + heartbeat + watchdog + reconnect + resume, and presence tracking.
 * The full state machine and wire details live in `API_CONTRACT.md` section 6.
 */

import { GATEWAY_SOCKET_PATH, PHOENIX_VSN } from "../core/constants";
import { GatewayError } from "../core/errors";
import { fullJitterBackoff } from "../core/fetch";
import { Connection, type PhoenixFrame } from "./connection";
import { type AnyListener, type Listener, TypedEmitter, type Unsubscribe } from "./emitter";
import type { CloseInfo, GatewayLifecycleMap, ReconnectingInfo, WarmblyEventMap } from "./events";
import { WARMBLY_EVENTS } from "./events";
import { normalizeIntents } from "./intents";
import { buildPresenceUpdate, PRESENCE_UPDATE_EVENT, PresenceTracker } from "./presence";
import type {
  GatewayOptions,
  GatewayState,
  HelloPayload,
  PresenceState,
  PresenceUpdate,
  ResumeOutcome,
  WebSocketCtor,
} from "./types";
import {
  ChannelTopic,
  describeCloseCode,
  GatewayCloseCode,
  HEARTBEAT_TIMEOUT_CLOSE_CODE,
  isRejectionCloseCode,
} from "./types";
import { resolveWebSocket } from "./websocket";

/** Default gateway base URL when none is supplied. */
const DEFAULT_GATEWAY_URL = "wss://realtime.warmbly.com";

/** Default cap on the reconnect backoff, in milliseconds. */
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;

/** A normal WebSocket close: the consumer asked to stop, so no reconnect. */
const NORMAL_CLOSE_CODE = 1000;

/** The merged map of data events and lifecycle events the gateway emits. */
type GatewayEventMap = WarmblyEventMap & GatewayLifecycleMap;

/**
 * An ergonomic, strongly-typed realtime client over the Warmbly Phoenix gateway.
 *
 * @example
 * const gw = new Gateway({ orgId: "org_123", token: "wmbly_...", intents: ["EMAIL", "CAMPAIGN"] });
 * gw.on("EMAIL_OPENED", (e) => console.log(e.campaign_id));
 * gw.on("CUSTOM_EVENT", (e) => console.log(e.name, e.payload));
 * gw.on("reconnecting", ({ attempt, delayMs }) => console.log(attempt, delayMs));
 * await gw.connect();
 *
 * @example
 * // With an injected WebSocket and a token provider that re-mints on expiry.
 * const gw = new Gateway({
 *   orgId: "org_123",
 *   getToken: () => mintRealtimeToken(),
 *   webSocket: MyWebSocket,
 * });
 */
export class Gateway {
  private readonly emitter = new TypedEmitter<GatewayEventMap>();
  private readonly presenceTracker = new PresenceTracker();

  private readonly url: string;
  private readonly orgId: string | undefined;
  private readonly staticToken: string | undefined;
  private readonly tokenProvider: (() => string | Promise<string>) | undefined;
  private readonly intents: string[] | undefined;
  private readonly injectedWebSocket: WebSocketCtor | undefined;
  private readonly autoReconnect: boolean;
  private readonly maxReconnectDelayMs: number;
  private readonly logger: GatewayOptions["logger"];

  private connection: Connection | undefined;
  private orgJoinRef: string | undefined;
  private _state: GatewayState = "idle";
  private _latestSeq = 0;
  private hello: HelloPayload | undefined;

  private reconnectAttempts = 0;
  private deliberatelyClosed = false;

  private heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatPending = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: GatewayOptions = {}) {
    this.url = stripTrailingSlash(options.url ?? DEFAULT_GATEWAY_URL);
    this.orgId = options.orgId;
    this.staticToken = options.token;
    this.tokenProvider = options.getToken;
    this.intents = normalizeIntents(options.intents);
    this.injectedWebSocket = options.webSocket;
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
    this.logger = options.logger;
  }

  /** The current lifecycle state. */
  get state(): GatewayState {
    return this._state;
  }

  /** The highest processed per-org sequence number; survives reconnects for resume. */
  get latestSeq(): number {
    return this._latestSeq;
  }

  /** A snapshot of the current org presence map. */
  get presence(): PresenceState {
    return this.presenceTracker.state;
  }

  /** The HELLO payload from the most recent join, when available. */
  get helloPayload(): HelloPayload | undefined {
    return this.hello;
  }

  /** Subscribes to a data event. Returns an unsubscribe function. */
  on<K extends keyof WarmblyEventMap>(name: K, listener: Listener<WarmblyEventMap[K]>): Unsubscribe;
  /** Subscribes to a lifecycle event. Returns an unsubscribe function. */
  on<K extends keyof GatewayLifecycleMap>(
    name: K,
    listener: Listener<GatewayLifecycleMap[K]>,
  ): Unsubscribe;
  on(name: keyof GatewayEventMap, listener: Listener<never>): Unsubscribe {
    return this.emitter.on(name, listener as Listener<GatewayEventMap[typeof name]>);
  }

  /** Subscribes to a data event for a single emission. */
  once<K extends keyof WarmblyEventMap>(
    name: K,
    listener: Listener<WarmblyEventMap[K]>,
  ): Unsubscribe;
  /** Subscribes to a lifecycle event for a single emission. */
  once<K extends keyof GatewayLifecycleMap>(
    name: K,
    listener: Listener<GatewayLifecycleMap[K]>,
  ): Unsubscribe;
  once(name: keyof GatewayEventMap, listener: Listener<never>): Unsubscribe {
    return this.emitter.once(name, listener as Listener<GatewayEventMap[typeof name]>);
  }

  /** Removes a data-event listener, or all listeners for the event when none is given. */
  off<K extends keyof WarmblyEventMap>(name: K, listener?: Listener<WarmblyEventMap[K]>): void;
  /** Removes a lifecycle-event listener, or all listeners for the event when none is given. */
  off<K extends keyof GatewayLifecycleMap>(
    name: K,
    listener?: Listener<GatewayLifecycleMap[K]>,
  ): void;
  off(name: keyof GatewayEventMap, listener?: Listener<never>): void {
    this.emitter.off(name, listener as Listener<GatewayEventMap[typeof name]> | undefined);
  }

  /** Subscribes a catch-all listener invoked for every emitted event. Returns an unsubscribe. */
  onAny(listener: AnyListener<GatewayEventMap>): Unsubscribe {
    return this.emitter.onAny(listener);
  }

  /**
   * Opens the socket, joins the org channel, and resolves once HELLO is received and the
   * gateway is ready. Subsequent reconnects are handled internally.
   */
  async connect(): Promise<void> {
    if (this._state === "ready" || this._state === "connecting" || this._state === "identifying") {
      return;
    }
    this.deliberatelyClosed = false;
    await this.openSocket();
    await this.waitForReady();
  }

  /** Closes the socket cleanly and stops all timers and reconnection. */
  close(): void {
    this.deliberatelyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.connection?.close(NORMAL_CLOSE_CODE, "client closed");
    this.connection = undefined;
    this.setState("closed");
  }

  /** Joins a campaign channel. Requires the connection to be ready. */
  joinCampaign(campaignId: string): void {
    this.joinChannel(ChannelTopic.campaign(campaignId));
  }

  /** Joins an email account channel. Requires the connection to be ready. */
  joinAccount(accountId: string): void {
    this.joinChannel(ChannelTopic.account(accountId));
  }

  /** Joins a bulk operation progress channel. Requires the connection to be ready. */
  joinBulk(operationId: string): void {
    this.joinChannel(ChannelTopic.bulk(operationId));
  }

  /** Joins the caller's own user channel. Requires the connection to be ready. */
  joinUser(userId: string): void {
    this.joinChannel(ChannelTopic.user(userId));
  }

  /** Pushes a presence update for the caller on the org channel. */
  updatePresence(update: PresenceUpdate): void {
    if (!this.connection?.isOpen || !this.orgId) return;
    this.connection.send(
      ChannelTopic.org(this.orgId),
      PRESENCE_UPDATE_EVENT,
      buildPresenceUpdate(update),
      false,
      this.orgJoinRef ?? null,
    );
  }

  /** Resolves the token from a provider or the static option. */
  private async resolveToken(): Promise<string | undefined> {
    if (this.tokenProvider) return this.tokenProvider();
    return this.staticToken;
  }

  /** Builds the connection URL with the negotiated version and the token query parameter. */
  private buildSocketUrl(token: string): string {
    return `${this.url}${GATEWAY_SOCKET_PATH}?vsn=${PHOENIX_VSN}&token=${encodeURIComponent(token)}`;
  }

  /** Opens a fresh socket and wires up transport handlers. */
  private async openSocket(): Promise<void> {
    const token = await this.resolveToken();
    if (!token) {
      const error = new GatewayError("No gateway token was provided.", {
        code: GatewayCloseCode.NOT_AUTHENTICATED,
      });
      this.emitter.emit("error", error);
      throw error;
    }
    if (!this.orgId) {
      const error = new GatewayError("No organization id was provided to the gateway.");
      this.emitter.emit("error", error);
      throw error;
    }

    const Ctor = await resolveWebSocket(this.injectedWebSocket);
    this.setState("connecting");
    const socket = new Ctor(this.buildSocketUrl(token));
    this.connection = new Connection(socket, {
      onOpen: () => this.handleOpen(),
      onFrame: (frame) => this.handleFrame(frame),
      onClose: (event) => this.handleClose(event.code, event.reason),
      onError: (error) => this.handleTransportError(error),
    });
  }

  /** Waits until the gateway reaches `ready`, or rejects on a close before that. */
  private waitForReady(): Promise<void> {
    if (this._state === "ready") return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const offReady = this.emitter.on("ready", () => {
        offReady();
        offError();
        offClose();
        resolve();
      });
      const offError = this.emitter.on("error", (error) => {
        // Only reject the initial connect, not transient post-ready errors.
        if (this._state === "ready") return;
        offReady();
        offError();
        offClose();
        reject(error);
      });
      const offClose = this.emitter.on("close", (info) => {
        if (this._state === "ready") return;
        offReady();
        offError();
        offClose();
        reject(
          new GatewayError(describeCloseCode(info.code), {
            code: info.code,
            reason: info.reason,
          }),
        );
      });
    });
  }

  /** On socket open: emit lifecycle, then send the org join. */
  private handleOpen(): void {
    this.setState("open");
    this.emitter.emit("open");
    this.sendOrgJoin();
  }

  /** Sends `phx_join` to the org topic with intents and a resume marker when applicable. */
  private sendOrgJoin(): void {
    if (!this.connection || !this.orgId) return;
    this.setState("identifying");
    const payload: Record<string, unknown> = {};
    if (this.intents) payload.intents = this.intents;
    if (this._latestSeq > 0) payload.resume = { last_seq: this._latestSeq };
    this.orgJoinRef = this.connection.send(ChannelTopic.org(this.orgId), "phx_join", payload, true);
  }

  /** Joins an additional channel with a fresh `phx_join`. */
  private joinChannel(topic: string): void {
    if (!this.connection?.isOpen) {
      this.logger?.warn?.(`Cannot join ${topic}: the gateway is not ready.`);
      return;
    }
    this.connection.send(topic, "phx_join", {}, true);
  }

  /** Routes a decoded frame to the appropriate handler. */
  private handleFrame(frame: PhoenixFrame): void {
    switch (frame.event) {
      case "phx_reply":
        this.handleReply(frame);
        return;
      case "phx_error":
        this.handlePhxError(frame);
        return;
      case "phx_close":
        // The server closed this channel; the socket-level close handler drives reconnect.
        return;
      case "presence_state":
        this.emitter.emit("presence", this.presenceTracker.applyState(frame.payload));
        return;
      case "presence_diff":
        this.emitter.emit("presence", this.presenceTracker.applyDiff(frame.payload));
        return;
      case "resumed":
        this.handleResumed(frame.payload);
        return;
      case "resume_failed":
        this.handleResumeFailed(frame.payload);
        return;
      case "rate_limited":
        this.emitter.emit("rateLimited", frame.payload);
        return;
      case "heartbeat":
        // Server-initiated heartbeats are unused by this client.
        return;
      default:
        this.dispatchEvent(frame);
    }
  }

  /** Handles `phx_reply` frames: the org join reply is HELLO; the phoenix reply clears the watchdog. */
  private handleReply(frame: PhoenixFrame): void {
    if (frame.topic === ChannelTopic.phoenix) {
      // Heartbeat acknowledged; the socket is alive.
      this.heartbeatPending = false;
      return;
    }

    const status = frame.payload.status;
    const response = (frame.payload.response ?? {}) as Record<string, unknown>;

    if (status === "error") {
      this.handleJoinError(response);
      return;
    }

    // The org join reply carries HELLO.
    if (this.orgJoinRef && frame.join_ref === this.orgJoinRef) {
      this.handleHello(response);
    }
  }

  /** Applies the HELLO payload: record seq + heartbeat cadence, start heartbeat, mark ready. */
  private handleHello(response: Record<string, unknown>): void {
    const hello = response as HelloPayload;
    this.hello = hello;
    if (typeof hello.seq === "number" && hello.seq > this._latestSeq) {
      this._latestSeq = hello.seq;
    }
    this.emitter.emit("hello", hello);
    this.startHeartbeat(hello.heartbeat_interval_ms);
    this.reconnectAttempts = 0;
    this.setState("ready");
    this.emitter.emit("ready");
  }

  /** Surfaces a post-join error reply (status "error") as a GatewayError or rate-limit. */
  private handleJoinError(response: Record<string, unknown>): void {
    const reason = typeof response.reason === "string" ? response.reason : undefined;
    if (reason === "rate_limited") {
      this.emitter.emit("rateLimited", response);
      return;
    }
    const code = typeof response.code === "number" ? response.code : undefined;
    this.emitter.emit(
      "error",
      new GatewayError(reason ?? "Channel join was rejected.", { code, reason }),
    );
  }

  /** Handles a `phx_error` frame on a channel. */
  private handlePhxError(frame: PhoenixFrame): void {
    const reason = typeof frame.payload.reason === "string" ? frame.payload.reason : undefined;
    this.emitter.emit("error", new GatewayError(reason ?? "Channel error.", { reason }));
  }

  /** Applies a `resumed` marker: advance seq and emit the lifecycle event. */
  private handleResumed(payload: Record<string, unknown>): void {
    const currentSeq =
      typeof payload.current_seq === "number" ? payload.current_seq : this._latestSeq;
    const outcome: Extract<ResumeOutcome, { ok: true }> = {
      ok: true,
      from: typeof payload.from === "number" ? payload.from : this._latestSeq,
      current_seq: currentSeq,
      replayed: typeof payload.replayed === "number" ? payload.replayed : 0,
    };
    if (currentSeq > this._latestSeq) this._latestSeq = currentSeq;
    this.emitter.emit("resumed", outcome);
  }

  /** Applies a `resume_failed` marker: keep the current seq and emit the lifecycle event. */
  private handleResumeFailed(payload: Record<string, unknown>): void {
    const reason = typeof payload.reason === "string" ? payload.reason : "invalid_resume";
    const currentSeq =
      typeof payload.current_seq === "number" ? payload.current_seq : this._latestSeq;
    const outcome: Extract<ResumeOutcome, { ok: false }> = {
      ok: false,
      reason: reason as Extract<ResumeOutcome, { ok: false }>["reason"],
      current_seq: currentSeq,
    };
    // On resume failure, continue live from current_seq after a REST resync.
    if (currentSeq > this._latestSeq) this._latestSeq = currentSeq;
    this.emitter.emit("resumeFailed", outcome);
  }

  /** Dispatches an application event by name, deduping by seq. */
  private dispatchEvent(frame: PhoenixFrame): void {
    const payload = frame.payload as WarmblyEventMap[keyof WarmblyEventMap];
    const seq = typeof payload.seq === "number" ? payload.seq : undefined;

    // Dedupe: skip events at or below the highest processed seq.
    if (seq !== undefined && seq <= this._latestSeq) return;
    if (seq !== undefined) this._latestSeq = seq;

    const name = frame.event as keyof WarmblyEventMap;
    if (name === WARMBLY_EVENTS.CUSTOM_EVENT) {
      this.emitter.emit(WARMBLY_EVENTS.CUSTOM_EVENT, payload as WarmblyEventMap["CUSTOM_EVENT"]);
      return;
    }
    this.emitter.emit(name, payload as never);
  }

  /** Starts the client heartbeat loop with a watchdog that force-reconnects on a missed reply. */
  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    const interval = intervalMs > 0 ? intervalMs : 25_000;
    this.heartbeatPending = false;
    this.heartbeatTimer = setInterval(() => {
      if (!this.connection?.isOpen) return;
      // If the previous heartbeat was never acknowledged, the socket is silently dead.
      if (this.heartbeatPending) {
        this.logger?.warn?.("Heartbeat timed out; forcing a reconnect.");
        this.connection.close(HEARTBEAT_TIMEOUT_CLOSE_CODE, "heartbeat timeout");
        return;
      }
      this.heartbeatPending = true;
      this.connection.send(ChannelTopic.phoenix, "heartbeat", {});
    }, interval);
  }

  /** Stops the heartbeat loop and clears the pending flag. */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.heartbeatPending = false;
  }

  /** Handles a transport-level error: surface it; the close handler drives reconnect. */
  private handleTransportError(error: Error): void {
    this.logger?.error?.("Gateway transport error.", error);
    this.emitter.emit("error", error);
  }

  /** Handles a socket close: emit lifecycle, surface rejection codes, then reconnect if appropriate. */
  private handleClose(code: number | undefined, reason: string | undefined): void {
    this.stopHeartbeat();
    this.presenceTracker.reset();
    const info: CloseInfo = {};
    if (code !== undefined) info.code = code;
    if (reason !== undefined) info.reason = reason;
    this.emitter.emit("close", info);

    if (isRejectionCloseCode(code)) {
      this.emitter.emit("error", new GatewayError(describeCloseCode(code), { code, reason }));
    }

    if (this.deliberatelyClosed || !this.autoReconnect) {
      this.setState("closed");
      return;
    }

    // A permission-denied or connection-limit close will not succeed on a blind retry.
    if (code === GatewayCloseCode.PERMISSION_DENIED || code === GatewayCloseCode.CONNECTION_LIMIT) {
      this.setState("closed");
      return;
    }

    this.scheduleReconnect();
  }

  /** Schedules a reconnect with exponential backoff and jitter, capped at the configured max. */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.setState("reconnecting");
    this.reconnectAttempts += 1;
    const delayMs = fullJitterBackoff(this.reconnectAttempts - 1, 500, this.maxReconnectDelayMs);
    const info: ReconnectingInfo = { attempt: this.reconnectAttempts, delayMs };
    this.emitter.emit("reconnecting", info);
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect();
    }, delayMs);
  }

  /** Performs a reconnect, re-joining the org channel with a resume marker. */
  private async reconnect(): Promise<void> {
    if (this.deliberatelyClosed) return;
    try {
      await this.openSocket();
    } catch (error) {
      this.logger?.error?.("Gateway reconnect failed.", error);
      // openSocket already emitted the error; back off and try again.
      if (!this.deliberatelyClosed && this.autoReconnect) this.scheduleReconnect();
    }
  }

  /** Clears any pending reconnect timer. */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /** Transitions to a new state and logs the change. */
  private setState(next: GatewayState): void {
    if (this._state === next) return;
    this._state = next;
    this.logger?.debug?.(`Gateway state -> ${next}`);
  }
}

/** Removes any trailing slashes from a URL. */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
