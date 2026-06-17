/**
 * Permissions and API key lifecycle.
 * Builds a permission bitmask with the `Permissions` helper, creates a scoped
 * API key, reads the live permission catalog, lists keys, fetches the usage
 * summary, and revokes a key.
 *
 * Requires a key with the API_KEYS scope to manage other keys.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/permissions-and-api-keys.ts
 */
import { Permissions, Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// ---------------------------------------------------------------------------
// Build a permission bitmask with the Permissions helper.
// Permissions is immutable: from/add/remove all return a NEW set. You can mix
// permission names ("READ_CAMPAIGNS"), scope strings ("write_contacts"), raw
// numeric masks, and other Permissions instances anywhere a permission is taken.
// ---------------------------------------------------------------------------
let perms = Permissions.from("READ_CAMPAIGNS", "write_contacts");

// has() checks that EVERY supplied permission is present.
console.log("has READ_CAMPAIGNS:", perms.has("READ_CAMPAIGNS")); // true

// add() returns a new set with extra bits; remove() returns one with bits cleared.
perms = perms.add("READ_CONTACTS").remove("WRITE_CONTACTS");

// toScopes() lowercases the names into OAuth scope strings; .value is the numeric mask.
console.log("scopes:", perms.toScopes()); // ["read_campaigns", "read_contacts"]
console.log("bitmask:", perms.value);

// Presets mirror the server's built-in masks. Start from read_only and widen it.
const readOnly = Permissions.readOnly();
const fullAccess = Permissions.fullAccess();
console.log("read_only mask:", readOnly.value, "full_access mask:", fullAccess.value);

// A realistic key: read-only access plus the ability to subscribe to the realtime gateway.
const ciPermissions = Permissions.readOnly().add("REALTIME_SUBSCRIBE");

// ---------------------------------------------------------------------------
// Create an API key with those permissions.
// The `permissions` field is a number, so pass the helper's `.value`. The
// returned `secret` is the full plaintext key and is shown ONLY ONCE here.
// ---------------------------------------------------------------------------
const created = await warmbly.apiKeys.create({
  name: "ci-readonly",
  description: "Read-only CI key with realtime access",
  permissions: ciPermissions.value,
  rate_limit_per_minute: 120,
});
console.log("created key id:", created.id);
console.log("SAVE THIS NOW, it is never shown again:", created.secret);

// ---------------------------------------------------------------------------
// Fetch the live permission catalog.
// These are the canonical bit values, human descriptions, and preset masks
// straight from the server, useful for rendering a permission picker UI.
// ---------------------------------------------------------------------------
const catalog = await warmbly.apiKeys.permissions();
for (const entry of catalog.permissions) {
  console.log(`${entry.name} (${entry.category}) = ${entry.value}: ${entry.description}`);
}
console.log("server presets:", catalog.presets.read_only, catalog.presets.full_access);

// ---------------------------------------------------------------------------
// List existing keys (auto-paginated when iterated).
// ---------------------------------------------------------------------------
for await (const key of await warmbly.apiKeys.list({ status: "active" })) {
  console.log(key.name, key.key_prefix, "status:", key.status, "perms:", key.permissions);
}

// ---------------------------------------------------------------------------
// Aggregate usage summary across all of the organization's keys.
// ---------------------------------------------------------------------------
const summary = await warmbly.apiKeys.usageSummary();
console.log("usage summary:", summary);

// ---------------------------------------------------------------------------
// Revoke the key we just created, recording a reason.
// ---------------------------------------------------------------------------
const revoked = await warmbly.apiKeys.revoke(created.id, "example cleanup");
console.log("revoked key", created.id, "status now:", revoked.status);
