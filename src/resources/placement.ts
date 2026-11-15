import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** Which seed panel a test runs against. */
export type PlacementPanel = "instance" | "workspace" | "cloud" | (string & {});

/** Where a test copy landed. `pending` until it is classified. */
export type PlacementFolder =
  | "pending"
  | "inbox"
  | "promotions"
  | "other"
  | "spam"
  | "missing"
  | "failed"
  | "cancelled"
  | "unknown"
  | "archive"
  | "custom"
  | (string & {});

/** Lifecycle of a single placement test. */
export type PlacementTestStatus = "running" | "completed" | "cancelled" | "failed" | (string & {});

/** Lifecycle of a placement batch. */
export type PlacementBatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "cancelled"
  | "failed"
  | (string & {});

/** Lifecycle of one sender inside a batch. */
export type PlacementSenderStatus =
  | "queued"
  | "deferred"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled"
  | (string & {});

/** Which tracking the test copy carries. `compare` sends both and doubles the tests. */
export type PlacementTracking = "campaign" | "on" | "off" | "compare" | (string & {});

/** `spaced` sends over time; `quick` sends at once (single tests only). */
export type PlacementPace = "spaced" | "quick" | (string & {});

/** How a batch treats a sender that cannot send right now. */
export type PlacementOnUnavailable = "skip" | "defer" | (string & {});

/** How a batch picks senders from the ones its scope matched. */
export type PlacementSampleMode =
  | "all"
  | "random"
  | "percent"
  | "per_domain"
  | "per_provider"
  | (string & {});

/** Sort order of {@link Placement.batchSenders}. */
export type PlacementSenderSort = "worst" | "best" | "email" | "status" | (string & {});

/** A hedged rate with its sample, used inside {@link PlacementCounts}. */
export interface PlacementObservationMetric {
  version?: string;
  population?: string;
  numerator: number;
  denominator: number;
  unresolved: number;
  value: number | null;
  [key: string]: unknown;
}

/** Where a set of copies landed. Rates are fractions 0 to 1, null before anything is delivered. */
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
  unknown: number;
  archive: number;
  custom: number;
  observed_receipts: number;
  classified_receipts: number;
  unresolved: number;
  primary_metric: PlacementObservationMetric | null;
  non_spam_metric: PlacementObservationMetric | null;
  delivered: number;
  inbox_rate: number | null;
  tabs_rate: number | null;
  spam_rate: number | null;
  missing_rate: number | null;
  [key: string]: unknown;
}

/** Counts for one recipient mail host family (`gmail`, `outlook`, ...). */
export interface PlacementFamilyCounts {
  family: string;
  label: string;
  counts: PlacementCounts;
}

/** A test, as listed. The copy bodies are left out of lists. */
export interface PlacementTest {
  id: string;
  sender_account_id: string | null;
  sender_email: string;
  created_by: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  contact_id: string | null;
  monitor_id: string | null;
  batch_id: string | null;
  subject: string;
  body_html?: string;
  body_plain?: string;
  open_tracking: boolean;
  link_tracking: boolean;
  /** Shared by the two halves of a tracking comparison. */
  compare_group_id: string | null;
  /** `manual`, `monitor`, `admin`, `remote`, or `batch`. */
  origin: string;
  panel: PlacementPanel;
  status: PlacementTestStatus;
  error?: string;
  pace: PlacementPace;
  /** Legacy credit count; prefer `charged_usd`. */
  credits_charged: number;
  credits_refunded: number;
  credits_settled_at: string | null;
  charged_usd: number;
  refunded_usd: number;
  created_at: string;
  finished_at: string | null;
  /** Where the copies landed, overall. */
  summary: PlacementCounts;
  /** Where they landed per recipient host family. */
  families: PlacementFamilyCounts[];
  [key: string]: unknown;
}

/** One probe of a test as the dashboard shows it. */
export interface PlacementResult {
  /** The seed address, masked on shared panels. */
  seed: string;
  family: string;
  family_label: string;
  folder: PlacementFolder;
  scheduled_at: string | null;
  sent_at: string | null;
  detected_at: string | null;
  error?: string;
  first_folder?: string | null;
  observed_at?: string | null;
  late_observation?: boolean;
  /** Authentication and transport evidence read off the received copy. */
  evidence: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** The rules pass over a test's copy. */
export interface PlacementContentCheck {
  score: number;
  issues: Array<Record<string, unknown>>;
}

/** One test in full: its probes, content check, and for a tracking comparison the other half. */
export interface PlacementTestDetail extends PlacementTest {
  results: PlacementResult[];
  content: PlacementContentCheck;
  compare?: PlacementTest;
}

/** Body for {@link Placement.createTest}. */
export interface CreatePlacementTestParams {
  /** The mailbox that sends the test. Required. */
  sender_account_id: string;
  /** Take the copy from this campaign, optionally a specific step, and fill merge tags from a contact. */
  campaign_id?: string;
  sequence_id?: string;
  contact_id?: string;
  /** A hand-written copy, used instead of a campaign. */
  subject?: string;
  body_html?: string;
  body_plain?: string;
  /** Defaults to `campaign`. */
  tracking?: PlacementTracking;
  /** Defaults to the instance panel. */
  panel?: PlacementPanel;
  /** Specific workspace seed inboxes, with `panel: "workspace"`. */
  seed_ids?: string[];
  /** Limit the test to these recipient host families. */
  families?: string[];
  pace?: PlacementPace;
  /** The most, in USD, you agree to pay for tests past the free allowance. */
  max_usd?: number;
  /** Legacy form of `max_usd`, read only when `max_usd` is absent. */
  max_credits?: number;
  [key: string]: unknown;
}

/** Query for {@link Placement.listTests}. */
export interface ListPlacementTestsParams {
  /** Only tests for this campaign. */
  campaign_id?: string;
  /** 1 to 100, default 25. */
  limit?: number;
  cursor?: string;
}

/** Query for {@link Placement.listBatches}. */
export interface ListPlacementBatchesParams {
  /** 1 to 100, default 25. */
  limit?: number;
  cursor?: string;
}

/** Query for {@link Placement.batchSenders}. */
export interface ListPlacementBatchSendersParams {
  status?: PlacementSenderStatus;
  /** Search by sender address. */
  q?: string;
  /** Default `worst` (lowest inbox rate first). */
  sort?: PlacementSenderSort;
  /** 1 to 100, default 25. */
  limit?: number;
  cursor?: string;
}

/** Which workspace mailboxes a batch tests from. */
export interface PlacementSenderScope {
  /** `campaign` or `workspace`. */
  type: "campaign" | "workspace" | (string & {});
  campaign_id?: string;
  providers?: string[];
  domains?: string[];
  tag_ids?: string[];
  include_inactive?: boolean;
  /** Only mailboxes not tested in this many days. */
  untested_days?: number;
  [key: string]: unknown;
}

/** How many of the matched senders a batch keeps. */
export interface PlacementSample {
  mode: PlacementSampleMode;
  /** For `random`, or per group for `per_domain`/`per_provider`. */
  count?: number;
  /** For `percent`. */
  percent?: number;
  /** Stratify a `random` or `percent` sample by `domain` or `provider`. */
  stratify?: string;
  [key: string]: unknown;
}

/**
 * Body for {@link Placement.createBatch} and {@link Placement.previewBatch}. Name the
 * senders with `sender_account_ids` or `sender_scope`. A batch always sends `spaced`.
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
  pace?: "spaced";
  families?: string[];
  seed_ids?: string[];
  /** Defaults to `defer`. */
  on_unavailable?: PlacementOnUnavailable;
  max_usd?: number;
  max_credits?: number;
  [key: string]: unknown;
}

/** The senders and tests a batch would come to, from {@link Placement.previewBatch}. */
export interface PlacementBatchPreview {
  /** Senders the scope resolved to. */
  matched: number;
  /** Senders the sample kept. */
  selected: number;
  inactive: number;
  domains: number;
  providers: Array<{ key: string; label: string; senders: number }>;
  /** Two for a tracking comparison, which doubles every count. */
  variants: number;
  tests: number;
  seeds_per_test: number;
  /** The most probes the batch sends. */
  max_sends: number;
  metered: boolean;
  free_tests: number;
  paid_tests: number;
  cost_usd: number;
  credits: number;
  usage: PlacementUsage;
  senders_max: number;
  /** How many senders send at once in this workspace. */
  concurrency: number;
  [key: string]: unknown;
}

/** Sender counts of a batch by status. */
export interface PlacementBatchProgress {
  total: number;
  queued: number;
  deferred: number;
  running: number;
  completed: number;
  skipped: number;
  failed: number;
  cancelled: number;
}

/** A batch of placement tests across many senders, with progress and headline placement. */
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
  /** How the senders were chosen. */
  selection: {
    sender_account_ids?: number;
    sender_scope?: PlacementSenderScope;
    sample: PlacementSample;
    matched: number;
    [key: string]: unknown;
  };
  sender_count: number;
  max_credits: number;
  credits_spent: number;
  max_usd: number;
  spent_usd: number;
  status: PlacementBatchStatus;
  error?: string;
  retry_until: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  progress: PlacementBatchProgress;
  /** Where the headline copies landed (the tracked half of a comparison). */
  summary: PlacementCounts;
  [key: string]: unknown;
}

/** Placement for one sending domain or provider within a batch. */
export interface PlacementBatchGroup {
  key: string;
  label: string;
  senders: number;
  tested: number;
  counts: PlacementCounts;
}

/** One batch in full, with placement grouped by sending domain, sending provider and recipient. */
export interface PlacementBatchDetail extends PlacementBatch {
  /** The untracked half of a tracking comparison. */
  untracked?: PlacementCounts;
  domains: PlacementBatchGroup[];
  providers: PlacementBatchGroup[];
  recipients: PlacementFamilyCounts[];
  /** Placement per sending domain and recipient provider. */
  matrix: Array<{ domain: string; recipients: PlacementFamilyCounts[] }>;
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
  test_ids: string[];
  [key: string]: unknown;
}

/** A seed panel the workspace can test on. */
export interface PlacementPanelInfo {
  panel: PlacementPanel;
  available: boolean;
  /** Why the panel is unavailable. */
  reason?: string;
  seeds: number;
  families: Array<{ family: string; label: string; seeds: number }>;
  metered: boolean;
  [key: string]: unknown;
}

/** The workspace's monthly placement allowance. */
export interface PlacementUsage {
  used: number;
  /** Tests per month; null when unlimited. */
  limit: number | null;
  price_per_test_usd: number;
  balance_usd: number | null;
  credits_per_test: number;
  credit_balance: number | null;
  period_start: string;
  period_end: string;
  [key: string]: unknown;
}

/** What the workspace can test on and how much allowance is left. */
export interface PlacementOverview {
  panels: PlacementPanelInfo[];
  usage: PlacementUsage;
  workspace_seeds: number;
  seeds_per_test: number;
  spacing_seconds: number;
  [key: string]: unknown;
}

/** How much of the connected fleet delivered a placement test recently. */
export interface PlacementCoverage {
  mailboxes: number;
  tested_7d: number;
  tested_30d: number;
  never_tested: number;
}

/** A workspace mailbox and whether it is a seed inbox. */
export interface PlacementSeed {
  email_account_id: string;
  email: string;
  family: string;
  label: string;
  status: string;
  /** True when the mailbox is a seed inbox. */
  seed: boolean;
  /** Why the mailbox cannot be a seed. */
  blocker?: string;
  [key: string]: unknown;
}

/**
 * Inbox placement testing: send a copy from your mailbox to a panel of seed inboxes
 * and see whether it lands in the inbox, a tab, or spam. Reads need `READ_ANALYTICS`
 * (listing seeds needs `READ_EMAILS`); starting or cancelling tests and batches needs
 * `SEND_CAMPAIGNS`; marking a mailbox as a seed needs `WRITE_EMAILS`. A campaign's
 * scheduled placement monitor lives on `warmbly.campaigns`. Reachable as
 * `warmbly.placement`.
 *
 * @example
 * const [test] = await warmbly.placement.createTest({
 *   sender_account_id: "acc_1",
 *   subject: "Quick question",
 *   body_plain: "Hi there",
 * });
 * const detail = await warmbly.placement.getTest(test.id);
 */
export class Placement extends APIResource {
  /**
   * Returns the seed panels the workspace can test on and its monthly allowance.
   * Requires `READ_ANALYTICS`.
   * @example
   * const { usage, panels } = await warmbly.placement.overview();
   */
  overview(opts?: RequestOptions): Promise<PlacementOverview> {
    return this.http
      .get<{ data: PlacementOverview }>("placement/overview", opts)
      .then((r) => r.data);
  }

  /**
   * Lists tests, newest first, auto-paginating when iterated. Requires `READ_ANALYTICS`.
   * @example
   * for await (const t of await warmbly.placement.listTests({ campaign_id })) console.log(t.status);
   */
  listTests(
    params?: ListPlacementTestsParams,
    opts?: RequestOptions,
  ): Promise<Page<PlacementTest>> {
    return this.http.getPage<PlacementTest>("placement/tests", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Retrieves one test with every probe, the content check, and for a tracking comparison
   * the other half. Requires `READ_ANALYTICS`.
   * @example
   * const detail = await warmbly.placement.getTest("test_1");
   */
  getTest(id: string, opts?: RequestOptions): Promise<PlacementTestDetail> {
    return this.http
      .get<{ data: PlacementTestDetail }>(this.path("placement", "tests", id), opts)
      .then((r) => r.data);
  }

  /**
   * Starts a test. Returns one test, or two for a tracking comparison (`tracking:
   * "compare"`). Tests past the free allowance are charged up to `max_usd`. Requires
   * `SEND_CAMPAIGNS`.
   * @example
   * const tests = await warmbly.placement.createTest({ sender_account_id: "acc_1", campaign_id });
   */
  createTest(params: CreatePlacementTestParams, opts?: RequestOptions): Promise<PlacementTest[]> {
    return this.http
      .post<{ data: PlacementTest[] }>("placement/tests", { ...opts, body: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Stops the copies of a test that have not been sent yet and returns the test.
   * Requires `SEND_CAMPAIGNS`.
   * @example
   * await warmbly.placement.cancelTest("test_1");
   */
  cancelTest(id: string, opts?: RequestOptions): Promise<PlacementTest> {
    return this.http
      .post<{ data: PlacementTest }>(this.path("placement", "tests", id, "cancel"), opts)
      .then((r) => r.data);
  }

  /**
   * Lists batches, newest first, auto-paginating when iterated. Requires `READ_ANALYTICS`.
   * @example
   * const page = await warmbly.placement.listBatches({ limit: 10 });
   */
  listBatches(
    params?: ListPlacementBatchesParams,
    opts?: RequestOptions,
  ): Promise<Page<PlacementBatch>> {
    return this.http.getPage<PlacementBatch>("placement/batches", {
      ...opts,
      query: { ...opts?.query, ...params },
    });
  }

  /**
   * Retrieves one batch with its placement overall and grouped by sending domain,
   * sending provider and recipient provider. Requires `READ_ANALYTICS`.
   * @example
   * const batch = await warmbly.placement.getBatch("batch_1");
   */
  getBatch(id: string, opts?: RequestOptions): Promise<PlacementBatchDetail> {
    return this.http
      .get<{ data: PlacementBatchDetail }>(this.path("placement", "batches", id), opts)
      .then((r) => r.data);
  }

  /**
   * Lists a batch's senders with where each one's copies landed, worst inbox rate first
   * unless sorted otherwise. Auto-paginates when iterated. Requires `READ_ANALYTICS`.
   * @example
   * const page = await warmbly.placement.batchSenders("batch_1", { status: "failed" });
   */
  batchSenders(
    id: string,
    params?: ListPlacementBatchSendersParams,
    opts?: RequestOptions,
  ): Promise<Page<PlacementBatchSender>> {
    return this.http.getPage<PlacementBatchSender>(
      this.path("placement", "batches", id, "senders"),
      {
        ...opts,
        query: { ...opts?.query, ...params },
      },
    );
  }

  /**
   * Reports how many senders, tests, sends and dollars a batch would come to, without
   * starting anything. Requires `SEND_CAMPAIGNS`.
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
   * Snapshots the senders and queues a batch; the backend starts its senders a few at a
   * time. Requires `SEND_CAMPAIGNS`.
   * @example
   * const batch = await warmbly.placement.createBatch({
   *   sender_scope: { type: "workspace" },
   *   sample: { mode: "per_domain", count: 1 },
   *   campaign_id,
   * });
   */
  createBatch(params: PlacementBatchParams, opts?: RequestOptions): Promise<PlacementBatch> {
    return this.http
      .post<{ data: PlacementBatch }>("placement/batches", { ...opts, body: params })
      .then((r) => r.data);
  }

  /**
   * Stops a batch. Copies already sent keep being classified. Requires `SEND_CAMPAIGNS`.
   * @example
   * await warmbly.placement.cancelBatch("batch_1");
   */
  cancelBatch(id: string, opts?: RequestOptions): Promise<PlacementBatch> {
    return this.http
      .post<{ data: PlacementBatch }>(this.path("placement", "batches", id, "cancel"), opts)
      .then((r) => r.data);
  }

  /**
   * Reports how much of the connected fleet delivered a placement test in the last 7
   * and 30 days. Requires `READ_ANALYTICS`.
   * @example
   * const { mailboxes, never_tested } = await warmbly.placement.coverage();
   */
  coverage(opts?: RequestOptions): Promise<PlacementCoverage> {
    return this.http
      .get<{ data: PlacementCoverage }>("placement/coverage", opts)
      .then((r) => r.data);
  }

  /**
   * Lists the workspace's mailboxes and which are its seed inboxes. Requires
   * `READ_EMAILS`. A key limited to some mailboxes sees only those.
   * @example
   * const seeds = await warmbly.placement.listSeeds();
   */
  listSeeds(opts?: RequestOptions): Promise<PlacementSeed[]> {
    return this.http
      .get<{ data: PlacementSeed[] }>("placement/seeds", opts)
      .then((r) => r.data ?? []);
  }

  /**
   * Makes a workspace mailbox a seed inbox, or not, and returns it. Requires
   * `WRITE_EMAILS` and access to that mailbox.
   * @example
   * await warmbly.placement.setSeed("acc_1", true);
   */
  setSeed(emailAccountId: string, seed: boolean, opts?: RequestOptions): Promise<PlacementSeed> {
    return this.http
      .put<{ data: PlacementSeed }>(this.path("placement", "seeds", emailAccountId), {
        ...opts,
        body: { seed },
      })
      .then((r) => r.data);
  }
}
