import { WarmblyError } from "./core/errors";

/**
 * The Warmbly permission bits, mirroring the server's API permission bitmask.
 *
 * A key or OAuth grant carries a bitmask; a request is allowed only when the mask
 * contains every bit the route requires. OAuth scope strings are these names lowercased
 * (for example `READ_CAMPAIGNS` -> `read_campaigns`).
 *
 * The authoritative catalog (with descriptions and presets) is also available at runtime
 * via `warmbly.apiKeys.permissions()`. These constants reflect the catalog at publish time.
 */
export const PERMISSIONS = {
  READ_EMAILS: 1,
  READ_CAMPAIGNS: 2,
  READ_CONTACTS: 4,
  READ_UNIBOX: 8,
  READ_ANALYTICS: 16,
  WRITE_EMAILS: 32,
  WRITE_CAMPAIGNS: 64,
  WRITE_CONTACTS: 128,
  WRITE_UNIBOX: 256,
  BULK_CONTACTS: 512,
  BULK_CAMPAIGNS: 1024,
  REALTIME_SUBSCRIBE: 2048,
  WEBHOOKS: 4096,
  API_KEYS: 8192,
  SEND_CAMPAIGNS: 16384,
  READ_TEMPLATES: 32768,
  WRITE_TEMPLATES: 65536,
  READ_CRM: 131072,
  WRITE_CRM: 262144,
  READ_AUDIT_LOGS: 524288,
  INTEGRATIONS: 1048576,
  WARMUP_ROUTING: 2097152,
} as const;

/** A permission name, e.g. `"READ_CAMPAIGNS"`. */
export type PermissionName = keyof typeof PERMISSIONS;

/** An OAuth scope string, e.g. `"read_campaigns"` (a permission name lowercased). */
export type Scope = Lowercase<PermissionName>;

/** A permission category as returned by the permissions catalog. */
export type PermissionCategory = "read" | "write" | "bulk" | "special";

/** Anything accepted where a set of permissions is expected. */
export type PermissionInput = number | PermissionName | Scope | Permissions;

const CATEGORY: Record<PermissionName, PermissionCategory> = {
  READ_EMAILS: "read",
  READ_CAMPAIGNS: "read",
  READ_CONTACTS: "read",
  READ_UNIBOX: "read",
  READ_ANALYTICS: "read",
  READ_TEMPLATES: "read",
  READ_CRM: "read",
  READ_AUDIT_LOGS: "read",
  WRITE_EMAILS: "write",
  WRITE_CAMPAIGNS: "write",
  WRITE_CONTACTS: "write",
  WRITE_UNIBOX: "write",
  WRITE_TEMPLATES: "write",
  WRITE_CRM: "write",
  SEND_CAMPAIGNS: "write",
  BULK_CONTACTS: "bulk",
  BULK_CAMPAIGNS: "bulk",
  REALTIME_SUBSCRIBE: "special",
  WEBHOOKS: "special",
  API_KEYS: "special",
  INTEGRATIONS: "special",
  WARMUP_ROUTING: "special",
};

const PERMISSION_NAMES = Object.keys(PERMISSIONS) as PermissionName[];

/** The category of a permission, e.g. `category("SEND_CAMPAIGNS") === "write"`. */
export function permissionCategory(name: PermissionName): PermissionCategory {
  return CATEGORY[name];
}

/** Maps a permission name to its OAuth scope string. */
export function permissionToScope(name: PermissionName): Scope {
  return name.toLowerCase() as Scope;
}

/** Built-in preset masks, matching the server's `read_only` and `full_access` presets. */
export const PERMISSION_PRESETS = {
  read_only:
    PERMISSIONS.READ_EMAILS |
    PERMISSIONS.READ_CAMPAIGNS |
    PERMISSIONS.READ_CONTACTS |
    PERMISSIONS.READ_UNIBOX |
    PERMISSIONS.READ_ANALYTICS |
    PERMISSIONS.READ_TEMPLATES |
    PERMISSIONS.READ_CRM |
    PERMISSIONS.READ_AUDIT_LOGS,
  full_access: PERMISSION_NAMES.reduce((mask, name) => mask | PERMISSIONS[name], 0),
} as const;

function normalizeToBits(input: PermissionInput): number {
  if (typeof input === "number") return input;
  if (input instanceof Permissions) return input.value;
  const value = (PERMISSIONS as Record<string, number | undefined>)[input.toUpperCase()];
  if (value === undefined) {
    throw new WarmblyError(`Unknown permission or scope: "${input}"`);
  }
  return value;
}

function combine(inputs: PermissionInput[]): number {
  return inputs.reduce<number>((mask, input) => mask | normalizeToBits(input), 0);
}

/**
 * An immutable, ergonomic wrapper around a Warmbly permission bitmask.
 *
 * @example
 * const scopes = Permissions.from("READ_CAMPAIGNS", "write_contacts");
 * scopes.value;                    // numeric bitmask, ready to send as `permissions`
 * scopes.has("READ_CAMPAIGNS");    // true
 * scopes.toScopes();               // ["read_campaigns", "write_contacts"] for OAuth
 *
 * @example
 * const key = await warmbly.apiKeys.create({
 *   name: "ci",
 *   permissions: Permissions.readOnly().add("REALTIME_SUBSCRIBE").value,
 * });
 */
export class Permissions {
  /** The numeric bitmask, suitable for the `permissions`/`scopes` request fields. */
  readonly value: number;

  constructor(value = 0) {
    this.value = value;
  }

  /** Creates a set from any mix of names, scope strings, numeric masks, or other sets. */
  static from(...permissions: PermissionInput[]): Permissions {
    return new Permissions(combine(permissions));
  }

  /** Creates a set from a raw numeric mask. */
  static fromValue(value: number): Permissions {
    return new Permissions(value);
  }

  /** The `read_only` preset. */
  static readOnly(): Permissions {
    return new Permissions(PERMISSION_PRESETS.read_only);
  }

  /** The `full_access` preset. */
  static fullAccess(): Permissions {
    return new Permissions(PERMISSION_PRESETS.full_access);
  }

  /** Whether the set contains every supplied permission. */
  has(...permissions: PermissionInput[]): boolean {
    const required = combine(permissions);
    return (this.value & required) === required;
  }

  /** Whether the set contains at least one supplied permission. */
  hasAny(...permissions: PermissionInput[]): boolean {
    return (this.value & combine(permissions)) !== 0;
  }

  /** Returns a new set with the supplied permissions added. */
  add(...permissions: PermissionInput[]): Permissions {
    return new Permissions(this.value | combine(permissions));
  }

  /** Returns a new set with the supplied permissions removed. */
  remove(...permissions: PermissionInput[]): Permissions {
    return new Permissions(this.value & ~combine(permissions));
  }

  /** The permission names present in this set. */
  toArray(): PermissionName[] {
    return PERMISSION_NAMES.filter((name) => (this.value & PERMISSIONS[name]) !== 0);
  }

  /** The OAuth scope strings present in this set. */
  toScopes(): Scope[] {
    return this.toArray().map(permissionToScope);
  }

  /** The numeric bitmask. Lets the set be used directly in JSON bodies. */
  toJSON(): number {
    return this.value;
  }

  /** The numeric bitmask, so the set coerces in numeric contexts. */
  valueOf(): number {
    return this.value;
  }

  /** The numeric bitmask as a string. */
  toString(): string {
    return String(this.value);
  }
}
