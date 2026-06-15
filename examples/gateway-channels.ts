/**
 * Realtime gateway channels: connect to the org stream with an intent filter, then
 * join extra channels for finer-grained, targeted events. Channels let you scope
 * down to a single campaign, mailbox, bulk job, or your own user feed.
 *
 * Run with:
 *   WARMBLY_API_KEY=wmbly_... WARMBLY_ORG_ID=org_... npx tsx examples/gateway-channels.ts
 */
import { GatewayIntents, Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// Intents are a coarse traffic filter applied at join time on the org channel. The
// server treats each intent as a case-insensitive substring of the event type, so
// BULK matches BULK_* (and TASK_PROGRESS), ACCOUNT matches ACCOUNT_*, CAMPAIGN
// matches CAMPAIGN_*. Picking a focused set keeps the org stream lean.
const gw = warmbly.gateway({
  orgId: process.env.WARMBLY_ORG_ID,
  intents: [GatewayIntents.BULK, GatewayIntents.ACCOUNT, GatewayIntents.CAMPAIGN],
});

// Bulk operation progress. `processed`/`total` are reported when available, so a
// progress bar can divide one by the other. TASK_PROGRESS is the generic variant
// for long-running work and carries `progress` (0..100) and a `status` string.
gw.on("BULK_STARTED", (e) => console.log("bulk started:", e.operation_id));
gw.on("BULK_PROGRESS", (e) => {
  const pct = e.total ? Math.round(((e.processed ?? 0) / e.total) * 100) : undefined;
  console.log(`bulk ${e.operation_id}: ${e.processed ?? "?"}/${e.total ?? "?"}`, pct ? `(${pct}%)` : "");
});
gw.on("BULK_COMPLETED", (e) => console.log("bulk done:", e.operation_id));
gw.on("BULK_FAILED", (e) => console.log("bulk failed:", e.operation_id));
gw.on("TASK_PROGRESS", (e) => console.log(`task ${e.task_id}: ${e.progress ?? 0}% ${e.status ?? ""}`));

// Email account (mailbox) health and connection lifecycle.
gw.on("ACCOUNT_CONNECTED", (e) => console.log("account connected:", e.account_id));
gw.on("ACCOUNT_DISCONNECTED", (e) => console.log("account disconnected:", e.account_id));
gw.on("ACCOUNT_ERROR", (e) => console.log("account error:", e.account_id));
gw.on("ACCOUNT_SYNCED", (e) => console.log("account synced:", e.account_id));
gw.on("ACCOUNT_HEALTH_CHANGED", (e) => console.log("account health changed:", e.account_id));

// Campaign lifecycle.
gw.on("CAMPAIGN_STARTED", (e) => console.log("campaign started:", e.campaign_id));
gw.on("CAMPAIGN_PAUSED", (e) => console.log("campaign paused:", e.campaign_id));
gw.on("CAMPAIGN_COMPLETED", (e) => console.log("campaign completed:", e.campaign_id));

// Lifecycle hooks.
gw.on("hello", (hello) => console.log("ready at seq", hello.seq));
gw.on("error", (err) => console.error("gateway error:", err.message));

// Connect first. Joining extra channels requires a ready connection, since each
// join sends its own phx_join over the open socket.
await gw.connect();

// Read target ids from the environment so the example stays runnable as-is.
const campaignId = process.env.WARMBLY_CAMPAIGN_ID;
const accountId = process.env.WARMBLY_ACCOUNT_ID;
const bulkId = process.env.WARMBLY_BULK_ID;
const userId = process.env.WARMBLY_USER_ID;

// Join additional channels. Each is scoped to a single resource and delivers that
// resource's events in addition to whatever the filtered org stream sends.
if (campaignId) gw.joinCampaign(campaignId); // campaign:<id>
if (accountId) gw.joinAccount(accountId); // account:<id>
if (bulkId) gw.joinBulk(bulkId); // bulk:<id>, fine-grained progress for one job
if (userId) gw.joinUser(userId); // user:<id>, your own meetings/notifications feed

console.log("joined channels; listening for events");

// Keep the process alive; close cleanly on Ctrl+C.
process.on("SIGINT", () => {
  gw.close();
  process.exit(0);
});
