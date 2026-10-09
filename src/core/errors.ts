import type { ApiErrorBody } from "./types";

/**
 * Base class for every error thrown by the SDK.
 *
 * @example
 * try {
 *   await warmbly.campaigns.get("missing");
 * } catch (err) {
 *   if (err instanceof WarmblyError) console.error(err.message);
 * }
 */
export class WarmblyError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "WarmblyError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    // Restore the prototype chain when targeting ES5-ish downlevel output.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The stable, machine-readable `code` values the API documents, for branching on
 * {@link WarmblyAPIError.code}. Open-ended: codes added after this release still type-check.
 *
 * @example
 * if (err instanceof WarmblyAPIError && err.code === "list_bounce_risk") {
 *   await warmbly.campaigns.start(id, { acknowledge_list_risk: true });
 * }
 */
export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unprocessable"
  | "rate_limited"
  | "internal_error"
  | "no_organization"
  | "insufficient_credits"
  | "storage_limit_reached"
  | "mailbox_allowance_reached"
  | "mailbox_provider_not_configured"
  | "mailbox_worker_unreachable"
  | "list_bounce_risk"
  | "leads_undeliverable"
  | "lead_filter_requires_campaign"
  | "invalid_lead_status"
  | "invalid_engagement"
  | "unknown_verification_status"
  | "unknown_verification_provider"
  | "invalid_action"
  | "no_contacts"
  | "registration_invite_only"
  | "registration_closed"
  | "invitation_invalid"
  | "setup_already_complete"
  | "setup_token_invalid"
  | "sso_wrong_browser"
  // Inbox placement tests and batches.
  | "placement_batch_empty"
  | "placement_batch_not_running"
  | "placement_batch_too_large"
  | "placement_daily_budget"
  | "placement_invalid_seeds"
  | "placement_invalid_tracking"
  | "placement_no_seeds"
  | "placement_not_entitled"
  | "placement_not_running"
  | "placement_panel_unavailable"
  | "placement_quota_exceeded"
  | "placement_seed_limit"
  | "placement_seed_unavailable"
  | "placement_sender_busy"
  | "placement_sender_unavailable"
  | "placement_too_many_batches"
  | "placement_too_many_running"
  // Added in later server releases: mailbox imports and vendor/grant onboarding, domain redirects,
  // bulk selections, lead CC, re-authentication, Slack, and validation.
  | "admin_mfa_required"
  | "app_password_invalid"
  | "contact_email_taken"
  | "domain_redirect_cloud_unavailable"
  | "domain_redirect_cloud_unreachable"
  | "domain_redirect_invalid_target"
  | "domain_redirect_limit"
  | "domain_redirect_linked"
  | "domain_redirect_taken"
  | "empty_step_body"
  | "google_delegation_unauthorized"
  | "invalid_cursor"
  | "invalid_filter"
  | "invalid_layout"
  | "invalid_mail_host"
  | "invalid_name"
  | "invalid_setting"
  | "invalid_slug"
  | "invalid_sort_by"
  | "invalid_sync_folder"
  | "lead_cc_contact_not_found"
  | "lead_cc_has_copies"
  | "lead_cc_lead_is_copied"
  | "lead_cc_limit"
  | "lead_cc_self"
  | "mailbox_cloud_unenroll_failed"
  | "mailbox_grant_domain_mismatch"
  | "mailbox_grant_inactive"
  | "mailbox_grant_mailbox_unreachable"
  | "mailbox_grant_not_configured"
  | "mailbox_grant_proof_missing"
  | "mailbox_grant_state_invalid"
  | "mailbox_grant_unavailable"
  | "mailbox_import_credentials_expired"
  | "mailbox_import_empty"
  | "mailbox_import_no_email_column"
  | "mailbox_import_nothing_to_retry"
  | "mailbox_import_row_incomplete"
  | "mailbox_import_row_not_failed"
  | "mailbox_import_too_large"
  | "mailbox_is_seed"
  | "mailbox_not_google_signin"
  | "mailbox_reauth_delegated"
  | "mailbox_vendor_domain_not_found"
  | "mailbox_vendor_domain_unsupported"
  | "mailbox_vendor_invalid_fields"
  | "mailbox_vendor_no_workspace"
  | "mailbox_vendor_rate_limited"
  | "mailbox_vendor_unauthorized"
  | "mailbox_vendor_unavailable"
  | "mailbox_vendor_unknown"
  | "microsoft_consent_missing"
  | "passkey_user_verification_required"
  | "password_breached"
  | "password_changed_sign_in_again"
  | "pool_link_cleartext_mailbox"
  | "pool_link_redirect_not_found"
  | "reauth_no_factor"
  | "reauth_required"
  | "selection_too_large"
  | "sending_domain_bulk_invalid"
  | "sending_domain_not_in_workspace"
  | "sending_domain_shared_provider"
  | "slack_link_invalid"
  | "slack_not_connected"
  | "slack_not_linked"
  | "sso_link_expired"
  | "too_many_contacts"
  | "too_many_tasks"
  | "tracking_host_not_configured"
  | "two_fa_invalid_code"
  | "unknown_view"
  // CRM provider mode (HubSpot, Pipedrive), the native Salesforce sync, the community app
  // directory and OAuth apps, credential bounds, and send validation.
  | "action_provider_mismatch"
  | "api_key_holder_left"
  | "api_key_mailbox_limited"
  | "api_key_permissions_exceed_caller"
  | "app_not_listable"
  | "app_suspended"
  | "crm_contact_missing"
  | "crm_managed_externally"
  | "crm_not_connected"
  | "crm_owner_unmapped"
  | "crm_provider_rejected"
  | "crm_reauth_required"
  | "crm_record_missing"
  | "crm_stage_unknown"
  | "crm_sync_running"
  | "crm_unavailable"
  | "developer_access_blocked"
  | "import_running"
  | "invalid_listing"
  | "invalid_logo"
  | "invalid_message_id"
  | "invalid_recipient"
  | "invalid_salesforce_domain"
  | "invalid_salesforce_settings"
  | "invalid_website"
  | "listing_hidden"
  | "listing_slug_taken"
  | "oauth_token_not_allowed"
  | "reauth_limited"
  | "salesforce_error"
  | "salesforce_rate_limited"
  | "salesforce_reconnect_required"
  | "salesforce_sync_off"
  | "salesforce_unreachable"
  | "tracking_domain_taken"
  | (string & {});

/** Options used to construct a {@link WarmblyAPIError}. */
export interface WarmblyAPIErrorOptions {
  status: number;
  code?: ErrorCode | undefined;
  requestId?: string | undefined;
  body?: unknown;
  headers?: Headers | undefined;
}

/**
 * Thrown when the API returns a non-2xx response. Subclasses map to specific status codes.
 *
 * @example
 * try {
 *   await warmbly.contacts.add([{ email: "x" }]);
 * } catch (err) {
 *   if (err instanceof WarmblyAPIError) {
 *     console.error(err.status, err.code, err.requestId);
 *   }
 * }
 */
export class WarmblyAPIError extends WarmblyError {
  /** HTTP status code. */
  readonly status: number;
  /** Stable machine-readable error code, when provided. See {@link ErrorCode}. */
  readonly code: ErrorCode | undefined;
  /** Request id, useful when contacting support. */
  readonly requestId: string | undefined;
  /** The parsed response body, when available. */
  readonly body: unknown;
  /** The response headers, when available. */
  readonly headers: Headers | undefined;

  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message);
    this.name = "WarmblyAPIError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.body = options.body;
    this.headers = options.headers;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Builds the most specific error subclass for an HTTP status. */
  static from(
    status: number,
    body: unknown,
    headers?: Headers,
    requestId?: string,
  ): WarmblyAPIError {
    const parsed = (body && typeof body === "object" ? body : {}) as ApiErrorBody;
    const message = parsed.message || parsed.error || `Warmbly API error (HTTP ${status})`;
    const rid = requestId ?? parsed.request_id;
    const options: WarmblyAPIErrorOptions = {
      status,
      code: parsed.code,
      requestId: rid,
      body,
      headers,
    };

    if (status === 400) return new BadRequestError(message, options);
    if (status === 401) return new AuthenticationError(message, options);
    if (status === 403) return new PermissionDeniedError(message, options);
    if (status === 404) return new NotFoundError(message, options);
    if (status === 409) return new ConflictError(message, options);
    if (status === 422) return new UnprocessableEntityError(message, options);
    if (status === 429) {
      // The Retry-After header (seconds) is authoritative; fall back to the body,
      // which carries milliseconds (`retry_after_ms`) or a legacy seconds field.
      const bodyRetryAfter =
        parsed.retry_after_ms !== undefined
          ? Math.ceil(parsed.retry_after_ms / 1000)
          : parsed.retry_after;
      const retryAfter = retryAfterSeconds(headers) ?? bodyRetryAfter;
      return new RateLimitError(message, { ...options, retryAfter });
    }
    if (status >= 500) return new InternalServerError(message, options);
    return new WarmblyAPIError(message, options);
  }
}

/** 400 Bad Request: malformed request or invalid parameters. */
export class BadRequestError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "BadRequestError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 Unauthorized: missing, invalid, expired, or revoked credential. */
export class AuthenticationError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 403 Forbidden: the credential lacks the required scope, or the IP/account is not allowed. */
export class PermissionDeniedError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "PermissionDeniedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 404 Not Found: the resource does not exist or is not visible to the caller. */
export class NotFoundError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 409 Conflict: a uniqueness or idempotency-key conflict. */
export class ConflictError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "ConflictError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 422 Unprocessable Entity: the request was well-formed but failed validation. */
export class UnprocessableEntityError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "UnprocessableEntityError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 429 Too Many Requests: the rate limit was exceeded. */
export class RateLimitError extends WarmblyAPIError {
  /** Seconds to wait before retrying, parsed from `Retry-After` or the body. */
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    options: WarmblyAPIErrorOptions & { retryAfter?: number | undefined },
  ) {
    super(message, options);
    this.name = "RateLimitError";
    this.retryAfter = options.retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 5xx: an unexpected server-side error. */
export class InternalServerError extends WarmblyAPIError {
  constructor(message: string, options: WarmblyAPIErrorOptions) {
    super(message, options);
    this.name = "InternalServerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown on a network failure, timeout, or abort, when no HTTP response was received. */
export class WarmblyConnectionError extends WarmblyError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WarmblyConnectionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown by the OAuth endpoints, mirroring the `{ error, error_description }` body. */
export class OAuthError extends WarmblyError {
  /** The OAuth error code, e.g. `"invalid_grant"`. */
  readonly error: string;
  /** Human-readable description, when provided. */
  readonly errorDescription: string | undefined;
  /** HTTP status of the token/revoke response, when available. */
  readonly status: number | undefined;

  constructor(
    error: string,
    options?: { description?: string | undefined; status?: number | undefined; cause?: unknown },
  ) {
    super(options?.description ? `${error}: ${options.description}` : error, {
      cause: options?.cause,
    });
    this.name = "OAuthError";
    this.error = error;
    this.errorDescription = options?.description;
    this.status = options?.status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown by the realtime gateway on a connect-level or post-join rejection. */
export class GatewayError extends WarmblyError {
  /** The gateway close/reason code (e.g. 4004), when known. */
  readonly code: number | undefined;
  /** The server-provided reason, when known. */
  readonly reason: string | undefined;

  constructor(
    message: string,
    options?: { code?: number | undefined; reason?: string | undefined; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "GatewayError";
    this.code = options?.code;
    this.reason = options?.reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Parses a `Retry-After` header (delta-seconds or HTTP-date) into seconds. */
function retryAfterSeconds(headers?: Headers): number | undefined {
  const value = headers?.get("retry-after");
  if (!value) return undefined;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.round((asDate - Date.now()) / 1000));
  }
  return undefined;
}
