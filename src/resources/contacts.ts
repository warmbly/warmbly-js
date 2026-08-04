import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A Warmbly contact. Documented-but-open shape. */
export interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  phone?: string;
  custom_fields?: Record<string, string>;
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
  custom_fields?: Record<string, string>;
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

/** Query/body for searching contacts. */
export interface ContactSearchParams {
  cursor?: string;
  limit?: number;
  query?: string;
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
   * Bulk-updates contacts.
   * @example
   * await warmbly.contacts.bulkUpdate({ filter: {}, set: { company: "Warmbly" } });
   */
  bulkUpdate(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>("contacts", { body: params });
  }

  /**
   * Bulk-deletes contacts.
   * @example
   * await warmbly.contacts.bulkDelete({ ids: ["c_1", "c_2"] });
   */
  bulkDelete(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.delete<Record<string, unknown>>("contacts", { body: params });
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
   * Previews a contacts import without committing it.
   * @example
   * const preview = await warmbly.contacts.importPreview({ upload_id: "u_1" });
   */
  importPreview(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("contacts/import/preview", { body: params });
  }

  /**
   * Commits a previously previewed contacts import.
   * @example
   * await warmbly.contacts.importCommit({ upload_id: "u_1" });
   */
  importCommit(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("contacts/import/commit", { body: params });
  }

  /**
   * Looks up a contact by an identifier such as email (via the `lookup` query).
   * @example
   * const c = await warmbly.contacts.lookup({ email: "team@warmbly.com" });
   */
  lookup(params: Record<string, unknown>): Promise<Contact> {
    return this.http.get<Contact>("contacts/lookup", { query: params });
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
   * Retrieves a contact by id.
   * @example
   * const c = await warmbly.contacts.get("c_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Contact> {
    return this.http.get<Contact>(this.path("contacts", id), opts);
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
   * Returns the activity timeline for a contact.
   * @example
   * const timeline = await warmbly.contacts.timeline("c_1");
   */
  timeline(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
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
}
