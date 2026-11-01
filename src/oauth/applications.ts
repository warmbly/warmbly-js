import type { HttpClient } from "../core/http";
import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import type {
  AuthorizedApp,
  OAuthAppListing,
  OAuthAppListingWrite,
  OAuthApplication,
  OAuthApplicationWithSecret,
  OAuthApplicationWrite,
  OAuthDeveloperAccess,
  WebhookDelivery,
  WebhookEndpointHealth,
} from "./types";

/**
 * Unwraps a list payload that may be a bare array or an envelope keyed by `data`,
 * `applications`, or `authorized_apps` (the keys the API uses for these endpoints).
 */
function unwrapList<T>(
  payload: T[] | { data?: T[]; applications?: T[]; authorized_apps?: T[] } | undefined,
): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? payload?.applications ?? payload?.authorized_apps ?? [];
}

/**
 * Manages OAuth applications, their logo, their community directory listing, and their
 * webhook configuration. Uses the bearer-authenticated {@link HttpClient}, so the underlying
 * credential needs the `API_KEYS` (manage api keys) scope. An OAuth app token is always
 * refused here (403, code `oauth_token_not_allowed`): use the dashboard or an API key.
 *
 * @example
 * const apps = new OAuthApplications(http);
 * const created = await apps.create({
 *   name: "My App",
 *   redirect_uris: ["https://app.example.com/callback"],
 *   scopes: 6,
 * });
 * console.log(created.client_secret); // shown only once
 */
export class OAuthApplications {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Lists the organization's OAuth applications.
   *
   * @example
   * const apps = await warmbly.oauth.applications.list();
   */
  async list(): Promise<OAuthApplication[]> {
    const payload = await this.http.get<
      OAuthApplication[] | { data?: OAuthApplication[]; applications?: OAuthApplication[] }
    >("/oauth/applications");
    return unwrapList(payload);
  }

  /**
   * Lists the organization's OAuth applications together with whether this workspace and
   * caller may register and publish apps (`developer_access`). Needs `API_KEYS`.
   *
   * @example
   * const { applications, developer_access } = await warmbly.oauthApplications.listWithAccess();
   * if (developer_access.blocked) console.log(developer_access.reason);
   */
  async listWithAccess(
    opts?: RequestOptions,
  ): Promise<{ applications: OAuthApplication[]; developer_access: OAuthDeveloperAccess }> {
    const payload = await this.http.get<{
      applications?: OAuthApplication[];
      data?: OAuthApplication[];
      developer_access?: OAuthDeveloperAccess;
    }>("/oauth/applications", opts);
    return {
      applications: unwrapList(payload),
      developer_access: payload?.developer_access ?? { blocked: false },
    };
  }

  /**
   * Creates an OAuth application. The response includes the `client_secret` exactly once.
   *
   * @example
   * const app = await warmbly.oauth.applications.create({
   *   name: "My App",
   *   redirect_uris: ["https://app.example.com/callback"],
   *   scopes: 6,
   * });
   */
  async create(body: OAuthApplicationWrite): Promise<OAuthApplicationWithSecret> {
    return this.http.post<OAuthApplicationWithSecret>("/oauth/applications", { body });
  }

  /**
   * Fetches a single OAuth application by id.
   *
   * @example
   * const app = await warmbly.oauth.applications.get("wmcid_...");
   */
  async get(id: string): Promise<OAuthApplication> {
    return this.http.get<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}`);
  }

  /**
   * Updates an OAuth application.
   *
   * @example
   * const app = await warmbly.oauth.applications.update("wmcid_...", { name: "Renamed" });
   */
  async update(id: string, body: Partial<OAuthApplicationWrite>): Promise<OAuthApplication> {
    return this.http.patch<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}`, {
      body,
    });
  }

  /**
   * Deletes an OAuth application.
   *
   * @example
   * await warmbly.oauth.applications.delete("wmcid_...");
   */
  async delete(id: string): Promise<void> {
    await this.http.delete<void>(`/oauth/applications/${encodeURIComponent(id)}`);
  }

  /**
   * Rotates the application's client secret, returning the new secret once.
   *
   * @example
   * const app = await warmbly.oauth.applications.rotateSecret("wmcid_...");
   * console.log(app.client_secret);
   */
  async rotateSecret(id: string): Promise<OAuthApplicationWithSecret> {
    return this.http.post<OAuthApplicationWithSecret>(
      `/oauth/applications/${encodeURIComponent(id)}/rotate-secret`,
    );
  }

  /**
   * Uploads an application logo (PNG or JPEG, up to 2 MB) and returns its public URL.
   *
   * It lives outside `/applications/:id` on purpose, so the registration UI can upload a
   * logo during the branding step before an app id exists. Pass the returned `logo_url`
   * in the subsequent {@link OAuthApplications.create} or {@link OAuthApplications.update}
   * payload.
   *
   * @example
   * const { logo_url } = await warmbly.oauthApplications.uploadLogo(file, "logo.png");
   * const app = await warmbly.oauthApplications.create({ name: "My App", logo_url });
   */
  async uploadLogo(file: Blob, filename?: string): Promise<{ logo_url: string }> {
    const form = new FormData();
    form.append("file", file, filename);
    return this.http.post<{ logo_url: string }>("/oauth/application-logo", { body: form });
  }

  /**
   * Uploads and sets an existing application's logo as `multipart/form-data` and returns
   * the updated application. PNG or JPEG, under 2 MB and at least 32 px on each side; the
   * server re-encodes it and removes the previous logo. Needs `API_KEYS`.
   *
   * @example
   * const app = await warmbly.oauthApplications.setLogo("app_1", file, { filename: "logo.png" });
   * console.log(app.logo_url);
   */
  async setLogo(
    id: string,
    file: Blob,
    params?: { filename?: string },
    opts?: RequestOptions,
  ): Promise<OAuthApplication> {
    const form = new FormData();
    // Name the part only when there is a name: a non-spec FormData would otherwise
    // stringify an explicit undefined into "undefined".
    if (params?.filename !== undefined) form.append("file", file, params.filename);
    else form.append("file", file);
    return this.http.post<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}/logo`, {
      ...opts,
      body: form,
    });
  }

  /**
   * Removes the application's logo and returns the updated application. Needs `API_KEYS`.
   *
   * @example
   * const app = await warmbly.oauthApplications.removeLogo("app_1");
   */
  async removeLogo(id: string, opts?: RequestOptions): Promise<OAuthApplication> {
    return this.http.delete<OAuthApplication>(
      `/oauth/applications/${encodeURIComponent(id)}/logo`,
      opts,
    );
  }

  /**
   * Returns the application's community directory listing, or `null` when it is not
   * published. Needs `API_KEYS`.
   *
   * @example
   * const listing = await warmbly.oauthApplications.getListing("app_1");
   */
  async getListing(id: string, opts?: RequestOptions): Promise<OAuthAppListing | null> {
    const payload = await this.http.get<{ listing: OAuthAppListing | null }>(
      `/oauth/applications/${encodeURIComponent(id)}/listing`,
      opts,
    );
    return payload?.listing ?? null;
  }

  /**
   * Publishes the application to the community directory, or edits its listing. Saving
   * the same listing again changes nothing, so retries are safe. A disabled, suspended or
   * dynamically registered app is a 400 with code `app_not_listable`. Needs `API_KEYS`.
   *
   * @example
   * const listing = await warmbly.oauthApplications.saveListing("app_1", {
   *   slug: "acme-sync",
   *   tagline: "Two-way sync with Acme",
   *   category: "crm",
   *   install_url: "https://acme.example.com/install",
   * });
   */
  async saveListing(
    id: string,
    body: OAuthAppListingWrite,
    opts?: RequestOptions,
  ): Promise<OAuthAppListing> {
    const payload = await this.http.put<{ listing: OAuthAppListing }>(
      `/oauth/applications/${encodeURIComponent(id)}/listing`,
      { ...opts, body },
    );
    return payload.listing;
  }

  /**
   * Unpublishes the application. A listing the operators hid cannot be removed (409, code
   * `listing_hidden`). Needs `API_KEYS`.
   *
   * @example
   * await warmbly.oauthApplications.deleteListing("app_1");
   */
  async deleteListing(id: string, opts?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `/oauth/applications/${encodeURIComponent(id)}/listing`,
      opts,
    );
  }

  /**
   * Returns the application's webhook signing secret.
   *
   * @example
   * const { webhook_secret } = await warmbly.oauth.applications.getWebhookSecret("wmcid_...");
   */
  async getWebhookSecret(id: string): Promise<{ webhook_secret: string }> {
    return this.http.get<{ webhook_secret: string }>(
      `/oauth/applications/${encodeURIComponent(id)}/webhook-secret`,
    );
  }

  /**
   * Rotates the application's webhook signing secret.
   *
   * @example
   * const { webhook_secret } = await warmbly.oauth.applications.rotateWebhookSecret("wmcid_...");
   */
  async rotateWebhookSecret(id: string): Promise<{ webhook_secret: string }> {
    return this.http.post<{ webhook_secret: string }>(
      `/oauth/applications/${encodeURIComponent(id)}/webhook-secret/rotate`,
    );
  }

  /**
   * Lists the health of the application's configured webhook endpoints.
   *
   * @example
   * const { endpoints } = await warmbly.oauth.applications.listWebhookEndpoints("wmcid_...");
   */
  async listWebhookEndpoints(id: string): Promise<{ endpoints: WebhookEndpointHealth[] }> {
    return this.http.get<{ endpoints: WebhookEndpointHealth[] }>(
      `/oauth/applications/${encodeURIComponent(id)}/webhook-endpoints`,
    );
  }

  /**
   * Lists the application's webhook deliveries as an auto-paginating page.
   *
   * @example
   * const page = await warmbly.oauth.applications.listWebhookDeliveries("wmcid_...", {
   *   status: "failed",
   * });
   * for await (const delivery of page) console.log(delivery.id);
   */
  async listWebhookDeliveries(
    id: string,
    params?: { status?: string; event_type?: string; limit?: number; cursor?: string },
  ): Promise<Page<WebhookDelivery>> {
    return this.http.getPage<WebhookDelivery>(
      `/oauth/applications/${encodeURIComponent(id)}/webhook-deliveries`,
      { query: { ...params } },
    );
  }

  /**
   * Lists the applications the current user has authorized.
   *
   * Note: this endpoint is dashboard-only. It requires a logged-in user session (JWT) and
   * cannot be called with an API key or an OAuth access token.
   *
   * @example
   * const apps = await warmbly.oauth.applications.listAuthorizedApps();
   */
  async listAuthorizedApps(): Promise<AuthorizedApp[]> {
    const payload = await this.http.get<
      AuthorizedApp[] | { data?: AuthorizedApp[]; authorized_apps?: AuthorizedApp[] }
    >("/oauth/authorized-apps");
    return unwrapList(payload);
  }

  /**
   * Revokes a previously authorized application by its authorization id.
   *
   * Note: this endpoint is dashboard-only. It requires a logged-in user session (JWT) and
   * cannot be called with an API key or an OAuth access token.
   *
   * @example
   * await warmbly.oauth.applications.revokeAuthorizedApp("auth_...");
   */
  async revokeAuthorizedApp(id: string): Promise<void> {
    await this.http.delete<void>(`/oauth/authorized-apps/${encodeURIComponent(id)}`);
  }
}
