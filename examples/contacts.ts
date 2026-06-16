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

// 3. Look up a single contact by email.
const found = await warmbly.contacts.lookup({ email: "jordan@warmbly.com" });
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

// 7. Bulk update many contacts at once (filter selects, set applies the change).
await warmbly.contacts.bulkUpdate({
  filter: { company: "Acme Inc" },
  set: { custom_fields: { segment: "enterprise" } },
});
console.log("bulk update done");

// 8. Kick off an export job (returns a job descriptor you can poll elsewhere).
const job = await warmbly.contacts.export({ format: "csv" });
console.log("export started", job);
