/**
 * Client reports and tool migrations.
 * Builds a client report, previews it, shares it by public link and emails it weekly.
 * Then connects an account from another outreach tool, waits for the scan and starts
 * the import.
 *
 * Needs READ_ANALYTICS and MANAGE_REPORTS for reports, IMPORT_TOOLS for migrations.
 * Run with: WARMBLY_API_KEY=wmbly_... SMARTLEAD_KEY=... npx tsx examples/reports-and-migrations.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// ---------------------------------------------------------------------------
// Client reports
// ---------------------------------------------------------------------------
const report = await warmbly.reports.create({ name: "Acme weekly", date_range: "last_7_days" });

const view = await warmbly.reports.preview(report.id, { range: "last_30_days" });
console.log("preview overview:", view.overview);

// A public link anyone can open; the token is only in this response.
const { url } = await warmbly.reports.createLink(report.id, { expires_in_days: 30 });
console.log("share:", url);

// Email it every Monday at 9:00 in the client's time zone.
await warmbly.reports.setSchedule(report.id, {
  recipients: ["client@example.com"],
  cadence: "weekly",
  weekday: 1,
  hour: 9,
  timezone: "Europe/London",
});

for await (const r of await warmbly.reports.list()) console.log(r.name, r.schedule?.cadence);

// ---------------------------------------------------------------------------
// Migrations from another outreach tool
// ---------------------------------------------------------------------------
const providers = await warmbly.migrations.providers();
console.log(
  "can migrate from:",
  providers.map((p) => p.id),
);

let migration = await warmbly.migrations.create({
  provider: "smartlead",
  credentials: [{ api_key: process.env.SMARTLEAD_KEY ?? "" }],
});

// The source account is scanned first; poll until there is a preview.
while (migration.status === "scanning") {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  migration = await warmbly.migrations.get(migration.id);
}

if (migration.status === "ready") {
  migration = await warmbly.migrations.start(migration.id, {
    options: { kinds: ["mailboxes", "campaigns", "leads", "blocklist"], warmup: true },
  });
  console.log("migration", migration.id, migration.status);
}
