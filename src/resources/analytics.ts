import { Page } from "../core/pagination";
import type { ListResponse, RequestOptions } from "../core/types";
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

/** Period for {@link Analytics.direct}. Anything else is treated as `7d` by the server. */
export type DirectMailPeriod = "7d" | "30d" | "90d";

/** Volume and replies for hand-written mail, measured from the synced mailbox. */
export interface DirectMailVolume {
  sent: number;
  received: number;
  /** Outbound threads whose first message was ours. */
  threads_started: number;
  /** Threads that got an inbound message back. */
  replied: number;
  reply_rate: number;
  /** Delivery failures that came back; excluded from `replied`. */
  bounced: number;
  /** Median minutes the contact took to answer; 0 when nothing has been answered. */
  median_reply_minutes: number;
  [key: string]: unknown;
}

/**
 * Opens and clicks for hand-written mail. Opt-in per mailbox, so it covers only mail
 * sent through Warmbly by a mailbox with tracking on. `tracked_sent` is the
 * denominator for both rates.
 */
export interface DirectMailTracking {
  mailboxes_opted_in: number;
  mailboxes_total: number;
  tracked_sent: number;
  opened: number;
  machine_opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  [key: string]: unknown;
}

/** One day of hand-written mail volume. */
export interface DirectMailDailyStats {
  date: string;
  sent: number;
  received: number;
  [key: string]: unknown;
}

/** One mailbox's share of hand-written mail. */
export interface DirectMailMailboxStats {
  email_account_id: string;
  email: string;
  track_direct_mail: boolean;
  sent: number;
  received: number;
  [key: string]: unknown;
}

/** One correspondent, ranked by how much was sent to them. */
export interface DirectMailContact {
  email: string;
  sent: number;
  received: number;
  last_at: string;
  [key: string]: unknown;
}

/** Hand-written (non-campaign) mail analytics from {@link Analytics.direct}. */
export interface DirectMailAnalytics {
  period: string;
  volume: DirectMailVolume;
  tracking: DirectMailTracking;
  daily_trend: DirectMailDailyStats[];
  mailboxes: DirectMailMailboxStats[];
  top_contacts: DirectMailContact[];
  [key: string]: unknown;
}

/** Query params for {@link Analytics.inboxTagging}. */
export interface InboxTaggingParams {
  cursor?: string;
  /** 1..200, default 50. */
  limit?: number;
  /** Only verdicts flagged for review. */
  needs_review?: boolean;
  [key: string]: unknown;
}

/** One automatic inbox-tagging verdict. */
export interface InboxTaggingRow {
  id: string;
  message_id: string;
  thread_id: string;
  kind: string;
  kind_confidence: number;
  kind_source: string;
  intent: string;
  intent_confidence: number;
  relevance: number;
  priority: string;
  needs_review: boolean;
  review_reason: string;
  labels: string[];
  /** The model's answers to the classification questions; `{}` when none. */
  answers: Record<string, unknown>;
  model: string;
  input_tokens: number;
  /** What the workspace's switches let this verdict do. */
  actions: string[];
  /** Out-of-office return date (`YYYY-MM-DD`), `null` when the model was not asked. */
  return_date: string | null;
  created_at: string;
  [key: string]: unknown;
}

/** Counts across every tagging verdict in the workspace. */
export interface InboxTaggingSummary {
  total: number;
  needs_review: number;
  from_offline: number;
  acted: number;
  [key: string]: unknown;
}

/** The wire body of {@link Analytics.inboxTagging}. */
export interface InboxTaggingReview extends ListResponse<InboxTaggingRow> {
  /** Whether automatic tagging is switched on for this instance. */
  enabled: boolean;
  total: number;
  summary: InboxTaggingSummary;
}

/**
 * A page of tagging verdicts that is also an async-iterable over every page, and
 * carries the review's `enabled` flag and `summary` from the first response.
 */
export class InboxTaggingPage extends Page<InboxTaggingRow> {
  /** Whether automatic tagging is switched on for this instance. */
  readonly enabled: boolean;
  /** Counts across every verdict in the workspace, not just this page. */
  readonly summary: InboxTaggingSummary;
  /** Total verdicts matching the filter. */
  readonly total: number;

  constructor(
    response: InboxTaggingReview,
    fetchNext?: (cursor: string) => Promise<InboxTaggingPage>,
  ) {
    super(response, fetchNext);
    this.enabled = response.enabled === true;
    this.summary = response.summary ?? { total: 0, needs_review: 0, from_offline: 0, acted: 0 };
    this.total = response.total ?? this.data.length;
  }
}

/** Query params for {@link Analytics.warmupPlacement}. */
export interface WarmupPlacementParams {
  /** Restrict to one mailbox; omit for the whole workspace (adds a per-mailbox table). */
  email_id?: string;
  /** Window start, `YYYY-MM-DD`. Defaults to 29 days before `to`. */
  from?: string;
  /** Window end, `YYYY-MM-DD`. Defaults to today (UTC). The window spans at most 366 days. */
  to?: string;
  [key: string]: unknown;
}

/** Where a set of verified warmup deliveries landed. Rates are percentages (0..100). */
export interface WarmupPlacementCounts {
  /** Warmup mail the mailbox sent. */
  sent: number;
  /** What recipients verifiably received (inbox + tabs + spam). */
  delivered: number;
  inbox: number;
  /** Gmail category tabs. Counted as inbox in `inbox_rate`. */
  tabs: number;
  spam: number;
  /** Spam placements the recipient was told to move back to the inbox. */
  rescued: number;
  /** Mail sent long ago that no recipient has reported seeing. */
  unconfirmed: number;
  /** `null` until something is delivered. */
  inbox_rate: number | null;
  spam_rate: number | null;
  [key: string]: unknown;
}

/** A trailing-window inbox rate; withheld (`null`) below the sample floor. */
export interface WarmupPlacementRate {
  window_days: number;
  min_sample: number;
  /** Which recipients the rate covers (`major`: Google, Microsoft, Yahoo). */
  scope: string;
  delivered: number;
  inbox: number;
  tabs: number;
  spam: number;
  inbox_rate: number | null;
  /** `good`, `fair`, `poor`, `collecting` or `none`. */
  band: "good" | "fair" | "poor" | "collecting" | "none" | (string & {});
  other_delivered: number;
  other_inbox_rate: number | null;
  [key: string]: unknown;
}

/** One recipient group's share of a day. */
export interface WarmupPlacementGroupCounts {
  /** `google`, `microsoft`, `yahoo` or `other`. */
  group: string;
  inbox: number;
  tabs: number;
  spam: number;
  rescued: number;
  [key: string]: unknown;
}

/** One UTC day of warmup placement. */
export interface WarmupPlacementDay extends WarmupPlacementCounts {
  date: string;
  /** Trailing-window rate ending on this day; `null` below the sample floor. */
  rolling_inbox_rate: number | null;
  groups: WarmupPlacementGroupCounts[];
}

/** One mail host inside a recipient group. */
export interface WarmupPlacementHost extends WarmupPlacementCounts {
  host: string;
}

/** The window's placement at one recipient group. */
export interface WarmupPlacementProvider extends WarmupPlacementCounts {
  group: string;
  hosts: WarmupPlacementHost[];
}

/** One sender's row in the workspace report. */
export interface WarmupPlacementMailbox extends WarmupPlacementCounts {
  email_account_id: string;
  email: string;
  rate: WarmupPlacementRate;
  /** Follows the report's days; `null` on a day with no deliveries. */
  daily_inbox_rate: Array<number | null>;
}

/** Where warmup mail landed over a date range, from {@link Analytics.warmupPlacement}. */
export interface WarmupPlacementReport {
  /** Present for a single-mailbox report. */
  email_account_id?: string;
  date_range: { from: string; to: string };
  summary: WarmupPlacementCounts;
  rate: WarmupPlacementRate;
  daily: WarmupPlacementDay[];
  providers: WarmupPlacementProvider[];
  /** Workspace report only, worst rate first. */
  mailboxes?: WarmupPlacementMailbox[];
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

  /**
   * Returns analytics for mail written by hand rather than sent by a campaign: volume
   * and replies from the synced mailbox, plus opens and clicks for mailboxes that
   * opted into tracking. Needs `READ_ANALYTICS`.
   * @example
   * const direct = await warmbly.analytics.direct({ period: "30d" });
   */
  direct(
    params?: { period?: DirectMailPeriod },
    opts?: RequestOptions,
  ): Promise<DirectMailAnalytics> {
    return this.http.get<DirectMailAnalytics>("analytics/direct", { ...opts, query: params });
  }

  /**
   * Lists automatic inbox-tagging verdicts for review (read-only), auto-paginating when
   * iterated. The returned page also carries `enabled`, `summary` and `total`. Needs
   * `READ_ANALYTICS`.
   * @example
   * const page = await warmbly.analytics.inboxTagging({ needs_review: true });
   * console.log(page.enabled, page.summary.needs_review);
   */
  async inboxTagging(params?: InboxTaggingParams): Promise<InboxTaggingPage> {
    const fetchPage = async (query: InboxTaggingParams | undefined): Promise<InboxTaggingPage> => {
      const response = await this.http.get<InboxTaggingReview>("analytics/inbox-tagging", {
        query,
      });
      return new InboxTaggingPage(response, (cursor) => fetchPage({ ...query, cursor }));
    };
    return fetchPage(params);
  }

  /**
   * Reports where warmup mail landed (inbox, category tabs, spam) per day and per
   * recipient provider, for one mailbox or the whole workspace. Needs `READ_ANALYTICS`.
   * @example
   * const report = await warmbly.analytics.warmupPlacement({ email_id: "mb_1" });
   * console.log(report.rate.inbox_rate, report.rate.band);
   */
  warmupPlacement(
    params?: WarmupPlacementParams,
    opts?: RequestOptions,
  ): Promise<WarmupPlacementReport> {
    return this.http.get<WarmupPlacementReport>("analytics/warmup/placement", {
      ...opts,
      query: params,
    });
  }
}
