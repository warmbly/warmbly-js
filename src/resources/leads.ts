import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Where a lead's business record came from. */
export type LeadProvider = "osm" | "google_places" | "foursquare" | "outscraper" | (string & {});

/** Where a lead stands in prospecting. */
export type LeadFinderStatus = "new" | "saved" | "contacted" | "dismissed" | (string & {});

/** How far reading a lead's website got. */
export type LeadEnrichmentStatus =
  | "none"
  | "queued"
  | "done"
  | "no_website"
  | "failed"
  | (string & {});

/** How a lead list is ordered. Defaults to `recent`. */
export type LeadSort = "recent" | "score" | "rating" | "reviews" | "name" | (string & {});

/** Places a person in their business. */
export type LeadSeniority = "owner" | "executive" | "manager" | "staff" | (string & {});

/** Where a person was found. */
export type LeadPersonSource =
  | "schema"
  | "page"
  | "imprint"
  | "email"
  | "linkedin"
  | "manual"
  | (string & {});

/** How a person's address was arrived at (empty when there is none). */
export type LeadEmailSource = "" | "website" | "pattern" | "manual" | (string & {});

/** The shape a search covers. */
export type LeadAreaKind = "bbox" | "circle" | "polygon" | (string & {});

/** Which addresses an add-to-contacts import takes. */
export type LeadContactsWho = "business" | "people" | "both" | (string & {});

/** A point on the map. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A south-west to north-east rectangle. */
export interface LeadBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The part of the map a search covers. `bounds` is always set (the bounding box for shapes). */
export interface LeadArea {
  kind: LeadAreaKind;
  bounds: LeadBounds;
  /** The centre, for a circle. */
  center?: LatLng;
  /** The radius in metres, for a circle. */
  radius_m?: number;
  /** The vertices, for a polygon. */
  polygon?: LatLng[];
  [key: string]: unknown;
}

/** One address found for a lead and what checking it said. */
export interface LeadEmail {
  email: string;
  /** `website` when read off the business's site, else the provider. */
  source: string;
  url?: string;
  domain_match: boolean;
  status?: string;
  sub_status?: string;
  [key: string]: unknown;
}

/** What reading a lead's website found besides addresses. */
export interface LeadSite {
  reachable: boolean;
  final_url?: string;
  https: boolean;
  title?: string;
  description?: string;
  platform?: string;
  signals?: string[];
  phones?: string[];
  pages?: number;
  /** How the domain builds a person's address, e.g. `first.last`. */
  email_pattern?: string;
  /** Set when the mail server accepts any address, so guesses cannot be confirmed. */
  accepts_all?: boolean;
  /** Set when the listing had no website and one was worked out from the name. */
  found_website?: boolean;
  error?: string;
  checked_at?: string | null;
  [key: string]: unknown;
}

/** One person who works at a lead's business. */
export interface LeadPerson {
  id: string;
  lead_id: string;
  name: string;
  first_name: string;
  last_name: string;
  title: string;
  seniority: LeadSeniority;
  email: string;
  email_source: LeadEmailSource;
  /** The verification result, or `guessed` for a pattern-built address nothing could confirm. */
  email_status: string;
  email_confidence: number;
  linkedin_url: string;
  phone: string;
  source: LeadPersonSource;
  source_url: string;
  /** The contact this person was imported as, if any. */
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** One business in the lead finder. */
export interface Lead {
  id: string;
  provider: LeadProvider;
  external_id: string;
  name: string;
  category: string;
  categories: string[];
  address: string;
  street: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  latitude: number;
  longitude: number;
  phone: string;
  website: string;
  domain: string;
  /** The primary address. */
  email: string;
  emails: LeadEmail[];
  /** Social profile links keyed by network. */
  socials: Record<string, string>;
  rating: number | null;
  review_count: number | null;
  price_level: number | null;
  hours: string[];
  business_status: string;
  maps_url: string;
  description: string;
  chain: string;
  site: LeadSite;
  score: number;
  status: LeadFinderStatus;
  enrichment_status: LeadEnrichmentStatus;
  enriched_at: string | null;
  /** The contact this lead was imported as, if any. */
  contact_id: string | null;
  tags: string[];
  notes: string;
  people_count: number;
  /** Loaded only when one lead is read in full. */
  people?: LeadPerson[];
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Narrows the workspace's leads. Every field is optional. */
export interface LeadFilter {
  search_id?: string;
  /** Free-text match. */
  q?: string;
  statuses?: LeadFinderStatus[];
  providers?: LeadProvider[];
  category?: string;
  tag?: string;
  has_email?: boolean;
  has_website?: boolean;
  has_phone?: boolean;
  has_socials?: boolean;
  has_people?: boolean;
  in_contacts?: boolean;
  enrichment?: LeadEnrichmentStatus[];
  min_rating?: number;
  min_reviews?: number;
  max_reviews?: number;
  min_score?: number;
  bounds?: LeadBounds;
  exclude_chains?: boolean;
  [key: string]: unknown;
}

/** Names a set of leads: explicit ids, or every lead matching a filter (`all`). */
export interface LeadSelection {
  lead_ids?: string[];
  /** Select every lead matching `filter` (or every lead when no filter is given). */
  all?: boolean;
  filter?: LeadFilter;
  [key: string]: unknown;
}

/** The editable part of a lead. Omitted fields are left alone. */
export interface LeadPatch {
  status?: LeadFinderStatus;
  notes?: string;
  /** Replaces the tag list. */
  tags?: string[];
  add_tags?: string[];
  remove_tags?: string[];
  [key: string]: unknown;
}

/** Body for {@link Leads.update}: the selection plus the patch. */
export type UpdateLeadsParams = LeadSelection & LeadPatch;

/** Body for {@link Leads.query}. */
export interface QueryLeadsParams {
  filter?: LeadFilter;
  sort?: LeadSort;
  /** 1 to 200, default 50. */
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
  [key: string]: unknown;
}

/** Body for {@link Leads.search}: runs one page of a provider search. */
export interface SearchLeadsParams {
  /** Pass an existing search to fetch its next page. */
  search_id?: string;
  provider?: LeadProvider;
  /** Free-text query. */
  query?: string;
  /** A category preset id from {@link Leads.config}. */
  category?: string;
  location_label?: string;
  area?: LeadArea;
  /** Save the search so it appears in the saved list. */
  save?: boolean;
  name?: string;
  /** `en`, `de` or `fr`. */
  language?: string;
  [key: string]: unknown;
}

/** A search the workspace ran on the lead finder map. */
export interface LeadSearch {
  id: string;
  created_by_user_id: string | null;
  name: string;
  provider: LeadProvider;
  query: string;
  category: string;
  location_label: string;
  area: LeadArea;
  saved: boolean;
  result_count: number;
  pages_fetched: number;
  has_more: boolean;
  last_run_at: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** One page of a provider search, from {@link Leads.search}. */
export interface LeadSearchResult {
  search: LeadSearch;
  leads: Lead[];
  /** Leads this page returned. */
  found: number;
  /** Results dropped for falling outside the area. */
  outside_area: number;
  /** What the page cost, in USD. */
  charged_usd: number;
  [key: string]: unknown;
}

/** A pin on the map, from {@link Leads.points}. */
export interface LeadPoint {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  status: LeadFinderStatus;
  score: number;
  has_email: boolean;
  has_website: boolean;
  has_phone: boolean;
  rating: number | null;
  review_count: number | null;
  in_contacts: boolean;
  [key: string]: unknown;
}

/** The pins for a filter. */
export interface LeadPointsResult {
  data: LeadPoint[];
  /** True when the pin cap was hit and more leads match than were returned. */
  truncated: boolean;
}

/** One filterable value and how many leads carry it. */
export interface LeadFacet {
  value: string;
  count: number;
}

/** Filter values for a scope, from {@link Leads.facets}. */
export interface LeadFacets {
  categories: LeadFacet[];
  tags: LeadFacet[];
  cities: LeadFacet[];
  [key: string]: unknown;
}

/** A place a typed location resolved to, from {@link Leads.geocode}. */
export interface GeocodeResult {
  label: string;
  detail: string;
  kind: string;
  center: LatLng;
  bounds?: LeadBounds;
  [key: string]: unknown;
}

/** Query for {@link Leads.geocode}. */
export interface GeocodeParams {
  /** The typed location. */
  q: string;
  /** Bias the results toward this point. Send `lat` and `lng` together. */
  lat?: number;
  lng?: number;
  /** `en`, `de` or `fr`. */
  lang?: string;
}

/** A search provider and whether this workspace can use it. */
export interface LeadProviderInfo {
  id: LeadProvider;
  name: string;
  description: string;
  /** True when a search can run: free, or a key is configured. */
  available: boolean;
  /** `none`, `workspace` or `instance`. */
  key_source: string;
  needs_key: boolean;
  page_size: number;
  max_pages: number;
  cost_usd: number;
  fields: string[];
  /** The integration that holds the provider's key. */
  integration?: string;
  [key: string]: unknown;
}

/** A category preset. */
export interface LeadCategory {
  id: string;
  label: string;
  group: string;
}

/** A column available in an export. */
export interface LeadExportColumn {
  key: string;
  label: string;
}

/** The lead finder's providers, categories, export columns, prices and map style. */
export interface LeadFinderConfig {
  providers: LeadProviderInfo[];
  categories: LeadCategory[];
  default_provider: LeadProvider;
  /** USD per website read. */
  enrich_cost_usd: number;
  /** USD per person address worked out. */
  person_email_cost_usd: number;
  export_columns: LeadExportColumn[];
  /** Extra columns of a one-row-per-person export. */
  person_columns: LeadExportColumn[];
  default_export_columns: string[];
  map: { style_light: string; style_dark: string };
  [key: string]: unknown;
}

/** Body for {@link Leads.enrich}: the selection plus options. */
export interface EnrichLeadsParams extends LeadSelection {
  /** Verify the addresses found. Defaults to true. */
  verify?: boolean;
  /** Also find the people each site names and work out their addresses. Defaults to true. */
  people?: boolean;
}

/** A background pass reading leads' websites. */
export interface LeadEnrichmentRun {
  id: string;
  requested_by_user_id: string | null;
  verify: boolean;
  people: boolean;
  /** For example `queued`, `running`, `completed`, `failed`. */
  status: string;
  total: number;
  processed: number;
  emails_found: number;
  people_found: number;
  no_website: number;
  failed: number;
  charged_usd: number;
  last_error: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Body for {@link Leads.addToContacts}: the selection plus import options. */
export interface AddLeadsToContactsParams extends LeadSelection {
  /** Enroll the imported contacts in these campaigns. */
  campaign_ids?: string[];
  /** Label them with these categories. */
  category_ids?: string[];
  /** Pin them into these segments. */
  segment_ids?: string[];
  /** Skip every address that did not check as valid. */
  verified_only?: boolean;
  /** `business` (each lead's own address, default), `people` or `both`. */
  who?: LeadContactsWho;
  /** Include people whose address was worked out but not confirmed. */
  include_guessed?: boolean;
  /** Leave contacts already in the workspace as they are (they still get the segments, labels and campaigns). */
  keep_existing?: boolean;
  /** Enroll nobody another campaign is emailing. */
  skip_active_in_other_campaigns?: boolean;
}

/** What became of an {@link Leads.addToContacts} import. */
export interface AddLeadsToContactsResult {
  selected: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  no_email: number;
  unverified: number;
  suppressed: number;
  guessed: number;
  people: number;
  /** Per-row failures, when any. */
  errors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** Body for {@link Leads.export}: the selection plus format options. */
export interface ExportLeadsParams extends LeadSelection {
  /** `csv` (default), `xlsx` or `json`. */
  format?: "csv" | "xlsx" | "json" | (string & {});
  /** Column keys from {@link Leads.config}; defaults to `default_export_columns`. */
  columns?: string[];
  /** `leads` (one row per business, default) or `people` (one row per person). */
  rows?: "leads" | "people" | (string & {});
}

/** Body for {@link Leads.updateSearch}. */
export interface UpdateLeadSearchParams {
  name?: string;
  saved?: boolean;
}

/** Query for {@link Leads.searches}. */
export interface ListLeadSearchesParams {
  /** Only saved searches. Without it, recent searches are returned. */
  saved?: boolean;
}

/** Body for {@link Leads.addPerson}. Send a name; the address is worked out when none is given. */
export interface LeadPersonInput {
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  phone?: string;
  [key: string]: unknown;
}

/** Body for {@link Leads.updatePerson}. Omitted fields are left alone. */
export type LeadPersonPatch = LeadPersonInput;

/**
 * The lead finder: businesses found on a map become leads, then contacts. Leads are
 * prospect contacts, so the contact permissions gate them: reads need `READ_CONTACTS`,
 * edits and searches `WRITE_CONTACTS`, and the bulk routes (update, delete, enrich, add
 * to contacts) `BULK_CONTACTS`. Reachable as `warmbly.leads`. Separate from
 * `warmbly.leadSync`, which imports Google Sheets rows.
 *
 * @example
 * const result = await warmbly.leads.search({
 *   provider: "osm",
 *   category: "restaurant",
 *   location_label: "Berlin",
 *   area: { kind: "bbox", bounds: { south: 52.4, west: 13.3, north: 52.6, east: 13.5 } },
 * });
 * await warmbly.leads.addToContacts({ lead_ids: result.leads.map((l) => l.id) });
 */
export class Leads extends APIResource {
  /**
   * Lists the providers, category presets, export columns, prices and map style.
   * Requires `READ_CONTACTS`.
   * @example
   * const config = await warmbly.leads.config();
   */
  config(opts?: RequestOptions): Promise<LeadFinderConfig> {
    return this.http.get<LeadFinderConfig>("leads/config", opts);
  }

  /**
   * Looks up a typed location for the map. Requires `READ_CONTACTS`.
   * @example
   * const places = await warmbly.leads.geocode({ q: "Berlin" });
   */
  geocode(params: GeocodeParams, opts?: RequestOptions): Promise<GeocodeResult[]> {
    return this.http
      .get<{ data: GeocodeResult[] }>("leads/geocode", {
        ...opts,
        query: { ...opts?.query, ...params },
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Runs one page of a provider search and stores the leads it returns. Pass
   * `search_id` to fetch the next page of an earlier search. May charge the workspace
   * for provider pages (`charged_usd`). Requires `WRITE_CONTACTS`.
   * @example
   * const page = await warmbly.leads.search({ provider: "osm", category: "cafe", area });
   */
  search(params: SearchLeadsParams, opts?: RequestOptions): Promise<LeadSearchResult> {
    return this.http.post<LeadSearchResult>("leads/search", { ...opts, body: params });
  }

  /**
   * Lists leads matching a filter, a page at a time. It is a read sent as a POST so the
   * filter can travel in the body. The returned page auto-paginates when iterated.
   * Requires `READ_CONTACTS`.
   * @example
   * for await (const lead of await warmbly.leads.query({ filter: { has_email: true } })) {
   *   console.log(lead.name);
   * }
   */
  async query(params: QueryLeadsParams = {}, opts?: RequestOptions): Promise<Page<Lead>> {
    const fetchPage = async (body: QueryLeadsParams): Promise<Page<Lead>> => {
      const response = await this.http.post<ListResponse<Lead>>("leads/query", { ...opts, body });
      return new Page<Lead>(response, (cursor) => fetchPage({ ...body, cursor }));
    };
    return fetchPage(params);
  }

  /**
   * Returns the map pins for a filter, capped server side (`truncated` says so).
   * Requires `READ_CONTACTS`.
   * @example
   * const { data: pins } = await warmbly.leads.points({ filter: { statuses: ["new"] } });
   */
  points(
    params: Pick<QueryLeadsParams, "filter"> = {},
    opts?: RequestOptions,
  ): Promise<LeadPointsResult> {
    return this.http
      .post<Partial<LeadPointsResult>>("leads/points", { ...opts, body: params })
      .then((r) => ({ ...r, data: r.data ?? [], truncated: r.truncated ?? false }));
  }

  /**
   * Returns the category, tag, and city values (with counts) available inside a filter.
   * Requires `READ_CONTACTS`.
   * @example
   * const facets = await warmbly.leads.facets({ filter: { q: "bakery" } });
   */
  facets(
    params: Pick<QueryLeadsParams, "filter"> = {},
    opts?: RequestOptions,
  ): Promise<LeadFacets> {
    return this.http.post<LeadFacets>("leads/facets", { ...opts, body: params });
  }

  /**
   * Downloads the selected leads. `csv` comes back as text and `json` as the decoded
   * value. `xlsx` is binary, which this client's text decoding does not preserve, so
   * prefer `csv` or `json` here. Requires `READ_CONTACTS`.
   * @example
   * const csv = await warmbly.leads.export({ all: true, format: "csv" });
   */
  export(params: ExportLeadsParams, opts?: RequestOptions): Promise<unknown> {
    return this.http.post<unknown>("leads/export", { ...opts, body: params });
  }

  /**
   * Edits many leads at once (status, notes, tags). Returns how many changed. Safe to
   * retry. Requires `BULK_CONTACTS`.
   * @example
   * await warmbly.leads.update({ lead_ids: ["l_1"], status: "saved", add_tags: ["hot"] });
   */
  update(params: UpdateLeadsParams, opts?: RequestOptions): Promise<{ updated: number }> {
    return this.http.patch<{ updated: number }>("leads", { ...opts, body: params });
  }

  /**
   * Deletes the selected leads. Deleting what is already gone is a no-op. Returns how
   * many were removed. Requires `BULK_CONTACTS`.
   * @example
   * await warmbly.leads.delete({ lead_ids: ["l_1"] });
   */
  delete(selection: LeadSelection, opts?: RequestOptions): Promise<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>("leads", { ...opts, body: selection });
  }

  /**
   * Starts a background run reading the selected leads' websites for addresses and
   * people. Returns the run (HTTP 202); poll {@link Leads.getEnrichment}. Charges the
   * workspace per site. Requires `BULK_CONTACTS`.
   * @example
   * const run = await warmbly.leads.enrich({ lead_ids: ["l_1"], people: false });
   */
  enrich(params: EnrichLeadsParams, opts?: RequestOptions): Promise<LeadEnrichmentRun> {
    return this.http.post<LeadEnrichmentRun>("leads/enrich", { ...opts, body: params });
  }

  /**
   * Lists the enrichment runs still going. Requires `READ_CONTACTS`.
   * @example
   * const active = await warmbly.leads.enrichments();
   */
  enrichments(opts?: RequestOptions): Promise<LeadEnrichmentRun[]> {
    return this.http
      .get<{ data: LeadEnrichmentRun[] }>("leads/enrichments", opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Retrieves one enrichment run's progress. Requires `READ_CONTACTS`.
   * @example
   * const run = await warmbly.leads.getEnrichment("run_1");
   */
  getEnrichment(id: string, opts?: RequestOptions): Promise<LeadEnrichmentRun> {
    return this.http.get<LeadEnrichmentRun>(this.path("leads", "enrichments", id), opts);
  }

  /**
   * Imports the selected leads (and optionally the people found at them) as contacts,
   * optionally enrolling them in campaigns, categories and segments. Existing contacts
   * are updated, so a retry adds nobody twice. Requires `BULK_CONTACTS`.
   * @example
   * const r = await warmbly.leads.addToContacts({ all: true, verified_only: true, who: "both" });
   */
  addToContacts(
    params: AddLeadsToContactsParams,
    opts?: RequestOptions,
  ): Promise<AddLeadsToContactsResult> {
    return this.http.post<AddLeadsToContactsResult>("leads/contacts", { ...opts, body: params });
  }

  /**
   * Lists recent searches, or only saved ones with `saved: true`. Not paginated.
   * Requires `READ_CONTACTS`.
   * @example
   * const saved = await warmbly.leads.searches({ saved: true });
   */
  searches(params: ListLeadSearchesParams = {}, opts?: RequestOptions): Promise<LeadSearch[]> {
    return this.http
      .get<{ data: LeadSearch[] }>("leads/searches", {
        ...opts,
        query: { ...opts?.query, ...params },
      })
      .then((r) => r.data ?? []);
  }

  /**
   * Renames a search or saves/unsaves it. Requires `WRITE_CONTACTS`.
   * @example
   * await warmbly.leads.updateSearch("s_1", { name: "Berlin cafes", saved: true });
   */
  updateSearch(
    id: string,
    params: UpdateLeadSearchParams,
    opts?: RequestOptions,
  ): Promise<LeadSearch> {
    return this.http.patch<LeadSearch>(this.path("leads", "searches", id), {
      ...opts,
      body: params,
    });
  }

  /**
   * Deletes a search. Its leads stay. Requires `WRITE_CONTACTS`.
   * @example
   * await warmbly.leads.deleteSearch("s_1");
   */
  deleteSearch(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("leads", "searches", id), opts);
  }

  /**
   * Retrieves one lead, with its people. Requires `READ_CONTACTS`.
   * @example
   * const lead = await warmbly.leads.get("l_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Lead> {
    return this.http.get<Lead>(this.path("leads", id), opts);
  }

  /**
   * Edits one lead's status, notes or tags and returns the updated lead. Requires
   * `WRITE_CONTACTS`.
   * @example
   * await warmbly.leads.edit("l_1", { status: "contacted", notes: "Called Monday" });
   */
  edit(id: string, params: LeadPatch, opts?: RequestOptions): Promise<Lead> {
    return this.http.patch<Lead>(this.path("leads", id), { ...opts, body: params });
  }

  /**
   * Adds a person to a lead and works out their address when none is given. People are
   * matched by name, so a retry lands on the same person. Requires `WRITE_CONTACTS`.
   * @example
   * await warmbly.leads.addPerson("l_1", { name: "Ada Lovelace", title: "Owner" });
   */
  addPerson(id: string, params: LeadPersonInput, opts?: RequestOptions): Promise<LeadPerson> {
    return this.http.post<LeadPerson>(this.path("leads", id, "people"), { ...opts, body: params });
  }

  /**
   * Edits a person on a lead. Omitted fields are left alone. Requires `WRITE_CONTACTS`.
   * @example
   * await warmbly.leads.updatePerson("l_1", "p_1", { title: "CEO" });
   */
  updatePerson(
    id: string,
    personId: string,
    params: LeadPersonPatch,
    opts?: RequestOptions,
  ): Promise<LeadPerson> {
    return this.http.patch<LeadPerson>(this.path("leads", id, "people", personId), {
      ...opts,
      body: params,
    });
  }

  /**
   * Removes a person from a lead. Requires `WRITE_CONTACTS`.
   * @example
   * await warmbly.leads.deletePerson("l_1", "p_1");
   */
  deletePerson(id: string, personId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("leads", id, "people", personId), opts);
  }

  /**
   * Works out a person's address at the lead's domain again. Searching again converges
   * on the same address, so a retry is safe. May charge the workspace. Requires
   * `WRITE_CONTACTS`.
   * @example
   * const person = await warmbly.leads.findPersonEmail("l_1", "p_1");
   */
  findPersonEmail(id: string, personId: string, opts?: RequestOptions): Promise<LeadPerson> {
    return this.http.post<LeadPerson>(
      this.path("leads", id, "people", personId, "find-email"),
      opts,
    );
  }
}
