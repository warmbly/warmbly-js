import { describe, expect, it } from "vitest";
import { WARMBLY_EVENTS } from "./events";

describe("WARMBLY_EVENTS", () => {
  it("maps every event name to itself", () => {
    for (const [key, value] of Object.entries(WARMBLY_EVENTS)) {
      expect(value).toBe(key);
    }
  });

  it("includes the documented event families and CUSTOM_EVENT", () => {
    const names = Object.keys(WARMBLY_EVENTS);
    expect(names).toContain("CAMPAIGN_STARTED");
    expect(names).toContain("EMAIL_OPENED");
    expect(names).toContain("ACCOUNT_HEALTH_CHANGED");
    expect(names).toContain("CONTACTS_RELOAD");
    expect(names).toContain("BULK_PROGRESS");
    expect(names).toContain("TASK_PROGRESS");
    expect(names).toContain("AUTOMATION_RUN");
    expect(names).toContain("AUDIT_CREATED");
    expect(names).toContain("MEETING_BOOKED");
    expect(names).toContain("NOTIFICATION_CREATED");
    expect(names).toContain("CUSTOM_EVENT");
  });

  it("includes the AI and billing event families", () => {
    const names = Object.keys(WARMBLY_EVENTS);
    expect(names).toContain("AI_DRAFT_READY");
    expect(names).toContain("AI_RESEARCH_PROGRESS");
    expect(names).toContain("BILLING_CREDITS_LOW");
    expect(names).toContain("BILLING_CREDITS_CHANGED");
  });
});
