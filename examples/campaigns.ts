/**
 * Campaign lifecycle end to end: create, read, update, paginate, add a sequence
 * step, start, stop, read logs, and send a test email.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/campaigns.ts
 */
import { Warmbly } from "warmbly";

// apiKey is optional on the client, so reading a possibly-undefined env var is fine.
const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Create a campaign. The create body is an open shape; name is the common field.
const campaign = await warmbly.campaigns.create({ name: "Q3 outreach" });
console.log("created campaign", campaign.id, campaign.name);

// 2. Fetch it back by id.
const fetched = await warmbly.campaigns.get(campaign.id);
console.log("status", fetched.status);

// 3. Update it (for example, rename it).
const renamed = await warmbly.campaigns.update(campaign.id, { name: "Q3 outreach (v2)" });
console.log("renamed to", renamed.name);

// 4. List campaigns and page manually. list() returns a Page you can also iterate.
let page = await warmbly.campaigns.list({ limit: 25, status: "active" });
console.log("first page count", page.data.length, "total", page.pagination.total);
while (page.hasNextPage()) {
  // nextPage() returns the following Page, or null on the last one.
  page = (await page.nextPage())!;
  console.log("next page count", page.data.length);
}

// 5. Inspect the sequence steps, then append a follow-up step. createStep adds
// a new empty step to the sequence; fill in its content with updateStep.
const steps = await warmbly.campaigns.listSteps(campaign.id);
console.log("existing steps", steps.length);
const step = await warmbly.campaigns.createStep(campaign.id);
await warmbly.campaigns.updateStep(campaign.id, step.id, {
  subject: "Following up",
  body: "Hi {{first_name}}, just circling back.",
  delay_days: 3,
});
console.log("added step", step.id, "at position", step.position);

// 6. Send a test email so you can preview the sequence before launching.
await warmbly.campaigns.testEmail(campaign.id, { to: "dev@warmbly.com" });
console.log("test email sent");

// 7. Start the campaign, then stop it again.
await warmbly.campaigns.start(campaign.id);
console.log("campaign started");
await warmbly.campaigns.stop(campaign.id);
console.log("campaign stopped");

// 8. Read the campaign logs. logs() is also a Page; iterate to walk every entry.
const logsPage = await warmbly.campaigns.logs(campaign.id, { limit: 50 });
for (const entry of logsPage.data) {
  console.log("log", entry);
}
