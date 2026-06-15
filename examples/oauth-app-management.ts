/**
 * Managing your OAuth applications end to end.
 *
 * Demonstrates the full lifecycle of an OAuth application using `warmbly.oauthApplications`:
 * create, list, get, update, rotate the client secret, reveal and rotate the webhook signing
 * secret, inspect webhook endpoint health and deliveries, and list/revoke authorized apps.
 *
 * The credential used here must be an API key that holds the `API_KEYS` scope (manage api keys),
 * because every endpoint below is bearer-authenticated against that gate.
 *
 * Run with tsx:
 *   WARMBLY_API_KEY=wmbly_... npx tsx examples/oauth-app-management.ts
 */
import { Permissions, Warmbly } from "warmbly";

// The client reads its bearer credential from `apiKey`. `apiKey` is optional on the
// client options, so reading it straight from the environment needs no non-null assertion.
const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Create an OAuth application.
// `scopes` is a uint64 bitmask. The `Permissions` helper builds that mask from readable
// names; `.value` hands back the numeric bitmask the API expects.
const created = await warmbly.oauthApplications.create({
  name: "Acme Analytics Sync",
  description: "Reads campaign and contact data into the Acme dashboard.",
  website_url: "https://acme.example.com",
  redirect_uris: ["https://acme.example.com/oauth/callback"],
  // Receive delivery health and signed webhooks at this URL.
  webhook_url: "https://acme.example.com/warmbly/webhooks",
  webhook_events: ["EMAIL_OPENED", "EMAIL_REPLIED"],
  scopes: Permissions.from("READ_CAMPAIGNS", "READ_CONTACTS", "READ_ANALYTICS").value,
});

// The `client_secret` is returned exactly once, on create. Store it now; it is never
// shown again. The public `client_id` is safe to keep around long term.
console.log("Created app:", created.id, created.client_id);
console.log("Client secret (store securely, shown once):", created.client_secret);

const appId = created.id;

// 2. List every OAuth application in the organization.
// `list()` returns a plain array (not a paginated Page) for this resource.
const apps = await warmbly.oauthApplications.list();
console.log(`Org has ${apps.length} OAuth application(s):`);
for (const app of apps) {
  console.log(` - ${app.name} (${app.client_id}) status=${app.status}`);
}

// 3. Fetch a single application by id.
const fetched = await warmbly.oauthApplications.get(appId);
console.log("Fetched app redirect URIs:", fetched.redirect_uris);

// 4. Update mutable fields. Pass only what you want to change (partial write shape).
const updated = await warmbly.oauthApplications.update(appId, {
  description: "Acme dashboard sync (read-only).",
  // Widen the requested scopes to also include the unified inbox.
  scopes: Permissions.from("READ_CAMPAIGNS", "READ_CONTACTS", "READ_ANALYTICS", "READ_UNIBOX")
    .value,
});
console.log("Updated app at:", updated.updated_at);

// 5. Rotate the client secret. This invalidates the old secret and returns a new one once.
const rotated = await warmbly.oauthApplications.rotateSecret(appId);
console.log("New client secret (store securely, shown once):", rotated.client_secret);

// 6. Reveal the current webhook signing secret, then rotate it.
// Use this secret with `verifyWebhookSignature` to validate inbound webhook bodies.
const { webhook_secret } = await warmbly.oauthApplications.getWebhookSecret(appId);
console.log("Current webhook secret prefix:", webhook_secret.slice(0, 12));

const rotatedHook = await warmbly.oauthApplications.rotateWebhookSecret(appId);
console.log("Rotated webhook secret prefix:", rotatedHook.webhook_secret.slice(0, 12));

// 7. Inspect the health of the application's configured webhook endpoints.
const { endpoints } = await warmbly.oauthApplications.listWebhookEndpoints(appId);
for (const endpoint of endpoints) {
  console.log(
    `Endpoint ${endpoint.url ?? "(unknown)"}: healthy=${endpoint.healthy ?? "?"} ` +
      `lastStatus=${endpoint.last_status ?? "n/a"} failures=${endpoint.consecutive_failures ?? 0}`,
  );
}

// 8. Walk the application's webhook deliveries. This returns a Page, so it is async-iterable
// and fetches further pages on demand. Here we filter to failed deliveries.
const deliveries = await warmbly.oauthApplications.listWebhookDeliveries(appId, {
  status: "failed",
  limit: 50,
});
for await (const delivery of deliveries) {
  console.log(
    `Delivery ${delivery.id}: ${delivery.event_type ?? "?"} -> ${delivery.status ?? "?"} ` +
      `(${delivery.attempts ?? 0} attempt(s), http ${delivery.response_status ?? "n/a"})`,
  );
}

// 9. List the applications the current user has authorized, then revoke one.
// Each entry's `id` is the authorization (grant) id used to revoke access.
const authorized = await warmbly.oauthApplications.listAuthorizedApps();
console.log(`User has authorized ${authorized.length} app(s).`);
for (const grant of authorized) {
  console.log(` - ${grant.name ?? grant.client_id ?? grant.id} scopes=${grant.scopes?.join(",")}`);
}

// Revoke the first authorized grant, if any. After this the app can no longer act on the
// user's behalf and must be re-authorized.
const first = authorized[0];
if (first) {
  await warmbly.oauthApplications.revokeAuthorizedApp(first.id);
  console.log("Revoked authorized app:", first.id);
}
