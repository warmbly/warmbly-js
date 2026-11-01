/**
 * CRM sync tour: HubSpot or Pipedrive as the workspace CRM (settings, owners, sync health,
 * a contact's provider record, list imports), the native Salesforce sync (health, settings,
 * imports, the activity log), a contact's Salesforce panel, and the CRM_SYNCED gateway event.
 * Run with: WARMBLY_API_KEY=wmbly_... SALESFORCE_CONNECTION_ID=... npx tsx examples/crm-sync.ts
 */
import { ConflictError, Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// --- HubSpot or Pipedrive as the CRM ---------------------------------------

// Which CRM the workspace runs on, and the connected account.
const settings = await warmbly.crm.getSettings();
console.log("crm mode", settings.provider, settings.account?.name ?? "(none)");

if (settings.provider !== "native") {
  // Owners in the provider and the members they match.
  for (const owner of await warmbly.crm.listOwners()) {
    console.log("owner", owner.email, owner.user_id ?? "unmatched");
  }

  // What is waiting and what failed; requeue every failure.
  const health = await warmbly.crm.syncHealth();
  console.log("sync", health.pending, "pending", health.failed, "failed");
  if (health.failed > 0) {
    const { affected } = await warmbly.crm.retrySyncFailures();
    console.log("requeued", affected);
  }

  // The provider side of one contact, refreshed now.
  const record = await warmbly.crm.refreshContactRecord("c_1");
  console.log("contact", record.linked, record.lifecycle_stage?.label, record.url);

  // Turn a provider list into a contact import draft.
  const lists = await warmbly.crm.listLists({ limit: 10 });
  const [list] = lists.data;
  if (list) {
    const preview = await warmbly.crm.previewListImport({ list_id: list.external_id });
    console.log("list", preview.list_name, preview.included, "of", preview.total);
    const { import_id } = await warmbly.crm.importList(
      { list_id: list.external_id, apply_guards: true },
      { idempotencyKey: `crm-list-${list.external_id}` },
    );
    console.log("import draft", import_id);
  }
}

// --- Native Salesforce sync -----------------------------------------------

const connectionId = process.env.SALESFORCE_CONNECTION_ID;
if (connectionId) {
  const sf = warmbly.integrations.salesforce;

  const overview = await sf.overview(connectionId, { checks: true });
  console.log("salesforce", overview.health, overview.org.instance_url);
  for (const check of overview.checks ?? []) console.log(" check", check.label, check.ok);

  // Read the settings, change one switch, write the whole document back.
  const { settings: sfSettings } = await sf.getSettings(connectionId);
  await sf.updateSettings(connectionId, {
    ...sfSettings,
    activity: { ...sfSettings.activity, opened: false },
  });

  // Import a Lead list view on a schedule.
  const [view] = await sf.listViews(connectionId, "Lead");
  if (view) {
    const source = await sf.createImportSource(
      connectionId,
      { source_kind: "list_view", object: "Lead", source_id: view.id, recurring: true },
      { idempotencyKey: `sf-import-${view.id}` },
    );
    try {
      await sf.runImportSource(connectionId, source.id);
    } catch (err) {
      // The create already started the first run.
      if (!(err instanceof ConflictError && err.code === "import_running")) throw err;
    }
  }

  // Retry the activity rows that failed.
  const failed: string[] = [];
  for await (const row of await sf.listActivity(connectionId, { status: "failed" })) {
    failed.push(row.id);
    if (failed.length === 500) break;
  }
  if (failed.length > 0) console.log("requeued", (await sf.retryActivity(connectionId, failed)).requeued);

  // A contact's linked Leads and Contacts, with opportunities and recent Tasks.
  const panel = await warmbly.contacts.salesforce("c_1");
  for (const r of panel.records) console.log(r.object, r.name, r.opportunities.length, "opps");
}

// --- Realtime: refetch when the CRM changes ---------------------------------

const gw = warmbly.gateway({ orgId: process.env.WARMBLY_ORG_ID ?? "org_1", intents: ["CRM"] });
gw.on("CRM_SYNCED", (e) => console.log("crm changed", e.objects, e.contact_id));
await gw.connect();
gw.close();
