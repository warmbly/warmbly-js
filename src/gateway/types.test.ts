import { describe, expect, it } from "vitest";
import {
  ChannelTopic,
  describeCloseCode,
  GatewayCloseCode,
  isRejectionCloseCode,
  parseChannelTopic,
} from "./types";

describe("ChannelTopic", () => {
  it("builds the documented topic strings", () => {
    expect(ChannelTopic.org("org_1")).toBe("org:org_1");
    expect(ChannelTopic.user("u_1")).toBe("user:u_1");
    expect(ChannelTopic.campaign("c_1")).toBe("campaign:c_1");
    expect(ChannelTopic.account("a_1")).toBe("account:a_1");
    expect(ChannelTopic.bulk("b_1")).toBe("bulk:b_1");
    expect(ChannelTopic.phoenix).toBe("phoenix");
  });
});

describe("parseChannelTopic", () => {
  it("parses known topics into kind and id", () => {
    expect(parseChannelTopic("campaign:c_1")).toEqual({ kind: "campaign", id: "c_1" });
    expect(parseChannelTopic("phoenix")).toEqual({ kind: "phoenix", id: undefined });
  });

  it("marks unknown prefixes and missing separators", () => {
    expect(parseChannelTopic("widget:1")).toEqual({ kind: "unknown", id: "1" });
    expect(parseChannelTopic("bare")).toEqual({ kind: "unknown", id: undefined });
  });
});

describe("close codes", () => {
  it("recognizes server rejection codes", () => {
    expect(isRejectionCloseCode(GatewayCloseCode.AUTH_FAILED)).toBe(true);
    expect(isRejectionCloseCode(4000)).toBe(false);
    expect(isRejectionCloseCode(undefined)).toBe(false);
  });

  it("describes each rejection code", () => {
    expect(describeCloseCode(GatewayCloseCode.NOT_AUTHENTICATED)).toContain("not authenticated");
    expect(describeCloseCode(GatewayCloseCode.PERMISSION_DENIED)).toContain("permission denied");
    expect(describeCloseCode(1006)).toContain("1006");
  });

  it("maps each enum member to its numeric code", () => {
    expect(GatewayCloseCode.NOT_AUTHENTICATED).toBe(4003);
    expect(GatewayCloseCode.AUTH_FAILED).toBe(4004);
    expect(GatewayCloseCode.RATE_LIMITED).toBe(4007);
    expect(GatewayCloseCode.CONNECTION_LIMIT).toBe(4009);
    expect(GatewayCloseCode.PERMISSION_DENIED).toBe(4010);
  });
});
