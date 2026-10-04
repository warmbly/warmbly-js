import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** The seed panel a placement test sends to. */
export type PlacementPanel = "instance" | "workspace" | "cloud" | (string & {});

/** The state of one placement test. */
export type PlacementTestStatus = "running" | "completed" | "cancelled" | "failed" | (string & {});

/** What started a placement test. */
export type PlacementOrigin = "manual" | "monitor" | "admin" | "remote" | "batch" | (string & {});

/** Where one probe landed. */
export type PlacementFolder =
  | "pending"
  | "inbox"
  | "promotions"
  | "other"
  | "spam"
  | "missing"
  | "failed"
  | "cancelled"
  | (string & {});

/**
 * Open and click tracking for a test's copies. `campaign` copies the campaign's own
 * tracking, `compare` runs the same copy twice (tracked and untracked).
 */
export type PlacementTracking = "campaign" | "on" | "off" | "compare" | (string & {});

/** Pacing of a test's copies from one sender: about a minute apart, or a few seconds. */
export type PlacementPace = "spaced" | "quick" | (string & {});

/** The state of a placement batch. */
export type PlacementBatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "cancelled"
  | "failed"
  | (string & {});

/** The state of one sender inside a batch. */
export type PlacementSenderStatus =
  | "queued"
  | "deferred"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled"
  | (string & {});

/** What a batch does with a sender that cannot run when its turn comes. */
export type PlacementOnUnavailable = "skip" | "defer" | (string & {});

/** How a batch samples its resolved senders. */
export type PlacementSampleMode =
  | "all"
  | "random"
  | "percent"
  | "per_domain"
  | "per_provider"
  | (string & {});

/** Where a set of probes landed. Rates are percentages as fractions (0..1) or `null` until something is delivered. */
export interface PlacementCounts {
  total: number;
  pending: number;
  inbox: number;
  promotions: number;
  other: number;
  spam: number;
  missing: number;
  failed: number;
  cancelled: number;
  /** Every copy that left and got a verdict: inbox + promotions + other + spam + missing. */
  delivered: number;
  /** Primary-inbox share of `delivered`, 0..1. `null` until something is delivered. */
  inbox_rate: number | null;
  /** Gmail tabs (promotions + other) share of `delivered`, 0..1. */
  tabs_rate: number | null;
  spam_rate: number | null;
  /** Copies never seen in the seed, 0..1. */
  missing_rate: number | null;
  [key: string]: unknown;
}

/** One host family's share of a test. */
export interface PlacementFamilyCounts {
  /** A mailhost value such as `google_workspace`, `gmail`, `microsoft365`, `outlook`, `yahoo`. */
  family: string;
  label: string;
  counts: PlacementCounts;
  [key: string]: unknown;
}

/** One placement test: a copy sent from one sender to a seed panel. */
export interface PlacementTest {
  id: string;
  sender_account_id: string | null;
  sender_email: string;
  created_by: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  contact_id: string | null;
  monitor_id: string | null;
  /** The batch that started this test, when it came from one. */
  batch_id: string | null;
  subject: string;
  /** Omitted from lists. */
  body_html?: string;
  body_plain?: string;
  open_tracking: boolean;
  link_tracking: boolean;
  /** Shared by the two halves of a tracking comparison. */
  compare_group_id: string | null;
  origin: PlacementOrigin;
  panel: PlacementPanel;
  status: PlacementTestStatus;
  error?: string;
  pace: PlacementPace;
  /** What the test cost past the monthly free allowance. */
  credits_charged: number;
  /** What came back because no copy was delivered. */
  credits_refunded: number;
  credits_settled_at: string | null;
  created_at: string;
  finished_at: string | null;
  [key: string]: unknown;
}

/** A test with where its copies landed, overall and per host family. */
export interface PlacementTestView extends PlacementTest {
  summary: PlacementCounts;
  families: PlacementFamilyCounts[];
}

/** One probe: one copy to one seed. */
export interface PlacementResult {
  /** The seed's address, masked on the shared panels. */
  seed: string;
  family: string;
  family_label: string;
  folder: PlacementFolder;
  scheduled_at: string | null;
  sent_at: string | null;
  detected_at: string | null;
  error?: string;
  [key: string]: unknown;
}

/** A fragment of the copy that triggered a content issue. */
export interface PlacementContentSpan {
  /** `subject` or `body`. */
  field: string;
  text: string;
  line?: number;
  excerpt?: string;
  [key: string]: unknown;
}

/** One advisory content problem. */
export interface PlacementContentIssue {
  /** `warn` or `high`. */
  severity: "warn" | "high" | (string & {});
  code: string;
  message: string;
  field?: string;
  spans?: PlacementContentSpan[];
  suggestion?: string;
  [key: string]: unknown;
}

/** The rules pass over a test's copy. `score` is 0..100, higher is safer. */
export interface PlacementContentCheck {
  score: number;
  issues: PlacementContentIssue[];
  [key: string]: unknown;
}

/** One test in full, from {@link Placement.getTest}. */
export interface PlacementTestDetail extends PlacementTestView {
  results: PlacementResult[];
  content: PlacementContentCheck;
  /** The other half of a tracking comparison. */
  compare?: PlacementTestView;
}

/** The seeds one host family contributes to a panel. */
export interface PlacementPanelFamily {
  family: string;
  label: string;
  seeds: number;
  [key: string]: unknown;
}

/** Whether the workspace can test on a panel. */
export interface PlacementPanelInfo {
  panel: PlacementPanel;
  available: boolean;
  /** Why the panel is unavailable, in one sentence. */
  reason?: string;
  seeds: number;
  families: PlacementPanelFamily[];
  /** Metered panels count against the monthly allowance. */
  metered: boolean;
  [key: string]: unknown;
}

/** The workspace's monthly allowance on the metered panels. */
export interface PlacementUsage {
  used: number;
  /** `null` when the instance does not meter tests (self-hosted). */
  limit: number | null;
  /** Credits one test costs past the free allowance; 0 when tests cannot be paid for. */
  credits_per_test: number;
  /** Spendable credit balance; `null` when credits are off. */
  credit_balance: number | null;
  period_start: string;
  period_end: string;
  [key: string]: unknown;
}

/** What the workspace can test on and how much of its allowance is left. */
export interface PlacementOverview {
  panels: PlacementPanelInfo[];
  usage: PlacementUsage;
  workspace_seeds: number;
  seeds_per_test: number;
  spacing_seconds: number;
  [key: string]: unknown;
}

/** One of the workspace's mailboxes as a seed candidate. */
export interface PlacementWorkspaceSeed {
  email_account_id: string;
  email: string;
  family: string;
  label: string;
  status: string;
  /** Whether the mailbox is currently a seed inbox. */
  seed: boolean;
  /** Why the mailbox cannot become a seed; absent when it can. */
  blocker?: string;
  [key: string]: unknown;
}

/**
 * Selects a batch's senders on the server, so a fleet of thousands needs no id list.
 * Filters narrow whichever scope is chosen.
 */
export interface PlacementSenderScope {
  /** `campaign` (the campaign's senders, needs `campaign_id`) or `workspace` (every mailbox). */
  type: "campaign" | "workspace" | (string & {});
  campaign_id?: string;
  /** Keep mailboxes hosted by these mailhost families. */
  providers?: string[];
  domains?: string[];
  tag_ids?: string[];
  /** Keep disconnected mailboxes; they are skipped or deferred when their turn comes. */
  include_inactive?: boolean;
  /** Keep mailboxes with no delivered test in the last this many days. */
  untested_days?: number;
  [key: string]: unknown;
}

/** Picks part of the resolved senders. */
export interface PlacementSample {
  mode: PlacementSampleMode;
  count?: number;
  percent?: number;
  /** Spread a random or percent sample across `provider` or `domain`. */
  stratify?: "provider" | "domain" | (string & {});
  [key: string]: unknown;
}

/**
 * Body for {@link Placement.createTest}. Supply `sender_account_id` and either a
 * `campaign_id` (with optional `sequence_id`/`contact_id`) or your own copy
 * (`subject` plus `body_html` and/or `body_plain`).
 */
export interface CreatePlacementTestParams {
  /** The mailbox to send from. Required. */
  sender_account_id: string;
  campaign_id?: string;
  sequence_id?: string;
  contact_id?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  tracking?: PlacementTracking;
  panel?: PlacementPanel;
  /** Restrict to specific seeds. */
  seed_ids?: string[];
  /** Restrict to seeds hosted by these providers. */
  families?: string[];
  pace?: PlacementPace;
  /** The most credits you agree to pay for tests past the free allowance. */
  max_credits?: number;
  [key: string]: unknown;
}

/**
 * Body for {@link Placement.createBatch} and {@link Placement.previewBatch}. Give
 * `sender_account_ids` or a `sender_scope`, never an unbounded fleet by hand.
 */
export interface PlacementBatchParams {
  sender_account_ids?: string[];
  sender_scope?: PlacementSenderScope;
  sample?: PlacementSample;
  campaign_id?: string;
  sequence_id?: string;
  contact_id?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  tracking?: PlacementTracking;
  panel?: PlacementPanel;
  pace?: PlacementPace;
  families?: string[];
  seed_ids?: string[];
  on_unavailable?: PlacementOnUnavailable;
  /** The most credits you agree to pay across the whole batch. */
  max_credits?: number;
  [key: string]: unknown;
}

/** Query params for {@link Placement.listTests}. */
export interface ListPlacementTestsParams {
  cursor?: string;
  /** 1..100, default 25. */
  limit?: number;
  /** Only tests started for this campaign. */
  campaign_id?: string;
  [key: string]: unknown;
}

/** Query params for {@link Placement.listBatches}. */
export interface ListPlacementBatchesParams {
  cursor?: string;
  /** 1..100, default 25. */
  limit?: number;
  [key: string]: unknown;
}

/** Query params for {@link Placement.listBatchSenders}. */
export interface ListPlacementBatchSendersParams {
  cursor?: string;
  /** 1..100, default 25. */
  limit?: number;
  status?: PlacementSenderStatus;
  /** Search the sender address. */
  q?: string;
  /** `worst` (default), `best`, `email` or `status`. */
  sort?: "worst" | "best" | "email" | "status" | (string & {});
  [key: string]: unknown;
}

/** How a batch's senders were chosen. */
export interface PlacementBatchSelection {
  sender_account_ids?: number;
  sender_scope?: PlacementSenderScope;
  sample: PlacementSample;
  /** How many senders the scope resolved to before sampling. */
  matched: number;
  [key: string]: unknown;
}

/** A batch's senders counted by status. */
export interface PlacementBatchProgress {
  total: number;
  queued: number;
  deferred: number;
  running: number;
  completed: number;
  skipped: number;
  failed: number;
  cancelled: number;
  [key: string]: unknown;
}

/** A batch: one placement test run from many senders. */
export interface PlacementBatch {
  id: string;
  created_by: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  contact_id: string | null;
  subject: string;
  body_html?: string;
  body_plain?: string;
  tracking: PlacementTracking;
  panel: PlacementPanel;
  pace: PlacementPace;
  families: string[];
  seed_ids: string[];
  on_unavailable: PlacementOnUnavailable;
  selection: PlacementBatchSelection;
  sender_count: number;
  max_credits: number;
  credits_spent: number;
  status: PlacementBatchStatus;
  error?: string;
  /** Deferred senders are retried until this moment. */
  retry_until: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  [key: string]: unknown;
}

/** A batch with its progress and headline placement. */
export interface PlacementBatchView extends PlacementBatch {
  progress: PlacementBatchProgress;
  /** Headline placement (the tracked half of a tracking comparison). */
  summary: PlacementCounts;
}

/** A batch's placement for one sending domain or provider. */
export interface PlacementBatchGroup {
  key: string;
  label: string;
  senders: number;
  tested: number;
  counts: PlacementCounts;
  [key: string]: unknown;
}

/** One sending domain's placement per recipient provider. */
export interface PlacementBatchMatrixRow {
  domain: string;
  recipients: PlacementFamilyCounts[];
  [key: string]: unknown;
}

/** One batch in full, from {@link Placement.getBatch}. */
export interface PlacementBatchDetail extends PlacementBatchView {
  /** The untracked half of a tracking comparison. */
  untracked?: PlacementCounts;
  /** Grouped by sending domain. */
  domains: PlacementBatchGroup[];
  /** Grouped by sending provider. */
  providers: PlacementBatchGroup[];
  /** Grouped by recipient provider. */
  recipients: PlacementFamilyCounts[];
  matrix: PlacementBatchMatrixRow[];
  content: PlacementContentCheck;
}

/** One sender of a batch with where its copies landed. */
export interface PlacementBatchSender {
  id: string;
  batch_id: string;
  email_account_id: string | null;
  sender_email: string;
  sender_domain: string;
  sender_family: string;
  sender_family_label: string;
  status: PlacementSenderStatus;
  /** Why the sender was skipped or deferred. */
  reason?: string;
  detail?: string;
  attempts: number;
  next_attempt_at: string;
  started_at: string | null;
  finished_at: string | null;
  summary: PlacementCounts;
  /** The tests this sender ran (two for a tracking comparison). */
  test_ids: string[];
  [key: string]: unknown;
}

/** A provider's share of a batch preview. */
export interface PlacementBatchGroupCount {
  key: string;
  label: string;
  senders: number;
  [key: string]: unknown;
}

/** What a batch would do, from {@link Placement.previewBatch}. Starts nothing. */
export interface PlacementBatchPreview {
  /** Senders the scope resolved to. */
  matched: number;
  /** Senders the sample kept. */
  selected: number;
  inactive: number;
  domains: number;
  providers: PlacementBatchGroupCount[];
  /** Two for a tracking comparison, which doubles every count. */
  variants: number;
  tests: number;
  seeds_per_test: number;
  /** The most probes the batch sends; each sender's daily limit can only lower it. */
  max_sends: number;
  metered: boolean;
  free_tests: number;
  paid_tests: number;
  /** The most the paid tests cost, in credits. */
  credits: number;
  usage: PlacementUsage;
  senders_max: number;
  /** How many senders send at once in this workspace. */
  concurrency: number;
  [key: string]: unknown;
}

/** How much of the connected fleet delivered a placement test recently. */
export interface PlacementCoverage {
  mailboxes: number;
  tested_7d: number;
  tested_30d: number;
  never_tested: number;
  [key: string]: unknown;
}

/**
 * Inbox placement testing: send a template or campaign step to a seed panel and see
 * which folder each copy lands in, from one sender or from a whole fleet at once.
 * Reads need `READ_ANALYTICS`, starting or cancelling a test or batch needs
 * `SEND_CAMPAIGNS`, and the seed list and seed toggle need `READ_EMAILS` and
 * `WRITE_EMAILS`. Reachable as `warmbly.placement`.
 *
 * @example
 * const preview = await warmbly.placement.previewBatch({
 *   sender_scope: { type: "workspace" },
 *   subject: "Quick question",
 *   body_plain: "Hi there",
 * });
 * if (preview.credits === 0) await warmbly.placement.createBatch({ ... });
 */
export class Placement extends APIResource {
  /**
   * Lists the seed panels this workspace can test on and its monthly allowance.
   * Needs `READ_ANALYTICS`.
   * @example
   * const { panels, usage } = await warmbly.placement.overview();
   */
  overview(opts?: RequestOptions): Promise<PlacementOverview> {
    return this.http
      .get<{ data: PlacementOverview }>("placement/overview", opts)
      .then((r) => r.data);
  }

  /**
   * Lists the workspace's placement tests, newest first, auto-paginating when iterated.
   * Needs `READ_ANALYTICS`.
   * @example
   * for await (const test of await warmbly.placement.listTests({ campaign_id })) {
   *   console.log(test.status, test.summary.inbox_rate);
   * }
   */
  listTests(params?: ListPlacementTestsParams): Promise<Page<PlacementTestView>> {
    return this.http.getPage<PlacementTestView>("placement/tests", { query: params });
  }

  /**
   * Returns one test with every copy, the content check and, for a tracking
   * comparison, the other half. Needs `READ_ANALYTICS`.
   * @example
   * const test = await warmbly.placement.getTest("pt_1");
   */
  getTest(id: string, opts?: RequestOptions): Promise<PlacementTestDetail> {
    return this.http
      .get<{ data: PlacementTestDetail }>(this.path("placement", "tests", id), opts)
      .then((r) => r.data);
  }

  /**
   * Starts a test from one mailbox: one test, or two for a `compare` tracking run, so
   * the result is an array. Needs `SEND_CAMPAIGNS`. An API key limited to some
   * mailboxes can only test from those. Mutating: the client sends an
   * `Idempotency-Key` on retries, or pass `idempotencyKey` yourself.
   * @example
   * const tests = await warmbly.placement.createTest({
   *   sender_account_id: "mb_1",
   *   subject: "Quick question",
   *   body_plain: "Hi there",
   * });
   */
  createTest(
    params: CreatePlacementTestParams,
    opts?: RequestOptions,
  ): Promise<PlacementTestView[]> {
    return this.http
      .post<{ data: PlacementTestView[] }>("placement/tests", { ...opts, body: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Stops the copies of a running test that have not been sent yet. Needs
   * `SEND_CAMPAIGNS`.
   * @example
   * const test = await warmbly.placement.cancelTest("pt_1");
   */
  cancelTest(id: string, opts?: RequestOptions): Promise<PlacementTestView> {
    return this.http
      .post<{ data: PlacementTestView }>(this.path("placement", "tests", id, "cancel"), opts)
      .then((r) => r.data);
  }

  /**
   * Lists the workspace's placement batches, newest first, auto-paginating when
   * iterated. Needs `READ_ANALYTICS`.
   * @example
   * for await (const batch of await warmbly.placement.listBatches()) console.log(batch.status);
   */
  listBatches(params?: ListPlacementBatchesParams): Promise<Page<PlacementBatchView>> {
    return this.http.getPage<PlacementBatchView>("placement/batches", { query: params });
  }

  /**
   * Returns one batch with its placement overall and grouped by sending domain,
   * sending provider and recipient provider. Needs `READ_ANALYTICS`.
   * @example
   * const batch = await warmbly.placement.getBatch("pb_1");
   */
  getBatch(id: string, opts?: RequestOptions): Promise<PlacementBatchDetail> {
    return this.http
      .get<{ data: PlacementBatchDetail }>(this.path("placement", "batches", id), opts)
      .then((r) => r.data);
  }

  /**
   * Lists a batch's senders with where each one's copies landed (worst inbox rate
   * first unless `sort` says otherwise), auto-paginating when iterated. Needs
   * `READ_ANALYTICS`.
   * @example
   * for await (const s of await warmbly.placement.listBatchSenders("pb_1", { status: "failed" })) {
   *   console.log(s.sender_email, s.reason);
   * }
   */
  listBatchSenders(
    id: string,
    params?: ListPlacementBatchSendersParams,
  ): Promise<Page<PlacementBatchSender>> {
    return this.http.getPage<PlacementBatchSender>(
      this.path("placement", "batches", id, "senders"),
      {
        query: params,
      },
    );
  }

  /**
   * Reports how many senders, tests, sends and credits a batch would come to. Starts
   * nothing. Needs `SEND_CAMPAIGNS`.
   * @example
   * const preview = await warmbly.placement.previewBatch({ sender_scope: { type: "workspace" } });
   */
  previewBatch(
    params: PlacementBatchParams,
    opts?: RequestOptions,
  ): Promise<PlacementBatchPreview> {
    return this.http
      .post<{ data: PlacementBatchPreview }>("placement/batches/preview", { ...opts, body: params })
      .then((r) => r.data);
  }

  /**
   * Snapshots the senders and queues a batch; the server starts its senders a few at
   * a time. Needs `SEND_CAMPAIGNS`. Mutating: the client sends an `Idempotency-Key`
   * on retries, or pass `idempotencyKey` yourself.
   * @example
   * const batch = await warmbly.placement.createBatch({
   *   sender_scope: { type: "workspace", untested_days: 7 },
   *   sample: { mode: "per_domain", count: 1 },
   *   subject: "Quick question",
   *   body_plain: "Hi there",
   * });
   */
  createBatch(params: PlacementBatchParams, opts?: RequestOptions): Promise<PlacementBatchView> {
    return this.http
      .post<{ data: PlacementBatchView }>("placement/batches", { ...opts, body: params })
      .then((r) => r.data);
  }

  /**
   * Stops a batch. Copies already sent keep being classified. Needs `SEND_CAMPAIGNS`.
   * @example
   * const batch = await warmbly.placement.cancelBatch("pb_1");
   */
  cancelBatch(id: string, opts?: RequestOptions): Promise<PlacementBatchView> {
    return this.http
      .post<{ data: PlacementBatchView }>(this.path("placement", "batches", id, "cancel"), opts)
      .then((r) => r.data);
  }

  /**
   * Reports how much of the connected fleet delivered a placement test in the last 7
   * and 30 days. Needs `READ_ANALYTICS`.
   * @example
   * const { mailboxes, never_tested } = await warmbly.placement.coverage();
   */
  coverage(opts?: RequestOptions): Promise<PlacementCoverage> {
    return this.http
      .get<{ data: PlacementCoverage }>("placement/coverage", opts)
      .then((r) => r.data);
  }

  /**
   * Lists the workspace's mailboxes and which are its seed inboxes. Needs
   * `READ_EMAILS`. An API key limited to some mailboxes sees only those.
   * @example
   * const seeds = await warmbly.placement.listSeeds();
   */
  listSeeds(opts?: RequestOptions): Promise<PlacementWorkspaceSeed[]> {
    return this.http
      .get<{ data: PlacementWorkspaceSeed[] }>("placement/seeds", opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Makes a workspace mailbox a seed inbox, or stops it being one. Needs
   * `WRITE_EMAILS`, and an API key limited to some mailboxes must include this one.
   * Setting the same value twice is a no-op.
   * @example
   * await warmbly.placement.setSeed("mb_1", true);
   */
  setSeed(id: string, seed: boolean, opts?: RequestOptions): Promise<PlacementWorkspaceSeed> {
    return this.http
      .put<{ data: PlacementWorkspaceSeed }>(this.path("placement", "seeds", id), {
        ...opts,
        body: { seed },
      })
      .then((r) => r.data);
  }
}
