/**
 * Webhook signature verification for Warmbly delivery callbacks.
 *
 * Warmbly signs every webhook delivery with HMAC-SHA256 using the endpoint's
 * `whsec_`-prefixed signing secret. The `X-Warmbly-Signature` header has the form
 * `t=<unix-timestamp>,v1=<hex-digest>`. The signed string is the timestamp, a literal
 * `.`, then the exact raw request body. Verification recomputes the HMAC and compares
 * it against `v1` in constant time, rejecting deliveries whose timestamp is outside a
 * tolerance window. Unknown schemes (anything other than `v1`) are ignored.
 *
 * This is the exact scheme documented at /api/reference/webhooks (Verifying signatures).
 */

/** The default replay tolerance in seconds (5 minutes), matching the Warmbly docs. */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/** Parameters for {@link verifyWebhookSignature}. */
export interface VerifyWebhookSignatureParams {
  /**
   * The raw, unmodified request body bytes (or its UTF-8 string). Always verify over
   * the exact bytes received, before any JSON parse and re-serialize round-trip.
   */
  payload: string | Uint8Array;
  /** The full `X-Warmbly-Signature` header value, e.g. `t=1700000000,v1=abcd...`. */
  header: string;
  /** The endpoint signing secret (`whsec_...`) returned at create or rotate time. */
  secret: string;
  /**
   * Maximum allowed difference, in seconds, between the signature timestamp and now.
   * Defaults to 300 (5 minutes). Never set this to 0; that rejects deliveries that
   * arrive even one second late.
   */
  toleranceSeconds?: number;
}

const encoder = new TextEncoder();

/**
 * Verifies a Warmbly webhook delivery signature.
 *
 * Recomputes `HMAC-SHA256(secret, "<t>." + rawBody)` and compares the hex digest
 * against the `v1` value in the `X-Warmbly-Signature` header using a constant-time
 * comparison. Returns `false` (never throws) when the header is malformed, the scheme
 * is unrecognized, the timestamp is outside the tolerance window, or the digest does
 * not match. Uses `globalThis.crypto.subtle`, so it runs on Node 18+, Bun, Deno,
 * browsers, and edge runtimes without extra dependencies.
 *
 * @example
 * // In an HTTP handler, verify before trusting the payload.
 * const ok = await verifyWebhookSignature({
 *   payload: rawBodyString,
 *   header: req.headers["x-warmbly-signature"],
 *   secret: process.env.WARMBLY_WEBHOOK_SECRET!,
 * });
 * if (!ok) return res.status(400).end();
 *
 * @example
 * // Tighten the replay window to two minutes.
 * const ok = await verifyWebhookSignature({ payload, header, secret, toleranceSeconds: 120 });
 */
export async function verifyWebhookSignature(
  params: VerifyWebhookSignatureParams,
): Promise<boolean> {
  const { payload, header, secret } = params;
  const tolerance = params.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;

  if (!header || !secret) return false;

  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  const { timestamp, signature } = parsed;

  // Reject stale or future-dated deliveries to blunt replay attacks.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) return false;

  const bodyBytes = typeof payload === "string" ? encoder.encode(payload) : payload;
  const expected = await hmacSha256Hex(secret, timestamp, bodyBytes);
  return timingSafeEqual(expected, signature);
}

/** The parsed pieces of an `X-Warmbly-Signature` header. */
interface ParsedSignature {
  timestamp: number;
  signature: string;
}

/** Parses `t=<unix>,v1=<hex>`, ignoring any scheme that is not `v1`. */
function parseSignatureHeader(header: string): ParsedSignature | null {
  let timestamp: number | undefined;
  let signature: string | undefined;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      const parsedTs = Number(value);
      if (Number.isInteger(parsedTs)) timestamp = parsedTs;
    } else if (key === "v1") {
      signature = value;
    }
    // Any other scheme (future v2, etc.) is intentionally ignored.
  }
  if (timestamp === undefined || !signature) return null;
  return { timestamp, signature };
}

/** Computes the hex-encoded HMAC-SHA256 over `"<timestamp>." + body`. */
async function hmacSha256Hex(secret: string, timestamp: number, body: Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prefix = encoder.encode(`${timestamp}.`);
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix, 0);
  signed.set(body, prefix.length);
  const digest = await subtle.sign("HMAC", key, signed);
  return toHex(new Uint8Array(digest));
}

/** Resolves the Web Crypto `subtle` interface, throwing a clear error if absent. */
function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto (globalThis.crypto.subtle) is unavailable. Use Node 18+, Bun, Deno, a browser, or an edge runtime.",
    );
  }
  return subtle;
}

/** Lower-case hex encoding of a byte array. */
function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Constant-time comparison of two ASCII/hex strings. Returns `false` immediately on a
 * length mismatch, otherwise compares every character so the time taken does not leak
 * how many leading characters matched.
 *
 * @example
 * constantTimeEqual("abc", "abc"); // true
 * constantTimeEqual("abc", "abd"); // false
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Internal alias kept for readability at the call site. */
const timingSafeEqual = constantTimeEqual;
