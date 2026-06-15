/**
 * The unified inbox: list conversations, read counts and overview, open a thread,
 * set labels, mark seen, reply, snooze/unsnooze, and manage scheduled sends.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/unibox.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. List inbox conversations. list() returns a Page; here we read the first page.
const page = await warmbly.unibox.list({ status: "unread", limit: 25 });
console.log("conversations on this page", page.data.length);

// 2. Counts (for example, unread totals) and a higher-level overview summary.
const counts = await warmbly.unibox.count();
console.log("counts", counts);
const overview = await warmbly.unibox.overview();
console.log("overview", overview);

const firstItem = page.data[0];
if (!firstItem) {
  console.log("inbox empty; nothing to act on");
} else {
  // Conversations carry both their own id and the thread_id they belong to.
  const conversationId = firstItem.id;
  const threadId = firstItem.thread_id;

  // 3. Open the full thread by thread_id.
  const thread = await warmbly.unibox.thread({ thread_id: threadId });
  console.log("thread", thread);

  // 4. Replace the labels on the thread (and read them back).
  await warmbly.unibox.setThreadLabels({ thread_id: threadId, labels: ["lead", "warm"] });
  const labels = await warmbly.unibox.getThreadLabels({ thread_id: threadId });
  console.log("labels now", labels);

  // 5. Mark the conversation as seen.
  await warmbly.unibox.markSeen({ ids: [conversationId], seen: true });
  console.log("marked seen");

  // 6. Reply within the thread.
  await warmbly.unibox.reply({ thread_id: threadId, body: "Thanks for getting back to me!" });
  console.log("reply sent");

  // 7. Snooze the conversation until a time, then unsnooze it.
  await warmbly.unibox.snooze({ thread_id: threadId, until: "2026-07-01T09:00:00Z" });
  console.log("snoozed");
  await warmbly.unibox.unsnooze({ thread_id: threadId });
  console.log("unsnoozed");
}

// 8. List scheduled (queued) sends, and cancel the first one by its task id.
const scheduled = await warmbly.unibox.scheduled();
console.log("scheduled sends", scheduled);
const tasks = (scheduled.tasks ?? []) as Array<{ task_id: string }>;
if (tasks[0]) {
  await warmbly.unibox.cancelScheduled(tasks[0].task_id);
  console.log("cancelled scheduled send", tasks[0].task_id);
}
