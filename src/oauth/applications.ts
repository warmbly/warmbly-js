import type { HttpClient } from "../core/http";
import type { Page } from "../core/pagination";
import type {
  AppListing,
  AppListingWrite,
  AuthorizedApp,
  OAuthApplication,
  OAuthApplicationWithSecret,
  OAuthApplicationWrite,
  WebhookDelivery,
  WebhookEndpointHealth,
  WorkspaceAuthorization,
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
 * Manages OAuth applications and their webhook configuration. Uses the bearer-authenticated
 * {@link HttpClient}, so the underlying credential needs the `API_KEYS` (manage api keys) scope.
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
   * const apps = await warmbly.oauthApplications.list();
   */
  async list(): Promise<OAuthApplication[]> {
    const payload = await this.http.get<
      OAuthApplication[] | { data?: OAuthApplication[]; applications?: OAuthApplication[] }
    >("/oauth/applications");
    return unwrapList(payload);
  }

  /**
   * Creates an OAuth application. The response includes the `client_secret` exactly once.
   *
   * @example
   * const app = await warmbly.oauthApplications.create({
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
   * const app = await warmbly.oauthApplications.get("wmcid_...");
   */
  async get(id: string): Promise<OAuthApplication> {
    return this.http.get<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}`);
  }

  /**
   * Updates an OAuth application.
   *
   * @example
   * const app = await warmbly.oauthApplications.update("wmcid_...", { name: "Renamed" });
   */
  async update(id: string, body: Partial<OAuthApplicationWrite>): Promise<OAuthApplication> {
    return this.http.patch<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}`, {
      body,
    });
  }

  /**
   * Deletes an OAuth application. The server answers `{ deleted: true }`.
   *
   * @example
   * await warmbly.oauthApplications.delete("wmcid_...");
   */
  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/oauth/applications/${encodeURIComponent(id)}`);
  }

  /**
   * Rotates the application's client secret, returning the new secret once. The server
   * answers `{ client_secret }` only, not the application.
   *
   * @example
   * const { client_secret } = await warmbly.oauthApplications.rotateSecret("wmcid_...");
   */
  async rotateSecret(id: string): Promise<{ client_secret: string }> {
    return this.http.post<{ client_secret: string }>(
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
   * Uploads the application's logo (PNG or JPEG, at most 2 MB, 32 to 1,024 pixels per
   * side). Warmbly re-encodes and stores it, sets it on the app, and deletes the previous
   * one. Resolves to the updated application. Needs `API_KEYS`; refused for OAuth tokens
   * and for suspended apps.
   *
   * @example
   * const app = await warmbly.oauthApplications.setLogo("app_1", file, "logo.png");
   * console.log(app.logo_url);
   */
  async setLogo(id: string, file: Blob, filename?: string): Promise<OAuthApplication> {
    const form = new FormData();
    // Append the filename only when there is one: a non-spec FormData would stringify
    // an explicit undefined into a file named "undefined".
    if (filename !== undefined) form.append("file", file, filename);
    else form.append("file", file);
    return this.http.post<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}/logo`, {
      body: form,
    });
  }

  /**
   * Removes the application's logo and deletes the stored image. Resolves to the updated
   * application. Needs `API_KEYS`; refused for OAuth tokens and for suspended apps.
   *
   * @example
   * const app = await warmbly.oauthApplications.deleteLogo("app_1");
   */
  async deleteLogo(id: string): Promise<OAuthApplication> {
    return this.http.delete<OAuthApplication>(`/oauth/applications/${encodeURIComponent(id)}/logo`);
  }

  /**
   * Reads the application's community-directory listing. `listing` is `null` when the app
   * is not published. Needs `API_KEYS`; refused for OAuth tokens.
   *
   * @example
   * const { listing } = await warmbly.oauthApplications.getListing("app_1");
   */
  async getListing(id: string): Promise<{ listing: AppListing | null }> {
    return this.http.get<{ listing: AppListing | null }>(
      `/oauth/applications/${encodeURIComponent(id)}/listing`,
    );
  }

  /**
   * Publishes the app to the community directory, or replaces its listing (the whole
   * listing is replaced, so repeating the request is safe). Refusals: 400
   * `invalid_listing`, 400 `app_not_listable`, 409 `listing_slug_taken`. Needs `API_KEYS`.
   *
   * @example
   * const { listing } = await warmbly.oauthApplications.putListing("app_1", {
   *   slug: "acme-sync",
   *   tagline: "Push positive replies into Acme as deals",
   *   category: "crm",
   *   install_url: "https://acme.com/warmbly/install",
   * });
   */
  async putListing(id: string, body: AppListingWrite): Promise<{ listing: AppListing }> {
    return this.http.put<{ listing: AppListing }>(
      `/oauth/applications/${encodeURIComponent(id)}/listing`,
      { body },
    );
  }

  /**
   * Unpublishes the app: removes the listing and its link. Succeeds when there is no
   * listing, so it is safe to retry. Needs `API_KEYS`; refused for OAuth tokens.
   *
   * @example
   * await warmbly.oauthApplications.deleteListing("app_1");
   */
  async deleteListing(id: string): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `/oauth/applications/${encodeURIComponent(id)}/listing`,
    );
  }

  /**
   * Returns the application's webhook signing secret.
   *
   * @example
   * const { webhook_secret } = await warmbly.oauthApplications.getWebhookSecret("wmcid_...");
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
   * const { webhook_secret } = await warmbly.oauthApplications.rotateWebhookSecret("wmcid_...");
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
   * const { endpoints } = await warmbly.oauthApplications.listWebhookEndpoints("wmcid_...");
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
   * const page = await warmbly.oauthApplications.listWebhookDeliveries("wmcid_...", {
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
   * const apps = await warmbly.oauthApplications.listAuthorizedApps();
   */
  async listAuthorizedApps(): Promise<AuthorizedApp[]> {
    const payload = await this.http.get<
      AuthorizedApp[] | { data?: AuthorizedApp[]; authorized_apps?: AuthorizedApp[] }
    >("/oauth/authorized-apps");
    return unwrapList(payload);
  }

  /**
   * Revokes the current user's authorization of an application, by the application id
   * (the `application_id` of an {@link AuthorizedApp}). Answers `{ revoked: true }`.
   *
   * Note: this endpoint is dashboard-only. It requires a logged-in user session (JWT) and
   * cannot be called with an API key or an OAuth access token.
   *
   * @example
   * await warmbly.oauthApplications.revokeAuthorizedApp("app_1");
   */
  async revokeAuthorizedApp(applicationId: string): Promise<{ revoked: boolean }> {
    return this.http.delete<{ revoked: boolean }>(
      `/oauth/authorized-apps/${encodeURIComponent(applicationId)}`,
    );
  }

  /**
   * Lists every member's live app authorizations in the workspace. Needs the
   * `manage_api_keys` or `manage_settings` org permission.
   *
   * Note: this endpoint is dashboard-only (JWT session).
   *
   * @example
   * const auths = await warmbly.oauthApplications.listWorkspaceAuthorizations();
   */
  async listWorkspaceAuthorizations(): Promise<WorkspaceAuthorization[]> {
    const payload = await this.http.get<{ authorizations?: WorkspaceAuthorization[] }>(
      "/oauth/workspace-authorizations",
    );
    return payload?.authorizations ?? [];
  }

  /**
   * Revokes one member's authorization of an app in the workspace. Succeeds when there is
   * nothing to revoke. Needs the `manage_api_keys` or `manage_settings` org permission.
   *
   * Note: this endpoint is dashboard-only (JWT session).
   *
   * @example
   * await warmbly.oauthApplications.revokeWorkspaceAuthorization("app_1", "user_1");
   */
  async revokeWorkspaceAuthorization(
    applicationId: string,
    userId: string,
  ): Promise<{ revoked: boolean }> {
    return this.http.delete<{ revoked: boolean }>(
      `/oauth/workspace-authorizations/${encodeURIComponent(applicationId)}/members/${encodeURIComponent(userId)}`,
    );
  }
}
