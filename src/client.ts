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
  Advisor,
  Agency,
  AgentTools,
  AISkills,
  Analytics,
  ApiKeys,
  Automations,
  Campaigns,
  Contacts,
  Crm,
  EmailImages,
  Emails,
  Forms,
  Generation,
  Integrations,
  LeadSync,
  Leads,
  Meetings,
  Migrations,
  Misc,
  Placement,
  Reports,
  Segments,
  Suppressions,
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
  /** The options this client was constructed with, kept for {@link Warmbly.withOrganization}. */
  readonly #clientOptions: ClientOptions;
  /** The underlying HTTP client. Use {@link Warmbly.request} for unmodeled endpoints. */
  readonly http: HttpClient;

  /** API key management, usage analytics, and the permission catalog. */
  readonly apiKeys: ApiKeys;
  /** Campaigns, sequences, steps, A/B variants, attachments, and lifecycle. */
  readonly campaigns: Campaigns;
  /** Contacts, notes, timelines, activities, import/export, verification, and search. */
  readonly contacts: Contacts;
  /** Saved contact audiences: conditions plus manual overrides, evaluated live. */
  readonly segments: Segments;
  /** Hosted lead-capture forms, their submissions, statistics, and custom domain. */
  readonly forms: Forms;
  /** The workspace suppression list: addresses and domains no campaign will email. */
  readonly suppressions: Suppressions;
  /** Email accounts (mailboxes), warmup controls, sending behaviour, and sending. */
  readonly emails: Emails;
  /** The unified inbox: threads, replies, labels, snoozes, and scheduled sends. */
  readonly unibox: Unibox;
  /** Dashboard, deliverability, warmup, and per-campaign analytics. */
  readonly analytics: Analytics;
  /** Continuous recommendations about the workspace's sending posture. */
  readonly advisor: Advisor;
  /** AI writing: compose, rewrite a selection, and preview AI variables. */
  readonly generation: Generation;
  /** Organization playbooks every AI surface follows. */
  readonly aiSkills: AISkills;
  /** The AI tool registry over plain HTTP, for function-calling agents without MCP. */
  readonly agentTools: AgentTools;
  /** Reply templates: render, score, duplicate, and reorder. */
  readonly templates: Templates;
  /** CRM pipelines, deals, task types, and tasks. */
  readonly crm: Crm;
  /** Booked calls from Calendly and Cal.com, plus meetings you log by hand. */
  readonly meetings: Meetings;
  /** Third-party integrations: connections, events, field mappings, and bookings. */
  readonly integrations: Integrations;
  /** The visual flow builder: trigger events plus action steps across integrations. */
  readonly automations: Automations;
  /** On-demand Google Sheets to contacts sync. */
  readonly leadSync: LeadSync;
  /** Outbound webhook endpoints, deliveries, and event types. */
  readonly webhooks: Webhooks;
  /** Caller identity, deployment config, folders, tags, categories, teams, audit logs, outreach, deliverability ingestion, the task DLQ, warmup routing, plans, and timezones. */
  readonly misc: Misc;
  /** Manage your own OAuth applications (requires the `API_KEYS` scope). */
  readonly oauthApplications: OAuthApplications;
  /** Lead finder: search, enrich, and import leads. */
  readonly leads: Leads;
  /** Inbox placement tests and batches. */
  readonly placement: Placement;
  /** Uploaded images for email templates. */
  readonly emailImages: EmailImages;
  /** Bring mailboxes, contacts and campaigns over from another outreach tool. */
  readonly migrations: Migrations;
  /**
   * The agency endpoints under `/agency`: clients, usage, AI balance, overview, inbox and
   * migrations. Takes an agency API key (`wmagency_...`) or a session.
   */
  readonly agency: Agency;
  /** Client reports: build, share by public link and email on a schedule. */
  readonly reports: Reports;

  constructor(options: ClientOptions = {}) {
    this.#clientOptions = { ...options };
    this.options = resolveClientOptions(options);
    this.http = new HttpClient(this.options);

    this.apiKeys = new ApiKeys(this.http);
    this.campaigns = new Campaigns(this.http);
    this.contacts = new Contacts(this.http);
    this.segments = new Segments(this.http);
    this.forms = new Forms(this.http);
    this.suppressions = new Suppressions(this.http);
    this.emails = new Emails(this.http);
    this.unibox = new Unibox(this.http);
    this.analytics = new Analytics(this.http);
    this.advisor = new Advisor(this.http);
    this.generation = new Generation(this.http);
    this.aiSkills = new AISkills(this.http);
    this.agentTools = new AgentTools(this.http);
    this.templates = new Templates(this.http);
    this.crm = new Crm(this.http);
    this.meetings = new Meetings(this.http);
    this.integrations = new Integrations(this.http);
    this.automations = new Automations(this.http);
    this.leadSync = new LeadSync(this.http);
    this.webhooks = new Webhooks(this.http);
    this.misc = new Misc(this.http);
    this.oauthApplications = new OAuthApplications(this.http);
    this.leads = new Leads(this.http);
    this.placement = new Placement(this.http);
    this.emailImages = new EmailImages(this.http);
    this.migrations = new Migrations(this.http);
    this.agency = new Agency(this.http);
    this.reports = new Reports(this.http);
  }

  /**
   * Returns a new client with the same credentials and settings that acts on another
   * workspace. With an agency API key this is how you switch between client workspaces: each
   * request carries the id in the `Warmbly-Organization` header. The original client is left
   * unchanged.
   *
   * @example
   * const agency = new Warmbly({ apiKey: process.env.WARMBLY_AGENCY_KEY });
   * for (const client of await agency.agency.clients.list(agencyId)) {
   *   const acme = agency.withOrganization(client.organization_id);
   *   for await (const c of await acme.campaigns.list()) console.log(client.name, c.name);
   * }
   */
  withOrganization(organizationId: string): Warmbly {
    return new Warmbly({ ...this.#clientOptions, organizationId });
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
