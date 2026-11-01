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
  body_plain: "Hi {{first_name}}, just circling back.",
  wait_after: 3,
  // Reply in the thread the first email started (the default) instead of opening a new one.
  thread_reply: true,
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

// 8. See what the campaign will send today and which limit decided it.
const plan = await warmbly.campaigns.sendPlan(campaign.id);
console.log("projected today", plan.projected_today, "bottleneck", plan.bottleneck || "none");
for (const limit of plan.limits) console.log("  limit", limit.kind, "removed", limit.emails);

// 9. Park one lead's flow until a date (they stay subscribed), copy a colleague on it,
//    then lift the hold.
const leadId = "c_1";
await warmbly.campaigns.pauseLead(campaign.id, leadId, { until: "2026-11-01T00:00:00Z" });
console.log((await warmbly.campaigns.getLeadHold(campaign.id, leadId)).hold?.source);
const { cc } = await warmbly.campaigns.setLeadCC(campaign.id, leadId, ["c_2"]);
console.log("copying", cc.map((c) => c.email));
await warmbly.campaigns.resumeLead(campaign.id, leadId);

// 10. Re-test inbox placement every week and pause the campaign if it drops.
const monitor = await warmbly.campaigns.putPlacementMonitor(campaign.id, {
  interval_days: 7,
  alert_below: 80,
  pause_on_alert: true,
});
console.log("next placement test", monitor.next_run_at);

// 11. Read the campaign logs. logs() is also a Page; iterate to walk every entry.
const logsPage = await warmbly.campaigns.logs(campaign.id, { limit: 50 });
for (const entry of logsPage.data) {
  console.log("log", entry);
}
