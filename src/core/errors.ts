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

/** Options used to construct a {@link WarmblyAPIError}. */
export interface WarmblyAPIErrorOptions {
  status: number;
  code?: string | undefined;
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
  /** Stable machine-readable error code, when provided. */
  readonly code: string | undefined;
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
      const retryAfter = retryAfterSeconds(headers) ?? parsed.retry_after;
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
