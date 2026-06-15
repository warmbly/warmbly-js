/**
 * Realtime gateway custom events: subscribe with only the CUSTOM intent and react to
 * CUSTOM_EVENT pushes. Custom events are emitted by Warmbly automations and sequences
 * (and other integrations), so this is how you hook app logic onto workflow steps. The
 * example also wires up the full connection lifecycle for a production-ready listener.
 *
 * Run with:
 *   WARMBLY_API_KEY=wmbly_... WARMBLY_ORG_ID=org_... npx tsx examples/gateway-custom-events.ts
 */
import { GatewayIntents, Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// CUSTOM is the intent family for CUSTOM_EVENT. Filtering to just this family keeps
// us from receiving the rest of the org's traffic.
const gw = warmbly.gateway({
  orgId: process.env.WARMBLY_ORG_ID,
  intents: [GatewayIntents.CUSTOM],
});

// CUSTOM_EVENT is the catch-all for producer-defined events. `e.name` is the custom
// event name set by the automation/sequence, and `e.payload` is its arbitrary body.
// `e.source`/`e.source_id` identify the producing system when provided. Treat the
// payload as a signal (ids over full state) and refetch over REST when you need more.
gw.on("CUSTOM_EVENT", (e) => {
  console.log(`custom event "${e.name}" from ${e.source ?? "automation"}`);
  console.log("  payload:", e.payload);

  // Branch on the producer-defined name to run app logic for specific workflow steps.
  switch (e.name) {
    case "lead.qualified":
      console.log("  -> lead qualified, payload keys:", Object.keys(e.payload));
      break;
    case "sequence.step_completed":
      console.log("  -> a sequence step finished");
      break;
    default:
      console.log("  -> unhandled custom event");
  }
});

// Lifecycle events. These live in a separate namespace from data events but are
// delivered through the same `on`. Wiring them up makes the listener observable and
// resilient.

// `hello`: the org join reply arrived. Carries heartbeat cadence and the current seq.
gw.on("hello", (hello) => {
  console.log(`hello: org ${hello.org_id}, role ${hello.role}, seq ${hello.seq}`);
});

// `resumed`: a reconnect replayed the missed window, so no events were lost.
gw.on("resumed", (r) => {
  console.log(`resumed: replayed ${r.replayed} event(s) up to seq ${r.current_seq}`);
});

// `resumeFailed`: the missed window could not be replayed (e.g. buffer evicted). The
// recommended response is a REST resync, then continue live from `current_seq`.
gw.on("resumeFailed", (r) => {
  console.warn(`resume failed (${r.reason}); resync over REST from seq ${r.current_seq}`);
});

// `reconnecting`: a reconnect attempt is scheduled with backoff. `attempt` is 1-based
// and `delayMs` is the wait before this attempt.
gw.on("reconnecting", ({ attempt, delayMs }) => {
  console.log(`reconnecting: attempt ${attempt} in ${delayMs}ms`);
});

// `rateLimited`: the server pushed a rate-limit notice. The body is producer-defined.
gw.on("rateLimited", (info) => {
  console.warn("rate limited:", info);
});

// `error`: connection rejections, decode failures, and transport errors surface here.
gw.on("error", (err) => {
  console.error("gateway error:", err.message);
});

// `close`: the socket closed (clean or otherwise). Auto-reconnect (on by default)
// will follow for recoverable closes; permission/limit closes will not retry.
gw.on("close", (info) => {
  console.log(`closed${info.code ? ` (code ${info.code})` : ""}${info.reason ? `: ${info.reason}` : ""}`);
});

// Connect and wait for ready. The client handles heartbeat, watchdog, reconnect, and
// resume on its own after this point.
await gw.connect();
console.log("listening for custom events; trigger one from a Warmbly automation/sequence");

// Keep the process alive; close cleanly on Ctrl+C.
process.on("SIGINT", () => {
  gw.close();
  process.exit(0);
});
