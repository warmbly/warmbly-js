import { describe, expect, it } from "vitest";
import { WarmblyError } from "./core/errors";
import {
  PERMISSION_PRESETS,
  PERMISSIONS,
  Permissions,
  permissionCategory,
  permissionToScope,
} from "./permissions";

describe("permission bits", () => {
  it("match the server's bit values for every permission", () => {
    expect(PERMISSIONS.READ_EMAILS).toBe(1);
    expect(PERMISSIONS.READ_CAMPAIGNS).toBe(2);
    expect(PERMISSIONS.READ_CONTACTS).toBe(4);
    expect(PERMISSIONS.READ_UNIBOX).toBe(8);
    expect(PERMISSIONS.READ_ANALYTICS).toBe(16);
    expect(PERMISSIONS.WRITE_EMAILS).toBe(32);
    expect(PERMISSIONS.WRITE_CAMPAIGNS).toBe(64);
    expect(PERMISSIONS.WRITE_CONTACTS).toBe(128);
    expect(PERMISSIONS.WRITE_UNIBOX).toBe(256);
    expect(PERMISSIONS.BULK_CONTACTS).toBe(512);
    expect(PERMISSIONS.BULK_CAMPAIGNS).toBe(1024);
    expect(PERMISSIONS.REALTIME_SUBSCRIBE).toBe(2048);
    expect(PERMISSIONS.WEBHOOKS).toBe(4096);
    expect(PERMISSIONS.API_KEYS).toBe(8192);
    expect(PERMISSIONS.SEND_CAMPAIGNS).toBe(16384);
    expect(PERMISSIONS.READ_TEMPLATES).toBe(32768);
    expect(PERMISSIONS.WRITE_TEMPLATES).toBe(65536);
    expect(PERMISSIONS.READ_CRM).toBe(131072);
    expect(PERMISSIONS.WRITE_CRM).toBe(262144);
    expect(PERMISSIONS.READ_AUDIT_LOGS).toBe(524288);
    expect(PERMISSIONS.INTEGRATIONS).toBe(1048576);
    expect(PERMISSIONS.WARMUP_ROUTING).toBe(2097152);
  });

  it("uses unique single-bit values", () => {
    const values = Object.values(PERMISSIONS);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) {
      expect(v & (v - 1)).toBe(0);
    }
  });

  it("compute presets that match the server", () => {
    expect(PERMISSION_PRESETS.read_only).toBe(688159);
    expect(PERMISSION_PRESETS.full_access).toBe(4194303);
  });

  it("read_only is exactly the read bits", () => {
    expect(PERMISSION_PRESETS.read_only).toBe(
      PERMISSIONS.READ_EMAILS |
        PERMISSIONS.READ_CAMPAIGNS |
        PERMISSIONS.READ_CONTACTS |
        PERMISSIONS.READ_UNIBOX |
        PERMISSIONS.READ_ANALYTICS |
        PERMISSIONS.READ_TEMPLATES |
        PERMISSIONS.READ_CRM |
        PERMISSIONS.READ_AUDIT_LOGS,
    );
  });

  it("full_access contains every bit", () => {
    const all = Object.values(PERMISSIONS).reduce((mask, v) => mask | v, 0);
    expect(PERMISSION_PRESETS.full_access).toBe(all);
  });
});

describe("permissionCategory", () => {
  it("returns the category for read permissions", () => {
    expect(permissionCategory("READ_EMAILS")).toBe("read");
    expect(permissionCategory("READ_CAMPAIGNS")).toBe("read");
    expect(permissionCategory("READ_CONTACTS")).toBe("read");
    expect(permissionCategory("READ_UNIBOX")).toBe("read");
    expect(permissionCategory("READ_ANALYTICS")).toBe("read");
    expect(permissionCategory("READ_TEMPLATES")).toBe("read");
    expect(permissionCategory("READ_CRM")).toBe("read");
    expect(permissionCategory("READ_AUDIT_LOGS")).toBe("read");
  });

  it("returns the category for write permissions", () => {
    expect(permissionCategory("WRITE_EMAILS")).toBe("write");
    expect(permissionCategory("WRITE_CAMPAIGNS")).toBe("write");
    expect(permissionCategory("WRITE_CONTACTS")).toBe("write");
    expect(permissionCategory("WRITE_UNIBOX")).toBe("write");
    expect(permissionCategory("WRITE_TEMPLATES")).toBe("write");
    expect(permissionCategory("WRITE_CRM")).toBe("write");
    expect(permissionCategory("SEND_CAMPAIGNS")).toBe("write");
  });

  it("returns the category for bulk permissions", () => {
    expect(permissionCategory("BULK_CONTACTS")).toBe("bulk");
    expect(permissionCategory("BULK_CAMPAIGNS")).toBe("bulk");
  });

  it("returns the category for special permissions", () => {
    expect(permissionCategory("REALTIME_SUBSCRIBE")).toBe("special");
    expect(permissionCategory("WEBHOOKS")).toBe("special");
    expect(permissionCategory("API_KEYS")).toBe("special");
    expect(permissionCategory("INTEGRATIONS")).toBe("special");
    expect(permissionCategory("WARMUP_ROUTING")).toBe("special");
  });
});

describe("permissionToScope", () => {
  it("lowercases the permission name", () => {
    expect(permissionToScope("READ_CAMPAIGNS")).toBe("read_campaigns");
    expect(permissionToScope("WRITE_CONTACTS")).toBe("write_contacts");
    expect(permissionToScope("WARMUP_ROUTING")).toBe("warmup_routing");
  });
});

describe("Permissions.from", () => {
  it("combines names and scope strings into a bitmask", () => {
    const p = Permissions.from("READ_CAMPAIGNS", "write_contacts");
    expect(p.value).toBe(PERMISSIONS.READ_CAMPAIGNS | PERMISSIONS.WRITE_CONTACTS);
  });

  it("accepts numeric masks", () => {
    const p = Permissions.from(PERMISSIONS.READ_EMAILS, 256);
    expect(p.value).toBe(PERMISSIONS.READ_EMAILS | 256);
  });

  it("accepts nested Permissions instances", () => {
    const base = Permissions.from("READ_EMAILS", "READ_CAMPAIGNS");
    const p = Permissions.from(base, "WRITE_EMAILS");
    expect(p.value).toBe(
      PERMISSIONS.READ_EMAILS | PERMISSIONS.READ_CAMPAIGNS | PERMISSIONS.WRITE_EMAILS,
    );
  });

  it("accepts a mix of all input kinds", () => {
    const nested = Permissions.from("WRITE_CRM");
    const p = Permissions.from("READ_EMAILS", "write_contacts", PERMISSIONS.API_KEYS, nested);
    expect(p.value).toBe(
      PERMISSIONS.READ_EMAILS |
        PERMISSIONS.WRITE_CONTACTS |
        PERMISSIONS.API_KEYS |
        PERMISSIONS.WRITE_CRM,
    );
  });

  it("returns an empty set with no arguments", () => {
    expect(Permissions.from().value).toBe(0);
  });
});

describe("Permissions.fromValue", () => {
  it("wraps a raw numeric mask", () => {
    const p = Permissions.fromValue(688159);
    expect(p.value).toBe(688159);
    expect(p.value).toBe(PERMISSION_PRESETS.read_only);
  });
});

describe("Permissions presets", () => {
  it("readOnly matches the preset", () => {
    expect(Permissions.readOnly().value).toBe(PERMISSION_PRESETS.read_only);
    expect(Permissions.readOnly().value).toBe(688159);
  });

  it("fullAccess matches the preset", () => {
    expect(Permissions.fullAccess().value).toBe(PERMISSION_PRESETS.full_access);
    expect(Permissions.fullAccess().value).toBe(4194303);
  });

  it("default constructor is empty", () => {
    expect(new Permissions().value).toBe(0);
  });
});

describe("Permissions.has", () => {
  it("is true only when every supplied permission is present", () => {
    const p = Permissions.from("READ_CAMPAIGNS", "WRITE_CONTACTS");
    expect(p.has("READ_CAMPAIGNS")).toBe(true);
    expect(p.has("READ_CAMPAIGNS", "WRITE_CONTACTS")).toBe(true);
    expect(p.has("WRITE_EMAILS")).toBe(false);
    expect(p.has("READ_CAMPAIGNS", "WRITE_EMAILS")).toBe(false);
  });
});

describe("Permissions.hasAny", () => {
  it("is true when at least one supplied permission is present", () => {
    const p = Permissions.from("READ_CAMPAIGNS", "WRITE_CONTACTS");
    expect(p.hasAny("WRITE_EMAILS", "WRITE_CONTACTS")).toBe(true);
    expect(p.hasAny("WRITE_EMAILS", "READ_EMAILS")).toBe(false);
  });
});

describe("Permissions.add and remove", () => {
  it("add returns a new immutable set", () => {
    const base = Permissions.readOnly();
    const more = base.add("WRITE_CONTACTS");
    expect(more.has("WRITE_CONTACTS")).toBe(true);
    expect(base.has("WRITE_CONTACTS")).toBe(false);
  });

  it("remove returns a new immutable set", () => {
    const base = Permissions.readOnly();
    const more = base.add("WRITE_CONTACTS");
    expect(more.remove("WRITE_CONTACTS").value).toBe(base.value);
  });

  it("add accepts nested Permissions and numbers", () => {
    const p = new Permissions(PERMISSIONS.READ_EMAILS)
      .add(Permissions.from("WRITE_EMAILS"))
      .add(PERMISSIONS.API_KEYS);
    expect(p.value).toBe(PERMISSIONS.READ_EMAILS | PERMISSIONS.WRITE_EMAILS | PERMISSIONS.API_KEYS);
  });

  it("remove accepts nested Permissions", () => {
    const p = Permissions.from("READ_EMAILS", "WRITE_EMAILS").remove(
      Permissions.from("WRITE_EMAILS"),
    );
    expect(p.value).toBe(PERMISSIONS.READ_EMAILS);
  });
});

describe("Permissions serialization", () => {
  it("toArray lists the present permission names", () => {
    expect(Permissions.from("READ_EMAILS", "WRITE_CONTACTS").toArray()).toEqual([
      "READ_EMAILS",
      "WRITE_CONTACTS",
    ]);
    expect(new Permissions().toArray()).toEqual([]);
  });

  it("toScopes lists the present scope strings", () => {
    expect(Permissions.from("READ_CAMPAIGNS", "WRITE_CONTACTS").toScopes()).toEqual([
      "read_campaigns",
      "write_contacts",
    ]);
  });

  it("toJSON returns the numeric mask", () => {
    const p = Permissions.from("READ_CAMPAIGNS");
    expect(p.toJSON()).toBe(PERMISSIONS.READ_CAMPAIGNS);
    expect(JSON.stringify({ permissions: p })).toBe(
      `{"permissions":${PERMISSIONS.READ_CAMPAIGNS}}`,
    );
  });

  it("valueOf coerces in numeric contexts", () => {
    const p = Permissions.from("READ_CAMPAIGNS", "READ_CONTACTS");
    expect(p.valueOf()).toBe(PERMISSIONS.READ_CAMPAIGNS | PERMISSIONS.READ_CONTACTS);
    expect(+p).toBe(PERMISSIONS.READ_CAMPAIGNS | PERMISSIONS.READ_CONTACTS);
  });

  it("toString returns the mask as a string", () => {
    const p = Permissions.from("READ_CAMPAIGNS");
    expect(p.toString()).toBe(String(PERMISSIONS.READ_CAMPAIGNS));
    expect(`${p}`).toBe(String(PERMISSIONS.READ_CAMPAIGNS));
  });
});

describe("normalizeToBits errors", () => {
  it("throws WarmblyError on an unknown permission or scope string", () => {
    expect(() => Permissions.from("NOT_A_REAL_SCOPE" as never)).toThrow(WarmblyError);
    expect(() => Permissions.from("NOT_A_REAL_SCOPE" as never)).toThrow(
      'Unknown permission or scope: "NOT_A_REAL_SCOPE"',
    );
  });

  it("throws via has, add, and remove too", () => {
    const p = Permissions.readOnly();
    expect(() => p.has("bogus" as never)).toThrow(WarmblyError);
    expect(() => p.add("bogus" as never)).toThrow(WarmblyError);
    expect(() => p.remove("bogus" as never)).toThrow(WarmblyError);
  });
});
