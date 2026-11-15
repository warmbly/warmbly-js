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
  AI_AGENT: 4194304,
  AI_RESEARCH: 8388608,
  /** Connect mailboxes with their credentials and create sign-in links (Partnership plan). */
  CONNECT_EMAILS: 16777216,
  /** Create, share and schedule client reports. */
  MANAGE_REPORTS: 33554432,
  /** Agency keys only: view the agency, its staff, clients, overview, inbox and brand. */
  AGENCY_READ: 67108864,
  /** Agency keys only: create, attach, cap and detach client workspaces. */
  AGENCY_MANAGE_CLIENTS: 134217728,
  /** Agency keys only: view the shared send pool and AI balance. */
  AGENCY_READ_USAGE: 268435456,
  /** Agency keys only: move AI balance from the agency into a client workspace. */
  AGENCY_TRANSFER_AI: 536870912,
  /** Migrate data in from another outreach tool. */
  IMPORT_TOOLS: 1073741824,
  /** Agency keys only: migrate client accounts in from another outreach tool. */
  AGENCY_MIGRATE: 2147483648,
} as const;

/** A permission name, e.g. `"READ_CAMPAIGNS"`. */
export type PermissionName = keyof typeof PERMISSIONS;

/** An OAuth scope string, e.g. `"read_campaigns"` (a permission name lowercased). */
export type Scope = Lowercase<PermissionName>;

/** A permission category as returned by the permissions catalog. */
export type PermissionCategory = "read" | "write" | "bulk" | "special" | "agency";

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
  AI_AGENT: "special",
  AI_RESEARCH: "special",
  CONNECT_EMAILS: "special",
  MANAGE_REPORTS: "write",
  IMPORT_TOOLS: "bulk",
  AGENCY_READ: "agency",
  AGENCY_MANAGE_CLIENTS: "agency",
  AGENCY_READ_USAGE: "agency",
  AGENCY_TRANSFER_AI: "agency",
  AGENCY_MIGRATE: "agency",
};

// Masks reach bit 31 and beyond, past what JavaScript's 32-bit bitwise operators handle,
// so every mask operation works on a high and a low 32-bit half.
const HIGH = 2 ** 32;

function split(value: number): [number, number] {
  return [Math.floor(value / HIGH), value % HIGH];
}

function join(high: number, low: number): number {
  return high * HIGH + (low >>> 0);
}

/** Bitwise OR of two permission masks, safe above bit 31. */
export function maskOr(a: number, b: number): number {
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return join((ah | bh) >>> 0, (al | bl) >>> 0);
}

/** Bitwise AND of two permission masks, safe above bit 31. */
export function maskAnd(a: number, b: number): number {
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return join((ah & bh) >>> 0, (al & bl) >>> 0);
}

/** `a` with every bit of `b` cleared, safe above bit 31. */
export function maskWithout(a: number, b: number): number {
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return join((ah & ~bh) >>> 0, (al & ~bl) >>> 0);
}

function orAll(names: readonly PermissionName[]): number {
  return names.reduce((mask, name) => maskOr(mask, PERMISSIONS[name]), 0);
}

const PERMISSION_NAMES = Object.keys(PERMISSIONS) as PermissionName[];

/** The category of a permission, e.g. `category("SEND_CAMPAIGNS") === "write"`. */
export function permissionCategory(name: PermissionName): PermissionCategory {
  return CATEGORY[name];
}

/** Maps a permission name to its OAuth scope string. */
export function permissionToScope(name: PermissionName): Scope {
  return name.toLowerCase() as Scope;
}

/** The agency permissions. Only an agency API key can hold them; a workspace key never does. */
export const AGENCY_PERMISSIONS: readonly PermissionName[] = [
  "AGENCY_READ",
  "AGENCY_MANAGE_CLIENTS",
  "AGENCY_READ_USAGE",
  "AGENCY_TRANSFER_AI",
  "AGENCY_MIGRATE",
];

const WORKSPACE_PERMISSIONS = PERMISSION_NAMES.filter((name) => CATEGORY[name] !== "agency");

const READ_ONLY_NAMES: readonly PermissionName[] = [
  "READ_EMAILS",
  "READ_CAMPAIGNS",
  "READ_CONTACTS",
  "READ_UNIBOX",
  "READ_ANALYTICS",
  "READ_TEMPLATES",
  "READ_CRM",
  "READ_AUDIT_LOGS",
];

/**
 * Built-in preset masks for workspace keys, matching the server's `read_only` and
 * `full_access` presets. `full_access` leaves out `CONNECT_EMAILS` (granted on purpose,
 * Partnership plan only) and every agency bit.
 */
export const PERMISSION_PRESETS = {
  read_only: orAll(READ_ONLY_NAMES),
  full_access: orAll(WORKSPACE_PERMISSIONS.filter((name) => name !== "CONNECT_EMAILS")),
} as const;

/** Every agency bit OR-ed together. */
export const AGENCY_PERMISSIONS_MASK: number = orAll(AGENCY_PERMISSIONS);

/**
 * Every bit an agency API key may carry: the workspace bits except `API_KEYS`,
 * `REALTIME_SUBSCRIBE` and `CONNECT_EMAILS`, plus every agency bit. Matches the server's
 * `grantable` for agency keys.
 */
export const AGENCY_KEY_GRANTABLE_PERMISSIONS: number = maskOr(
  maskWithout(
    orAll(WORKSPACE_PERMISSIONS),
    orAll(["API_KEYS", "REALTIME_SUBSCRIBE", "CONNECT_EMAILS"]),
  ),
  AGENCY_PERMISSIONS_MASK,
);

/**
 * The organization member permission each API permission acts under, mirroring the
 * server's role-delegation table. A key or OAuth grant can carry a permission only when
 * the member who creates or approves it holds every member permission listed. An empty
 * list means every member qualifies.
 */
export const PERMISSION_ROLE_NEEDS: Readonly<Record<PermissionName, readonly string[]>> = {
  READ_EMAILS: ["view_campaigns"],
  READ_CAMPAIGNS: ["view_campaigns"],
  READ_CONTACTS: ["view_contacts"],
  READ_UNIBOX: ["access_unibox"],
  READ_ANALYTICS: ["view_analytics"],
  WRITE_EMAILS: ["manage_emails"],
  WRITE_CAMPAIGNS: ["manage_campaigns"],
  WRITE_CONTACTS: ["manage_contacts"],
  WRITE_UNIBOX: ["access_unibox"],
  BULK_CONTACTS: ["manage_contacts"],
  BULK_CAMPAIGNS: ["manage_campaigns"],
  REALTIME_SUBSCRIBE: [],
  WEBHOOKS: ["manage_settings"],
  API_KEYS: ["manage_api_keys"],
  SEND_CAMPAIGNS: ["send_campaigns"],
  READ_TEMPLATES: ["view_campaigns"],
  WRITE_TEMPLATES: ["manage_campaigns"],
  READ_CRM: ["view_contacts"],
  WRITE_CRM: ["manage_contacts"],
  READ_AUDIT_LOGS: ["view_analytics"],
  INTEGRATIONS: ["use_integrations"],
  WARMUP_ROUTING: ["manage_settings"],
  AI_AGENT: ["use_ai"],
  AI_RESEARCH: ["view_contacts", "use_ai"],
  CONNECT_EMAILS: ["manage_emails"],
  MANAGE_REPORTS: ["view_analytics", "manage_campaigns"],
  IMPORT_TOOLS: ["manage_contacts"],
  // Agency bits are not delegated from a workspace role; see apiPermissionsForMember.
  AGENCY_READ: [],
  AGENCY_MANAGE_CLIENTS: [],
  AGENCY_READ_USAGE: [],
  AGENCY_TRANSFER_AI: [],
  AGENCY_MIGRATE: [],
};

/**
 * The widest mask a member can delegate to an API key or OAuth app, given the member
 * permission names they hold (for example `["view_campaigns", "manage_contacts"]`). An
 * owner delegates everything. Mirrors the server's `APIPermissionsForMember`.
 *
 * @example
 * apiPermissionsForMember(["view_campaigns"]).toScopes();
 * // ["read_emails", "read_campaigns", "realtime_subscribe", "read_templates"]
 */
export function apiPermissionsForMember(
  memberPermissions: Iterable<string>,
  owner = false,
): Permissions {
  if (owner) return new Permissions(orAll(WORKSPACE_PERMISSIONS));
  const held = new Set(memberPermissions);
  let mask = 0;
  for (const name of WORKSPACE_PERMISSIONS) {
    if (PERMISSION_ROLE_NEEDS[name].every((need) => held.has(need))) {
      mask = maskOr(mask, PERMISSIONS[name]);
    }
  }
  return new Permissions(mask);
}

/**
 * Every permission a third-party OAuth app may request: every workspace permission except
 * `API_KEYS` and `CONNECT_EMAILS`, since key management and mailbox credentials stay with
 * people. Also returned as `app_scopes` by `GET /api-keys/permissions`.
 */
export const APP_GRANTABLE_PERMISSIONS: number = maskWithout(
  orAll(WORKSPACE_PERMISSIONS),
  orAll(["API_KEYS", "CONNECT_EMAILS"]),
);

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
  return inputs.reduce<number>((mask, input) => maskOr(mask, normalizeToBits(input)), 0);
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
    return maskAnd(this.value, required) === required;
  }

  /** Whether the set contains at least one supplied permission. */
  hasAny(...permissions: PermissionInput[]): boolean {
    return maskAnd(this.value, combine(permissions)) !== 0;
  }

  /** Returns a new set with the supplied permissions added. */
  add(...permissions: PermissionInput[]): Permissions {
    return new Permissions(maskOr(this.value, combine(permissions)));
  }

  /** Returns a new set with the supplied permissions removed. */
  remove(...permissions: PermissionInput[]): Permissions {
    return new Permissions(maskWithout(this.value, combine(permissions)));
  }

  /** The permission names present in this set. */
  toArray(): PermissionName[] {
    return PERMISSION_NAMES.filter((name) => maskAnd(this.value, PERMISSIONS[name]) !== 0);
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
