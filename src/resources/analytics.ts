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

/** Analytics query params for endpoints where the platform requires an explicit window. */
export interface RangeAnalyticsParams {
  /** Inclusive start of the window (RFC 3339 or `YYYY-MM-DD`). Required. */
  from: string;
  /** Inclusive end of the window (RFC 3339 or `YYYY-MM-DD`). Required. */
  to: string;
  interval?: string;
  [key: string]: unknown;
}

/** Query params for {@link Analytics.compareCampaigns}; all three fields are required. */
export interface CompareCampaignsParams extends RangeAnalyticsParams {
  /** The campaign ids to compare (an array or a comma-separated string). */
  ids: string | string[];
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
   * Returns warmup analytics for an explicit date window. `from` and `to` are required.
   * @example
   * const report = await warmbly.analytics.warmup({ from: "2026-06-01", to: "2026-06-15" });
   */
  warmup(params: RangeAnalyticsParams): Promise<AnalyticsReport> {
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
   * Compares analytics across multiple campaigns. `ids`, `from`, and `to` are required.
   * An array of ids is sent as a single comma-separated `ids` query parameter.
   * @example
   * const report = await warmbly.analytics.compareCampaigns({
   *   ids: ["c_1", "c_2"],
   *   from: "2026-06-01",
   *   to: "2026-06-15",
   * });
   */
  compareCampaigns(params: CompareCampaignsParams): Promise<AnalyticsReport> {
    const { ids, ...rest } = params;
    const query = { ...rest, ids: Array.isArray(ids) ? ids.join(",") : ids };
    return this.http.get<AnalyticsReport>("analytics/campaigns/compare", { query });
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
   * Returns daily-bucketed analytics for a campaign. `from` and `to` are required.
   * @example
   * const report = await warmbly.analytics.campaignDaily("c_1", {
   *   from: "2026-06-01",
   *   to: "2026-06-15",
   * });
   */
  campaignDaily(id: string, params: RangeAnalyticsParams): Promise<AnalyticsReport> {
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
