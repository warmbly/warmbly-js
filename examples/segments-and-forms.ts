/**
 * Segments and hosted forms: build a live audience, preview and pin members, link it to
 * a campaign as a continuous lead source, then capture new leads with a hosted form.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/segments-and-forms.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Discover the fields a condition can name. Custom fields appear as custom.<key>.
const fields = await warmbly.segments.fields();
console.log("segment fields", fields.map((f) => `${f.field} (${f.kind})`).join(", "));

// 2. Preview a definition before saving it. Nothing is written.
const conditions = [
  { field: "custom.industry", operator: "equals", value: "fintech" },
  { field: "last_opened_at", operator: "within_days", value: "30" },
  { field: "emails_replied", operator: "equals", value: "0" },
];
const { contact_count } = await warmbly.segments.preview({ match: "all", conditions });
console.log("would match", contact_count, "contacts");

// 3. Create the segment and pin one contact into it by hand.
const segment = await warmbly.segments.create({
  name: "Warm fintech leads",
  description: "Opened in the last 30 days, not yet replied",
  color: "#0284c7",
  match: "all",
  conditions,
});
const contactId = process.env.WARMBLY_CONTACT_ID;
if (contactId) {
  await warmbly.segments.setMembers(segment.id, { contacts: [contactId], mode: "include" });
  const modes = await warmbly.segments.memberModes(segment.id, [contactId]);
  console.log("override on", contactId, modes[contactId]);
}

// 4. Estimate a send to this audience before a campaign exists.
const estimate = await warmbly.campaigns.estimate({ segment_ids: [segment.id], daily_limit: 40 });
console.log("estimate", estimate.recipients, "recipients over", estimate.sending_days, "days");

// 5. Link it to a campaign as a live audience source. Every current member is enrolled now;
//    later joiners are enrolled automatically. A continuous campaign waits for them instead
//    of finishing when it runs out of leads.
const campaign = await warmbly.campaigns.create({ name: "Fintech outbound", continuous: true });
const { added } = await warmbly.campaigns.setSegments(campaign.id, [segment.id]);
console.log("enrolled", added, "leads;", (await warmbly.campaigns.listSegments(campaign.id)).length, "linked");

// 6. Or take a one-time snapshot instead of a live link.
const snapshot = await warmbly.segments.addToCampaign(segment.id, { campaign_id: campaign.id });
console.log("snapshot enrolled", snapshot.added, "of", snapshot.members, "members");

// 7. A hosted form that creates contacts and drops them into the campaign.
const form = await warmbly.forms.create({ name: "Demo request" });
const published = await warmbly.forms.update(form.id, {
  status: "published",
  campaign_id: campaign.id,
  success_message: "Thanks, we will be in touch.",
});
console.log("share this URL:", published.share_url);

// 8. Mint a personalized link for a contact (idempotent: the same token every time).
if (contactId) {
  const { url } = await warmbly.forms.mintLink(form.id, contactId);
  console.log("personalized link", url);
}

// 9. Read what happened: submissions, the funnel, and the campaign-side view.
const { data: submissions, has_more } = await warmbly.forms.listSubmissions(form.id, { limit: 20 });
console.log(submissions.length, "submissions", has_more ? "(more available)" : "");
const stats = await warmbly.forms.stats(form.id, { range: "30d" });
console.log("views", stats.totals?.views, "submissions", stats.totals?.submissions);
for (const f of await warmbly.campaigns.forms(campaign.id)) {
  console.log("campaign form", f.form_name, "links sent", f.links_sent, "submitted", f.submissions);
}

// 10. The contact-side view of segments and campaign progress.
if (contactId) {
  const memberships = await warmbly.contacts.segments(contactId);
  console.log("member of", memberships.filter((m) => m.member).map((m) => m.name));
  for (const state of await warmbly.contacts.campaigns(contactId)) {
    console.log(state.campaign_name, state.lead_status, "next:", state.next?.state ?? state.ended_reason);
  }
}
