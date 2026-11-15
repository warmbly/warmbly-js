/**
 * Public surface of the realtime gateway pillar. The orchestrator's `warmbly.gateway(opts)`
 * factory constructs a {@link Gateway} with the client's gateway URL, token provider, and
 * organization id injected through {@link GatewayOptions}.
 *
 * @example
 * import { Gateway, GatewayIntents } from "warmbly";
 * const gw = new Gateway({ orgId: "org_1", token: "wmbly_...", intents: [GatewayIntents.EMAIL] });
 * gw.on("EMAIL_SENT", (e) => console.log(e.email_id));
 * await gw.connect();
 */

export type { ConnectionHandlers, PhoenixFrame } from "./connection";
export { Connection, decodeFrame, encodeFrame } from "./connection";
// Types.
export type { AnyListener, Listener, Unsubscribe } from "./emitter";
export { TypedEmitter } from "./emitter";
export type {
  AccountEvent,
  AccountSyncStateEvent,
  AIDraftReadyEvent,
  AIResearchEvent,
  AuditEvent,
  AutomationEvent,
  BulkEvent,
  CampaignEvent,
  CloseInfo,
  ContactEvent,
  ContactImportEvent,
  ContactsReloadEvent,
  CRMSyncedEvent,
  CreditsChangedEvent,
  CreditsLowEvent,
  CustomEvent,
  DirectEmailEvent,
  EmailEvent,
  FormSubmissionEvent,
  GatewayEventBase,
  GatewayLifecycleMap,
  GatewayLifecycleName,
  MailboxImportEvent,
  MeetingEvent,
  NotificationEvent,
  PageHitEvent,
  PlacementTestEvent,
  RateLimitedInfo,
  ReconnectingInfo,
  TaskProgressEvent,
  WarmblyEventMap,
  WarmblyEventName,
  WarmupActivityEvent,
  WarmupPlacementEvent,
} from "./events";
export { WARMBLY_EVENTS } from "./events";
// Values.
export { Gateway } from "./gateway";
export type { EventScopeRequirement, GatewayIntent } from "./intents";
export {
  ALL_INTENTS,
  credentialReceivesEvent,
  GatewayIntents,
  matchesIntents,
  normalizeIntents,
  requiredScopeForEvent,
} from "./intents";
export {
  buildPresenceUpdate,
  PRESENCE_UPDATE_EVENT,
  PresenceTracker,
} from "./presence";
export type {
  GatewayLogger,
  GatewayOptions,
  GatewayState,
  GatewayTokenProvider,
  GatewayTokenTransport,
  HelloPayload,
  ParsedChannelTopic,
  PresenceAction,
  PresenceDiff,
  PresenceEntry,
  PresenceMeta,
  PresenceState,
  PresenceUpdate,
  ResumeOutcome,
  WebSocketCloseEvent,
  WebSocketCtor,
  WebSocketEventName,
  WebSocketInit,
  WebSocketLike,
  WebSocketMessageEvent,
} from "./types";
export {
  ChannelTopic,
  describeCloseCode,
  GATEWAY_TOKEN_HEADER,
  GatewayCloseCode,
  HEARTBEAT_TIMEOUT_CLOSE_CODE,
  isRejectionCloseCode,
  parseChannelTopic,
  WS_READY_STATE,
} from "./types";
export { resolveWebSocket } from "./websocket";
