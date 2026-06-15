import type { HttpClient } from "../core/http";
import type { Page } from "../core/pagination";
import type {
  AuthorizedApp,
  OAuthApplication,
  OAuthApplicationWithSecret,
  OAuthApplicationWrite,
  WebhookDelivery,
  WebhookEndpointHealth,
} from "./types";

/** Unwraps a list payload that may be either a bare array or a `{ data: [...] }` envelope. */
function unwrapList<T>(payload: T[] | { data?: T[] } | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
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
   * const apps = await warmbly.oauth.applications.list();
   */
  async list(): Promise<OAuthApplication[]> {
    const payload = await this.http.get<OAuthApplication[] | { data?: OAuthApplication[] }>(
      "/oauth/applications",
    );
    return unwrapList(payload);
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
   * @example
   * const apps = await warmbly.oauth.applications.listAuthorizedApps();
   */
  async listAuthorizedApps(): Promise<AuthorizedApp[]> {
    const payload = await this.http.get<AuthorizedApp[] | { data?: AuthorizedApp[] }>(
      "/oauth/authorized-apps",
    );
    return unwrapList(payload);
  }

  /**
   * Revokes a previously authorized application by its authorization id.
   *
   * @example
   * await warmbly.oauth.applications.revokeAuthorizedApp("auth_...");
   */
  async revokeAuthorizedApp(id: string): Promise<void> {
    await this.http.delete<void>(`/oauth/authorized-apps/${encodeURIComponent(id)}`);
  }
}
