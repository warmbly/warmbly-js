/**
 * Realtime gateway presence: connect, render the live org presence map, and publish
 * your own activity. Presence tells you which teammates are online and what they are
 * looking at or doing, so a UI can show "Alex is replying to thread_42".
 *
 * Run with:
 *   WARMBLY_API_KEY=wmbly_... WARMBLY_ORG_ID=org_... npx tsx examples/gateway-presence.ts
 */
import { type PresenceState, type PresenceUpdate, Warmbly } from "warmbly";

// The client injects its token and gateway URL into every gateway it opens.
const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// Open a gateway bound to the org. No intents here: presence rides on the org
// channel itself, so we receive presence regardless of the event-stream filter.
const gw = warmbly.gateway({
  orgId: process.env.WARMBLY_ORG_ID,
});

// Pretty-print the current presence map. Each key is usually a user id, and each
// entry carries one `metas` row per open connection for that user.
function renderPresence(state: PresenceState): void {
  const keys = Object.keys(state);
  console.log(`presence: ${keys.length} member(s) online`);
  for (const key of keys) {
    const entry = state[key];
    // A user can have several connections (tabs, devices); show the first meta.
    const meta = entry?.metas[0];
    const where = meta?.page ?? "unknown page";
    const what = meta?.action ?? "idle";
    const on = meta?.resource ? ` on ${meta.resource}` : "";
    console.log(`  - ${key}: ${what} at ${where}${on}`);
  }
}

// The "presence" lifecycle event fires after every `presence_state` (the full map,
// sent right after join) and every `presence_diff` (incremental joins/leaves). The
// payload is the already-merged map, so we just render it.
gw.on("presence", (state) => {
  renderPresence(state);
});

// A handful of lifecycle hooks so we can see the connection come up.
gw.on("hello", (hello) => {
  console.log(`joined org ${hello.org_id} as ${hello.role}, seq ${hello.seq}`);
});
gw.on("error", (err) => {
  console.error("gateway error:", err.message);
});

// Connect and wait until the gateway is ready (socket open + HELLO received).
await gw.connect();

// Publish our own activity. `updatePresence` takes a `PresenceUpdate`: any of
// `page`, `resource`, `action`, plus arbitrary extra fields. Nullish fields are
// dropped before sending. `action` is one of "viewing" | "editing" | "replying" | "idle".
const update: PresenceUpdate = {
  page: "/inbox",
  resource: "thread_42",
  action: "replying",
};
gw.updatePresence(update);
console.log("published presence:", update);

// `gw.presence` is a synchronous snapshot of the latest map at any time.
console.log("snapshot now:", Object.keys(gw.presence).length, "member(s)");

// Move ourselves to "viewing" a campaign a moment later to show updates flowing.
setTimeout(() => {
  gw.updatePresence({ page: "/campaigns", resource: "camp_7", action: "viewing" });
}, 5_000);

// Keep the process alive; close cleanly on Ctrl+C.
process.on("SIGINT", () => {
  gw.close();
  process.exit(0);
});
