/**
 * Working with contacts: add, search, lookup by email, read/update one, attach a
 * note, read the timeline and activities, bulk update, and start an export.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/contacts.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Add contacts in a batch. add() takes an array of AddContactParams (email required).
await warmbly.contacts.add([
  { email: "jordan@warmbly.com", first_name: "Jane", last_name: "Doe", company: "Warmbly" },
  { email: "sam@warmbly.com", first_name: "Sam", company: "Warmbly" },
]);
console.log("contacts added");

// 2. Search contacts. POST /contacts/search is the list endpoint; it returns a Page.
//    Iterate to walk every match across pages.
const results = await warmbly.contacts.search({ query: "acme.com", limit: 50 });
for await (const c of results) {
  console.log("match", c.id, c.email);
}

// 3. Look up a single contact by email. An unknown sender is a 200 with `contact: null`,
//    not a 404, so check before using it.
const { contact: found } = await warmbly.contacts.lookup({ email: "jordan@warmbly.com" });
if (!found) throw new Error("no contact with that address");
console.log("looked up", found.id, found.first_name);

// 4. Get that contact by id and update a field.
const contact = await warmbly.contacts.get(found.id);
const updated = await warmbly.contacts.update(contact.id, { company: "Acme Inc" });
console.log("updated company", updated.company);

// 5. Attach a note to the contact.
const note = await warmbly.contacts.createNote(contact.id, { content: "Called, left voicemail." });
console.log("note added", note.id);

// 6. Read the activity timeline and the activities feed for the contact.
const timeline = await warmbly.contacts.timeline(contact.id);
console.log("timeline", timeline);
const activities = await warmbly.contacts.activities(contact.id);
console.log("activities", activities);

// 7. Bulk update many contacts at once. The selection is either an id list or a filter
//    ("select all matching") minus the ids you unticked; `fields` edits custom fields.
await warmbly.contacts.bulkUpdate({
  all: true,
  filters: { query: "Acme Inc" },
  fields: [{ type: "ADD", key: "segment", value: "enterprise" }],
});
console.log("bulk update done");

// 8. Export contacts. The response is the file itself: CSV text here (capped at 50,000 rows).
const csv = await warmbly.contacts.export({ format: "csv", scope: "all" });
console.log("exported", typeof csv === "string" ? csv.split("\n").length - 1 : 0, "rows");

// 9. Import a file in the background: upload it as a draft, check what it would do under
//    your mapping, then start it. (Node 20+ has global Blob.)
const draft = await warmbly.contacts.createImport(
  new Blob(["email,first_name\njordan@warmbly.com,Jordan\n"], { type: "text/csv" }),
  { filename: "leads.csv" },
);
const options = {
  mapping: draft.preview?.suggested_mapping ?? [{ index: 0, target: "email" }],
  has_header: true,
  dedup: "update" as const,
};
const analysis = await warmbly.contacts.analyzeImport(draft.id, {
  mapping: options.mapping,
  has_header: true,
});
console.log("would create", analysis.new, "and update", analysis.existing);
if (!analysis.problem) {
  const started = await warmbly.contacts.startImport(draft.id, options);
  console.log("import", started.id, started.status);
}
