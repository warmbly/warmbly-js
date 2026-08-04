/**
 * AI writing and research: compose copy, rewrite a selection, preview a per-recipient
 * AI variable, research a contact, and steer all of it with organization playbooks.
 * Every call charges credits and reports the real cost, settled against token usage.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/ai-generation.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. Skills are organization playbooks every AI surface reads as extra instructions —
//    the assistant, campaign switches, reply drafts, and compose drafts alike.
const skill = await warmbly.aiSkills.create({
  name: "House style",
  description: "How we write cold email",
  content: "Never open with a compliment. Keep emails under 90 words. No exclamation marks.",
});
console.log("skill", skill.id, skill.enabled);
console.log("active skills", (await warmbly.aiSkills.list()).filter((s) => s.enabled).length);

// 2. Write new copy. The response carries the real cost, not a flat label.
const written = await warmbly.generation.write({
  prompt: "A first-touch email to a VP of Engineering about cutting CI spend",
  tone: "direct",
});
console.log(written.text);
console.log(`cost ${written.credits_charged} credits, ${written.credits_remaining} left`);

// 3. Rewrite one passage under an instruction. The passage is fenced as untrusted
//    content, so any instructions hiding inside it are ignored. Idempotent, and
//    refunded if the provider fails.
const edited = await warmbly.generation.edit({
  text: written.text ?? "",
  instruction: "shorten by a third and drop the closing question",
  tone: "direct",
});
console.log("edited", edited.text);

// 4. Preview a per-recipient AI variable block. "instant" resolves from the contact
//    record; "research" looks the company up, and web_search costs an extra credit
//    only when results actually land.
const contacts = await warmbly.contacts.search({ limit: 1 });
const contact = contacts.data[0];
if (contact) {
  const preview = await warmbly.generation.aiVariable({
    mode: "research",
    prompt: "One specific line about what this company ships",
    contact_id: contact.id,
    web_search: true,
    context_before: "Hi {{first_name}}, ",
    context_after: " — worth a look?",
  });
  console.log("variable renders as", preview.text);

  // 5. Contact research is a separate, dedicated scope (AI_RESEARCH). It charges even
  //    when it finds nothing, and only saves findings it can cite.
  const run = await warmbly.contacts.research(contact.id, {
    objective: "Recent funding, hiring, or product-launch signals",
  });
  console.log("research", run.status, `${run.credits_charged} credits`);
  if (run.result?.nothing_found) {
    console.log("nothing citable found (still billed)");
  }
  for (const signal of run.result?.signals ?? []) {
    console.log(`  [${signal.confidence}] ${signal.fact} — ${signal.url}`);
  }
  for (const hook of run.result?.hooks ?? []) {
    console.log("  opener:", hook.opener_line);
  }

  // Past runs for the contact, newest first.
  console.log("previous runs", (await warmbly.contacts.listResearch(contact.id)).length);

  // 6. Research many contacts at once (up to 500). The batch drains in the background
  //    and reports progress over the AI_RESEARCH_PROGRESS gateway event.
  const { queued } = await warmbly.contacts.researchBatch({
    contact_ids: contacts.data.map((c) => c.id),
    objective: "Recent funding, hiring, or product-launch signals",
  });
  console.log("queued", queued, "research runs");
}

// 7. The custom-field keys actually in use across your contacts, frequency-ranked —
//    what a personalization picker should offer.
console.log("custom fields", await warmbly.contacts.customFields());

// 8. Retire a skill without losing it.
await warmbly.aiSkills.update(skill.id, { enabled: false });
