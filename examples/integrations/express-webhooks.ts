/**
 * Express webhook receiver gated by Warmbly signature verification.
 *
 * The critical detail is that signature verification must run over the EXACT
 * raw request bytes. Express's default json() parser would consume and reparse
 * the body, breaking the HMAC. So we mount express.raw() only on the webhook
 * route to keep the untouched buffer available as req.body.
 *
 * This file is illustrative and is NOT typechecked. It imports express.
 *
 * Run with:
 *   npm install express warmbly
 *   WARMBLY_WEBHOOK_SECRET=whsec_... npx tsx examples/integrations/express-webhooks.ts
 */
import express from "express";
import { verifyWebhookSignature } from "warmbly";

const app = express();
const PORT = process.env.PORT ?? 3000;
const SECRET = process.env.WARMBLY_WEBHOOK_SECRET ?? "";

// Mount express.raw() ONLY for this route so req.body is the untouched Buffer.
// Use a wide type so any content type Warmbly sends still arrives as raw bytes.
app.post(
  "/webhooks/warmbly",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    // The signature header carries "t=<unix>,v1=<hex>".
    const signature = req.header("x-warmbly-signature") ?? "";

    // req.body is a Buffer here. verifyWebhookSignature accepts a Uint8Array
    // (a Buffer is one) or a string, so pass the raw bytes directly.
    const ok = await verifyWebhookSignature({
      payload: req.body,
      header: signature,
      secret: SECRET,
    });

    // Reject unverified deliveries before doing anything with the payload.
    if (!ok) {
      return res.status(400).send("invalid signature");
    }

    // Now it is safe to parse. The raw Buffer is valid UTF-8 JSON.
    const event = JSON.parse(req.body.toString("utf8"));
    console.log("received", event.event_type, "seq", event.seq);

    // Acknowledge quickly; queue any slow processing for a worker.
    res.status(200).send("ok");
  },
);

// Other routes can use the normal JSON body parser without affecting webhooks.
app.use(express.json());

app.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}/webhooks/warmbly`);
});
