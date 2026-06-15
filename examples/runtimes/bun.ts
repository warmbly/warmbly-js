/**
 * Bun usage of the Warmbly SDK, including the realtime gateway.
 *
 * Bun has a built-in WebSocket and fetch, so the gateway connects with no extra
 * peer dependency (unlike Node < 22, which needs the optional `ws` peer). This
 * opens a single socket, registers typed handlers, and connects.
 *
 * This file is illustrative and is NOT typechecked.
 *
 * Run with:
 *   bun add warmbly
 *   WARMBLY_API_KEY=wmbly_... WARMBLY_ORG_ID=org_... bun run examples/runtimes/bun.ts
 */
import { Warmbly } from "warmbly";

// The token must be an API key with the REALTIME_SUBSCRIBE permission (or an
// OAuth access token with the realtime_subscribe scope). The gateway inherits
// this token from the client automatically.
const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// Open the gateway. Intents narrow the stream to the event families we act on.
const gw = warmbly.gateway({
  orgId: process.env.WARMBLY_ORG_ID,
  intents: ["EMAIL", "CAMPAIGN"],
});

// Typed event handlers: the payload type follows the event name.
gw.on("EMAIL_OPENED", (e) => console.log("opened", e.campaign_id));
gw.on("CAMPAIGN_COMPLETED", (e) => console.log("campaign done", e.campaign_id));

// Lifecycle: the client reconnects and resumes by sequence number on its own.
gw.on("hello", (h) => console.log("ready at seq", h.seq));
gw.on("error", (err) => console.error("gateway error", err.message));

await gw.connect();

// Close cleanly on Ctrl+C.
process.on("SIGINT", () => {
  gw.close();
  process.exit(0);
});
