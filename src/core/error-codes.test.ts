import { describe, expect, it } from "vitest";
import { ERROR_CODES, MAIL_ERROR_CODES, SEND_ADMISSION_CODES } from "./error-codes";
import { WarmblyAPIError } from "./errors";

describe("ERROR_CODES", () => {
  it("maps every key to its lowercase snake_case value", () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key.toLowerCase());
      expect(value).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  it("keeps the codes the SDK already named", () => {
    expect(ERROR_CODES.LIST_BOUNCE_RISK).toBe("list_bounce_risk");
    expect(ERROR_CODES.SSO_WRONG_BROWSER).toBe("sso_wrong_browser");
    expect(ERROR_CODES.MAILBOX_ALLOWANCE_REACHED).toBe("mailbox_allowance_reached");
  });

  it("names the codes added since the last sync", () => {
    expect(ERROR_CODES.API_KEY_PERMISSIONS_EXCEED_CALLER).toBe("api_key_permissions_exceed_caller");
    expect(ERROR_CODES.OAUTH_TOKEN_NOT_ALLOWED).toBe("oauth_token_not_allowed");
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe("rate_limit_exceeded");
    expect(ERROR_CODES.USAGE_CAP_EXCEEDED).toBe("usage_cap_exceeded");
    expect(ERROR_CODES.PLACEMENT_QUOTA_EXCEEDED).toBe("placement_quota_exceeded");
    expect(ERROR_CODES.DUPLICATE_QUERY_PARAMETER).toBe("duplicate_query_parameter");
    expect(ERROR_CODES.MEMBER_ACCESS_RESTRICTED).toBe("member_access_restricted");
    expect(ERROR_CODES.SEND_HOLD_NOT_FOUND).toBe("send_hold_not_found");
    expect(ERROR_CODES.REAUTH_REQUIRED).toBe("reauth_required");
  });

  it("exposes send-admission and mailbox error code families", () => {
    expect(SEND_ADMISSION_CODES.RECIPIENT_SUPPRESSED).toBe("RECIPIENT_SUPPRESSED");
    expect(MAIL_ERROR_CODES.TLS_CERTIFICATE_CHANGED).toBe("TLS_CERTIFICATE_CHANGED");
    expect(MAIL_ERROR_CODES.SYNC_FAIR_USE).toBe("SYNC_FAIR_USE");
  });

  it("lets a named code and an unknown code both pass through WarmblyAPIError", () => {
    const named = WarmblyAPIError.from(403, {
      code: ERROR_CODES.API_KEY_PERMISSIONS_EXCEED_CALLER,
    });
    expect(named.code).toBe("api_key_permissions_exceed_caller");
    const unknown = WarmblyAPIError.from(400, { code: "brand_new_code_from_the_future" });
    expect(unknown.code).toBe("brand_new_code_from_the_future");
  });
});
