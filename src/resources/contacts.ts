import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";
import type { ImportColumnMapping } from "./lead-sync";

/** An address verification verdict in Warmbly's vocabulary. */
export type VerificationStatus = "valid" | "risky" | "invalid" | "unknown";

/** How a contact came to exist. */
export type ContactSource =
  | "manual"
  | "campaign"
  | "import"
  | "sheet_sync"
  | "api"
  | "form"
  | "automation"
  | "ai_assistant"
  | "crm_sync"
  | "apollo"
  | "clay"
  | "lead_finder"
  | "unknown"
  | (string & {});

/** A Warmbly contact. Documented-but-open shape. */
export interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  phone?: string;
  custom_fields?: Record<string, string>;
  subscribed?: boolean;
  verification_status?: VerificationStatus | (string & {});
  verification_sub_status?: string;
  /** `probe`, `provider`, `imported`, `manual`, or empty when never checked. */
  verification_source?: string;
  verification_provider?: string;
  verification_reason?: string;
  verification_checked_at?: string | null;
  /** 0..100, scored from the check plus what real mail to the address showed. */
  verification_confidence?: number;
  /** Set while a member-requested re-check waits to run; the verdict above stands until it lands. */
  verification_requested_at?: string | null;
  /** Who hosts the contact's inbox (read from the domain's MX); empty until the sweep has run. */
  mail_host?: string;
  /** The family of `mail_host` used for campaign ESP matching: empty, `gmail`, `outlook` or `other`. */
  esp_provider?: string;
  esp_resolved_at?: string | null;
  /** The contact's engagement across every campaign. Present on search rows. */
  outreach?: ContactOutreach;
  /** First-touch attribution, fixed at creation. */
  source?: ContactSource;
  source_detail?: string;
  first_seen_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Where a contact stands with your outreach, summed across every campaign. */
export interface ContactOutreach {
  sent: number;
  /** Human opens only; a mail client's automatic fetch is not counted. */
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  last_sent_at?: string;
  last_opened_at?: string;
  last_clicked_at?: string;
  last_replied_at?: string;
  last_bounced_at?: string;
  [key: string]: unknown;
}

/** Body fields for adding a contact. */
export interface AddContactParams {
  first_name?: string;
  last_name?: string;
  email: string;
  company?: string;
  phone?: string;
  campaigns?: string[];
  categories?: string[];
  /** Segments to pin the contact into as a manual include override. */
  segments?: string[];
  custom_fields?: Record<string, string>;
  /** Marketing consent. Omit to default a new contact to subscribed. */
  subscribed?: boolean;
  /** A verdict you already hold, in Warmbly's vocabulary or any known service's. */
  verification_status?: string;
  /** The vocabulary `verification_status` is written in, e.g. `zerobounce`. */
  verification_provider?: string;
  [key: string]: unknown;
}

/** The author of a contact note, joined into the response when available. Open shape. */
export interface ContactNoteAuthor {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

/** A note attached to a contact. */
export interface ContactNote {
  id: string;
  contact_id?: string;
  organization_id?: string;
  user_id?: string;
  /** The note text. */
  content?: string;
  created_at?: string;
  updated_at?: string;
  /** The note author, when the API joins it. */
  user?: ContactNoteAuthor;
  [key: string]: unknown;
}

/** Body for creating a contact note. */
export interface CreateContactNoteParams {
  /** The note text (required, up to 10000 characters). */
  content: string;
  [key: string]: unknown;
}

/** Body for updating a contact note. */
export interface UpdateContactNoteParams {
  /** The replacement note text. */
  content?: string;
  [key: string]: unknown;
}

/** A public artifact cited by AI contact research. */
export interface ResearchArtifact {
  what?: string;
  where?: string;
  when?: string;
  /** Source URL. Research only saves cited findings, so this is always present. */
  url: string;
  [key: string]: unknown;
}

/** A cited fact uncovered by AI contact research. */
export interface ResearchSignal {
  type?: string;
  fact?: string;
  when?: string;
  /** Source URL backing the fact. */
  url: string;
  confidence?: "high" | "medium" | "low";
  [key: string]: unknown;
}

/** An opener line grounded in a research signal. */
export interface ResearchHook {
  based_on?: string;
  why_relevant?: string;
  opener_line?: string;
  [key: string]: unknown;
}

/** The findings of one AI contact-research run. */
export interface ResearchResult {
  company?: {
    summary?: string;
    industry?: string;
    size_estimate?: string;
    sells_to?: string;
    tech_or_stack_signals?: string[];
    [key: string]: unknown;
  };
  person?: {
    role_confirmed?: boolean;
    title?: string;
    public_artifacts?: ResearchArtifact[];
    [key: string]: unknown;
  };
  signals?: ResearchSignal[];
  hooks?: ResearchHook[];
  /** Custom-field values the run proposes for the contact. */
  custom_field_updates?: Record<string, string>;
  research_notes?: string;
  /** True when the run found nothing citable. It is still billed. */
  nothing_found?: boolean;
  [key: string]: unknown;
}

/** One AI contact-research run. Charges credits even when it finds nothing. */
export interface ContactResearchRun {
  id: string;
  org_id?: string;
  contact_id?: string;
  requested_by?: string;
  status?: "pending" | "running" | "succeeded" | "failed" | string;
  objective?: string;
  result?: ResearchResult;
  error?: string;
  credits_charged?: number;
  model_used?: string;
  tokens_used?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Contacts.research} and {@link Contacts.researchBatch}. */
export interface ResearchParams {
  /** What the run should look for. Optional; the platform has a sensible default. */
  objective?: string;
  [key: string]: unknown;
}

/** Body for {@link Contacts.researchBatch}: up to 500 contact ids, drained in the background. */
export interface BatchResearchParams extends ResearchParams {
  contact_ids: string[];
}

/** A contact's derived status inside one campaign. */
export type LeadStatus =
  | "pending"
  | "active"
  | "completed"
  | "replied"
  | "bounced"
  | "failed"
  | "paused"
  | "undeliverable"
  | "unsubscribed";

/** An engagement filter inside one campaign. `opened` means a human open. */
export type LeadEngagement =
  | "opened"
  | "not_opened"
  | "clicked"
  | "not_clicked"
  | "replied"
  | "not_replied"
  | "bounced";

/** Query/body for searching contacts. */
export interface ContactSearchParams {
  cursor?: string;
  limit?: number;
  query?: string;
  /** Scope to campaigns. `lead_status` and `engagement` need exactly one entry. */
  campaign_ids?: string[];
  /** Filter to one derived lead status inside the one campaign in `campaign_ids`. */
  lead_status?: LeadStatus;
  /** Filter by engagement inside the one campaign in `campaign_ids`. */
  engagement?: LeadEngagement;
  /** The contact must be a member of every listed segment. */
  segment_ids?: string[];
  verification_status?: VerificationStatus;
  /** Contacts whose inbox host is any of these. An empty string matches "not detected yet". */
  mail_hosts?: string[];
  /** A column name (`created_at`, `first_name`, `company`, ...) or `custom:<key>` for a custom field. */
  sort_by?: string;
  /** Ascending when true; the default is descending. */
  reverse?: boolean;
  [key: string]: unknown;
}

/**
 * The contacts a bulk action applies to: an explicit id list (up to 10,000), or
 * `all: true` with the `filters` of a search (up to 250,000 matches) minus `exclude`.
 * A selection that names both prefers the filter.
 */
export interface ContactSelection {
  contacts?: string[];
  /** Switches the selection from `contacts` to `filters`. */
  all?: boolean;
  /** The same body `contacts.search` takes. */
  filters?: ContactSearchParams;
  /** Ids to drop from the resolved set. Ignored unless `all` is set. */
  exclude?: string[];
}

/** Body for {@link Contacts.bulkUpdate}: a selection plus the edits to apply. */
export interface BulkUpdateContactsParams extends ContactSelection {
  add_campaigns?: string[];
  remove_campaigns?: string[];
  add_categories?: string[];
  remove_categories?: string[];
  /** Custom-field edits. `type` is `ADD`, `EDIT`, `DELETE` or `RENAME`. */
  fields?: Array<{ type: string; [key: string]: unknown }>;
  subscribe?: boolean;
  /** Keep a contact out of `add_campaigns` while their sequence runs in another campaign. */
  skip_active_in_other_campaigns?: boolean;
  [key: string]: unknown;
}

/** Who checks this workspace's addresses and the contacts by verdict. */
export interface ContactVerificationOverview {
  provider: "builtin" | "millionverifier" | "cleanmylist" | (string & {});
  connection_id?: string;
  /** The connected service's remaining balance. */
  credits?: number;
  /** Set when the service is connected but unusable, in which case the built-in check runs. */
  provider_error?: string;
  builtin_ready?: boolean;
  counts?: {
    valid?: number;
    risky?: number;
    invalid?: number;
    unknown?: number;
    /** The share of `unknown` nobody has checked yet. */
    pending?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Body for {@link Contacts.requestVerification}. At least one contact must be selected. */
export interface ContactVerificationParams extends ContactSelection {
  /** `verify` queues a re-check; the other two record a manual verdict. */
  action: "verify" | "mark_deliverable" | "mark_undeliverable";
  /** Instead of, or as well as, `contacts`: every lead of this campaign that verification refused. */
  campaign_id?: string;
  [key: string]: unknown;
}

/** The result of {@link Contacts.requestVerification}. */
export interface ContactVerificationResult {
  affected: number;
  action: string;
  /** True when a re-check was queued rather than a verdict recorded. */
  queued?: boolean;
  /** Who runs a queued check: `builtin` or the connected provider. */
  verifier?: string;
  verifier_label?: string;
  /** Why a connected provider cannot be used right now, in which case the built-in check runs. */
  verifier_error?: string;
  [key: string]: unknown;
}

/** A contact's progress on one step of a campaign flow. */
export interface ContactCampaignStep {
  id: string;
  label?: string;
  kind?: string;
  position?: number;
  subject?: string;
  /** The mailbox that sent this step; empty until it is sent. */
  sender_email?: string;
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
  replied_at?: string;
  bounced_at?: string;
  failed_at?: string;
  attempts?: number;
  in_flight?: boolean;
  [key: string]: unknown;
}

/** A contact's state inside one campaign, with what happens next derived on read. */
export interface ContactCampaignState {
  campaign_id: string;
  campaign_name?: string;
  campaign_status?: string;
  lead_status?: LeadStatus | (string & {});
  /** The mailbox that sent the lead's latest step; empty until the first email went out. */
  sender_id?: string;
  sender_email?: string;
  /** Which mailbox follow-ups leave from: `same`, `same_domain` or `rotate`. */
  follow_up_sender?: string;
  failure_reason?: string;
  /** The per-lead pause, present only while it is live. */
  hold?: {
    since: string;
    until?: string;
    reason?: string;
    source: "manual" | "out_of_office" | "inbox_tagging" | "crm" | (string & {});
    [key: string]: unknown;
  };
  /** Contacts copied on every email to this lead in this campaign. */
  cc?: Array<{
    contact_id: string;
    email: string;
    first_name: string;
    last_name: string;
    company?: string;
    status: string;
    bounced_at?: string;
    [key: string]: unknown;
  }>;
  steps?: ContactCampaignStep[];
  completed_steps?: number;
  total_steps?: number;
  current_step?: ContactCampaignStep;
  last_action?: string;
  last_action_at?: string;
  /** Absent once the flow has ended for the contact; see `ended_reason`. */
  next?: {
    step_id?: string;
    step_label?: string;
    kind?: string;
    subject?: string;
    state?: "due" | "waiting" | "paused" | "blocked" | (string & {});
    scheduled_at?: string;
    not_before?: string;
    constraint?: string;
    reason?: string;
    [key: string]: unknown;
  };
  ended_reason?: string;
  [key: string]: unknown;
}

/**
 * @deprecated The legacy import endpoints take a multipart file upload, not an
 * `upload_id`. Use {@link ContactImportOptions} with {@link Contacts.importCommit}.
 */
export interface ContactImportParams {
  upload_id?: string;
  mapping?: ImportColumnMapping[];
  segment_ids?: string[];
  [key: string]: unknown;
}

/** What to do when a row's email matches an existing contact. */
export type ContactImportDedup = "skip" | "update" | "create_duplicate" | (string & {});

/**
 * How to import a file: the column mapping plus the collision rule and where the
 * contacts land. Exactly one mapped column must target `email`. Used by the draft save,
 * `start`, and the legacy {@link Contacts.importCommit}.
 */
export interface ContactImportOptions {
  mapping: ImportColumnMapping[];
  dedup?: ContactImportDedup;
  has_header: boolean;
  category_ids?: string[];
  campaign_ids?: string[];
  /** Keep an existing contact out of `campaign_ids` while their sequence runs in another campaign. */
  skip_active_in_other_campaigns?: boolean;
  /** Pin every imported row into these segments as a manual include override. */
  segment_ids?: string[];
  /** What new contacts inherit when no column maps to `subscribed`. Defaults to true. */
  subscribed_default?: boolean;
  [key: string]: unknown;
}

/** One column's fill across the whole file. */
export interface ContactImportColumnStats {
  filled: number;
  /** Different non-empty values, capped at 1000. */
  distinct: number;
  samples: string[];
  [key: string]: unknown;
}

/** What the column mapper shows for an uploaded file. */
export interface ContactImportPreview {
  filename: string;
  format: string;
  total_rows: number;
  columns: string[];
  has_header: boolean;
  /** Up to 20 rows, verbatim. */
  sample_rows: string[][];
  suggested_mapping: ImportColumnMapping[];
  /** Column indexes whose suggestion came from a type judgment rather than the header or values. */
  inferred_columns?: number[];
  column_stats?: ContactImportColumnStats[];
  /** `saved` when the workspace confirmed a mapping for these exact headers before, else `suggested`. */
  mapping_source?: "suggested" | "saved" | (string & {});
  [key: string]: unknown;
}

/** An address-level assessment of an import. */
export interface ContactImportQuality {
  malformed: number;
  disposable: number;
  /** Shared inboxes like info@. Reported, not counted as bad. */
  role: number;
  bad_share_pct: number;
  flagged: boolean;
  summary?: string;
  [key: string]: unknown;
}

/** A row that could not be imported. */
export interface ContactImportRowError {
  /** 1-based line in the source file (after the header when there is one). */
  line: number;
  email?: string;
  values?: string[];
  reason: string;
  [key: string]: unknown;
}

/** Where a background import is in its life. */
export type ContactImportStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | (string & {});

/** One background import of a contact file. */
export interface ContactImport {
  id: string;
  organization_id: string;
  created_by?: string;
  filename: string;
  format: string;
  status: ContactImportStatus;
  has_header: boolean;
  columns: string[];
  /** Data rows in the file. */
  total: number;
  /** Rows that have settled. */
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  options?: ContactImportOptions;
  quality?: ContactImportQuality;
  /** With segment targets: true when every membership write landed, false when one did not. */
  segments_pinned?: boolean;
  notes: string[];
  error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  /** The mapper preview. Carried by a draft only. */
  preview?: ContactImportPreview;
  /** The first (up to 200) failed rows once the import has finished. */
  failures?: ContactImportRowError[];
  [key: string]: unknown;
}

/** Body for {@link Contacts.analyzeImport}. */
export interface AnalyzeContactImportParams {
  mapping: ImportColumnMapping[];
  has_header: boolean;
  [key: string]: unknown;
}

/** What an import would do under a mapping, read over the whole file. Writes nothing. */
export interface ContactImportAnalysis {
  /** Every data row; each lands in exactly one bucket below. */
  rows: number;
  new: number;
  existing: number;
  duplicates_in_file: number;
  invalid: number;
  /** Addresses the importing member holds as a contact in another workspace. */
  conflicts: number;
  /** The first (up to 25) invalid or conflicting rows, with reasons. */
  invalid_samples: ContactImportRowError[];
  quality?: ContactImportQuality;
  /** Why starting would be refused as a whole (plan limit, too many new categories); empty when it would run. */
  problem?: string;
  [key: string]: unknown;
}

/** The totals the legacy synchronous {@link Contacts.importCommit} returns. */
export interface ContactImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  started_at: string;
  ended_at: string;
  /** Per-row failures and notes, capped at 1000. */
  errors?: ContactImportRowError[];
  errors_truncated?: boolean;
  segments_pinned?: boolean;
  quality?: ContactImportQuality;
  [key: string]: unknown;
}

/** Query params for {@link Contacts.listImports}. */
export interface ListContactImportsParams {
  cursor?: string;
  /** 1..100, default 50. */
  limit?: number;
  [key: string]: unknown;
}

/** How {@link Contacts.lookup} matched the sender. */
export type ContactLookupMatch = "email" | "thread" | (string & {});

/** Query for {@link Contacts.lookup}. Send `email`, `thread_id`, or both. */
export interface ContactLookupParams {
  /** An address, or a `Display Name <addr@example.com>` string. */
  email?: string;
  /** A unibox thread id: resolves a reply from an alias back to the lead. */
  thread_id?: string;
  /** The mailbox the thread lives in. */
  account_id?: string;
  [key: string]: unknown;
}

/** The answer of {@link Contacts.lookup}. */
export interface ContactLookup {
  /** `null` when nothing matched (still HTTP 200). */
  contact: Contact | null;
  match?: ContactLookupMatch;
  [key: string]: unknown;
}

/** A connected Salesforce org shown in a contact's panel. */
export interface SalesforcePanelConnection {
  id: string;
  label: string;
  environment: string;
  instance_url: string;
  [key: string]: unknown;
}

/** An opportunity on the linked record's account. */
export interface SalesforcePanelOpportunity {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  close_date?: string;
  is_closed: boolean;
  is_won: boolean;
  url: string;
  [key: string]: unknown;
}

/** A recent activity on the linked record. */
export interface SalesforcePanelTask {
  id: string;
  subject: string;
  date?: string;
  status: string;
  owner_name?: string;
  url: string;
  from_warmbly: boolean;
  [key: string]: unknown;
}

/** The Lead or Contact a Warmbly contact is linked to in one Salesforce org. */
export interface SalesforcePanelRecord {
  /** Pass to {@link Contacts.unlinkSalesforce}. */
  link_id: string;
  connection_id: string;
  connection_label: string;
  /** `Lead` or `Contact`. */
  object: string;
  id: string;
  url: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  owner?: { id: string; name: string };
  account?: { id: string; name: string; url: string };
  is_converted: boolean;
  opted_out: boolean;
  lead_source?: string;
  opportunities: SalesforcePanelOpportunity[];
  tasks: SalesforcePanelTask[];
  linked_by: string;
  last_synced_at?: string;
  last_pushed_at?: string;
  sync: { pending: number; failed: number; synced: number; last_error?: string };
  /** True when the live read could not run, for example the connection needs reconnecting. */
  stale: boolean;
  error?: string;
  [key: string]: unknown;
}

/** A contact's Salesforce context. */
export interface ContactSalesforcePanel {
  connections: SalesforcePanelConnection[];
  records: SalesforcePanelRecord[];
  can_sync: boolean;
  [key: string]: unknown;
}

/** Body for {@link Contacts.syncSalesforce}. */
export interface SyncContactSalesforceParams {
  /** Sync to one connected org only. Omit for every active connection. */
  connection_id?: string;
  /** What to create when the contact is not in Salesforce yet. */
  create_as?: "lead" | "contact";
  [key: string]: unknown;
}

/** A segment as seen from one contact: whether it is a member, and any override. */
export interface ContactSegmentMembership {
  id: string;
  name?: string;
  color?: string;
  /** Whether the contact is in the segment right now. */
  member: boolean;
  /** The manual override, when any. */
  mode?: "include" | "exclude";
  [key: string]: unknown;
}

/**
 * Manage contacts: search, add, bulk update/delete, import/export, notes, and related
 * resources. Reachable as `warmbly.contacts`.
 *
 * @example
 * const page = await warmbly.contacts.search({ query: "acme.com" });
 * for await (const c of page) console.log(c.email);
 */
export class Contacts extends APIResource {
  /**
   * Searches contacts. Returns the `data` + `pagination` envelope as an iterable page.
   * @example
   * const page = await warmbly.contacts.search({ query: "ceo" });
   */
  search(params?: ContactSearchParams): Promise<Page<Contact>> {
    return this.searchPage(params);
  }

  /**
   * Alias for {@link search}; `POST /contacts/search` is the list endpoint for contacts.
   * @example
   * for await (const c of await warmbly.contacts.list()) console.log(c.id);
   */
  list(params?: ContactSearchParams): Promise<Page<Contact>> {
    return this.searchPage(params);
  }

  // POST /contacts/search returns the data+pagination envelope; wrap it as a Page.
  private async searchPage(params?: ContactSearchParams): Promise<Page<Contact>> {
    const body: ContactSearchParams = { ...params };
    const response = await this.http.post<ListResponse<Contact>>("contacts/search", { body });
    const fetchNext = (cursor: string): Promise<Page<Contact>> =>
      this.searchPage({ ...params, cursor });
    return new Page<Contact>(response, fetchNext);
  }

  /**
   * Adds contacts in a batch.
   * @example
   * await warmbly.contacts.add([{ email: "team@warmbly.com" }]);
   */
  add(contacts: AddContactParams[], opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("contacts", {
      ...opts,
      body: { contacts },
    });
  }

  /**
   * Bulk-updates contacts. Name them with `contacts` (up to 10,000 ids), or select
   * everything a search matches with `all: true` plus `filters` (up to 250,000; the
   * response then carries counts rather than every row). Needs `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.bulkUpdate({ contacts: ["c_1"], add_categories: ["cat_1"] });
   */
  bulkUpdate(params: BulkUpdateContactsParams): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("contacts", { body: params });
  }

  /**
   * Bulk-deletes contacts (204). Pass a bare array of ids, or a {@link ContactSelection}
   * for "select all matching". Needs `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.bulkDelete(["c_1", "c_2"]);
   * await warmbly.contacts.bulkDelete({ all: true, filters: { query: "acme.com" }, exclude: ["c_9"] });
   */
  bulkDelete(selection: string[] | ContactSelection): Promise<void> {
    return this.http.delete<void>("contacts", { body: selection });
  }

  /**
   * Starts a contacts export.
   * @example
   * const job = await warmbly.contacts.export({ format: "csv" });
   */
  export(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("contacts/export", { body: params });
  }

  /**
   * Legacy synchronous import, step one: uploads a CSV or XLSX file as
   * `multipart/form-data` and returns its columns, sample rows and a suggested mapping.
   * Nothing is stored. Prefer {@link Contacts.createImport}, which keeps a draft. The file
   * is capped at 50 MB. Needs `WRITE_CONTACTS`.
   * @example
   * const preview = await warmbly.contacts.importPreview(file, { filename: "leads.csv" });
   */
  importPreview(
    file: Blob,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<ContactImportPreview> {
    return this.http.post<ContactImportPreview>("contacts/import/preview", {
      ...opts,
      body: fileForm(file, params?.filename),
    });
  }

  /**
   * Legacy synchronous import, step two: uploads the file again with the mapping you
   * chose (sent as the JSON `options` form field) and writes every row inside the request.
   * Capped at 50,000 rows and gated on `BULK_CONTACTS`. A bad mapping (no `email` column,
   * an unusable custom-field name) is a 400 raised before any row is written. Prefer
   * {@link Contacts.createImport} for large files.
   * @example
   * await warmbly.contacts.importCommit(file, {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   *   dedup: "skip",
   * });
   */
  importCommit(
    file: Blob,
    options: ContactImportOptions,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<ContactImportResult> {
    const form = fileForm(file, params?.filename);
    form.append("options", JSON.stringify(options));
    return this.http.post<ContactImportResult>("contacts/import/commit", {
      ...opts,
      body: form,
    });
  }

  /**
   * Uploads a contact file as a background-import draft (`multipart/form-data`, field
   * `file`, up to 50 MB) and returns it with the preview the column mapper needs.
   * Follow with {@link Contacts.saveImportDraft}, {@link Contacts.analyzeImport} and
   * {@link Contacts.startImport}. Needs `WRITE_CONTACTS`.
   * @example
   * const draft = await warmbly.contacts.createImport(file, { filename: "leads.csv" });
   * console.log(draft.preview?.suggested_mapping);
   */
  createImport(
    file: Blob,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<ContactImport> {
    return this.http.post<ContactImport>("contacts/imports", {
      ...opts,
      body: fileForm(file, params?.filename),
    });
  }

  /**
   * Lists background imports, newest first, auto-paginating when iterated. `limit` is
   * 1..100 (default 50). Needs `READ_CONTACTS`.
   * @example
   * for await (const imp of await warmbly.contacts.listImports()) console.log(imp.status);
   */
  listImports(params?: ListContactImportsParams): Promise<Page<ContactImport>> {
    return this.http.getPage<ContactImport>("contacts/imports", { query: params });
  }

  /**
   * Retrieves one background import with its progress, quality read and first failures.
   * Needs `READ_CONTACTS`.
   * @example
   * const imp = await warmbly.contacts.getImport("imp_1");
   */
  getImport(id: string, opts?: RequestOptions): Promise<ContactImport> {
    return this.http.get<ContactImport>(this.path("contacts", "imports", id), opts);
  }

  /**
   * Autosaves a draft's mapping and options so a reload resumes it. Naturally
   * idempotent. Needs `WRITE_CONTACTS`.
   * @example
   * await warmbly.contacts.saveImportDraft("imp_1", {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   * });
   */
  saveImportDraft(id: string, options: ContactImportOptions): Promise<ContactImport> {
    return this.http.patch<ContactImport>(this.path("contacts", "imports", id), {
      body: options,
    });
  }

  /**
   * Reports what the draft would do under a mapping, over the whole file, writing
   * nothing. Needs `WRITE_CONTACTS`.
   * @example
   * const a = await warmbly.contacts.analyzeImport("imp_1", {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   * });
   * console.log(a.new, a.existing, a.problem);
   */
  analyzeImport(id: string, params: AnalyzeContactImportParams): Promise<ContactImportAnalysis> {
    return this.http.post<ContactImportAnalysis>(this.path("contacts", "imports", id, "analyze"), {
      body: params,
    });
  }

  /**
   * Starts the import with the final options. Starting one that already started returns
   * it unchanged, so a retry is safe. Needs `BULK_CONTACTS`.
   * @example
   * const running = await warmbly.contacts.startImport("imp_1", {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   *   dedup: "update",
   * });
   */
  startImport(id: string, options: ContactImportOptions): Promise<ContactImport> {
    return this.http.post<ContactImport>(this.path("contacts", "imports", id, "start"), {
      body: options,
    });
  }

  /**
   * Cancels a running import. Rows already written stay written. Needs `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.cancelImport("imp_1");
   */
  cancelImport(id: string, opts?: RequestOptions): Promise<ContactImport> {
    return this.http.post<ContactImport>(this.path("contacts", "imports", id, "cancel"), opts);
  }

  /**
   * Downloads the failed rows of a finished import as CSV text (the one route here that
   * answers `text/csv` rather than JSON). Needs `READ_CONTACTS`.
   * @example
   * const csv = await warmbly.contacts.importFailuresCsv("imp_1");
   */
  importFailuresCsv(id: string, opts?: RequestOptions): Promise<string> {
    return this.http
      .get<string>(this.path("contacts", "imports", id, "failed.csv"), opts)
      .then((r) => r ?? "");
  }

  /**
   * Resolves a sender to a contact in the workspace, for a CRM side panel. Send `email`,
   * `thread_id` (resolves a reply from an alias to the lead it answers), or both, plus
   * the optional `account_id` the thread lives in. An unknown sender is a 200 with
   * `contact: null`, not a 404. Needs `READ_CONTACTS`.
   * @example
   * const { contact, match } = await warmbly.contacts.lookup({ email: "team@warmbly.com" });
   */
  lookup(params: ContactLookupParams): Promise<ContactLookup> {
    return this.http.get<ContactLookup>("contacts/lookup", { query: params });
  }

  /**
   * Lists the distinct custom-field keys used across the organization's contacts,
   * ranked by frequency and capped at 200. Useful for building a variable picker.
   *
   * @example
   * const keys = await warmbly.contacts.customFields(); // ["industry", "seat_count"]
   */
  customFields(opts?: RequestOptions): Promise<string[]> {
    return this.http
      .get<{ data: string[] }>("contacts/custom-fields", opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Queues AI research for many contacts at once (up to 500 ids). The batch drains in
   * the background and reports progress over the `AI_RESEARCH_PROGRESS` gateway event.
   * Requires the `AI_RESEARCH` scope.
   *
   * @example
   * const { queued } = await warmbly.contacts.researchBatch({
   *   contact_ids: ["c_1", "c_2"],
   *   objective: "Find a recent funding or hiring signal",
   * });
   */
  researchBatch(params: BatchResearchParams): Promise<{ queued: number }> {
    return this.http.post<{ queued: number }>("contacts/research/batch", { body: params });
  }

  /**
   * Runs AI research on one contact and returns the completed run. Executes inside the
   * request, charges credits (billable even when it finds nothing), and only saves
   * cited findings. Requires the `AI_RESEARCH` scope.
   *
   * @example
   * const run = await warmbly.contacts.research("c_1", { objective: "Recent product launches" });
   * for (const signal of run.result?.signals ?? []) console.log(signal.fact, signal.url);
   */
  research(id: string, params?: ResearchParams): Promise<ContactResearchRun> {
    return this.http.post<ContactResearchRun>(this.path("contacts", id, "research"), {
      body: params,
    });
  }

  /**
   * Lists a contact's past AI research runs, newest first. Requires the `AI_RESEARCH` scope.
   *
   * @example
   * const runs = await warmbly.contacts.listResearch("c_1");
   */
  listResearch(id: string, params?: Record<string, unknown>): Promise<ContactResearchRun[]> {
    return this.http
      .get<{ data: ContactResearchRun[] }>(this.path("contacts", id, "research"), {
        query: params,
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Reports which verifier checks this workspace's addresses and the contacts by verdict.
   * @example
   * const { provider, counts } = await warmbly.contacts.verification();
   */
  verification(opts?: RequestOptions): Promise<ContactVerificationOverview> {
    return this.http.get<ContactVerificationOverview>("contacts/verification", opts);
  }

  /**
   * Queues a fresh address check of the listed contacts, or records a manual verdict on
   * them. Marking leads deliverable resumes any campaign paused for verification.
   * Requires `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.requestVerification({ action: "verify", campaign_id: "camp_1" });
   */
  requestVerification(params: ContactVerificationParams): Promise<ContactVerificationResult> {
    return this.http.post<ContactVerificationResult>("contacts/verification", { body: params });
  }

  /**
   * Retrieves a contact by id.
   * @example
   * const c = await warmbly.contacts.get("c_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Contact> {
    return this.http.get<Contact>(this.path("contacts", id), opts);
  }

  /**
   * Returns, for every campaign the contact is a lead of, its progress on each step,
   * the derived lead status, and what happens next.
   * @example
   * for (const state of await warmbly.contacts.campaigns("c_1")) console.log(state.next?.state);
   */
  campaigns(id: string, opts?: RequestOptions): Promise<ContactCampaignState[]> {
    return this.http
      .get<{ data: ContactCampaignState[] }>(this.path("contacts", id, "campaigns"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Returns every segment in the organization with whether the contact is a member
   * right now and its manual override, when any.
   * @example
   * const inSegments = (await warmbly.contacts.segments("c_1")).filter((s) => s.member);
   */
  segments(id: string, opts?: RequestOptions): Promise<ContactSegmentMembership[]> {
    return this.http
      .get<{ data: ContactSegmentMembership[] }>(this.path("contacts", id, "segments"), opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Updates a single contact. `email` may be changed; doing so drops the verification
   * verdict and delivery evidence that belonged to the old mailbox.
   * @example
   * await warmbly.contacts.update("c_1", { company: "Warmbly" });
   */
  update(id: string, params: Record<string, unknown>): Promise<Contact> {
    return this.http.patch<Contact>(this.path("contacts", id), { body: params });
  }

  /**
   * Deletes a single contact.
   * @example
   * await warmbly.contacts.delete("c_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("contacts", id), opts);
  }

  /**
   * Lists the email messages associated with a contact.
   * @example
   * const emails = await warmbly.contacts.emails("c_1");
   */
  emails(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("contacts", id, "emails"), {
      query: params,
    });
  }

  /**
   * Returns the merged activity feed for a contact. Paginate by passing
   * `pagination.next_cursor` back as `cursor` until `has_more` is false.
   * @example
   * const timeline = await warmbly.contacts.timeline("c_1", { limit: 100 });
   */
  timeline(
    id: string,
    params?: { limit?: number; cursor?: string; [key: string]: unknown },
  ): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("contacts", id, "timeline"), {
      query: params,
    });
  }

  /**
   * Returns the activities for a contact.
   * @example
   * const activities = await warmbly.contacts.activities("c_1");
   */
  activities(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("contacts", id, "activities"), {
      query: params,
    });
  }

  /**
   * Returns the deals associated with a contact.
   * @example
   * const deals = await warmbly.contacts.deals("c_1");
   */
  deals(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("contacts", id, "deals"), {
      query: params,
    });
  }

  /**
   * Lists notes on a contact.
   * @example
   * const notes = await warmbly.contacts.listNotes("c_1");
   */
  listNotes(id: string, opts?: RequestOptions): Promise<ContactNote[]> {
    return this.http.get<ContactNote[]>(this.path("contacts", id, "notes"), opts);
  }

  /**
   * Adds a note to a contact. The note text goes in the `content` field.
   * @example
   * await warmbly.contacts.createNote("c_1", { content: "Called, no answer" });
   */
  createNote(id: string, params: CreateContactNoteParams): Promise<ContactNote> {
    return this.http.post<ContactNote>(this.path("contacts", id, "notes"), { body: params });
  }

  /**
   * Updates a note on a contact. The note text goes in the `content` field.
   * @example
   * await warmbly.contacts.updateNote("c_1", "n_1", { content: "Updated" });
   */
  updateNote(id: string, noteId: string, params: UpdateContactNoteParams): Promise<ContactNote> {
    return this.http.patch<ContactNote>(this.path("contacts", id, "notes", noteId), {
      body: params,
    });
  }

  /**
   * Deletes a note from a contact.
   * @example
   * await warmbly.contacts.deleteNote("c_1", "n_1");
   */
  deleteNote(id: string, noteId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("contacts", id, "notes", noteId), opts);
  }

  /**
   * Returns the contact's Salesforce panel: connected orgs, the linked Lead or Contact in
   * each with opportunities and recent tasks, and the sync outbox state. Linking happens
   * on the way when the address matches an unlinked record. Needs `READ_CRM`.
   * @example
   * const panel = await warmbly.contacts.salesforce("c_1");
   * for (const r of panel.records) console.log(r.object, r.name, r.status);
   */
  salesforce(id: string, opts?: RequestOptions): Promise<ContactSalesforcePanel> {
    return this.http.get<ContactSalesforcePanel>(this.path("contacts", id, "salesforce"), opts);
  }

  /**
   * Matches (or creates) the contact in Salesforce and pushes its mapped fields, then
   * returns the refreshed panel. Matching runs first, so a retry finds the record the
   * first attempt created. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.contacts.syncSalesforce("c_1", { create_as: "lead" });
   */
  syncSalesforce(
    id: string,
    params?: SyncContactSalesforceParams,
    opts?: RequestOptions,
  ): Promise<ContactSalesforcePanel> {
    return this.http.post<ContactSalesforcePanel>(this.path("contacts", id, "salesforce", "sync"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Drops the contact's link to a Salesforce record (204). The `link_id` is on each
   * record of {@link Contacts.salesforce}. Needs `INTEGRATIONS`.
   * @example
   * await warmbly.contacts.unlinkSalesforce("c_1", "link_1");
   */
  unlinkSalesforce(id: string, linkId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("contacts", id, "salesforce", "links", linkId), opts);
  }
}

/** Builds the multipart body the import endpoints expect: the file under `file`. */
function fileForm(file: Blob, filename: string | undefined): FormData {
  const form = new FormData();
  // Append the filename only when there is one; a non-spec FormData would stringify an
  // explicit undefined into a file named "undefined".
  if (filename !== undefined) form.append("file", file, filename);
  else form.append("file", file);
  return form;
}
