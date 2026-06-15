/**
 * REST quick tour: auth, pagination, single requests, and error handling.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/rest.ts
 */
import { NotFoundError, RateLimitError, Warmbly, WarmblyAPIError } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// Auto-paginate: the loop fetches each page on demand.
for await (const campaign of await warmbly.campaigns.list({ limit: 50 })) {
  console.log(campaign.id, campaign.name, campaign.status);
}

// Create a contact with an idempotency key so retries are safe.
const added = await warmbly.contacts.add(
  [{ email: "jordan@warmbly.com", first_name: "Jane", company: "Warmbly" }],
  { idempotencyKey: "seed-jane" },
);
console.log("added", added);

// Typed error handling.
try {
  await warmbly.campaigns.get("does-not-exist");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("no such campaign");
  } else if (err instanceof RateLimitError) {
    console.log("slow down, retry after", err.retryAfter, "seconds");
  } else if (err instanceof WarmblyAPIError) {
    console.error("api error", err.status, err.code, err.requestId);
  } else {
    throw err;
  }
}
