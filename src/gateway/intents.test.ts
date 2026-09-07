import { describe, expect, it } from "vitest";
import { ALL_INTENTS, GatewayIntents, matchesIntents, normalizeIntents } from "./intents";

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
});
