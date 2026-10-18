/**
 * Gateway intents: coarse event families passed at join time to trim the event stream.
 * The server treats an intent as a case-insensitive substring family over the event type
 * (`CAMPAIGN` matches `CAMPAIGN_*`, `EMAIL` matches `EMAIL_SENT/OPENED/...`, and so on).
 * Intents are a traffic filter, not a security boundary.
 */

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
  /** Email/message events (`EMAIL_*`, which also matches `DIRECT_EMAIL_*`). */
  EMAIL: "EMAIL",
  /** Contact events (`CONTACT_*`, including `CONTACT_IMPORT_PROGRESS`, and `CONTACTS_RELOAD`). */
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
  /** Warmup events (`WARMUP_PLACEMENT`). */
  WARMUP: "WARMUP",
  /** Inbox placement test events (`PLACEMENT_TEST_UPDATED`, also matches `WARMUP_PLACEMENT`). */
  PLACEMENT: "PLACEMENT",
  /** Hand-written mail tracking events (`DIRECT_EMAIL_OPENED`, `DIRECT_EMAIL_CLICKED`). */
  DIRECT: "DIRECT",
  /** Import progress events (`MAILBOX_IMPORT_PROGRESS`, `CONTACT_IMPORT_PROGRESS`). */
  IMPORT: "IMPORT",
  /** Billing and AI-credit events (`BILLING_CREDITS_LOW`, `BILLING_CREDITS_CHANGED`). */
  BILLING: "BILLING",
  /** Connected CRM sync events (`CRM_SYNCED`). */
  CRM: "CRM",
} as const;

/** A known intent family name. */
export type GatewayIntent = (typeof GatewayIntents)[keyof typeof GatewayIntents];

/** Every known intent family, in declaration order. */
export const ALL_INTENTS: GatewayIntent[] = Object.values(GatewayIntents);

/**
 * Normalizes a list of intents: trims, uppercases, turns `.`, `:`, `-` and spaces into `_` like the
 * server does, and drops empties and duplicates.
 * Returns `undefined` when nothing remains, which the server reads as the full stream.
 *
 * @example
 * normalizeIntents([" email ", "Email", ""]); // ["EMAIL"]
 */
export function normalizeIntents(intents?: string[]): string[] | undefined {
  if (!intents || intents.length === 0) return undefined;
  const seen = new Set<string>();
  for (const raw of intents) {
    const value = raw
      .trim()
      .toUpperCase()
      .replace(/[.:\s-]+/g, "_");
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
