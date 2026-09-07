/**
 * The suppression list and the REST agent-tools surface: keep addresses and domains out
 * of every campaign, and hand Warmbly's permission-filtered tool registry to a
 * function-calling agent without an MCP client.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/suppressions-and-agent-tools.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Add addresses and domains. A value with "@" is an address; a bare host is a domain.
//    Existing values are updated in place, so the call is safe to repeat.
const { added, skipped } = await warmbly.suppressions.add({
  entries: [
    { value: "dana@acme.com", reason: "Asked us by phone" },
    { value: "competitor.io" },
    { value: "not an address" },
  ],
  reason: "Existing customers",
});
console.log("added", added, "skipped", skipped);

// 2. Page the list, newest first. Filter with q.
for await (const entry of await warmbly.suppressions.list({ q: "acme" })) {
  console.log(entry.kind, entry.email, "via", entry.source, entry.reason ?? "");
}

// 3. Lift one entry so campaigns can email the address again (audited).
const page = await warmbly.suppressions.list({ q: "competitor.io", limit: 1 });
const first = page.data[0];
if (first) await warmbly.suppressions.remove(first.id);

// 4. Agent tools: list what this credential may use, in the manifest your framework expects.
const native = await warmbly.agentTools.list();
console.log("tools:", native.map((t) => t.name).join(", "));
const openai = await warmbly.agentTools.list({ format: "openai" }); // or "hermes"
console.log("first tool schema", openai[0]?.function.parameters);

// 5. Execute a tool with the argument object the model produced, and feed the result back.
//    An unknown tool is a 404, one the credential lacks the scope for a 403, and a tool-level
//    failure a 422 whose message is meant for the model to read.
const { name, result } = await warmbly.agentTools.call("list_threads", {
  folder: "inbox",
  unseen_only: true,
  limit: 10,
});
console.log(name, "->", result);
