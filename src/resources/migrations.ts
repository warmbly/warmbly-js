import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** The outreach tool a migration reads from. */
export type ToolMigrationProviderId =
  | "apollo"
  | "instantly"
  | "lemlist"
  | "mailshake"
  | "quickmail"
  | "replyio"
  | "saleshandy"
  | "smartlead"
  | "snovio"
  | "woodpecker"
  | (string & {});

/** A kind of data a migration can bring over. */
export type ToolMigrationKind = "mailboxes" | "campaigns" | "leads" | "blocklist" | (string & {});

/**
 * Where a migration stands. `scanning` reads the source account, `ready` has a preview and
 * waits for {@link Migrations.start}, `running` is bringing data over.
 */
export type ToolMigrationStatus =
  | "scanning"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | (string & {});

/**
 * What happens to a lead the old tool was part way through a sequence with. `restart`
 * enrolls it from the first step, `skip` (the default) imports the contact without enrolling
 * it. `continue` is refused by the server.
 */
export type ToolMigrationInFlight = "continue" | "restart" | "skip" | (string & {});

/** One target's progress. */
export type ToolMigrationTargetStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | (string & {});

/** How a source mailbox signs in. */
export type ToolMigrationMailboxKind =
  | "google"
  | "microsoft"
  | "smtp_imap"
  | "unknown"
  | (string & {});

/** A campaign's state in the source tool. */
export type ToolMigrationCampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived"
  | (string & {});

/** One credential field a provider asks for. */
export interface ToolMigrationProviderField {
  /** The key to use inside each `credentials` object. */
  key: string;
  label: string;
  help?: string;
  secret: boolean;
  optional?: boolean;
  placeholder?: string;
  /** The allowed values, when the field is a choice. */
  options?: string[];
  [key: string]: unknown;
}

/** A tool the workspace can migrate from, from {@link Migrations.providers}. */
export interface ToolMigrationProvider {
  id: ToolMigrationProviderId;
  label: string;
  /** The credential fields one key needs. */
  fields: ToolMigrationProviderField[];
  /** Where to find the key, in words. */
  key_help: string;
  key_url?: string;
  /** What the tool's API shares. */
  kinds: ToolMigrationKind[];
  /** Whether the tool has more than one workspace per account. */
  workspaces: boolean;
  /** Whether more than one key can be added to one migration. */
  multi_key: boolean;
  /** Whether the tool returns mailbox passwords, so SMTP/IMAP mailboxes connect on their own. */
  mailbox_secrets: boolean;
  notes?: string[];
  [key: string]: unknown;
}

/** Who a pasted key acts as. */
export interface ToolMigrationAccount {
  name?: string;
  email?: string;
  plan?: string;
  [key: string]: unknown;
}

/** One workspace in the source tool. */
export interface ToolMigrationSourceWorkspace {
  /** Empty for a tool with a single workspace per account. */
  id: string;
  name: string;
  /** The index of the key (in `credentials`) that reads it. Absent for the first key. */
  key?: number;
  [key: string]: unknown;
}

/** One campaign the scan found. */
export interface ToolMigrationCampaignSummary {
  id: string;
  name: string;
  status: ToolMigrationCampaignStatus;
  steps: number;
  leads: number;
  [key: string]: unknown;
}

/** What a source workspace holds. */
export interface ToolMigrationInventory {
  mailboxes: number;
  campaigns: number;
  leads: number;
  blocklist: number;
  campaign_summaries?: ToolMigrationCampaignSummary[];
  [key: string]: unknown;
}

/** One source workspace and what the scan found in it. */
export interface ToolMigrationWorkspace {
  workspace: ToolMigrationSourceWorkspace;
  inventory: ToolMigrationInventory;
  error?: string;
  [key: string]: unknown;
}

/** The choices made before a migration starts. */
export interface ToolMigrationOptions {
  kinds: ToolMigrationKind[];
  /** Source campaign ids to bring (with their leads); empty or absent brings every campaign. */
  campaign_ids?: string[];
  in_flight: ToolMigrationInFlight;
  /** Leaves out campaigns the source marks completed or archived. */
  skip_finished: boolean;
  /** Starts warmup on mailboxes that connect, unless the source said off. */
  warmup: boolean;
  [key: string]: unknown;
}

/** What one target brought over. */
export interface ToolMigrationCounts {
  blocklist_imported: number;
  mailboxes_queued: number;
  mailboxes_manual: number;
  campaigns_created: number;
  campaigns_skipped: number;
  steps_created: number;
  leads_read: number;
  contacts_imported: number;
  contacts_updated: number;
  leads_enrolled: number;
  leads_not_enrolled: number;
  leads_suppressed: number;
  leads_failed: number;
  [key: string]: unknown;
}

/** A mailbox its owner still has to connect. */
export interface ToolMigrationMailbox {
  email: string;
  kind: ToolMigrationMailboxKind;
  [key: string]: unknown;
}

/** One draft campaign a migration created. */
export interface ToolMigrationCampaign {
  source_id: string;
  campaign_id: string;
  name: string;
  /**
   * Source sender addresses with no mailbox in the workspace yet. Once connected, link them
   * with {@link Migrations.linkSenders}.
   */
  missing_senders?: string[];
  [key: string]: unknown;
}

/** What a person still has to do after a target ran. */
export interface ToolMigrationFollowup {
  /** Mailboxes that sign in with Google or Microsoft, or whose password the source keeps. */
  reconnect?: ToolMigrationMailbox[];
  /** Things that did not carry over, such as LinkedIn steps. */
  notes?: string[];
  /** The draft campaigns created, for review before launch. */
  campaigns?: ToolMigrationCampaign[];
  [key: string]: unknown;
}

/** One source workspace brought into one Warmbly workspace. */
export interface ToolMigrationTarget {
  id: string;
  migration_id: string;
  workspace: ToolMigrationSourceWorkspace;
  organization_id: string;
  organization_name?: string;
  status: ToolMigrationTargetStatus;
  /** The kind being imported now; absent before the first. */
  phase?: ToolMigrationKind;
  counts: ToolMigrationCounts;
  followup: ToolMigrationFollowup;
  error?: string;
  /** The mailbox import that connects mailboxes the source returned passwords for. */
  mailbox_import_id?: string;
  /** The contact category every imported contact is filed under. */
  category_id?: string;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
  [key: string]: unknown;
}

/** One import from another outreach tool. */
export interface ToolMigration {
  id: string;
  organization_id?: string;
  /** Set on an agency's migration instead of `organization_id`. */
  agency_id?: string;
  created_by_user_id?: string;
  provider: ToolMigrationProviderId;
  label: string;
  status: ToolMigrationStatus;
  /** Who each pasted key acts as, in the order they were added. */
  accounts: ToolMigrationAccount[];
  /** What the scan found, one entry per source workspace. */
  inventory: ToolMigrationWorkspace[];
  /** Set once the migration has started. */
  options?: ToolMigrationOptions;
  targets: ToolMigrationTarget[];
  error?: string;
  /** False once the keys are wiped: when the migration finishes, is canceled or dismissed. */
  credentials_held: boolean;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Query params for {@link Migrations.list}. */
export interface ListToolMigrationsParams {
  /** 1..100, default 20. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Body of {@link Migrations.create}. */
export interface CreateToolMigrationParams {
  provider: ToolMigrationProviderId;
  label?: string;
  /**
   * One object per key, keyed by the provider's field `key`s. More than one only where the
   * provider's `multi_key` is true.
   */
  credentials: Array<Record<string, string>>;
  [key: string]: unknown;
}

/** Where one source workspace goes. A workspace's own migration only uses `skip`. */
export interface ToolMigrationTargetChoice {
  /** The source workspace id, from `inventory[].workspace.id`. */
  workspace_id: string;
  /** The key index, from `inventory[].workspace.key` (0 when absent). */
  key: number;
  /** An existing client workspace (agency migrations). */
  organization_id?: string;
  /** Creates a new client workspace with this name (agency migrations). */
  create_name?: string;
  /** Leaves this source workspace out. */
  skip?: boolean;
  [key: string]: unknown;
}

/** Body of {@link Migrations.start}. */
export interface StartToolMigrationParams {
  options: Partial<ToolMigrationOptions> & { kinds: ToolMigrationKind[] };
  /** Entries to leave source workspaces out; every other one lands in this workspace. */
  targets?: ToolMigrationTargetChoice[];
  [key: string]: unknown;
}

/**
 * Migrations from another outreach tool (Instantly, Smartlead, lemlist and others): check the
 * keys and scan, preview what the account holds, then bring mailboxes, campaigns, leads and
 * the blocklist over. Every route needs `IMPORT_TOOLS`; a key or role limited to selected
 * mailboxes or campaigns is refused, and starting also needs the permissions of the kinds
 * chosen. Reachable as `warmbly.migrations`.
 *
 * @example
 * const m = await warmbly.migrations.create({
 *   provider: "instantly",
 *   credentials: [{ api_key: "..." }],
 * });
 * // poll until the scan is done
 * const ready = await warmbly.migrations.get(m.id);
 * if (ready.status === "ready") {
 *   await warmbly.migrations.start(m.id, {
 *     options: { kinds: ["campaigns", "leads"], in_flight: "restart" },
 *   });
 * }
 */
export class Migrations extends APIResource {
  /**
   * Lists the tools this instance can migrate from, with the credential fields each asks
   * for. Empty when migrations are off. Needs `IMPORT_TOOLS`.
   * @example
   * const providers = await warmbly.migrations.providers();
   * const fields = providers.find((p) => p.id === "smartlead")?.fields;
   */
  providers(opts?: RequestOptions): Promise<ToolMigrationProvider[]> {
    return this.http
      .get<{ data: ToolMigrationProvider[] }>("migrations/providers", opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Lists the workspace's migrations, newest first, auto-paginating when iterated. Needs
   * `IMPORT_TOOLS`.
   * @example
   * for await (const m of await warmbly.migrations.list()) console.log(m.provider, m.status);
   */
  list(params?: ListToolMigrationsParams, opts?: RequestOptions): Promise<Page<ToolMigration>> {
    return this.http.getPage<ToolMigration>("migrations", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Checks every key with the tool and starts the scan (201, status `scanning`). A refused
   * key is a 422 `tool_migration_key_rejected` and nothing is stored. Needs `IMPORT_TOOLS`.
   * @example
   * const m = await warmbly.migrations.create({
   *   provider: "smartlead",
   *   label: "Old Smartlead",
   *   credentials: [{ api_key: "sl_..." }],
   * });
   */
  create(params: CreateToolMigrationParams, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.post<ToolMigration>("migrations", { ...opts, body: params });
  }

  /**
   * Retrieves one migration with its `inventory` per source workspace and its `targets`.
   * Needs `IMPORT_TOOLS`.
   * @example
   * const m = await warmbly.migrations.get("mig_1");
   */
  get(id: string, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.get<ToolMigration>(this.path("migrations", id), opts);
  }

  /**
   * Starts a `ready` migration with the chosen kinds and options. A retry of a start that
   * already went through answers the running migration. Needs `IMPORT_TOOLS` plus the
   * permissions of the kinds chosen.
   * @example
   * await warmbly.migrations.start("mig_1", {
   *   options: { kinds: ["mailboxes", "campaigns", "leads"], in_flight: "skip", warmup: true },
   * });
   */
  start(
    id: string,
    params: StartToolMigrationParams,
    opts?: RequestOptions,
  ): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(this.path("migrations", id, "start"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Stops a migration at its next checkpoint, keeping what already came over. Needs
   * `IMPORT_TOOLS`.
   * @example
   * await warmbly.migrations.cancel("mig_1");
   */
  cancel(id: string, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(this.path("migrations", id, "cancel"), opts);
  }

  /**
   * Adds mailboxes connected since the run to the draft campaigns that named them as
   * senders. A second call changes nothing more. Needs `IMPORT_TOOLS`.
   * @example
   * const m = await warmbly.migrations.linkSenders("mig_1");
   */
  linkSenders(id: string, opts?: RequestOptions): Promise<ToolMigration> {
    return this.http.post<ToolMigration>(this.path("migrations", id, "link-senders"), opts);
  }

  /**
   * Dismisses a migration that is not scanning or running from the list (204), keeping
   * everything it imported. A 409 `tool_migration_running` otherwise. Needs `IMPORT_TOOLS`.
   * @example
   * await warmbly.migrations.delete("mig_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("migrations", id), opts);
  }
}
