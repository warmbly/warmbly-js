/**
 * Mailboxes and warmup: list connected accounts, inspect one, verify an address,
 * run an auth check, drive the warmup state machine, read ban status, and send.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/mailboxes-warmup.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. List connected mailboxes. list() returns a Page; iterate to walk every account.
const page = await warmbly.emails.list({ status: "connected", limit: 25 });
for (const account of page.data) {
  console.log("mailbox", account.id, account.email, "warmup:", account.warmup_enabled);
}

// Pick the first mailbox to operate on (guard since the list may be empty).
const first = page.data[0];
if (!first) {
  console.log("no connected mailboxes; nothing to do");
} else {
  const mailboxId = first.id;

  // 2. Fetch a single mailbox by id.
  const mailbox = await warmbly.emails.get(mailboxId);
  console.log("provider", mailbox.provider, "status", mailbox.status);

  // 3. Verify one or more addresses (deliverability/existence check).
  const verification = await warmbly.emails.verify({ emails: [mailbox.email] });
  console.log("verify result", verification);

  // 4. Run an auth/deliverability check (SPF/DKIM/DMARC etc.) on the mailbox.
  const authCheck = await warmbly.emails.authCheck(mailboxId);
  console.log("auth check", authCheck);

  // 5. Drive the warmup state machine. warmup() takes a typed action:
  //    "start" | "pause" | "resume" | "stop" | "appeal".
  await warmbly.emails.warmup(mailboxId, "start");
  console.log("warmup started");
  await warmbly.emails.warmup(mailboxId, "pause");
  console.log("warmup paused");
  await warmbly.emails.warmup(mailboxId, "resume");
  console.log("warmup resumed");
  await warmbly.emails.warmup(mailboxId, "stop");
  console.log("warmup stopped");

  // 6. Check whether warmup has been banned (and why).
  const banStatus = await warmbly.emails.warmupBanStatus(mailboxId);
  console.log("ban status", banStatus);

  // 7. Send a one-off message from the mailbox.
  await warmbly.emails.send(mailboxId, {
    to: "taylor@warmbly.com",
    subject: "Quick hello",
    body: "Hi there, reaching out from our team.",
  });
  console.log("message sent");
}
