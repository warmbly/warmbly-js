import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A connected sending mailbox (email account). Documented-but-open shape. */
export interface EmailAccount {
  id: string;
  email?: string;
  provider?: string;
  status?: string;
  warmup_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Query params for listing mailboxes. */
export interface ListEmailsParams {
  cursor?: string;
  limit?: number;
  /** Full-text search across the mailbox address and label. */
  q?: string;
  /** Filter to mailboxes carrying this tag. */
  tag?: string;
  [key: string]: unknown;
}

/** Body for sending a one-off email. The platform requires `body_html` and/or `body_plain`. */
export interface SendEmailParams {
  /** One or more recipient addresses. */
  to: string[];
  subject?: string;
  /** HTML body. Provide this and/or `body_plain`. */
  body_html?: string;
  /** Plain-text body. Provide this and/or `body_html`. */
  body_plain?: string;
  [key: string]: unknown;
}

/** Query params for updating a mailbox's tracking domain. */
export interface TrackParams {
  /** The custom tracking domain to apply (sent as the `domain` query parameter). */
  domain: string;
  [key: string]: unknown;
}

/**
 * Warmup actions accepted by {@link Emails.warmup}: start, pause, resume, stop, appeal.
 */
export type WarmupAction = "start" | "pause" | "resume" | "stop" | "appeal";

/**
 * Manage connected mailboxes: list, inspect, update, verify, warmup control, and sending.
 * Reachable as `warmbly.emails`.
 *
 * @example
 * for await (const mb of await warmbly.emails.list()) console.log(mb.email);
 * await warmbly.emails.warmup("mb_1", "start");
 */
export class Emails extends APIResource {
  /**
   * Lists mailboxes, auto-paginating when iterated.
   * @example
   * const page = await warmbly.emails.list({ status: "connected" });
   */
  list(params?: ListEmailsParams): Promise<Page<EmailAccount>> {
    return this.http.getPage<EmailAccount>("emails", { query: params });
  }

  /**
   * Retrieves a mailbox by id.
   * @example
   * const mb = await warmbly.emails.get("mb_1");
   */
  get(id: string, opts?: RequestOptions): Promise<EmailAccount> {
    return this.http.get<EmailAccount>(this.path("emails", id), opts);
  }

  /**
   * Updates a mailbox.
   * @example
   * await warmbly.emails.update("mb_1", { daily_send_limit: 40 });
   */
  update(id: string, params: Record<string, unknown>): Promise<EmailAccount> {
    return this.http.patch<EmailAccount>(this.path("emails", id), { body: params });
  }

  /**
   * Disconnects/deletes a mailbox.
   * @example
   * await warmbly.emails.delete("mb_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("emails", id), opts);
  }

  /**
   * Sets a mailbox's custom open/click tracking domain. The domain is sent as the
   * `domain` query parameter (the platform reads it from the query string, not the body).
   * @example
   * await warmbly.emails.track("mb_1", { domain: "track.warmbly.com" });
   */
  track(id: string, params: TrackParams): Promise<EmailAccount> {
    return this.http.patch<EmailAccount>(this.path("emails", id, "track"), { query: params });
  }

  /**
   * Verifies one or more mailbox addresses.
   * @example
   * const result = await warmbly.emails.verify({ emails: ["team@warmbly.com"] });
   */
  verify(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>("emails/verify", { body: params });
  }

  /**
   * Runs an auth/deliverability check on a mailbox.
   * @example
   * const check = await warmbly.emails.authCheck("mb_1");
   */
  authCheck(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(this.path("emails", id, "auth-check"), opts);
  }

  /**
   * Returns the warmup ban status for a mailbox.
   * @example
   * const status = await warmbly.emails.warmupBanStatus("mb_1");
   */
  warmupBanStatus(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      this.path("emails", id, "warmup", "ban-status"),
      opts,
    );
  }

  /**
   * Controls a mailbox's warmup: start, pause, resume, stop, or appeal a ban.
   * @example
   * await warmbly.emails.warmup("mb_1", "pause");
   */
  warmup(
    id: string,
    action: WarmupAction,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("emails", id, "warmup", action), {
      body: params,
    });
  }

  /**
   * Sends a one-off email from a mailbox. Provide `body_html` and/or `body_plain`.
   * @example
   * await warmbly.emails.send("mb_1", {
   *   to: ["team@warmbly.com"],
   *   subject: "Hi",
   *   body_html: "<p>Hello from Warmbly</p>",
   * });
   */
  send(id: string, params: SendEmailParams): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("emails", id, "send"), {
      body: params,
    });
  }
}
