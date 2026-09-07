import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A hosted form's publication state. */
export type FormStatus = "draft" | "published" | "archived" | (string & {});

/** The kinds of image a form can carry. */
export type FormAssetKind = "logo" | "cover" | "background";

/** One field on a hosted form. Open shape; the builder owns the full vocabulary. */
export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  help_text?: string;
  required?: boolean;
  options?: string[];
  /** The contact column this field writes to (`email`, `first_name`, `custom:<key>`, ...). */
  map_to?: string;
  value?: string;
  width?: string;
  rows?: number;
  [key: string]: unknown;
}

/** The visual design of a hosted form. Open shape; every key is optional. */
export interface FormDesign {
  theme?: string;
  layout?: string;
  mode?: string;
  font_family?: string;
  accent_color?: string;
  button_text?: string;
  [key: string]: unknown;
}

/** A hosted lead-capture form. */
export interface Form {
  id: string;
  organization_id?: string;
  created_by?: string;
  /** The unguessable id in the public URL. */
  public_id?: string;
  name: string;
  status?: FormStatus;
  fields?: FormField[];
  design?: FormDesign;
  success_message?: string;
  redirect_url?: string;
  /** The campaign a submission enrolls the contact into, when set. */
  campaign_id?: string | null;
  category_ids?: string[];
  allowed_domains?: string[];
  captcha_enabled?: boolean;
  logo_url?: string;
  cover_url?: string;
  background_url?: string;
  views_count?: number;
  submissions_count?: number;
  starts_count?: number;
  identified_count?: number;
  trend?: number[];
  last_submission_at?: string | null;
  published_at?: string | null;
  /** The public URL of the form, on the workspace's forms domain when one is verified. */
  share_url?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for {@link Forms.update}. Every field is optional; `campaign_id: null` clears it. */
export interface UpdateFormParams {
  name?: string;
  status?: FormStatus;
  fields?: FormField[];
  design?: FormDesign;
  success_message?: string;
  redirect_url?: string;
  campaign_id?: string | null;
  category_ids?: string[];
  allowed_domains?: string[];
  captcha_enabled?: boolean;
  [key: string]: unknown;
}

/** One visitor submission of a hosted form. */
export interface FormSubmission {
  id: string;
  form_id?: string;
  organization_id?: string;
  /** The contact created or matched, when one was. */
  contact_id?: string;
  campaign_id?: string;
  /** The answers, keyed by field. */
  data?: Record<string, unknown>;
  source_url?: string;
  created_at?: string;
  contact_email?: string;
  contact_name?: string;
  campaign_name?: string;
  [key: string]: unknown;
}

/** Query params for {@link Forms.listSubmissions}. */
export interface ListFormSubmissionsParams {
  /** Page size, 1..100 (default 50). */
  limit?: number;
  /** Return submissions strictly older than this RFC 3339 timestamp. */
  before?: string;
  [key: string]: unknown;
}

/** A page of submissions. Paginate by passing the oldest `created_at` as `before`. */
export interface FormSubmissionList {
  data: FormSubmission[];
  has_more: boolean;
  [key: string]: unknown;
}

/** A `{ key, count }` bucket in the form statistics. */
export interface FormStatsBucket {
  key: string;
  count: number;
  [key: string]: unknown;
}

/** Statistics for one form over a window. */
export interface FormStats {
  totals?: {
    views?: number;
    starts?: number;
    submissions?: number;
    completion_rate?: number;
    identified_visitors?: number;
    [key: string]: unknown;
  };
  daily?: Array<{
    date: string;
    views?: number;
    starts?: number;
    submissions?: number;
    [key: string]: unknown;
  }>;
  pages?: Array<{
    page_index: number;
    title?: string;
    reached?: number;
    completed_from?: number;
    [key: string]: unknown;
  }>;
  sources?: FormStatsBucket[];
  countries?: FormStatsBucket[];
  devices?: FormStatsBucket[];
  campaigns?: FormStatsBucket[];
  identified?: Array<{
    contact_id: string;
    name?: string;
    email?: string;
    last_seen?: string;
    furthest_page?: number;
    completed?: boolean;
    campaign?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** The state of the workspace's custom forms domain. */
export interface FormsDomainStatus {
  forms_domain: string;
  forms_domain_verified: boolean;
  forms_domain_verified_at?: string | null;
  /** The value to put in the `CNAME`. */
  cname_target?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
}

/** Deployment-level forms settings, from {@link Forms.config}. */
export interface FormsConfig {
  /** The base URL public forms are served from. */
  base_url: string;
  /** Whether the deployment can put a captcha on a form. */
  captcha_available: boolean;
  [key: string]: unknown;
}

/**
 * Hosted lead-capture forms. Reads need `READ_CONTACTS`, writes `WRITE_CONTACTS`;
 * the custom domain routes additionally need the `manage_settings` organization
 * permission for session callers. Reachable as `warmbly.forms`.
 *
 * @example
 * const form = await warmbly.forms.create({ name: "Demo request" });
 * await warmbly.forms.update(form.id, { status: "published", campaign_id: "camp_1" });
 * console.log(form.share_url);
 */
export class Forms extends APIResource {
  /**
   * Lists every form with its counts and share URL. Not paginated.
   * @example
   * const forms = await warmbly.forms.list();
   */
  list(opts?: RequestOptions): Promise<Form[]> {
    return this.http.get<{ data: Form[] }>("forms", opts).then((r) => r.data ?? []);
  }

  /**
   * Reads the deployment's forms base URL and whether captcha is available.
   * @example
   * const { base_url } = await warmbly.forms.config();
   */
  config(opts?: RequestOptions): Promise<FormsConfig> {
    return this.http.get<FormsConfig>("forms/config", opts);
  }

  /**
   * Creates a draft form with the given name.
   * @example
   * const form = await warmbly.forms.create({ name: "Newsletter" });
   */
  create(params: { name: string; [key: string]: unknown }): Promise<Form> {
    return this.http.post<Form>("forms", { body: params });
  }

  /**
   * Retrieves a form by id.
   * @example
   * const form = await warmbly.forms.get("form_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Form> {
    return this.http.get<Form>(this.path("forms", id), opts);
  }

  /**
   * Updates a form: fields, design, status, the campaign to enroll into, and more.
   * @example
   * await warmbly.forms.update("form_1", { status: "published" });
   */
  update(id: string, params: UpdateFormParams): Promise<Form> {
    return this.http.patch<Form>(this.path("forms", id), { body: params });
  }

  /**
   * Deletes a form and its submissions.
   * @example
   * await warmbly.forms.delete("form_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("forms", id), opts);
  }

  /**
   * Lists submissions, newest first. Paginate by passing the oldest `created_at` as `before`.
   * @example
   * const { data, has_more } = await warmbly.forms.listSubmissions("form_1", { limit: 100 });
   */
  listSubmissions(id: string, params?: ListFormSubmissionsParams): Promise<FormSubmissionList> {
    return this.http.get<FormSubmissionList>(this.path("forms", id, "submissions"), {
      query: params,
    });
  }

  /**
   * Deletes one submission.
   * @example
   * await warmbly.forms.deleteSubmission("form_1", "sub_1");
   */
  deleteSubmission(id: string, submissionId: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("forms", id, "submissions", submissionId), opts);
  }

  /**
   * Returns views, starts, submissions, the page funnel, and breakdowns over a window.
   * @example
   * const stats = await warmbly.forms.stats("form_1", { range: "7d" });
   */
  stats(id: string, params?: { range?: "7d" | "30d" | "90d" }): Promise<FormStats> {
    return this.http.get<FormStats>(this.path("forms", id, "stats"), { query: params });
  }

  /**
   * Mints (or returns the existing) personalized link to the form for one contact.
   * Idempotent: repeating the call returns the same token. Needs `WRITE_CONTACTS`
   * because minting writes a link row.
   * @example
   * const { url } = await warmbly.forms.mintLink("form_1", "c_1");
   */
  mintLink(id: string, contactId: string, opts?: RequestOptions): Promise<{ url: string }> {
    return this.http.get<{ url: string }>(this.path("forms", id, "links", contactId), opts);
  }

  /**
   * Uploads a PNG or JPG as the form's logo, cover, or background, as `multipart/form-data`.
   * Logos are capped at 1 MB and 1024px; covers and backgrounds at 4 MB and 2560px.
   * @example
   * await warmbly.forms.uploadAsset("form_1", "logo", new Blob([bytes], { type: "image/png" }));
   */
  uploadAsset(
    id: string,
    kind: FormAssetKind,
    file: Blob,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<Form> {
    const form = new FormData();
    // Append the filename only when there is one. Node, Bun and browsers all treat an
    // explicit undefined third argument as absent, per WebIDL, but a non-spec FormData
    // (React Native's, some polyfills) stringifies it into a file named "undefined".
    if (params?.filename !== undefined) form.append("file", file, params.filename);
    else form.append("file", file);
    return this.http.post<Form>(this.path("forms", id, "assets", kind), { ...opts, body: form });
  }

  /**
   * Removes the form's logo, cover, or background.
   * @example
   * await warmbly.forms.deleteAsset("form_1", "cover");
   */
  deleteAsset(id: string, kind: FormAssetKind, opts?: RequestOptions): Promise<Form> {
    return this.http.delete<Form>(this.path("forms", id, "assets", kind), opts);
  }

  /**
   * Reads the workspace's custom forms domain and the `CNAME` it must point at.
   * @example
   * const domain = await warmbly.forms.getDomain();
   */
  getDomain(opts?: RequestOptions): Promise<FormsDomainStatus> {
    return this.http.get<FormsDomainStatus>("forms/domain", opts);
  }

  /**
   * Sets the custom forms domain and resolves it once. Send an empty string to clear it.
   * Only a verified domain is used to build share URLs.
   * @example
   * await warmbly.forms.setDomain("forms.acme.com");
   */
  setDomain(formsDomain: string): Promise<FormsDomainStatus> {
    return this.http.put<FormsDomainStatus>("forms/domain", {
      body: { forms_domain: formsDomain },
    });
  }

  /**
   * Re-resolves the saved forms domain and records the verdict.
   * @example
   * const { forms_domain_verified } = await warmbly.forms.verifyDomain();
   */
  verifyDomain(opts?: RequestOptions): Promise<FormsDomainStatus> {
    return this.http.post<FormsDomainStatus>("forms/domain/verify", opts);
  }
}
