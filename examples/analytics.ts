/**
 * Analytics tour: dashboard, deliverability, warmup, usage, per-account, and
 * per-campaign reports (including daily and hourly buckets) over a time window.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/analytics.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// A reusable time window. All analytics methods accept these optional params
// (from / to as ISO dates, interval as the bucket granularity).
const window = {
  from: "2026-06-01",
  to: "2026-06-15",
};

// Top-level dashboard: the headline numbers for the whole workspace.
const dashboard = await warmbly.analytics.dashboard(window);
console.log("dashboard", dashboard);

// Deliverability: inbox placement, bounces, spam complaints, and the like.
const deliverability = await warmbly.analytics.deliverability(window);
console.log("deliverability", deliverability);

// Warmup health across your mailboxes.
const warmup = await warmbly.analytics.warmup(window);
console.log("warmup", warmup);

// Usage: how much of your plan budget you have consumed in the window.
const usage = await warmbly.analytics.usage(window);
console.log("usage", usage);

// Per-account analytics across every connected mailbox.
const accounts = await warmbly.analytics.accounts(window);
console.log("all accounts", accounts);

// Drill into a single account by id.
const account = await warmbly.analytics.account("acc_1", window);
console.log("account acc_1", account);

// Compare several campaigns side by side. Extra filters (like ids) ride along
// in the query because AnalyticsParams is open.
const comparison = await warmbly.analytics.compareCampaigns({
  ...window,
  ids: ["c_1", "c_2"],
});
console.log("campaign comparison", comparison);

// Per-campaign summary.
const campaign = await warmbly.analytics.campaign("c_1", window);
console.log("campaign c_1", campaign);

// Daily-bucketed series for one campaign (good for charting trends).
const daily = await warmbly.analytics.campaignDaily("c_1", {
  ...window,
  interval: "day",
});
console.log("campaign c_1 daily", daily);

// Hourly-bucketed series for one campaign over a single busy day.
const hourly = await warmbly.analytics.campaignHourly("c_1", {
  from: "2026-06-10",
  to: "2026-06-11",
  interval: "hour",
});
console.log("campaign c_1 hourly", hourly);
