import { resolveClientOptions } from "./core/config";
import { GatewayError } from "./core/errors";
import { HttpClient } from "./core/http";
import type {
  ClientOptions,
  HttpMethod,
  RequestOptions,
  ResolvedClientOptions,
} from "./core/types";
import { Gateway } from "./gateway/gateway";
import type { GatewayOptions, GatewayTokenProvider } from "./gateway/types";
import { OAuthApplications } from "./oauth/applications";
import { OAuthClient } from "./oauth/oauth";
import {
  Analytics,
  ApiKeys,
  Campaigns,
  Contacts,
  Crm,
  Emails,
  Integrations,
  Misc,
  Templates,
  Unibox,
  Webhooks,
} from "./resources";

/**
 * The top-level Warmbly client. Construct it with an API key (or OAuth access token), then
 * reach every REST resource through a typed namespace, open a realtime gateway connection, or
 * manage OAuth applications. The same instance works on Node, Bun, Deno, browsers, and the edge.
 *
 * @example
 * import { Warmbly } from "warmbly";
 *
 * const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });
 *
 * // REST with auto-pagination
 * for await (const contact of await warmbly.contacts.list()) {
 *   console.log(contact.email);
 * }
 *
 * // Realtime
 * const gw = warmbly.gateway({ orgId: "org_123", intents: ["EMAIL", "CAMPAIGN"] });
 * gw.on("EMAIL_OPENED", (e) => console.log(e.campaign_id));
 * await gw.connect();
 *
 * @example
 * // OAuth2 authorization-code flow (no token needed to build URLs or exchange codes)
 * const oauth = new Warmbly.OAuth({ clientId, clientSecret, redirectUri });
 * const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
 *   scopes: ["read_campaigns", "read_contacts"],
 *   pkce: true,
 * });
 */
export class Warmbly {
  /** The OAuth2 flow helper class. Use it standalone: `new Warmbly.OAuth({ clientId, ... })`. */
  static readonly OAuth = OAuthClient;

  /** Fully resolved options with defaults applied. */
  readonly options: ResolvedClientOptions;
  /** The underlying HTTP client. Use {@link Warmbly.request} for unmodeled endpoints. */
  readonly http: HttpClient;

  /** API key management, usage analytics, and the permission catalog. */
  readonly apiKeys: ApiKeys;
  /** Campaigns, sequences, steps, A/B variants, attachments, and lifecycle. */
  readonly campaigns: Campaigns;
  /** Contacts, notes, timelines, activities, import/export, and search. */
  readonly contacts: Contacts;
  /** Email accounts (mailboxes), warmup controls, and sending. */
  readonly emails: Emails;
  /** The unified inbox: threads, replies, labels, snoozes, and scheduled sends. */
  readonly unibox: Unibox;
  /** Dashboard, deliverability, warmup, and per-campaign analytics. */
  readonly analytics: Analytics;
  /** Reply templates: render, score, duplicate, and reorder. */
  readonly templates: Templates;
  /** CRM pipelines, deals, task types, and tasks. */
  readonly crm: Crm;
  /** Third-party integrations: connections, events, field mappings, and bookings. */
  readonly integrations: Integrations;
  /** Outbound webhook endpoints, deliveries, and event types. */
  readonly webhooks: Webhooks;
  /** Folders, tags, categories, teams, audit logs, outreach, warmup routing, plans, and timezones. */
  readonly misc: Misc;
  /** Manage your own OAuth applications (requires the `API_KEYS` scope). */
  readonly oauthApplications: OAuthApplications;

  constructor(options: ClientOptions = {}) {
    this.options = resolveClientOptions(options);
    this.http = new HttpClient(this.options);

    this.apiKeys = new ApiKeys(this.http);
    this.campaigns = new Campaigns(this.http);
    this.contacts = new Contacts(this.http);
    this.emails = new Emails(this.http);
    this.unibox = new Unibox(this.http);
    this.analytics = new Analytics(this.http);
    this.templates = new Templates(this.http);
    this.crm = new Crm(this.http);
    this.integrations = new Integrations(this.http);
    this.webhooks = new Webhooks(this.http);
    this.misc = new Misc(this.http);
    this.oauthApplications = new OAuthApplications(this.http);
  }

  /**
   * Opens a realtime gateway client bound to this client's gateway URL and credentials.
   * The client's token is injected automatically; pass `orgId` (or set `organizationId` on
   * the client) and optional `intents`. Any field here overrides the inherited defaults.
   *
   * @example
   * const gw = warmbly.gateway({ orgId: "org_123", intents: ["EMAIL", "CUSTOM"] });
   * gw.on("CUSTOM_EVENT", (e) => console.log(e.name, e.payload));
   * await gw.connect();
   */
  gateway(options: GatewayOptions = {}): Gateway {
    const inheritedToken: GatewayTokenProvider = async () => {
      const token = await this.options.getToken();
      if (!token) {
        throw new GatewayError(
          "No token available for the realtime gateway. Set apiKey, accessToken, or getToken on the client, or pass token/getToken to gateway().",
        );
      }
      return token;
    };
    // Spread the caller's options first, then apply inherited defaults with `??` so an
    // explicitly-undefined token/getToken/url/orgId never clobbers the client's values.
    const merged: GatewayOptions = { ...options };
    merged.url = options.url ?? this.options.gatewayUrl;
    const orgId = options.orgId ?? this.options.organizationId;
    if (orgId !== undefined) merged.orgId = orgId;
    if (options.token === undefined && options.getToken === undefined) {
      merged.getToken = inheritedToken;
    }
    return new Gateway(merged);
  }

  /**
   * Low-level escape hatch for any endpoint not yet modeled as a typed method. Returns the
   * decoded body, response, and request id.
   *
   * @example
   * const { data } = await warmbly.request("GET", "/timezones");
   */
  request<T>(method: HttpMethod, path: string, options?: RequestOptions) {
    return this.http.request<T>(method, path, options);
  }
}

export default Warmbly;
