/**
 * The typed event map for the realtime gateway. Every event name from the contract maps
 * to a payload interface extending {@link GatewayEventBase}. Payloads are intentionally
 * permissive: the documented fields are typed and an index signature keeps them open, so
 * unmodeled fields stay reachable. Treat payloads as invalidation signals (ids, not full
 * state) and refetch over REST when you need the latest data.
 */

import type { HelloPayload, PresenceState, ResumeOutcome } from "./types";

/**
 * Fields present on every dispatched gateway event payload.
 *
 * @example
 * gw.onAny((name, payload) => console.log(name, payload.event_type, payload.seq));
 */
export interface GatewayEventBase {
  /** The event type, identical to the dispatch event name (e.g. `"EMAIL_SENT"`). */
  event_type: string;
  /** ISO-8601 timestamp of when the event occurred. */
  timestamp: string;
  /** The monotonic per-org sequence number, used for dedupe and resume. */
  seq?: number;
  [key: string]: unknown;
}

/** A campaign lifecycle event. */
export interface CampaignEvent extends GatewayEventBase {
  /** The affected campaign's id. */
  campaign_id?: string;
}

/** An email or message event. */
export interface EmailEvent extends GatewayEventBase {
  /** The affected email/message id. */
  email_id?: string;
  /** The campaign the email belongs to, when applicable. */
  campaign_id?: string;
  /** The contact the email relates to, when applicable. */
  contact_id?: string;
  /** The email account the message was sent from or received on, when applicable. */
  account_id?: string;
  /** The conversation thread id, when applicable. */
  thread_id?: string;
}

/** An email account (mailbox) connection or health event. */
export interface AccountEvent extends GatewayEventBase {
  /** The affected account's id. */
  account_id?: string;
}

/** A contact create/update/delete event. */
export interface ContactEvent extends GatewayEventBase {
  /** The affected contact's id. */
  contact_id?: string;
}

/** A signal that the contact list should be reloaded wholesale. */
export interface ContactsReloadEvent extends GatewayEventBase {
  event_type: "CONTACTS_RELOAD";
}

/** A bulk operation lifecycle or progress event. */
export interface BulkEvent extends GatewayEventBase {
  /** The bulk operation's id. */
  operation_id?: string;
  /** Items processed so far, when reported. */
  processed?: number;
  /** Total items in the operation, when reported. */
  total?: number;
}

/** A generic task progress event for long-running work. */
export interface TaskProgressEvent extends GatewayEventBase {
  event_type: "TASK_PROGRESS";
  /** The task id. */
  task_id?: string;
  /** Completion percentage in the range 0..100, when reported. */
  progress?: number;
  /** A human-readable status, when reported. */
  status?: string;
}

/** An automation lifecycle or run event. */
export interface AutomationEvent extends GatewayEventBase {
  /** The affected automation's id. */
  automation_id?: string;
}

/** An audit-log entry created event. */
export interface AuditEvent extends GatewayEventBase {
  event_type: "AUDIT_CREATED";
  /** The audit-log entry id. */
  audit_id?: string;
  /** The action that was recorded. */
  action?: string;
}

/** A meeting/booking lifecycle event delivered on the user channel. */
export interface MeetingEvent extends GatewayEventBase {
  /** The affected meeting's id. */
  meeting_id?: string;
  /** The contact the meeting is with, when applicable. */
  contact_id?: string;
}

/** A notification created event delivered on the user channel. */
export interface NotificationEvent extends GatewayEventBase {
  event_type: "NOTIFICATION_CREATED";
  /** The notification id. */
  notification_id?: string;
}

/**
 * A custom event emitted by an integration or automation. The `payload` field carries the
 * integration-defined body.
 *
 * @example
 * gw.on("CUSTOM_EVENT", (e) => console.log(e.name, e.payload, e.source));
 */
export interface CustomEvent extends GatewayEventBase {
  event_type: "CUSTOM_EVENT";
  /** The custom event name, defined by the producer. */
  name: string;
  /** The custom payload body. */
  payload: Record<string, unknown>;
  /** The producing system, when provided. */
  source?: string;
  /** An id within the producing system, when provided. */
  source_id?: string;
  /** The organization the event belongs to, when provided. */
  org_id?: string;
}

/**
 * Maps every dispatchable gateway event name to its payload type. Use it to type
 * `gw.on(name, cb)` handlers.
 *
 * @example
 * gw.on("EMAIL_OPENED", (e) => console.log(e.campaign_id));
 */
export interface WarmblyEventMap {
  CAMPAIGN_CREATED: CampaignEvent;
  CAMPAIGN_UPDATED: CampaignEvent;
  CAMPAIGN_DELETED: CampaignEvent;
  CAMPAIGN_STARTED: CampaignEvent;
  CAMPAIGN_PAUSED: CampaignEvent;
  CAMPAIGN_COMPLETED: CampaignEvent;

  EMAIL_SENT: EmailEvent;
  EMAIL_OPENED: EmailEvent;
  EMAIL_CLICKED: EmailEvent;
  EMAIL_REPLIED: EmailEvent;
  EMAIL_RECEIVED: EmailEvent;
  EMAIL_BOUNCED: EmailEvent;
  EMAIL_UPDATED: EmailEvent;
  EMAIL_DELETED: EmailEvent;

  ACCOUNT_CONNECTED: AccountEvent;
  ACCOUNT_DISCONNECTED: AccountEvent;
  ACCOUNT_ERROR: AccountEvent;
  ACCOUNT_SYNCED: AccountEvent;
  ACCOUNT_HEALTH_CHANGED: AccountEvent;

  CONTACT_CREATED: ContactEvent;
  CONTACT_UPDATED: ContactEvent;
  CONTACT_DELETED: ContactEvent;
  CONTACTS_RELOAD: ContactsReloadEvent;

  BULK_STARTED: BulkEvent;
  BULK_PROGRESS: BulkEvent;
  BULK_COMPLETED: BulkEvent;
  BULK_FAILED: BulkEvent;
  TASK_PROGRESS: TaskProgressEvent;

  AUTOMATION_CREATED: AutomationEvent;
  AUTOMATION_UPDATED: AutomationEvent;
  AUTOMATION_DELETED: AutomationEvent;
  AUTOMATION_RUN: AutomationEvent;

  AUDIT_CREATED: AuditEvent;

  MEETING_BOOKED: MeetingEvent;
  MEETING_RESCHEDULED: MeetingEvent;
  MEETING_CANCELED: MeetingEvent;

  NOTIFICATION_CREATED: NotificationEvent;

  CUSTOM_EVENT: CustomEvent;
}

/** A dispatchable event name. */
export type WarmblyEventName = keyof WarmblyEventMap;

/**
 * A const map of every event name to itself, for autocomplete and refactor-safe references.
 *
 * @example
 * gw.on(WARMBLY_EVENTS.EMAIL_SENT, (e) => console.log(e.email_id));
 */
export const WARMBLY_EVENTS = {
  CAMPAIGN_CREATED: "CAMPAIGN_CREATED",
  CAMPAIGN_UPDATED: "CAMPAIGN_UPDATED",
  CAMPAIGN_DELETED: "CAMPAIGN_DELETED",
  CAMPAIGN_STARTED: "CAMPAIGN_STARTED",
  CAMPAIGN_PAUSED: "CAMPAIGN_PAUSED",
  CAMPAIGN_COMPLETED: "CAMPAIGN_COMPLETED",

  EMAIL_SENT: "EMAIL_SENT",
  EMAIL_OPENED: "EMAIL_OPENED",
  EMAIL_CLICKED: "EMAIL_CLICKED",
  EMAIL_REPLIED: "EMAIL_REPLIED",
  EMAIL_RECEIVED: "EMAIL_RECEIVED",
  EMAIL_BOUNCED: "EMAIL_BOUNCED",
  EMAIL_UPDATED: "EMAIL_UPDATED",
  EMAIL_DELETED: "EMAIL_DELETED",

  ACCOUNT_CONNECTED: "ACCOUNT_CONNECTED",
  ACCOUNT_DISCONNECTED: "ACCOUNT_DISCONNECTED",
  ACCOUNT_ERROR: "ACCOUNT_ERROR",
  ACCOUNT_SYNCED: "ACCOUNT_SYNCED",
  ACCOUNT_HEALTH_CHANGED: "ACCOUNT_HEALTH_CHANGED",

  CONTACT_CREATED: "CONTACT_CREATED",
  CONTACT_UPDATED: "CONTACT_UPDATED",
  CONTACT_DELETED: "CONTACT_DELETED",
  CONTACTS_RELOAD: "CONTACTS_RELOAD",

  BULK_STARTED: "BULK_STARTED",
  BULK_PROGRESS: "BULK_PROGRESS",
  BULK_COMPLETED: "BULK_COMPLETED",
  BULK_FAILED: "BULK_FAILED",
  TASK_PROGRESS: "TASK_PROGRESS",

  AUTOMATION_CREATED: "AUTOMATION_CREATED",
  AUTOMATION_UPDATED: "AUTOMATION_UPDATED",
  AUTOMATION_DELETED: "AUTOMATION_DELETED",
  AUTOMATION_RUN: "AUTOMATION_RUN",

  AUDIT_CREATED: "AUDIT_CREATED",

  MEETING_BOOKED: "MEETING_BOOKED",
  MEETING_RESCHEDULED: "MEETING_RESCHEDULED",
  MEETING_CANCELED: "MEETING_CANCELED",

  NOTIFICATION_CREATED: "NOTIFICATION_CREATED",

  CUSTOM_EVENT: "CUSTOM_EVENT",
} as const satisfies Record<WarmblyEventName, WarmblyEventName>;

/** Payload for the `reconnecting` lifecycle event. */
export interface ReconnectingInfo {
  /** The 1-based reconnect attempt number. */
  attempt: number;
  /** The delay before this attempt, in milliseconds. */
  delayMs: number;
}

/** Payload for the `close` lifecycle event. */
export interface CloseInfo {
  /** The WebSocket close code, when known. */
  code?: number;
  /** The close reason, when known. */
  reason?: string;
}

/**
 * Maps the gateway lifecycle event names to their payload types. These are emitted on the
 * same emitter as data events but live in a separate namespace.
 *
 * @example
 * gw.on("reconnecting", ({ attempt, delayMs }) => console.log(attempt, delayMs));
 * gw.on("error", (err) => console.error(err.message));
 */
export interface GatewayLifecycleMap {
  /** The socket has opened, before the org join. */
  open: void;
  /** The org join reply (HELLO) was received. */
  hello: HelloPayload;
  /** The gateway is fully ready: joined, HELLO received, heartbeat running. */
  ready: void;
  /** A reconnect resume succeeded and the missed window was replayed. */
  resumed: Extract<ResumeOutcome, { ok: true }>;
  /** A reconnect resume failed; a REST resync is recommended. */
  resumeFailed: Extract<ResumeOutcome, { ok: false }>;
  /** A reconnect attempt is about to be made. */
  reconnecting: ReconnectingInfo;
  /** The socket has closed (clean or otherwise). */
  close: CloseInfo;
  /** An error occurred (connection rejection, decode failure, etc.). */
  error: Error;
  /** A server `rate_limited` push was received. */
  rateLimited: Record<string, unknown>;
  /** The presence map changed (after a `presence_state` or `presence_diff`). */
  presence: PresenceState;
}

/** A lifecycle event name. */
export type GatewayLifecycleName = keyof GatewayLifecycleMap;
