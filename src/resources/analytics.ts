import { APIResource } from "./base";

/** A generic analytics report payload. Shape varies by endpoint. */
export interface AnalyticsReport {
  [key: string]: unknown;
}

/** Common analytics query params (time window, granularity, filters). */
export interface AnalyticsParams {
  from?: string;
  to?: string;
  interval?: string;
  [key: string]: unknown;
}

/**
 * Read-only analytics: dashboards, deliverability, warmup, usage, per-account, and
 * per-campaign reports. Reachable as `warmbly.analytics`.
 *
 * @example
 * const dash = await warmbly.analytics.dashboard({ from: "2026-06-01" });
 */
export class Analytics extends APIResource {
  /**
   * Returns the top-level analytics dashboard.
   * @example
   * const dash = await warmbly.analytics.dashboard();
   */
  dashboard(params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/dashboard", { query: params });
  }

  /**
   * Returns deliverability analytics.
   * @example
   * const report = await warmbly.analytics.deliverability();
   */
  deliverability(params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/deliverability", { query: params });
  }

  /**
   * Returns warmup analytics.
   * @example
   * const report = await warmbly.analytics.warmup();
   */
  warmup(params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/warmup", { query: params });
  }

  /**
   * Returns usage analytics.
   * @example
   * const report = await warmbly.analytics.usage();
   */
  usage(params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/usage", { query: params });
  }

  /**
   * Returns per-account analytics across all accounts.
   * @example
   * const report = await warmbly.analytics.accounts();
   */
  accounts(params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/accounts", { query: params });
  }

  /**
   * Returns analytics for a single account.
   * @example
   * const report = await warmbly.analytics.account("acc_1");
   */
  account(id: string, params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>(this.path("analytics", "accounts", id), {
      query: params,
    });
  }

  /**
   * Compares analytics across multiple campaigns (via query, e.g. `ids`).
   * @example
   * const report = await warmbly.analytics.compareCampaigns({ ids: ["c_1", "c_2"] });
   */
  compareCampaigns(params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/campaigns/compare", { query: params });
  }

  /**
   * Returns analytics for a single campaign.
   * @example
   * const report = await warmbly.analytics.campaign("c_1");
   */
  campaign(id: string, params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>(this.path("analytics", "campaigns", id), {
      query: params,
    });
  }

  /**
   * Returns daily-bucketed analytics for a campaign.
   * @example
   * const report = await warmbly.analytics.campaignDaily("c_1");
   */
  campaignDaily(id: string, params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>(this.path("analytics", "campaigns", id, "daily"), {
      query: params,
    });
  }

  /**
   * Returns hourly-bucketed analytics for a campaign.
   * @example
   * const report = await warmbly.analytics.campaignHourly("c_1");
   */
  campaignHourly(id: string, params?: AnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>(this.path("analytics", "campaigns", id, "hourly"), {
      query: params,
    });
  }
}
