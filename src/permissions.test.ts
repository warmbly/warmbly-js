import { describe, expect, it } from "vitest";
import { PERMISSION_PRESETS, PERMISSIONS, Permissions, permissionToScope } from "./permissions";

describe("permission bits", () => {
  it("match the server's bit values", () => {
    expect(PERMISSIONS.READ_EMAILS).toBe(1);
    expect(PERMISSIONS.READ_ANALYTICS).toBe(16);
    expect(PERMISSIONS.WRITE_CAMPAIGNS).toBe(64);
    expect(PERMISSIONS.REALTIME_SUBSCRIBE).toBe(2048);
    expect(PERMISSIONS.API_KEYS).toBe(8192);
    expect(PERMISSIONS.WARMUP_ROUTING).toBe(2097152);
  });

  it("compute presets that match the server", () => {
    expect(PERMISSION_PRESETS.read_only).toBe(688159);
    expect(PERMISSION_PRESETS.full_access).toBe(4194303);
  });
});

describe("Permissions", () => {
  it("combines names and scope strings into a bitmask", () => {
    const p = Permissions.from("READ_CAMPAIGNS", "write_contacts");
    expect(p.value).toBe(PERMISSIONS.READ_CAMPAIGNS | PERMISSIONS.WRITE_CONTACTS);
    expect(p.has("READ_CAMPAIGNS")).toBe(true);
    expect(p.has("WRITE_EMAILS")).toBe(false);
    expect(p.hasAny("WRITE_EMAILS", "WRITE_CONTACTS")).toBe(true);
  });

  it("maps to OAuth scope strings", () => {
    expect(permissionToScope("READ_CAMPAIGNS")).toBe("read_campaigns");
    expect(Permissions.from("READ_CAMPAIGNS", "WRITE_CONTACTS").toScopes()).toEqual([
      "read_campaigns",
      "write_contacts",
    ]);
  });

  it("add and remove are immutable", () => {
    const base = Permissions.readOnly();
    const more = base.add("WRITE_CONTACTS");
    expect(more.has("WRITE_CONTACTS")).toBe(true);
    expect(base.has("WRITE_CONTACTS")).toBe(false);
    expect(more.remove("WRITE_CONTACTS").value).toBe(base.value);
  });

  it("exposes the presets as helpers", () => {
    expect(Permissions.readOnly().value).toBe(688159);
    expect(Permissions.fullAccess().value).toBe(4194303);
  });

  it("throws on an unknown permission or scope", () => {
    expect(() => Permissions.from("NOT_A_REAL_SCOPE" as never)).toThrow();
  });
});
