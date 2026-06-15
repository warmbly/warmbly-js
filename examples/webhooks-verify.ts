/**
 * Framework-agnostic webhook signature verification.
 *
 * This shows the smallest possible handler: take the raw request body, the
 * X-Warmbly-Signature header, and the endpoint signing secret, then decide
 * whether to trust the payload. It returns a tiny result object you can map
 * onto any HTTP framework's response. No external imports.
 *
 * Run with: npx tsx examples/webhooks-verify.ts
 */
import { verifyWebhookSignature } from "warmbly";

/** A minimal, transport-neutral HTTP result. */
interface HandlerResult {
  status: 200 | 400;
  body: string;
}

/**
 * Verifies a Warmbly webhook delivery and returns a 200/400 result.
 *
 * Always verify over the EXACT raw bytes you received, before any JSON.parse
 * and re-serialize round-trip, otherwise the recomputed HMAC will not match.
 */
export async function handleWarmblyWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<HandlerResult> {
  // verifyWebhookSignature never throws on a bad/missing header: it returns
  // false. It recomputes HMAC-SHA256 over "<timestamp>.<rawBody>" and compares
  // it in constant time, also rejecting deliveries outside the replay window.
  const ok = await verifyWebhookSignature({
    payload: rawBody,
    header: signatureHeader,
    secret,
  });

  // Reject anything we cannot prove came from Warmbly.
  if (!ok) {
    return { status: 400, body: "invalid signature" };
  }

  // The signature is valid, so the payload is now safe to parse and process.
  const event = JSON.parse(rawBody) as { event_type?: string; seq?: number };
  console.log("verified event", event.event_type, "seq", event.seq);

  // Acknowledge fast; do heavy work asynchronously so deliveries do not time out.
  return { status: 200, body: "ok" };
}

// Tiny smoke run so the file does something when executed directly. These are
// placeholder values, so verification will (correctly) fail and return 400.
const result = await handleWarmblyWebhook(
  '{"event_type":"EMAIL_OPENED","seq":42}',
  "t=1700000000,v1=deadbeef",
  process.env.WARMBLY_WEBHOOK_SECRET ?? "whsec_example",
);
console.log("handler result", result.status, result.body);
