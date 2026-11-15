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
  /** Inclusive start of the window as a whole day, `YYYY-MM-DD`. Required. */
  from: string;
  /** Inclusive end of the window as a whole day, `YYYY-MM-DD`. Required. */
  to: string;
  interval?: string;
  [key: string]: unknown;
}

/** Query params for {@link Analytics.compareCampaigns}; all three fields are required. */
export interface CompareCampaignsParams extends RangeAnalyticsParams {
  /** The campaign ids to compare (an array or a comma-separated string). */
  ids: string | string[];
}

/** A trailing window for the dashboard and direct-mail overviews. Anything else falls back to `7d`. */
export type AnalyticsPeriod = "7d" | "30d" | "90d";

/** Query params for {@link Analytics.dashboard}. */
export interface DashboardAnalyticsParams {
  /** Trailing window; default `7d`. */
  period?: AnalyticsPeriod;
  /** Scope to these campaigns (at most 100; an array, or a comma-separated string). */
  campaign_ids?: string | string[];
  /** Scope to these folders (at most 100); a folder stands in for its campaigns. */
  folder_ids?: string | string[];
  [key: string]: unknown;
}

/** Query params for {@link Analytics.usage}. */
export interface UsageAnalyticsParams {
  /** `day` (default), `week` or `month`. */
  period?: "day" | "week" | "month";
  [key: string]: unknown;
}

/** Query params for {@link Analytics.accounts}. The listing is cursor-paginated. */
export interface AccountStatusesParams {
  /** Scope the page to these mailbox ids (an array, or comma-separated). */
  email_ids?: string | string[];
  /** Page size, 1 up to the server maximum. */
  limit?: number;
  /** The `pagination.next_cursor` of the previous page. */
  cursor?: string;
  [key: string]: unknown;
}

/** Query params for {@link Analytics.campaign}: an optional whole-day window, both or neither. */
export interface CampaignAnalyticsParams {
  /** `YYYY-MM-DD`. */
  from?: string;
  /** `YYYY-MM-DD`. */
  to?: string;
  [key: string]: unknown;
}

/** Query params for {@link Analytics.campaignHourly}. */
export interface CampaignHourlyParams {
  /** `YYYY-MM-DD`; defaults to today. */
  date?: string;
  [key: string]: unknown;
}

/** Query params for {@link Analytics.direct}. */
export interface DirectMailAnalyticsParams {
  period?: AnalyticsPeriod;
  [key: string]: unknown;
}

/** Volume and replies from the synced mailbox for hand-written mail. */
export interface DirectMailVolume {
  sent: number;
  received: number;
  /** Outbound threads whose first message was ours. */
  threads_started: number;
  /** Those that got an inbound message back. */
  replied: number;
  reply_rate: number;
  /** Delivery failures that came back; excluded from `replied`. */
  bounced: number;
  /** Minutes the contact took to answer, across answered threads. Zero when none were. */
  median_reply_minutes: number;
  [key: string]: unknown;
}

/** The opt-in tracking half of the direct-mail overview. `tracked_sent` is the denominator of both rates. */
export interface DirectMailTracking {
  mailboxes_opted_in: number;
  mailboxes_total: number;
  tracked_sent: number;
  opened: number;
  /** Automated fetches (prefetch, security gateways), kept apart from human opens. */
  machine_opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  [key: string]: unknown;
}

/** The result of {@link Analytics.direct}. */
export interface DirectMailAnalytics {
  period: AnalyticsPeriod | (string & {});
  volume: DirectMailVolume;
  tracking: DirectMailTracking;
  daily_trend: Array<{ date: string; sent: number; received: number; [key: string]: unknown }>;
  mailboxes: Array<{
    email_account_id: string;
    email: string;
    track_direct_mail: boolean;
    sent: number;
    received: number;
    [key: string]: unknown;
  }>;
  /** Correspondents ranked by how much was sent to them. */
  top_contacts: Array<{
    email: string;
    sent: number;
    received: number;
    last_at: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** Query params for {@link Analytics.inboxTagging}. Offset-paginated by an opaque cursor. */
export interface InboxTaggingParams {
  /** 1..200, default 50. */
  limit?: number;
  cursor?: string;
  /** Only verdicts a person should look at. Default false. */
  needs_review?: boolean;
  [key: string]: unknown;
}

/** One automatic-tagging verdict for a message. */
export interface InboxTagVerdict {
  id: string;
  message_id: string;
  thread_id: string;
  kind: string;
  kind_confidence: number;
  kind_source: string;
  /** The reply intent, e.g. `interested`. Open: the label set grows. */
  intent: string;
  intent_confidence: number;
  relevance: number;
  priority: string;
  needs_review: boolean;
  review_reason: string;
  labels: string[];
  /** The model's answers to the workspace's tagging questions. */
  answers: Record<string, unknown>;
  model: string;
  input_tokens: number;
  /** What the workspace's switches let this verdict do. */
  actions: string[];
  /** Out-of-office return date (`YYYY-MM-DD`) the model was asked to confirm, else `null`. */
  return_date: string | null;
  created_at: string;
  [key: string]: unknown;
}

/** The result of {@link Analytics.inboxTagging}. Not the standard list envelope: it carries a summary. */
export interface InboxTaggingReview {
  /** Whether automatic tagging is on for this instance, so an empty list can be explained. */
  enabled: boolean;
  data: InboxTagVerdict[];
  /** Verdicts matching the filter, across all pages. */
  total: number;
  summary: {
    total: number;
    needs_review: number;
    from_offline: number;
    acted: number;
    [key: string]: unknown;
  };
  pagination: { next_cursor: string | null; has_more: boolean };
  [key: string]: unknown;
}

/** Query params for {@link Analytics.warmupPlacement}. */
export interface WarmupPlacementParams {
  /** Scope to one mailbox of the workspace. Omit for the whole workspace. */
  email_id?: string;
  /** `YYYY-MM-DD`. Defaults to 29 days before `to`. */
  from?: string;
  /** `YYYY-MM-DD`. Defaults to today (UTC). At most a bounded number of days apart. */
  to?: string;
  [key: string]: unknown;
}

/** Warmup landing counters, shared by the summary, each day, provider and mailbox. */
export interface WarmupPlacementCounts {
  /** Warmup mail sent. */
  sent: number;
  /** What recipients verifiably received: inbox + tabs + spam. */
  delivered: number;
  inbox: number;
  tabs: number;
  spam: number;
  unknown: number;
  archived: number;
  custom: number;
  instrumented_receipts: number;
  observed_receipts: number;
  legacy_uninstrumented_receipts: number;
  rescue_requested: number;
  /** Spam placements the recipient was told to move back to the inbox. */
  rescued: number;
  rescue_confirmed: number;
  rescue_missing: number;
  rescue_failed: number;
  rescue_unreported: number;
  /** Sent long enough ago that no recipient has reported it. */
  unconfirmed: number;
  /** `null` until there are deliveries. */
  inbox_rate: number | null;
  spam_rate: number | null;
  non_spam_metric: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** The rolling inbox rate over a trailing window. */
export interface WarmupPlacementRate {
  window_days: number;
  min_sample: number;
  scope: string;
  delivered: number;
  inbox: number;
  tabs: number;
  spam: number;
  /** `null` until `delivered` reaches `min_sample`. */
  inbox_rate: number | null;
  /** `good`, `fair`, `poor`, `collecting` or `none`. */
  band: "good" | "fair" | "poor" | "collecting" | "none" | (string & {});
  metric: Record<string, unknown> | null;
  other_delivered: number;
  other_inbox_rate: number | null;
  [key: string]: unknown;
}

/** One recipient provider group (`google`, `microsoft`, `yahoo`, `other`) in a placement report. */
export interface WarmupPlacementProvider extends WarmupPlacementCounts {
  group: "google" | "microsoft" | "yahoo" | "other" | (string & {});
  hosts: Array<WarmupPlacementCounts & { host: string }>;
}

/** The result of {@link Analytics.warmupPlacement}. */
export interface WarmupPlacementReport {
  /** Present for a single-mailbox report. */
  email_account_id?: string;
  date_range: { from: string; to: string };
  summary: WarmupPlacementCounts;
  rate: WarmupPlacementRate;
  daily: Array<
    WarmupPlacementCounts & {
      /** `YYYY-MM-DD`. */
      date: string;
      rolling_inbox_rate: number | null;
      groups: Array<WarmupPlacementCounts & { group: string }>;
    }
  >;
  providers: WarmupPlacementProvider[];
  /** The workspace report only, worst rate first. */
  mailboxes?: Array<
    WarmupPlacementCounts & {
      email_account_id: string;
      email: string;
      rate: WarmupPlacementRate;
      /** Follows the report's days; `null` on a day with no deliveries. */
      daily_inbox_rate: Array<number | null>;
    }
  >;
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
   * Returns the top-level analytics dashboard for a trailing `period` (`7d`, `30d`,
   * `90d`), optionally scoped to campaigns or folders. Needs `READ_ANALYTICS`.
   * @example
   * const dash = await warmbly.analytics.dashboard({ period: "30d" });
   */
  dashboard(params?: DashboardAnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/dashboard", { query: params });
  }

  /**
   * Returns deliverability analytics. `from` and `to` are RFC 3339 timestamps (default:
   * the last 7 days); a value that does not parse is ignored. Needs `READ_ANALYTICS`.
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
   * Returns the usage overview for a `period` of `day`, `week` or `month`. Needs
   * `READ_ANALYTICS`.
   * @example
   * const report = await warmbly.analytics.usage({ period: "week" });
   */
  usage(params?: UsageAnalyticsParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>("analytics/usage", { query: params });
  }

  /**
   * Returns per-mailbox status, one bounded page at a time: `{ data, pagination }`.
   * Scope a page with `email_ids`, or walk everything with `pagination.next_cursor`
   * passed back as `cursor`. Needs `READ_ANALYTICS`.
   * @example
   * const page = await warmbly.analytics.accounts({ limit: 100 });
   */
  accounts(params?: AccountStatusesParams): Promise<AnalyticsReport> {
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
   * Returns analytics for a single campaign: all time, or a whole-day window when both
   * `from` and `to` are given. Needs `READ_ANALYTICS`.
   * @example
   * const report = await warmbly.analytics.campaign("c_1", { from: "2026-06-01", to: "2026-06-15" });
   */
  campaign(id: string, params?: CampaignAnalyticsParams): Promise<AnalyticsReport> {
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
   * Returns hourly-bucketed analytics for a campaign on one `date` (default today).
   * Needs `READ_ANALYTICS`.
   * @example
   * const report = await warmbly.analytics.campaignHourly("c_1", { date: "2026-06-15" });
   */
  campaignHourly(id: string, params?: CampaignHourlyParams): Promise<AnalyticsReport> {
    return this.http.get<AnalyticsReport>(this.path("analytics", "campaigns", id, "hourly"), {
      query: params,
    });
  }

  /**
   * Returns the direct-mail overview: volume and replies for hand-written mail from the
   * synced mailboxes, plus opens and clicks for the mailboxes that opted into tracking.
   * Needs `READ_ANALYTICS`.
   * @example
   * const direct = await warmbly.analytics.direct({ period: "30d" });
   * console.log(direct.volume.reply_rate, direct.tracking.open_rate);
   */
  direct(params?: DirectMailAnalyticsParams): Promise<DirectMailAnalytics> {
    return this.http.get<DirectMailAnalytics>("analytics/direct", { query: params });
  }

  /**
   * Lists what automatic inbox tagging decided and how sure it was, for review. Returns
   * the raw envelope (`enabled`, `data`, `total`, `summary`, `pagination`); pass
   * `pagination.next_cursor` back as `cursor` for the next page. Needs `READ_ANALYTICS`.
   * @example
   * const review = await warmbly.analytics.inboxTagging({ needs_review: true, limit: 100 });
   * for (const v of review.data) console.log(v.intent, v.intent_confidence);
   */
  inboxTagging(params?: InboxTaggingParams): Promise<InboxTaggingReview> {
    return this.http.get<InboxTaggingReview>("analytics/inbox-tagging", { query: params });
  }

  /**
   * Reports where warmup mail landed (inbox, category tabs, spam) per day and per
   * recipient provider, for one mailbox (`email_id`) or the whole workspace. Dates are
   * `YYYY-MM-DD`. Needs `READ_ANALYTICS`.
   * @example
   * const report = await warmbly.analytics.warmupPlacement({ from: "2026-06-01", to: "2026-06-30" });
   * console.log(report.rate.inbox_rate, report.rate.band);
   */
  warmupPlacement(params?: WarmupPlacementParams): Promise<WarmupPlacementReport> {
    return this.http.get<WarmupPlacementReport>("analytics/warmup/placement", { query: params });
  }
}
