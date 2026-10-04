import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";
import type { CampaignLeadCC, CampaignLeadHold } from "./campaigns";
import type { Deal } from "./crm";
import type { ImportColumnMapping, ImportDedupStrategy } from "./lead-sync";

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
  /** Set while a member-requested re-check waits to run; the verdict stands until it lands. */
  verification_requested_at?: string | null;
  /** Who hosts the contact's inbox, read from the domain's MX; empty until the sweep has run. */
  mail_host?: string;
  /** The family of `mail_host` used for ESP matching: `gmail`, `outlook`, `other`, or empty. */
  esp_provider?: "gmail" | "outlook" | "other" | "" | (string & {});
  esp_resolved_at?: string | null;
  /** First-touch attribution, fixed at creation. */
  source?: ContactSource;
  source_detail?: string;
  first_seen_at?: string;
  created_at?: string;
  updated_at?: string;
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

/**
 * Body for {@link Contacts.researchBatch}: contact ids (`contact_ids`, or the selection's
 * `contacts`), or `all` plus `filters` and `exclude` for a select-all. Drained in the
 * background.
 */
export interface BatchResearchParams extends ResearchParams {
  /** The original field name for an explicit id list. */
  contact_ids?: string[];
  /** The selection form: explicit ids. */
  contacts?: string[];
  /** Switches the selection to `filters`. */
  all?: boolean;
  filters?: ContactSearchFilters;
  exclude?: string[];
}

/**
 * A contact's derived status inside one campaign. `paused` is a lead whose flow is held
 * (an out-of-office auto-reply, or a member pausing it) and resumes where it stopped.
 */
export type LeadStatus =
  | "pending"
  | "active"
  | "completed"
  | "replied"
  | "bounced"
  | "failed"
  | "undeliverable"
  | "unsubscribed"
  | "paused";

/** An engagement filter inside one campaign. `opened` means a human open. */
export type LeadEngagement =
  | "opened"
  | "not_opened"
  | "clicked"
  | "not_clicked"
  | "replied"
  | "not_replied"
  | "bounced";

/** A filter on one custom field. */
export interface ContactCustomFieldFilter {
  name: string;
  value: string;
  type: "equal" | "starts_with" | "ends_with" | "contains" | (string & {});
}

/**
 * Filters for searching contacts, shared by {@link Contacts.search}, the `filters` of a
 * bulk selection, and an export. `limit`, `cursor` and `category` are the exception: the
 * platform reads them from the query string, and {@link Contacts.search} sends them there.
 */
export interface ContactSearchFilters {
  /** Text search across the core fields. */
  query?: string;
  custom_field_filters?: ContactCustomFieldFilter[];
  /** Scope to campaigns; the contact must be in all of them. `lead_status` and `engagement` need exactly one entry. */
  campaign_ids?: string[];
  /** Filter to one derived lead status inside the one campaign in `campaign_ids`. */
  lead_status?: LeadStatus;
  /** Filter by engagement inside the one campaign in `campaign_ids`. */
  engagement?: LeadEngagement;
  /** The contact must carry every listed category. */
  category_ids?: string[];
  /** The contact must be a member of every listed segment. */
  segment_ids?: string[];
  min_campaigns?: number;
  max_campaigns?: number;
  subscribed?: boolean;
  verification_status?: VerificationStatus;
  /** Contacts whose inbox host is any of these. An empty string matches "not detected yet". */
  mail_hosts?: string[];
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  /** A column name (`created_at`, `first_name`, `company`, ...) or `custom:<key>` for a custom field. */
  sort_by?: string;
  /** Ascending when true; the default is descending. */
  reverse?: boolean;
  [key: string]: unknown;
}

/** Params for searching contacts: the {@link ContactSearchFilters} plus paging. */
export interface ContactSearchParams extends ContactSearchFilters {
  /** The `pagination.next_cursor` of the previous page. Sent as a query parameter. */
  cursor?: string;
  /** Page size. Sent as a query parameter. */
  limit?: number;
  /** Restrict to one category. Sent as a query parameter. */
  category?: string;
}

/**
 * The contacts a bulk action applies to: an explicit id list, or every contact a search
 * matches (`all` plus `filters`) minus the ids in `exclude`. A selection naming both
 * prefers the filter. Up to 10,000 ids per request, and up to 250,000 contacts for a
 * select-all.
 */
export interface ContactSelection {
  /** Explicit contact ids. */
  contacts?: string[];
  /** Switches the selection from `contacts` to `filters`. */
  all?: boolean;
  /** The same body {@link Contacts.search} takes. */
  filters?: ContactSearchFilters;
  /** Ids dropped from the resolved set. Ignored unless `all` is true. */
  exclude?: string[];
  [key: string]: unknown;
}

/** One custom-field edit in a bulk update. */
export interface BulkEditContactsField {
  type: "ADD" | "EDIT" | "DELETE" | "RENAME";
  key: string;
  value?: string;
}

/** Body for {@link Contacts.bulkUpdate}: a selection plus the edits to apply to it. */
export interface BulkUpdateContactsParams extends ContactSelection {
  add_campaigns?: string[];
  remove_campaigns?: string[];
  add_categories?: string[];
  remove_categories?: string[];
  /** Custom-field edits. `type` is `ADD`, `EDIT`, `DELETE` or `RENAME`; `RENAME` writes the new key in `value`. */
  fields?: BulkEditContactsField[];
  /** Subscribe or unsubscribe every contact in the selection. */
  subscribe?: boolean;
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

/**
 * Body for {@link Contacts.requestVerification}. At least one contact must be selected,
 * by id list, by `all` plus `filters`, or by `campaign_id`.
 */
export interface ContactVerificationParams extends ContactSelection {
  /** `verify` queues a re-check; the other two record a manual verdict. */
  action: "verify" | "mark_deliverable" | "mark_undeliverable";
  /** Instead of, or as well as, `contacts`: every lead of this campaign that verification refused. */
  campaign_id?: string;
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
  /** The mailbox this lead's whole sequence sends from, fixed when its first email went out. */
  sender_id?: string;
  sender_email?: string;
  failure_reason?: string;
  /** The per-lead pause, present only while it is live. */
  hold?: CampaignLeadHold;
  /** Contacts copied on every email to this lead in this campaign. */
  cc?: CampaignLeadCC[];
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

/** What happens when an imported row's email matches an existing contact. */
export type ContactImportDedup = ImportDedupStrategy;

/**
 * The options of an import: how to map columns, how to treat collisions, and where the
 * contacts go. The mapping shape is shared with lead sync.
 */
export interface ContactImportOptions {
  /** Column mappings. Exactly one column must map to `email`. */
  mapping: ImportColumnMapping[];
  /** `skip` (the conservative default), `update`, or `create_duplicate`. */
  dedup?: ContactImportDedup;
  /** Whether the first row is a header. */
  has_header: boolean;
  category_ids?: string[];
  campaign_ids?: string[];
  /** Segments to pin imported contacts into, as a manual include override. */
  segment_ids?: string[];
  /** What new contacts inherit when no `subscribed` column is mapped. Defaults to true. */
  subscribed_default?: boolean;
  [key: string]: unknown;
}

/** Statistics for one column over the whole file. */
export interface ContactImportColumnStats {
  filled: number;
  /** Distinct non-empty values, capped at 1000. */
  distinct: number;
  samples: string[];
  [key: string]: unknown;
}

/** What the column mapper shows: the detected columns, a sample, and a suggested mapping. */
export interface ContactImportPreview {
  filename: string;
  format: string;
  total_rows: number;
  columns: string[];
  has_header: boolean;
  /** Up to 20 rows, verbatim. */
  sample_rows: string[][];
  /** A default the user can override, not a binding decision. */
  suggested_mapping: ImportColumnMapping[];
  /** Indexes whose suggestion came from inference rather than the header or values. */
  inferred_columns?: number[];
  /** Fill statistics for every column over the whole file. Set by background imports. */
  column_stats?: ContactImportColumnStats[];
  /** `saved` when the workspace confirmed a mapping for these exact headers before, else `suggested`. */
  mapping_source?: "suggested" | "saved" | (string & {});
  [key: string]: unknown;
}

/** An import's address-level assessment. Advisory: it is reported, never refused. */
export interface ContactImportQuality {
  malformed: number;
  disposable: number;
  /** Shared inboxes such as info@. Reported, not counted as bad. */
  role: number;
  bad_share_pct: number;
  flagged: boolean;
  summary?: string;
  [key: string]: unknown;
}

/** A row that could not be imported. */
export interface ContactImportRowError {
  /** The 1-based line in the source file. */
  line: number;
  email?: string;
  values?: string[];
  reason: string;
  [key: string]: unknown;
}

/** The result of the synchronous {@link Contacts.importCommit}. */
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
  /** True when the 1000-entry cap was reached. */
  errors_truncated?: boolean;
  /** Absent when the import had no segment targets; false when a membership write failed. */
  segments_pinned?: boolean;
  quality?: ContactImportQuality;
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
  /** The number of data rows. */
  total: number;
  /** How many rows have settled. */
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  /** The saved options, once a draft has been autosaved or the import started. */
  options?: ContactImportOptions;
  quality?: ContactImportQuality;
  segments_pinned?: boolean;
  notes: string[];
  error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  /** What the mapper shows. Carried by a draft only, so a reload resumes it. */
  preview?: ContactImportPreview;
  /** The first 200 failed rows once the import has finished; the failed.csv holds every one. */
  failures?: ContactImportRowError[];
  [key: string]: unknown;
}

/** Query params for listing background imports. */
export interface ListContactImportsParams {
  cursor?: string;
  /** Page size (1..100, default 50). */
  limit?: number;
  [key: string]: unknown;
}

/** Body for {@link Contacts.analyzeImport}: what a draft would do under a mapping. */
export interface AnalyzeContactImportParams {
  mapping: ImportColumnMapping[];
  has_header: boolean;
}

/** What an import would do, read over the whole file before anything is written. */
export interface ContactImportAnalysis {
  /** Every data row; each lands in exactly one of the buckets below. */
  rows: number;
  /** Addresses the workspace does not have yet. */
  new: number;
  /** Addresses the workspace already has a contact for. */
  existing: number;
  duplicates_in_file: number;
  /** Rows with no usable address or an unreadable value. */
  invalid: number;
  /** Addresses the importing member already holds as a contact in another workspace. */
  conflicts: number;
  /** The first 25 invalid or conflicting rows, with reasons. */
  invalid_samples: ContactImportRowError[];
  quality?: ContactImportQuality;
  /** Why starting this import would be refused as a whole (plan contact limit, too many new categories). */
  problem?: string;
  [key: string]: unknown;
}

/** How a unibox sender resolved to a contact. */
export type ContactLookupMatch = "email" | "thread" | (string & {});

/** Params for {@link Contacts.lookup}. Send `email`, `thread_id`, or both. */
export interface ContactLookupParams {
  /** The sender's address, bare or as `Display Name <addr@example.com>`. */
  email?: string;
  /** A unibox thread id, which resolves a reply from an alias back to the lead. Also needs `READ_UNIBOX`. */
  thread_id?: string;
  /** Narrows a thread lookup to one mailbox. */
  account_id?: string;
  [key: string]: unknown;
}

/** The answer of {@link Contacts.lookup}. `contact` is `null` when nothing matched. */
export interface ContactLookup {
  contact: Contact | null;
  /** How it matched; absent when `contact` is null. */
  match?: ContactLookupMatch;
  [key: string]: unknown;
}

/** Body for {@link Contacts.export}. */
export interface ContactExportParams {
  /** `csv`, `xlsx` or `json`. */
  format?: "csv" | "xlsx" | "json";
  /** `all`, `filtered` (uses `filters`) or `selected` (uses `contact_ids`). */
  scope?: "all" | "filtered" | "selected";
  contact_ids?: string[];
  filters?: ContactSearchFilters;
  /** Column identifiers in display order, including `custom:<key>`. Empty uses the default columns. */
  fields?: string[];
  /** The filename without extension. */
  filename?: string;
  [key: string]: unknown;
}

/**
 * What {@link Contacts.export} decodes: the file's text for `csv`, the parsed document for
 * `json`. A `xlsx` export is binary and the REST client decodes every body as text, so
 * request `csv` or `json` here.
 */
export type ContactExportData = string | unknown[] | Record<string, unknown>;

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

// Appends the file part, naming it only when there is a name: a non-spec FormData (React
// Native's, some polyfills) would otherwise stringify an explicit undefined into "undefined".
function appendFile(form: FormData, file: Blob, filename?: string): void {
  if (filename !== undefined) form.append("file", file, filename);
  else form.append("file", file);
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
   * Filters go in the request body; `limit`, `cursor` and `category` are sent as query
   * parameters, which is where the platform reads them. Needs `READ_CONTACTS`.
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

  // POST /contacts/search takes its filters in the body but reads `limit`, `cursor` and
  // `category` from the query string, and answers with the data + pagination envelope.
  private async searchPage(params?: ContactSearchParams): Promise<Page<Contact>> {
    const { limit, cursor, category, ...filters } = params ?? {};
    const response = await this.http.post<ListResponse<Contact>>("contacts/search", {
      body: filters,
      query: { limit, cursor, category },
    });
    const fetchNext = (next: string): Promise<Page<Contact>> =>
      this.searchPage({ ...params, cursor: next });
    return new Page<Contact>(response, fetchNext);
  }

  /**
   * Adds contacts in a batch. The platform expects the request body to be the bare array of
   * contacts (or a single contact object), not an object wrapping it. Needs `WRITE_CONTACTS`.
   * @example
   * await warmbly.contacts.add([{ email: "team@warmbly.com" }]);
   */
  add(contacts: AddContactParams[], opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("contacts", {
      ...opts,
      body: contacts,
    });
  }

  /**
   * Bulk-updates a selection of contacts: add or remove campaigns and categories, edit
   * fields, or change subscription. Select by `contacts` id list (up to 10,000), or by `all`
   * plus `filters` and `exclude`. A select-all answers with the count rather than every row.
   * Needs `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.bulkUpdate({
   *   contacts: ["c_1", "c_2"],
   *   add_categories: ["cat_1"],
   *   subscribe: true,
   * });
   */
  bulkUpdate(params: BulkUpdateContactsParams): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("contacts", { body: params });
  }

  /**
   * Bulk-deletes a selection of contacts. Pass a bare array of contact ids, or the
   * selection object (`all` plus `filters` and `exclude`). Resolves with no body on
   * success (204). Needs `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.bulkDelete(["c_1", "c_2"]);
   * await warmbly.contacts.bulkDelete({ all: true, filters: { subscribed: false } });
   */
  bulkDelete(selection: string[] | ContactSelection): Promise<void> {
    return this.http.delete<void>("contacts", { body: selection });
  }

  /**
   * Exports contacts as a file and returns its content: the text for `csv`, the parsed
   * document for `json`. Capped at 50,000 rows. The REST client decodes every body as text,
   * so a binary `xlsx` export is not usable here; request `csv` or `json`. Needs
   * `READ_CONTACTS`.
   * @example
   * const csv = (await warmbly.contacts.export({ format: "csv", scope: "all" })) as string;
   */
  export(params?: ContactExportParams): Promise<ContactExportData> {
    return this.http.post<ContactExportData>("contacts/export", { body: params });
  }

  /**
   * Previews a contacts import without writing anything: uploads the file as
   * `multipart/form-data` and returns the detected columns, a sample, and a suggested
   * mapping. Pass the file as a `Blob` or `File`. Needs `WRITE_CONTACTS`.
   *
   * For a large file, prefer the background flow ({@link Contacts.createImport}), which
   * keeps a draft you can resume.
   * @example
   * const preview = await warmbly.contacts.importPreview(new Blob([csv], { type: "text/csv" }), {
   *   filename: "leads.csv",
   * });
   */
  importPreview(
    file: Blob,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<ContactImportPreview> {
    const form = new FormData();
    appendFile(form, file, params?.filename);
    return this.http.post<ContactImportPreview>("contacts/import/preview", {
      ...opts,
      body: form,
    });
  }

  /**
   * Imports a file synchronously: uploads it as `multipart/form-data` with the `options`
   * (mapping, dedup, categories, campaigns, segments) as a JSON form field, and answers with
   * the per-row result. Capped at 50,000 rows and gated on `BULK_CONTACTS`, since one call
   * writes the lot. A bad mapping (no `email` column, an unusable custom-field name) is a
   * 400 on the whole request, raised before any row is written. For larger or resumable
   * imports use {@link Contacts.createImport}.
   * @example
   * const result = await warmbly.contacts.importCommit(file, {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   *   dedup: "update",
   *   segment_ids: ["seg_1"],
   * });
   */
  importCommit(
    file: Blob,
    options: ContactImportOptions,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<ContactImportResult> {
    const form = new FormData();
    appendFile(form, file, params?.filename);
    form.append("options", JSON.stringify(options));
    return this.http.post<ContactImportResult>("contacts/import/commit", {
      ...opts,
      body: form,
    });
  }

  /**
   * Uploads a contact file once as a background-import draft (`multipart/form-data`) and
   * returns it with the preview the column mapper needs. Walk it through
   * {@link Contacts.saveImportDraft}, {@link Contacts.analyzeImport}, and
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
    const form = new FormData();
    appendFile(form, file, params?.filename);
    return this.http.post<ContactImport>("contacts/imports", { ...opts, body: form });
  }

  /**
   * Lists background imports, newest first, auto-paginating when iterated. Needs
   * `READ_CONTACTS`.
   * @example
   * for await (const imp of await warmbly.contacts.listImports()) console.log(imp.status);
   */
  listImports(params?: ListContactImportsParams): Promise<Page<ContactImport>> {
    return this.http.getPage<ContactImport>("contacts/imports", { query: params });
  }

  /**
   * Retrieves one background import: its progress counters, quality, and (for a draft) the
   * preview. Needs `READ_CONTACTS`.
   * @example
   * const imp = await warmbly.contacts.getImport("imp_1");
   */
  getImport(id: string, opts?: RequestOptions): Promise<ContactImport> {
    return this.http.get<ContactImport>(this.path("contacts", "imports", id), opts);
  }

  /**
   * Autosaves a draft's mapping and options so a reload resumes it. Idempotent by nature.
   * Needs `WRITE_CONTACTS`.
   * @example
   * await warmbly.contacts.saveImportDraft("imp_1", {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   *   dedup: "skip",
   * });
   */
  saveImportDraft(id: string, options: ContactImportOptions): Promise<ContactImport> {
    return this.http.patch<ContactImport>(this.path("contacts", "imports", id), {
      body: options,
    });
  }

  /**
   * Reports what a draft would do under a mapping, over the whole file, writing nothing:
   * how many rows are new, existing, duplicated, invalid, or in conflict, and why starting
   * would be refused as a whole. Needs `WRITE_CONTACTS`.
   * @example
   * const analysis = await warmbly.contacts.analyzeImport("imp_1", {
   *   mapping: [{ index: 0, target: "email" }],
   *   has_header: true,
   * });
   * if (analysis.problem) console.warn(analysis.problem);
   */
  analyzeImport(id: string, params: AnalyzeContactImportParams): Promise<ContactImportAnalysis> {
    return this.http.post<ContactImportAnalysis>(this.path("contacts", "imports", id, "analyze"), {
      body: params,
    });
  }

  /**
   * Starts a draft import with the final options. Starting an import that already started
   * returns it unchanged, so a retry is safe. Needs `BULK_CONTACTS`.
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
   * Cancels a background import. Rows already written stay written. Needs `BULK_CONTACTS`.
   * @example
   * await warmbly.contacts.cancelImport("imp_1");
   */
  cancelImport(id: string, opts?: RequestOptions): Promise<ContactImport> {
    return this.http.post<ContactImport>(this.path("contacts", "imports", id, "cancel"), opts);
  }

  /**
   * Downloads the failed rows of a finished import as CSV text, every one of them (the
   * import itself lists only the first 200). Needs `READ_CONTACTS`.
   * @example
   * const csv = await warmbly.contacts.importFailures("imp_1");
   */
  async importFailures(id: string, opts?: RequestOptions): Promise<string> {
    const body = await this.http.get<string | undefined>(
      this.path("contacts", "imports", id, "failed.csv"),
      opts,
    );
    return typeof body === "string" ? body : "";
  }

  /**
   * Resolves a sender to a contact in the organization, for an inbox CRM panel. Send an
   * `email` (bare, or as `Display Name <addr@example.com>`), a `thread_id`, or both; a
   * `thread_id` resolves a reply from an alias back to the lead. An unknown sender is a 200
   * with `contact: null`, not a 404. Needs `READ_CONTACTS`, plus `READ_UNIBOX` when
   * `thread_id` is sent.
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
   * Updates a single contact.
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
   * Returns the deals associated with a contact, as a bare array.
   * @example
   * const deals = await warmbly.contacts.deals("c_1");
   */
  deals(id: string, params?: Record<string, unknown>): Promise<Deal[]> {
    return this.http.get<Deal[]>(this.path("contacts", id, "deals"), {
      query: params,
    });
  }

  /**
   * Lists notes on a contact, auto-paginating when iterated. Needs `READ_CONTACTS`.
   * @example
   * for await (const note of await warmbly.contacts.listNotes("c_1")) console.log(note.content);
   */
  listNotes(id: string, params?: { cursor?: string; limit?: number }): Promise<Page<ContactNote>> {
    return this.http.getPage<ContactNote>(this.path("contacts", id, "notes"), { query: params });
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
}
