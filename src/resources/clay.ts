import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Where rows a Clay table sends land. */
export interface ClayInboundDefaults {
  /** Enrol every row into this campaign. A row may name its own. */
  campaign_id?: string;
  /** Tag ids (up to 50). */
  category_ids: string[];
  /** Segment ids rows are pinned into (up to 20). */
  segment_ids: string[];
  /** What happens when a row's address already exists: `skip` or `update`. */
  dedup: "skip" | "update" | (string & {});
  /** Whether new contacts start subscribed. */
  subscribed: boolean;
  [key: string]: unknown;
}

/** The default Clay table Warmbly sends events to. The URL and token are never returned, only whether they are set. */
export interface ClayOutbound {
  webhook_url_set: boolean;
  /** The host of the saved table webhook URL. */
  webhook_host?: string;
  auth_token_set: boolean;
  /** Warmbly events sent to the table. */
  events: string[];
  [key: string]: unknown;
}

/** What the inbound URL has received. */
export interface ClayStats {
  received: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  last_received_at?: string;
  last_error?: string;
  [key: string]: unknown;
}

/** Everything the Clay page edits and shows. */
export interface ClaySettings {
  connection_id: string;
  label: string;
  status: string;
  health: string;
  /** Whether the inbound URL exists. Rotate it to reveal a new one. */
  inbound_url_minted: boolean;
  defaults: ClayInboundDefaults;
  outbound: ClayOutbound;
  stats: ClayStats;
  /** The Warmbly events a table can be sent. */
  available_events: string[];
  [key: string]: unknown;
}

/**
 * Body for {@link Clay.updateSettings}. Each field you pass replaces its value; one you
 * omit is left alone. An empty `webhook_url` or `auth_token` clears it.
 */
export interface UpdateClaySettingsParams {
  defaults?: ClayInboundDefaults;
  /** The webhook URL of a Clay table's webhook source. The host must contain `clay`. */
  webhook_url?: string;
  /** Up to 512 characters. */
  auth_token?: string;
  /** Needs a saved `webhook_url` first (a 400 `clay_webhook_missing` otherwise). */
  events?: string[];
  [key: string]: unknown;
}

/**
 * Clay: send rows from a Clay table into Warmbly, and send Warmbly events to a table.
 * `connectionId` is the id of a Clay connection. Reachable as `warmbly.integrations.clay`.
 *
 * Both methods need `INTEGRATIONS`. The inbound URL itself is minted with
 * `warmbly.integrations.rotateInboundUrl(connectionId)`.
 *
 * @example
 * const settings = await warmbly.integrations.clay.settings("conn_1");
 * await warmbly.integrations.clay.updateSettings("conn_1", {
 *   webhook_url: "https://api.clay.com/v3/sources/webhook/abc",
 *   events: ["campaign.reply_received"],
 * });
 */
export class Clay extends APIResource {
  /**
   * Reads everything the Clay page shows.
   * Needs `INTEGRATIONS`.
   * @example
   * const { defaults, outbound, stats } = await warmbly.integrations.clay.settings("conn_1");
   */
  settings(connectionId: string, opts?: RequestOptions): Promise<ClaySettings> {
    return this.http.get<ClaySettings>(this.path("integrations", "clay", connectionId), opts);
  }

  /**
   * Saves the inbound defaults, the outbound table, and the events sent to it, then
   * returns the refreshed settings. Every field replaces its value, so a retry converges.
   * Needs `INTEGRATIONS`.
   * @example
   * await warmbly.integrations.clay.updateSettings("conn_1", {
   *   defaults: { campaign_id: "camp_1", category_ids: [], segment_ids: [], dedup: "update", subscribed: true },
   * });
   */
  updateSettings(
    connectionId: string,
    params: UpdateClaySettingsParams,
    opts?: RequestOptions,
  ): Promise<ClaySettings> {
    return this.http.patch<ClaySettings>(this.path("integrations", "clay", connectionId), {
      ...opts,
      body: params,
    });
  }
}
