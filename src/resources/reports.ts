import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** The period a client report covers, in whole UTC days with today included. */
export type ClientReportRange =
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | (string & {});

/** How often a scheduled report email goes out. */
export type ClientReportCadence = "weekly" | "monthly" | (string & {});

/** `workspace` covers everything; `restricted` covers only the listed folders, campaigns and mailboxes. */
export type ClientReportAccessScope = "workspace" | "restricted" | (string & {});

/** Which campaigns, folders and mailboxes a report covers. Same shape as a member's access. */
export interface ClientReportAccess {
  scope: ClientReportAccessScope;
  /** Folders, resolved to the campaigns they hold each time the report is read. */
  campaign_folder_ids: string[];
  campaign_ids: string[];
  email_account_ids: string[];
  [key: string]: unknown;
}

/** The parts of a report that are shown. At least one must be on. */
export interface ClientReportSections {
  overview: boolean;
  campaigns: boolean;
  replies: boolean;
  positive_replies: boolean;
  mailboxes: boolean;
  daily_chart: boolean;
  [key: string]: unknown;
}

/** The state of a report's share link. The URL itself is only returned when minted. */
export interface ClientReportLink {
  /** The token's first characters, to tell links apart. */
  hint: string;
  created_at: string;
  expires_at: string | null;
  expired: boolean;
  [key: string]: unknown;
}

/** When a report is emailed and to whom. */
export interface ClientReportSchedule {
  recipients: string[];
  cadence: ClientReportCadence;
  /** 0 (Sunday) to 6, used by weekly schedules. */
  weekday: number;
  /** 1 to 28, used by monthly schedules. */
  month_day: number;
  /** 0 to 23, in `timezone`. */
  hour: number;
  /** IANA zone. */
  timezone: string;
  paused: boolean;
  last_sent_at: string | null;
  next_run_at: string;
  [key: string]: unknown;
}

/** A saved, scoped report a workspace shares with its client. */
export interface ClientReport {
  id: string;
  created_by: string | null;
  name: string;
  access: ClientReportAccess;
  sections: ClientReportSections;
  show_reply_snippets: boolean;
  /** The default range of the preview and the public page. */
  date_range: ClientReportRange;
  /** Null when the report has no share link. */
  link: ClientReportLink | null;
  /** Null when the report is not emailed. */
  schedule: ClientReportSchedule | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Query params for {@link Reports.list}. */
export interface ListClientReportsParams {
  /** 1..100, default 50. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Body of {@link Reports.update}. Absent fields keep their value. */
export interface UpdateClientReportParams {
  name?: string;
  /** Defaults to the whole workspace on create. Every id must belong to the workspace. */
  access?: Partial<ClientReportAccess>;
  /** Defaults to every section on create. */
  sections?: ClientReportSections;
  show_reply_snippets?: boolean;
  /** Defaults to `last_30_days` on create. */
  date_range?: ClientReportRange;
  [key: string]: unknown;
}

/** Body of {@link Reports.create}. Only `name` is required. */
export interface CreateClientReportParams extends UpdateClientReportParams {
  name: string;
}

/** Query params for {@link Reports.preview}. */
export interface PreviewClientReportParams {
  /** Defaults to the report's `date_range`. */
  range?: ClientReportRange;
  [key: string]: unknown;
}

/** Body of {@link Reports.createLink}. */
export interface CreateClientReportLinkParams {
  /** 1 to 365, default 90. */
  expires_in_days?: number;
  [key: string]: unknown;
}

/** A freshly minted share link. `url` and `token` are shown this once. */
export interface ClientReportLinkResult {
  url: string;
  token: string;
  link: ClientReportLink;
  report: ClientReport | null;
  [key: string]: unknown;
}

/** Body of {@link Reports.setSchedule}. */
export interface SetClientReportScheduleParams {
  /** 1 to 10 plain addresses. */
  recipients: string[];
  cadence: ClientReportCadence;
  /** 0 (Sunday) to 6, default 0. Used by weekly schedules. */
  weekday?: number;
  /** 1 to 28, default 1. Used by monthly schedules. */
  month_day?: number;
  /** 0 to 23, default 0. */
  hour?: number;
  /** IANA zone, default `UTC`. */
  timezone?: string;
  paused?: boolean;
  [key: string]: unknown;
}

/** The KPI row. Rates are percentages, 0 to 100. Positive figures are absent when that section is off. */
export interface ClientReportOverview {
  sent: number;
  opened: number;
  /** The sends that carried an open pixel; `open_rate` is of these. */
  open_tracked_sent: number;
  open_rate: number;
  clicked: number;
  replied: number;
  reply_rate: number;
  positive?: number;
  positive_rate?: number;
  bounced: number;
  bounce_rate: number;
  [key: string]: unknown;
}

/** One day of the chart. */
export interface ClientReportDay {
  /** `YYYY-MM-DD`, UTC. */
  date: string;
  sent: number;
  opens: number;
  replies: number;
  [key: string]: unknown;
}

/** One row of the campaign table. Rates are percentages, 0 to 100. */
export interface ClientReportCampaign {
  name: string;
  status: string;
  sent: number;
  opens: number;
  open_tracked_sent: number;
  open_rate: number;
  clicks: number;
  replies: number;
  reply_rate: number;
  positive?: number;
  bounces: number;
  bounce_rate: number;
  [key: string]: unknown;
}

/** One reply in the list. `snippet` is set only when the report shows snippets. */
export interface ClientReportReply {
  name: string;
  email: string;
  campaign: string;
  subject: string;
  replied_at: string;
  classification: string;
  snippet?: string;
  [key: string]: unknown;
}

/** The mailbox health and warmup summary. */
export interface ClientReportMailboxes {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  warmup_sent: number;
  warmup_received: number;
  warmup_replied: number;
  [key: string]: unknown;
}

/** A rendered report, as the preview and the public page show it. Sections that are off are absent. */
export interface ClientReportView {
  name: string;
  date_range: ClientReportRange;
  /** First day, `YYYY-MM-DD` UTC. */
  from: string;
  /** Last day, `YYYY-MM-DD` UTC. */
  to: string;
  generated_at: string;
  sections: ClientReportSections;
  show_reply_snippets: boolean;
  overview?: ClientReportOverview;
  daily?: ClientReportDay[];
  campaigns?: ClientReportCampaign[];
  replies?: ClientReportReply[];
  mailboxes?: ClientReportMailboxes;
  [key: string]: unknown;
}

/**
 * Client reports: saved, scoped views of the workspace's results that can be shared by link
 * and emailed on a schedule. Reads need `READ_ANALYTICS`; changing a report, its link or its
 * schedule needs `MANAGE_REPORTS`. Reachable as `warmbly.reports`.
 *
 * @example
 * const report = await warmbly.reports.create({
 *   name: "Acme weekly",
 *   access: { scope: "restricted", campaign_ids: ["cmp_1"] },
 * });
 * const { url } = await warmbly.reports.createLink(report.id, { expires_in_days: 30 });
 */
export class Reports extends APIResource {
  /**
   * Lists the workspace's reports, newest first, auto-paginating when iterated. Needs
   * `READ_ANALYTICS`.
   * @example
   * for await (const r of await warmbly.reports.list()) console.log(r.name);
   */
  list(params?: ListClientReportsParams, opts?: RequestOptions): Promise<Page<ClientReport>> {
    return this.http.getPage<ClientReport>("reports", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Creates a report (201). It covers the whole workspace, shows every section and reads
   * the last 30 days unless told otherwise. A workspace keeps at most 200. Needs
   * `MANAGE_REPORTS`.
   * @example
   * const report = await warmbly.reports.create({ name: "Acme monthly", date_range: "last_month" });
   */
  create(params: CreateClientReportParams, opts?: RequestOptions): Promise<ClientReport> {
    return this.http.post<ClientReport>("reports", { ...opts, body: params });
  }

  /**
   * Retrieves one report. Needs `READ_ANALYTICS`.
   * @example
   * const report = await warmbly.reports.get("rep_1");
   */
  get(id: string, opts?: RequestOptions): Promise<ClientReport> {
    return this.http.get<ClientReport>(this.path("reports", id), opts);
  }

  /**
   * Renders a report as its client would see it, for `range` or the report's own
   * `date_range`. An unknown range is a 400 `invalid_report_range`. Needs `READ_ANALYTICS`.
   * @example
   * const view = await warmbly.reports.preview("rep_1", { range: "this_month" });
   * console.log(view.overview?.reply_rate);
   */
  preview(
    id: string,
    params?: PreviewClientReportParams,
    opts?: RequestOptions,
  ): Promise<ClientReportView> {
    return this.http.get<ClientReportView>(this.path("reports", id, "preview"), {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Updates a report; absent fields keep their value. Needs `MANAGE_REPORTS`.
   * @example
   * await warmbly.reports.update("rep_1", { show_reply_snippets: true });
   */
  update(
    id: string,
    params: UpdateClientReportParams,
    opts?: RequestOptions,
  ): Promise<ClientReport> {
    return this.http.patch<ClientReport>(this.path("reports", id), { ...opts, body: params });
  }

  /**
   * Deletes a report with its link and schedule (204). Needs `MANAGE_REPORTS`.
   * @example
   * await warmbly.reports.delete("rep_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("reports", id), opts);
  }

  /**
   * Mints a share link (201), replacing any earlier one, so it is also the rotate action.
   * The `url` is returned only in this response. Without a portal domain configured this
   * is a 422 `report_links_unavailable`. Needs `MANAGE_REPORTS`.
   * @example
   * const { url } = await warmbly.reports.createLink("rep_1", { expires_in_days: 30 });
   */
  createLink(
    id: string,
    params?: CreateClientReportLinkParams,
    opts?: RequestOptions,
  ): Promise<ClientReportLinkResult> {
    return this.http.post<ClientReportLinkResult>(this.path("reports", id, "link"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Turns off the share link and the link inside every scheduled email already sent, and
   * returns the report. Needs `MANAGE_REPORTS`.
   * @example
   * const report = await warmbly.reports.revokeLink("rep_1");
   */
  revokeLink(id: string, opts?: RequestOptions): Promise<ClientReport> {
    return this.http.delete<ClientReport>(this.path("reports", id, "link"), opts);
  }

  /**
   * Sets (or replaces) the email schedule and returns the report. Needs `MANAGE_REPORTS`.
   * @example
   * await warmbly.reports.setSchedule("rep_1", {
   *   recipients: ["client@acme.com"],
   *   cadence: "weekly",
   *   weekday: 1,
   *   hour: 9,
   *   timezone: "Europe/London",
   * });
   */
  setSchedule(
    id: string,
    params: SetClientReportScheduleParams,
    opts?: RequestOptions,
  ): Promise<ClientReport> {
    return this.http.put<ClientReport>(this.path("reports", id, "schedule"), {
      ...opts,
      body: params,
    });
  }

  /**
   * Stops emailing a report and returns it with `schedule: null`. Needs `MANAGE_REPORTS`.
   * @example
   * await warmbly.reports.deleteSchedule("rep_1");
   */
  deleteSchedule(id: string, opts?: RequestOptions): Promise<ClientReport> {
    return this.http.delete<ClientReport>(this.path("reports", id, "schedule"), opts);
  }
}
