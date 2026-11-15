/**
 * Gateway intents: coarse event families passed at join time to trim the event stream.
 * The server treats an intent as a case-insensitive substring family over the event type
 * (`CAMPAIGN` matches `CAMPAIGN_*`, `EMAIL` matches `EMAIL_SENT/OPENED/...`, and so on).
 * Intents are a traffic filter, not a security boundary.
 */

import type { PermissionName } from "../permissions";
import { PERMISSIONS } from "../permissions";
import type { WarmblyEventName } from "./events";

/**
 * The known intent families. Pass any subset to {@link GatewayOptions.intents}; an empty or
 * absent list means the full stream.
 *
 * @example
 * const gw = new Gateway({ orgId: "org_1", intents: [GatewayIntents.EMAIL, GatewayIntents.CAMPAIGN] });
 */
export const GatewayIntents = {
  /** Audit-log events (`AUDIT_CREATED`). */
  AUDIT: "AUDIT",
  /** Campaign lifecycle events (`CAMPAIGN_*`). */
  CAMPAIGN: "CAMPAIGN",
  /** Email/message events (`EMAIL_*`, and `DIRECT_EMAIL_*` by substring). */
  EMAIL: "EMAIL",
  /** Contact events (`CONTACT_*`, `CONTACTS_RELOAD`, including `CONTACT_IMPORT_PROGRESS`). */
  CONTACT: "CONTACT",
  /** Hosted form events (`FORM_SUBMISSION_CREATED`). */
  FORM: "FORM",
  /** Website tracking events (`PAGE_HIT`). */
  PAGE: "PAGE",
  /** Email account events (`ACCOUNT_*`, including `ACCOUNT_SYNC_STATE`). */
  ACCOUNT: "ACCOUNT",
  /** Bulk operation events (`BULK_*`, `TASK_PROGRESS`). */
  BULK: "BULK",
  /** Automation events (`AUTOMATION_*`). */
  AUTOMATION: "AUTOMATION",
  /** Meeting/booking events (`MEETING_*`). */
  MEETING: "MEETING",
  /** Notification events (`NOTIFICATION_CREATED`). */
  NOTIFICATION: "NOTIFICATION",
  /** Custom integration events (`CUSTOM_EVENT`). */
  CUSTOM: "CUSTOM",
  /** AI events (`AI_DRAFT_READY`, `AI_RESEARCH_PROGRESS`). */
  AI: "AI",
  /** AI contact-research progress (`AI_RESEARCH_PROGRESS`). */
  RESEARCH: "RESEARCH",
  /** Warmup events (`WARMUP_PLACEMENT`, `WARMUP_ACTIVITY`). */
  WARMUP: "WARMUP",
  /** Inbox placement test events (`PLACEMENT_TEST_UPDATED`). */
  PLACEMENT: "PLACEMENT",
  /** Mailbox import progress (`MAILBOX_IMPORT_PROGRESS`). */
  MAILBOX: "MAILBOX",
  /** Mailbox and contact import progress (`MAILBOX_IMPORT_PROGRESS`, `CONTACT_IMPORT_PROGRESS`). */
  IMPORT: "IMPORT",
  /** Mirrored CRM changes (`CRM_SYNCED`). */
  CRM: "CRM",
  /** Direct (non-campaign) email tracking (`DIRECT_EMAIL_OPENED`, `DIRECT_EMAIL_CLICKED`). */
  DIRECT: "DIRECT",
  /** Billing and AI-credit events (`BILLING_CREDITS_LOW`, `BILLING_CREDITS_CHANGED`). */
  BILLING: "BILLING",
} as const;

/** A known intent family name. */
export type GatewayIntent = (typeof GatewayIntents)[keyof typeof GatewayIntents];

/** Every known intent family, in declaration order. */
export const ALL_INTENTS: GatewayIntent[] = Object.values(GatewayIntents);

/**
 * Normalizes a list of intents: trims, uppercases, and drops empties and duplicates.
 * Returns `undefined` when nothing remains, which the server reads as the full stream.
 *
 * @example
 * normalizeIntents([" email ", "Email", ""]); // ["EMAIL"]
 */
export function normalizeIntents(intents?: string[]): string[] | undefined {
  if (!intents || intents.length === 0) return undefined;
  const seen = new Set<string>();
  for (const raw of intents) {
    const value = raw.trim().toUpperCase();
    if (value) seen.add(value);
  }
  return seen.size > 0 ? [...seen] : undefined;
}

/**
 * Mirrors the server filter: whether an event type matches at least one intent. With no
 * intents, every event matches. Useful for client-side reasoning and tests.
 *
 * @example
 * matchesIntents("EMAIL_SENT", ["EMAIL"]); // true
 * matchesIntents("CAMPAIGN_STARTED", ["EMAIL"]); // false
 */
export function matchesIntents(eventType: WarmblyEventName | string, intents?: string[]): boolean {
  const normalized = normalizeIntents(intents);
  if (!normalized) return true;
  const upper = eventType.toUpperCase();
  return normalized.some((intent) => upper.includes(intent));
}

/**
 * What a credential needs to receive an event: an API permission, `null` when the org
 * channel applies no gate, or `"never"` when the event needs a member permission (team,
 * billing, settings) that no API key or OAuth token can carry.
 */
export type EventScopeRequirement = PermissionName | null | "never";

/**
 * Mirrors the realtime service's per-event permission gate for an API key or OAuth token.
 * The server maps each credential scope to the member permission it unlocks
 * (`READ_EMAILS` to `manage_emails`, `READ_CAMPAIGNS` to `view_campaigns`, `READ_CONTACTS`
 * to `view_contacts`, `READ_UNIBOX` to `access_unibox`, `READ_ANALYTICS` to
 * `view_analytics`) and gates event families on those. The rules are checked in server
 * order, so the first match wins. Unknown events are ungated (`null`), as on the server.
 *
 * @example
 * requiredScopeForEvent("PLACEMENT_TEST_UPDATED"); // "READ_ANALYTICS"
 * requiredScopeForEvent("BILLING_CREDITS_LOW"); // "never"
 * requiredScopeForEvent("CUSTOM_EVENT"); // null
 */
export function requiredScopeForEvent(eventType: WarmblyEventName | string): EventScopeRequirement {
  const t = eventType.toUpperCase();
  const has = (...parts: string[]) => parts.some((p) => t.includes(p));
  const inbox =
    has("INBOX", "AI_DRAFT") || ["EMAIL_RECEIVED", "EMAIL_UPDATED", "EMAIL_DELETED"].includes(t);

  if (has("SUBSCRIPTION", "BILLING", "MEMBER", "INVITATION", "SETTINGS")) return "never";
  if (inbox) return "READ_UNIBOX";
  if (has("DIRECT_EMAIL_", "PLACEMENT_TEST")) return "READ_ANALYTICS";
  if (
    has("CAMPAIGN", "TASK_PROGRESS") ||
    ["EMAIL_SENT", "EMAIL_OPENED", "EMAIL_CLICKED", "EMAIL_REPLIED", "EMAIL_BOUNCED"].includes(t)
  ) {
    return "READ_CAMPAIGNS";
  }
  if (has("CONTACT", "PAGE_HIT", "FORM", "RESEARCH")) return "READ_CONTACTS";
  if (has("ACCOUNT", "WARMUP", "MAILBOX_IMPORT")) return "READ_EMAILS";
  return null;
}

/**
 * Whether a credential holding the given permission mask is allowed to receive an event,
 * per {@link requiredScopeForEvent}. A client-side hint: the server is authoritative, and
 * a member restricted to selected resources is filtered further by their grants.
 *
 * @example
 * credentialReceivesEvent("CRM_SYNCED", 0); // true (no gate)
 * credentialReceivesEvent("EMAIL_OPENED", PERMISSIONS.READ_EMAILS); // false
 */
export function credentialReceivesEvent(
  eventType: WarmblyEventName | string,
  permissionMask: number,
): boolean {
  const need = requiredScopeForEvent(eventType);
  if (need === null) return true;
  if (need === "never") return false;
  return (permissionMask & PERMISSIONS[need]) !== 0;
}
