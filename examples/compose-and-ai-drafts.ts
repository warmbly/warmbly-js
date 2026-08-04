/**
 * Composing a brand-new email, AI drafting, autosaved drafts, and the inbox agent's
 * review queue. Drafting never sends — you decide what to do with the text.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/compose-and-ai-drafts.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

const recipient = "jordan@acme.com";

// 1. Score every active mailbox for this recipient before choosing one. The score
//    folds in conversation history, remaining daily budget, and domain-auth health.
const candidates = await warmbly.unibox.composeCandidates({ to: recipient });
for (const account of candidates.accounts) {
  console.log(account.email, account.score, account.remaining_today, account.reasons);
}
console.log("recommended", candidates.recommended_account_id, candidates.recommended_reason);

// A recipient who bounced, complained, or unsubscribed is suppressed org-wide.
// Compose would reject the send with a 400, so check before spending a draft on it.
if (candidates.suppression) {
  console.log("suppressed, not sending:", candidates.suppression.reason);
} else {
  // 2. Draft with AI. The draft is grounded in the contact record, your prior
  //    correspondence with the address, and the workspace voice profile. When the
  //    purpose is genuinely unknowable it asks a question instead of inventing a pitch.
  const draft = await warmbly.unibox.composeDraft({
    to: recipient,
    subject: "Quick question about your onboarding",
  });
  console.log("grounded in", draft.grounding);
  console.log("cost", draft.credits_charged, "credits on", draft.model);

  if (draft.question) {
    console.log("the model needs an answer first:", draft.question);
  } else {
    // 3. Autosave a working copy. The id is yours to generate, which makes the PUT
    //    idempotent — safe for a debounced autosave and safe to retry.
    const draftId = `draft-${recipient}`;
    await warmbly.unibox.saveDraft(draftId, {
      to: [recipient],
      subject: "Quick question about your onboarding",
      body: draft.text ?? "",
    });
    console.log("autosaved", (await warmbly.unibox.listDrafts()).length, "draft(s)");

    // 4. Send it. Omitting email_account_id lets the platform pick the best mailbox
    //    and tell you why; pass from_tag_id to keep the auto pick inside one tag.
    const sent = await warmbly.unibox.compose({
      to: [recipient],
      subject: "Quick question about your onboarding",
      body_plain: draft.text ?? "",
    });
    console.log("sent from", sent.account_email, "because:", sent.picked_reason);

    // The send is queued behind your undo-send window, so it is still cancellable.
    if (sent.task_id) console.log("cancel within the window:", sent.task_id);

    // 5. Discard the working copy now that it has been sent.
    await warmbly.unibox.deleteDraft(draftId);
  }
}

// 6. Review what the inbox agent drafted on inbound human replies. The agent never
//    sends: approving is the only path that transmits, and it claims the draft first
//    so two approvals cannot double-send.
const pending = await warmbly.unibox.agentDrafts();
console.log("agent drafts awaiting review", pending.length);

const first = pending[0];
if (first) {
  // Approve as-is, approve with an edit, or discard.
  await warmbly.unibox.approveAgentDraft(first.id, {
    body: `${first.body ?? ""}\n\nPS: happy to send over a calendar link.`,
  });
  console.log("approved and sent", first.id);
}
if (pending[1]) {
  await warmbly.unibox.discardAgentDraft(pending[1].id);
  console.log("discarded", pending[1].id);
}

// 7. Reply drafting works the same way on an existing thread.
const inbox = await warmbly.unibox.list({ status: "unread", limit: 1 });
const thread = inbox.data[0];
if (thread) {
  const threadId = thread.thread_id ?? thread.id;
  const reply = await warmbly.unibox.replyDraft({
    thread_id: threadId,
    instruction: "decline politely and suggest revisiting next quarter",
  });
  if (reply.text) {
    await warmbly.unibox.reply({ thread_id: threadId, body: reply.text });
    console.log("replied using the draft");
  }
}

// 8. The unibox list can be filtered by address (either side of the exchange) and by
//    direction, which is how you build a real Sent view or a per-contact history.
const withJordan = await warmbly.unibox.list({ address: recipient });
const sentOnly = await warmbly.unibox.list({ direction: "sent", limit: 25 });
console.log("conversations with", recipient, withJordan.data.length);
console.log("sent messages on this page", sentOnly.data.length);
