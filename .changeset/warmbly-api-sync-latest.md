---
"warmbly": minor
---

Cover the platform API surface added since the last sync. Every addition was verified against
the backend route table and handlers, so the SDK now reaches the whole API-key-accepted surface.

New namespaces:

- **`warmbly.advisor`**: the Advisor's recommendations, health summary, and settings, plus
  `apply`/`undo`/`snooze`/`dismiss`/`feedback`. Reads need `READ_ANALYTICS`; applying a fix
  carries no scope of its own and is refused unless the credential could make the change directly.
- **`warmbly.generation`**: `write`, `edit`, and `aiVariable`. Each reports the real settled
  cost (`credits_charged`, `tokens_used`, `model`) instead of a flat label.
- **`warmbly.aiSkills`**: the organization playbooks every AI surface follows (`AI_AGENT` scope).
- **`warmbly.automations`**: the visual flow builder — CRUD, `setLayout`, `test`, and `runs`.
- **`warmbly.meetings`**: booked calls from Calendly and Cal.com, plus manually logged ones.
- **`warmbly.leadSync`**: on-demand Google Sheets to contacts sync, with sources and `syncNow`.

New methods on existing namespaces:

- **unibox**: `compose`, `composeCandidates`, `composeDraft`, `replyDraft`, the autosaved
  `listDrafts`/`saveDraft`/`deleteDraft`, and the inbox agent's `agentDrafts`/`approveAgentDraft`/
  `discardAgentDraft`. `list` accepts the new `address` and `direction` filters.
- **contacts**: `customFields`, plus `research`, `listResearch`, and `researchBatch` (`AI_RESEARCH`).
- **campaigns**: `overview`, `setStepLayout`, and `verifyTrackingDomain`.
- **emails**: `bulkTag`, which retags up to 1000 mailboxes in one idempotent call.
- **misc**: `me` (caller identity for any credential), `ingestDeliverabilityEvent`, `deadLetters`,
  and `replayDeadLetter`.
- **oauth**: `OAuthClient.register` for RFC 7591 dynamic client registration. It is static because
  the caller has no credentials yet, and it deliberately does not retry, so a transient failure
  cannot double-register a client.

Catalog updates:

- **permissions**: added the `AI_AGENT` and `AI_RESEARCH` scopes. `full_access` now includes them.
- **gateway**: added the `AI_DRAFT_READY`, `AI_RESEARCH_PROGRESS`, `BILLING_CREDITS_LOW`, and
  `BILLING_CREDITS_CHANGED` events with typed payloads, and the `AI`, `RESEARCH`, and `BILLING` intents.
- **webhooks**: exported `WEBHOOK_EVENTS` (the full event catalog as a typed union) and
  `WEBHOOK_FIREHOSE_EVENTS` (the opt-in-only high-volume events).
