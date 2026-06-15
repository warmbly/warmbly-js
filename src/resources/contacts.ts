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

/** A note attached to a contact. */
export interface ContactNote {
  id: string;
  contact_id?: string;
  body?: string;
  created_at?: string;
  [key: string]: unknown;
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
   * for await (const c of warmbly.contacts.list()) console.log(c.id);
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
   * await warmbly.contacts.add([{ email: "a@example.com" }]);
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
   * await warmbly.contacts.bulkUpdate({ filter: {}, set: { company: "Acme" } });
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
   * const c = await warmbly.contacts.lookup({ email: "a@example.com" });
   */
  lookup(params: Record<string, unknown>): Promise<Contact> {
    return this.http.get<Contact>("contacts/lookup", { query: params });
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
   * await warmbly.contacts.update("c_1", { company: "Acme" });
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
   * Adds a note to a contact.
   * @example
   * await warmbly.contacts.createNote("c_1", { body: "Called, no answer" });
   */
  createNote(id: string, params: Record<string, unknown>): Promise<ContactNote> {
    return this.http.post<ContactNote>(this.path("contacts", id, "notes"), { body: params });
  }

  /**
   * Updates a note on a contact.
   * @example
   * await warmbly.contacts.updateNote("c_1", "n_1", { body: "Updated" });
   */
  updateNote(id: string, noteId: string, params: Record<string, unknown>): Promise<ContactNote> {
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
