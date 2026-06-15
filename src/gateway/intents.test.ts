import { describe, expect, it } from "vitest";
import { ALL_INTENTS, GatewayIntents, matchesIntents, normalizeIntents } from "./intents";

describe("intents", () => {
  it("exposes every documented intent family", () => {
    expect(ALL_INTENTS).toEqual([
      "AUDIT",
      "CAMPAIGN",
      "EMAIL",
      "CONTACT",
      "ACCOUNT",
      "BULK",
      "AUTOMATION",
      "MEETING",
      "NOTIFICATION",
      "CUSTOM",
    ]);
    expect(GatewayIntents.EMAIL).toBe("EMAIL");
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
