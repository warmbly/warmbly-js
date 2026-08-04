/**
 * The Advisor: continuous checks on your workspace's sending posture, and the fixes
 * for them. Reading needs READ_ANALYTICS; applying a fix needs whatever permission the
 * underlying change needs, so a read-only key can see advice but not act on it.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/advisor.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// 1. The health score and per-surface counts — what the nav badges are built from.
const summary = await warmbly.advisor.summary();
console.log("health score", summary.score, "of 100");
console.log("open findings", summary.total, `(${summary.critical} critical)`);
for (const surface of summary.surfaces ?? []) {
  console.log(`  ${surface.surface}: ${surface.total} (${surface.critical} critical)`);
}

// 2. List the open recommendations. Reads may kick off a background refresh when the
//    workspace's findings are stale, so this stays current without polling.
const findings = await warmbly.advisor.recommendations({ status: "open", limit: 50 });
for (const finding of findings) {
  console.log(`[${finding.severity}] ${finding.title} — ${finding.remedy}`);
  // A finding points at the thing it is about, so you can render it inline.
  if (finding.entity_label) console.log("  about:", finding.entity_type, finding.entity_label);
}

const finding = findings[0];
if (finding) {
  // 3. A finding with an `action` can be fixed in place. The preview tells you exactly
  //    what would change before you commit to it.
  for (const change of finding.action?.preview ?? []) {
    console.log(`  ${change.field}: ${change.from} -> ${change.to}`);
  }

  if (finding.action) {
    // Applying twice is a no-op that returns the first outcome, so a retried request
    // is safe without an Idempotency-Key.
    const applied = await warmbly.advisor.apply(finding.id);
    console.log("applied:", applied.status, applied.applied_result);

    // Changed your mind? Undo reverts it.
    await warmbly.advisor.undo(finding.id);
    console.log("undone");
  }

  // 4. Or tell the Advisor to stop suggesting it. A snooze is 1-90 days; an unbounded
  //    snooze is a dismissal in disguise, so use dismiss for that. A dismissal sticks
  //    until the condition clears and later recurs.
  await warmbly.advisor.snooze(finding.id, { days: 14 });
  await warmbly.advisor.dismiss(finding.id, { reason: "intentional for this workspace" });

  // 5. Feedback trains what gets surfaced.
  await warmbly.advisor.feedback(finding.id, { helpful: true });
}

// 6. Force an evaluation now — useful right after you fix something by hand and want
//    to watch it clear. The Advisor keeps itself current otherwise.
const refreshed = await warmbly.advisor.refresh();
console.log("score after refresh", refreshed.score);

// 7. Which checks are enabled for the workspace. Changing them is workspace governance
//    and is JWT-only: no API scope can silence a check for everyone.
console.log("settings", await warmbly.advisor.settings());
