/**
 * Deno usage of the Warmbly SDK.
 *
 * Deno resolves npm packages through the `npm:` specifier, so you import from
 * "npm:warmbly" instead of a bare "warmbly". You can pin a version too, e.g.
 * "npm:warmbly@^1". Deno provides fetch, WebSocket, and Web Crypto natively,
 * so the REST client and gateway work without any extra dependency.
 *
 * This file is illustrative and is NOT typechecked.
 *
 * Run with:
 *   WARMBLY_API_KEY=wmbly_... deno run --allow-net --allow-env examples/runtimes/deno.ts
 *
 * Note: the import below uses a bare "warmbly" so this file matches the others.
 * In a real Deno script, change it to: import { Warmbly } from "npm:warmbly";
 */
import { Warmbly } from "warmbly";

// Deno exposes environment variables via Deno.env. Read the key from there.
const apiKey = Deno.env.get("WARMBLY_API_KEY");

const warmbly = new Warmbly({ apiKey });

// List the first page of campaigns and print the records plus the next cursor.
const page = await warmbly.campaigns.list({ limit: 25 });
for (const campaign of page.data) {
  console.log(campaign.id, campaign.name, campaign.status);
}
console.log("next cursor", page.pagination.next_cursor);
