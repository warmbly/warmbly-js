/**
 * Error handling and per-request overrides.
 * Shows how to branch on the typed error classes the SDK throws, and how to
 * override retries, timeout, idempotency key, and the abort signal on a single
 * request without changing the client-wide defaults.
 *
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/errors-and-retries.ts
 */
import {
  AuthenticationError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  Warmbly,
  WarmblyAPIError,
  WarmblyConnectionError,
} from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// ---------------------------------------------------------------------------
// Branching on typed errors.
// Every non-2xx response throws a WarmblyAPIError subclass; check the most
// specific classes first, then fall back to the base class. A network failure,
// timeout, or abort (no HTTP response) throws WarmblyConnectionError instead.
// ---------------------------------------------------------------------------
try {
  await warmbly.campaigns.get("does-not-exist");
} catch (err) {
  if (err instanceof AuthenticationError) {
    // 401: the API key or token is missing, invalid, expired, or revoked.
    console.error("auth failed, check your credentials:", err.message);
  } else if (err instanceof PermissionDeniedError) {
    // 403: the credential is valid but lacks the required scope (or the IP is blocked).
    console.error("forbidden, key is missing a required permission:", err.message);
  } else if (err instanceof NotFoundError) {
    // 404: the resource does not exist or is not visible to this caller.
    console.error("not found:", err.message);
  } else if (err instanceof RateLimitError) {
    // 429: rate limited. `retryAfter` is the seconds to wait, parsed from the
    // Retry-After header or the response body (may be undefined).
    console.error("rate limited, retry after", err.retryAfter, "seconds");
  } else if (err instanceof WarmblyAPIError) {
    // Any other non-2xx (400, 409, 422, 5xx, ...). The base class carries the
    // HTTP status, the stable machine code, and the request id for support.
    console.error("api error", err.status, err.code, "request:", err.requestId);
  } else if (err instanceof WarmblyConnectionError) {
    // No HTTP response: DNS failure, connection reset, timeout, or abort.
    console.error("connection problem:", err.message);
  } else {
    // Something unrelated to the SDK; re-throw so it is not swallowed.
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Per-request overrides: maxRetries, timeout, idempotencyKey.
// These override the client-wide defaults for this single call. The idempotency
// key makes the mutation safe to retry: the server replays the stored response
// instead of executing the write twice.
// ---------------------------------------------------------------------------
const added = await warmbly.contacts.add(
  [{ email: "jordan@warmbly.com", first_name: "Jane", company: "Warmbly" }],
  {
    idempotencyKey: "import-jane-2026-06-15", // stable key, so a retry never double-adds
    maxRetries: 5, // retry transient 429/5xx/network failures up to 5 times
    timeout: 10_000, // give up on this request after 10 seconds
  },
);
console.log("added contact batch:", added);

// ---------------------------------------------------------------------------
// Per-request abort via AbortController (the `signal` override).
// Pass a signal to cancel an in-flight request yourself, for example on a user
// action or a deadline. An aborted request throws WarmblyConnectionError.
// ---------------------------------------------------------------------------
const controller = new AbortController();
// Abort automatically after 2 seconds if it has not finished by then.
const cancel = setTimeout(() => controller.abort(), 2_000);
try {
  // Methods that take per-request options (here `get`) accept the signal directly.
  const campaign = await warmbly.campaigns.get("camp_123", { signal: controller.signal });
  console.log("fetched campaign before the deadline:", campaign.id);
} catch (err) {
  if (err instanceof WarmblyConnectionError) {
    console.error("request was aborted or failed:", err.message);
  } else {
    throw err;
  }
} finally {
  clearTimeout(cancel);
}
