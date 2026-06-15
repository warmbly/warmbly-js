/**
 * Integrations tour: browse the catalog, connect a provider, configure it,
 * subscribe to events, set field mappings, list sync runs, test the connection,
 * push contacts through it, and list synced bookings.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/integrations.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// Browse the catalog of integrations you can connect.
const catalog = await warmbly.integrations.catalog();
console.log("catalog entries", catalog.length);

// Connect a provider. This creates a connection record you then configure.
const connection = await warmbly.integrations.createConnection({
  provider: "hubspot",
});
console.log("connection", connection.id, connection.status);

// Configure the connection (for example with credentials or portal settings).
const configured = await warmbly.integrations.updateConnectionConfig(connection.id, {
  api_key: process.env.HUBSPOT_API_KEY,
  portal_id: "12345678",
});
console.log("configured", configured.status);

// Subscribe to an event so Warmbly notifies the provider when it happens.
const event = await warmbly.integrations.createConnectionEvent(connection.id, {
  event_type: "contact.created",
});
console.log("subscribed event", event.id);

// Inspect the current event subscriptions on the connection.
const events = await warmbly.integrations.listConnectionEvents(connection.id);
console.log("events", events.length);

// Map Warmbly fields to the provider's fields so synced records line up.
const mappings = await warmbly.integrations.setFieldMappings(connection.id, {
  mappings: [
    { source: "email", target: "email" },
    { source: "first_name", target: "firstname" },
    { source: "company", target: "company" },
  ],
});
console.log("field mappings", mappings);

// List recent sync runs to see what has flowed through the connection.
const runs = await warmbly.integrations.listRuns(connection.id, { limit: 10 });
console.log("runs", runs);

// Test the connection end to end before relying on it.
const test = await warmbly.integrations.testConnection(connection.id);
console.log("test result", test);

// Push specific contacts through the connection on demand.
const push = await warmbly.integrations.pushConnection(connection.id, {
  contact_ids: ["c_1", "c_2"],
});
console.log("push result", push);

// List meeting bookings synced in from connected schedulers.
const bookings = await warmbly.integrations.bookings({
  from: "2026-06-01",
  to: "2026-06-15",
});
console.log("bookings", bookings);
