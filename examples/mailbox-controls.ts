/**
 * Mailbox controls beyond warmup: the workspace allowance, the custom tracking domain,
 * recording a domain authentication check, holding a mailbox out of rotation, the human
 * sending behaviour profile, and inbound sync state.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/mailbox-controls.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Read the allowance before connecting anything: every connect path refuses with
//    mailbox_allowance_reached once remaining is 0.
const allowance = await warmbly.emails.allowance();
console.log(`${allowance.used} of ${allowance.allowance ?? "unlimited"} mailboxes (${allowance.basis})`);

const page = await warmbly.emails.list({ limit: 1 });
const mailbox = page.data[0];
if (!mailbox) {
  console.log("no mailboxes; nothing to do");
} else {
  // 2. The custom tracking domain: read the CNAME target, set the domain, then re-verify
  //    once DNS has propagated. Only a verified domain is used at send time.
  const current = await warmbly.emails.getTrackingDomain(mailbox.id);
  console.log("point a CNAME at", current.cname_target, "status:", current.status);
  const set = await warmbly.emails.track(mailbox.id, { domain: "t.acme.com" });
  console.log(set.message);
  const verified = await warmbly.emails.verifyTrackingDomain(mailbox.id);
  console.log("tracking domain", verified.status, verified.observed ?? "");

  // 3. Domain authentication. GET reports, POST records the verdict on every mailbox of
  //    the domain, which is what lifts the send gate after a DNS fix.
  const check = await warmbly.emails.recordAuthCheck(mailbox.id);
  console.log(check.summary, check.dmarc_inherited ? `(DMARC from ${check.dmarc_domain})` : "");

  // 4. Hold the mailbox out of campaign sending (warmup keeps running), then release it.
  const held = await warmbly.emails.hold(mailbox.id);
  console.log("state", held.state, held.reason);
  const released = await warmbly.emails.release(mailbox.id);
  console.log("state", released.state);

  // 5. Human sending behaviour: the ranges the workday is rolled from, and today's plan.
  const behaviour = await warmbly.emails.updateBehavior(mailbox.id, {
    enabled: true,
    daily_limit_min: 30,
    daily_limit_max: 45,
    lunch_enabled: true,
  });
  console.log("behaviour", behaviour.daily_limit_min, "-", behaviour.daily_limit_max, "per day");
  const plan = await warmbly.emails.behaviorPlan(mailbox.id);
  console.log("today", plan.sent_today, "sent,", plan.remaining_today, "left");

  // 6. Inbound sync: backfill progress and whether fair use is holding the mailbox.
  const sync = await warmbly.emails.sync(mailbox.id);
  console.log("backfill", sync.state?.backfill_status ?? "not reported", "throttled until", sync.state?.throttled_until ?? "never");

  // 7. SMTP/IMAP mailboxes can opt out of filing a copy in Sent.
  await warmbly.emails.update(mailbox.id, { save_to_sent: false, timezone: "America/Denver" });
}
