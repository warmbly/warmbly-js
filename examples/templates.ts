/**
 * Templates tour: list, create, get, update, duplicate, render with a sample
 * contact's variables, score, and reorder.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/templates.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// List templates. This endpoint is not paginated; it returns the full set as
// an array. Pass `q` to search by name, subject, or body.
const templates = await warmbly.templates.list();
console.log(
  "existing templates",
  templates.map((t) => t.name),
);

// Create a new template. Subject and bodies may contain {{.Variable}} placeholders that
// get filled in at render time.
const template = await warmbly.templates.create({
  name: "Intro outreach",
  subject: "Quick question, {{.FirstName}}",
  body_plain: "Hi {{.FirstName}} at {{.Company}}, are you the right person to talk to?",
});
console.log("created", template.id);

// Fetch it back by id.
const fetched = await warmbly.templates.get(template.id);
console.log("fetched subject", fetched.subject);

// Update the subject line.
const updated = await warmbly.templates.update(template.id, {
  subject: "A quick idea for {{.Company}}",
});
console.log("updated subject", updated.subject);

// Duplicate the template to branch off a variant.
const copy = await warmbly.templates.duplicate(template.id, {
  name: "Intro outreach (variant B)",
});
console.log("duplicated into", copy.id);

// Render the template with a sample contact's field values. The variables map
// is substituted into the subject and both bodies.
const rendered = await warmbly.templates.render(template.id, {
  variables: {
    FirstName: "Sam",
    Company: "Warmbly",
  },
});
console.log("rendered", rendered);

// Score a draft for quality and deliverability before you send it. Scoring
// takes raw content rather than a template id.
const score = await warmbly.templates.score({
  subject: updated.subject,
  body_plain: fetched.body_plain,
});
console.log("score", score.score, score.issues.map((i) => i.message));

// For located findings and rewrites, run the AI spam analysis. It charges AI credits.
const analysis = await warmbly.templates.analyze({
  subject: updated.subject,
  body_plain: fetched.body_plain,
});
for (const finding of analysis.findings) {
  console.log(finding.severity, finding.text, "->", finding.suggestion);
}

// Reorder how templates appear in the UI by passing the desired id order.
const reordered = await warmbly.templates.reorder({
  ids: [copy.id, template.id],
});
console.log("reordered", reordered.map((t) => t.id));
