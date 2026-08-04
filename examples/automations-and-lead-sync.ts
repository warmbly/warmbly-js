/**
 * Automations (the visual flow builder), meetings, and Google Sheets lead sync.
 * All three sit behind operational scopes: INTEGRATIONS for automations, READ/WRITE_CONTACTS
 * for meetings, WRITE_CONTACTS for lead sync (it ultimately upserts contacts).
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/automations-and-lead-sync.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// --- Automations ------------------------------------------------------------

// 1. A flow is a trigger node plus action nodes, wired by edges. Condition nodes have
//    "true"/"false" outgoing edges; an "ai" condition asks a plain-language yes/no
//    question and costs one credit per evaluation.
const created = await warmbly.automations.create({
  name: "Tag hot replies",
  enabled: true,
  trigger_event: "inbox.reply_received",
  graph: {
    nodes: [
      { id: "trigger", type: "trigger", x: 0, y: 0 },
      {
        id: "is_interested",
        type: "condition",
        condition: { field: "ai", operator: "is", prompt: "Is this reply expressing interest?" },
        x: 220,
        y: 0,
      },
    ],
    edges: [{ id: "e1", source: "trigger", target: "is_interested" }],
  },
});
console.log("created", created.id);

// An inbound-webhook trigger gets a public URL whose token is the credential.
if (created.inbound_url) console.log("fires on POST to", created.inbound_url);

// 2. Update is a full write, so read the flow back first if you only mean to flip a field.
const current = await warmbly.automations.get(created.id);
await warmbly.automations.update(created.id, {
  name: current.name ?? "Tag hot replies",
  enabled: false,
  trigger_event: current.trigger_event ?? "inbox.reply_received",
  graph: current.graph ?? { nodes: [], edges: [] },
});

// 3. Node positions persist separately: cosmetic, unaudited, last-write-wins, and they
//    do not bump updated_at — so dragging nodes never reads as a content change.
await warmbly.automations.setLayout(created.id, {
  positions: [{ id: "is_interested", x: 260, y: 40 }],
});

// 4. Dry-run the flow against sample data: no side effects, and you get the path taken.
console.log("test", await warmbly.automations.test(created.id, {
  data: { from: "jordan@acme.com", body: "Yes, let's talk next week." },
}));

// 5. Run history.
for (const run of await warmbly.automations.runs(created.id, { limit: 10 })) {
  console.log("run", run.id, run.status);
}

// Deleting returns 409 while campaign steps still reference the flow.
await warmbly.automations.delete(created.id);

// --- Meetings ---------------------------------------------------------------

// 6. Booked calls captured from Calendly/Cal.com, plus ones you log by hand.
const upcoming = await warmbly.meetings.list({ timeframe: "upcoming", limit: 25 });
for (const meeting of upcoming.data) {
  console.log(meeting.scheduled_for, meeting.invitee_email, meeting.status, meeting.source);
}
console.log("summary", await warmbly.meetings.summary());

// A manually logged meeting is attributed to a contact by explicit id or by email match.
// Unlike an auto-captured booking it fires no "a prospect booked a call" alerts at you.
const logged = await warmbly.meetings.create({
  title: "Intro call",
  invitee_email: "jordan@acme.com",
  scheduled_for: "2026-08-10T15:00:00Z",
  duration_minutes: 30,
  location: "Google Meet",
});
console.log("logged", logged.id);

// --- Lead sync --------------------------------------------------------------

// 7. Connect the Google account through the integrations OAuth flow with provider
//    "google_sheets" first — that handshake is JWT-only and not reachable with a key.
const google = await warmbly.leadSync.googleConnection();
if (!google.connected) {
  console.log("connect a Google account in the dashboard first");
} else {
  const connectionId = google.connection?.id ?? "";

  // 8. Read the sheet's tabs and headers, then preview what a sync would import.
  const sheetId = process.env.WARMBLY_SHEET_ID ?? "";
  console.log("sheet", await warmbly.leadSync.spreadsheet({ connection_id: connectionId, sheet_id: sheetId }));
  console.log("preview", await warmbly.leadSync.preview({
    connection_id: connectionId,
    sheet_id: sheetId,
    tab_title: "Leads",
  }));

  // 9. Save it as a source you re-run with "Sync now". New rows create contacts;
  //    rows matched by email follow the dedup strategy.
  const source = await warmbly.leadSync.createSource({
    connection_id: connectionId,
    sheet_id: sheetId,
    tab_title: "Leads",
    has_header: true,
    dedup: "update",
    label: "Weekly leads",
    column_mapping: [
      { index: 0, target: "email" },
      { index: 1, target: "first_name" },
      { index: 2, target: "custom:industry", custom_key: "industry" },
    ],
  });

  const result = await warmbly.leadSync.syncNow(source.id);
  console.log("synced", result);
  console.log("last run", (await warmbly.leadSync.getSource(source.id)).last_result);
}
