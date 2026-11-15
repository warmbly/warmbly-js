import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "../permissions";
import {
  ALL_INTENTS,
  credentialReceivesEvent,
  GatewayIntents,
  matchesIntents,
  normalizeIntents,
  requiredScopeForEvent,
} from "./intents";

describe("intents", () => {
  it("exposes every documented intent family", () => {
    expect(ALL_INTENTS).toEqual([
      "AUDIT",
      "CAMPAIGN",
      "EMAIL",
      "CONTACT",
      "FORM",
      "PAGE",
      "ACCOUNT",
      "BULK",
      "AUTOMATION",
      "MEETING",
      "NOTIFICATION",
      "CUSTOM",
      "AI",
      "RESEARCH",
      "WARMUP",
      "PLACEMENT",
      "MAILBOX",
      "IMPORT",
      "CRM",
      "DIRECT",
      "BILLING",
    ]);
    expect(GatewayIntents.EMAIL).toBe("EMAIL");
  });

  it("matches the AI, research, and billing events with their intents", () => {
    expect(matchesIntents("AI_DRAFT_READY", ["AI"])).toBe(true);
    expect(matchesIntents("AI_RESEARCH_PROGRESS", ["RESEARCH"])).toBe(true);
    expect(matchesIntents("BILLING_CREDITS_LOW", ["BILLING"])).toBe(true);
    expect(matchesIntents("EMAIL_SENT", ["BILLING"])).toBe(false);
  });

  it("matches the form, page-hit, sync-state, and idle events with their intents", () => {
    expect(matchesIntents("FORM_SUBMISSION_CREATED", ["FORM"])).toBe(true);
    expect(matchesIntents("PAGE_HIT", ["PAGE"])).toBe(true);
    expect(matchesIntents("ACCOUNT_SYNC_STATE", ["ACCOUNT"])).toBe(true);
    expect(matchesIntents("CAMPAIGN_IDLE", ["CAMPAIGN"])).toBe(true);
    expect(matchesIntents("PAGE_HIT", ["FORM"])).toBe(false);
  });

  it("matches the warmup, placement, import, CRM and direct-email events with their intents", () => {
    expect(matchesIntents("WARMUP_PLACEMENT", ["WARMUP"])).toBe(true);
    expect(matchesIntents("WARMUP_ACTIVITY", ["WARMUP"])).toBe(true);
    expect(matchesIntents("PLACEMENT_TEST_UPDATED", ["PLACEMENT"])).toBe(true);
    expect(matchesIntents("MAILBOX_IMPORT_PROGRESS", ["MAILBOX"])).toBe(true);
    expect(matchesIntents("MAILBOX_IMPORT_PROGRESS", ["IMPORT"])).toBe(true);
    expect(matchesIntents("CONTACT_IMPORT_PROGRESS", ["IMPORT"])).toBe(true);
    expect(matchesIntents("CONTACT_IMPORT_PROGRESS", ["CONTACT"])).toBe(true);
    expect(matchesIntents("CRM_SYNCED", ["CRM"])).toBe(true);
    expect(matchesIntents("DIRECT_EMAIL_OPENED", ["DIRECT"])).toBe(true);
    expect(matchesIntents("DIRECT_EMAIL_CLICKED", ["EMAIL"])).toBe(true);
    expect(matchesIntents("WARMUP_ACTIVITY", ["ACCOUNT"])).toBe(false);
  });

  it("normalizes by trimming, uppercasing, and deduping", () => {
    expect(normalizeIntents([" email ", "Email", "campaign"])).toEqual(["EMAIL", "CAMPAIGN"]);
  });

  it("returns undefined for empty or all-blank input (full stream)", () => {
    expect(normalizeIntents()).toBeUndefined();
    expect(normalizeIntents([])).toBeUndefined();
    expect(normalizeIntents(["  ", ""])).toBeUndefined();
  });

  it("matches events as case-insensitive substring families", () => {
    expect(matchesIntents("EMAIL_SENT", ["EMAIL"])).toBe(true);
    expect(matchesIntents("CAMPAIGN_STARTED", ["EMAIL"])).toBe(false);
    expect(matchesIntents("CONTACTS_RELOAD", ["CONTACT"])).toBe(true);
  });

  it("matches every event when no intents are given", () => {
    expect(matchesIntents("AUDIT_CREATED")).toBe(true);
    expect(matchesIntents("ANYTHING", [])).toBe(true);
  });

  it("maps events to the credential scope the server gates them on", () => {
    expect(requiredScopeForEvent("PLACEMENT_TEST_UPDATED")).toBe("READ_ANALYTICS");
    expect(requiredScopeForEvent("DIRECT_EMAIL_OPENED")).toBe("READ_ANALYTICS");
    expect(requiredScopeForEvent("EMAIL_RECEIVED")).toBe("READ_UNIBOX");
    expect(requiredScopeForEvent("AI_DRAFT_READY")).toBe("READ_UNIBOX");
    expect(requiredScopeForEvent("EMAIL_OPENED")).toBe("READ_CAMPAIGNS");
    expect(requiredScopeForEvent("TASK_PROGRESS")).toBe("READ_CAMPAIGNS");
    expect(requiredScopeForEvent("CONTACT_IMPORT_PROGRESS")).toBe("READ_CONTACTS");
    expect(requiredScopeForEvent("PAGE_HIT")).toBe("READ_CONTACTS");
    expect(requiredScopeForEvent("FORM_SUBMISSION_CREATED")).toBe("READ_CONTACTS");
    expect(requiredScopeForEvent("AI_RESEARCH_PROGRESS")).toBe("READ_CONTACTS");
    expect(requiredScopeForEvent("WARMUP_ACTIVITY")).toBe("READ_EMAILS");
    expect(requiredScopeForEvent("MAILBOX_IMPORT_PROGRESS")).toBe("READ_EMAILS");
    expect(requiredScopeForEvent("ACCOUNT_SYNC_STATE")).toBe("READ_EMAILS");
    expect(requiredScopeForEvent("BILLING_CREDITS_CHANGED")).toBe("never");
    expect(requiredScopeForEvent("CRM_SYNCED")).toBeNull();
    expect(requiredScopeForEvent("CUSTOM_EVENT")).toBeNull();
    expect(requiredScopeForEvent("SOMETHING_NEW")).toBeNull();
  });

  it("decides whether a permission mask receives an event", () => {
    expect(credentialReceivesEvent("CRM_SYNCED", 0)).toBe(true);
    expect(credentialReceivesEvent("EMAIL_OPENED", PERMISSIONS.READ_EMAILS)).toBe(false);
    expect(credentialReceivesEvent("EMAIL_OPENED", PERMISSIONS.READ_CAMPAIGNS)).toBe(true);
    expect(credentialReceivesEvent("BILLING_CREDITS_LOW", 0xffffff)).toBe(false);
  });
});
