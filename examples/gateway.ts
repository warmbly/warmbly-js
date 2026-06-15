/**
 * Realtime gateway: subscribe to live events with intents, handle the lifecycle,
 * and let the client reconnect and resume on its own.
 * Run with: WARMBLY_API_KEY=wmbly_... WARMBLY_ORG_ID=org_... npx tsx examples/gateway.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

const gw = warmbly.gateway({
  orgId: process.env.WARMBLY_ORG_ID,
  intents: ["EMAIL", "CAMPAIGN", "CUSTOM"],
});

// Typed event handlers: the payload type follows the event name.
gw.on("EMAIL_SENT", (e) => console.log("sent", e.email_id ?? e));
gw.on("EMAIL_OPENED", (e) => console.log("opened", e.campaign_id));
gw.on("EMAIL_REPLIED", (e) => console.log("reply on thread", e.thread_id));
gw.on("CAMPAIGN_COMPLETED", (e) => console.log("campaign done", e.campaign_id));
gw.on("CUSTOM_EVENT", (e) => console.log("custom", e.name, e.payload));

// Lifecycle.
gw.on("hello", (h) => console.log("ready at seq", h.seq));
gw.on("resumed", (r) => console.log("replayed", r.replayed, "events"));
gw.on("reconnecting", ({ attempt, delayMs }) => console.log("reconnecting", attempt, delayMs));
gw.on("error", (err) => console.error("gateway error", err.message));

await gw.connect();

// Keep the process alive; close on SIGINT.
process.on("SIGINT", () => {
  gw.close();
  process.exit(0);
});
