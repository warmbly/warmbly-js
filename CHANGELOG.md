# Changelog

## 0.2.0

### Minor Changes

- ad7ce84: Initial release of the warmbly SDK: a typed REST client, an OAuth2 authorization-code helper with PKCE and token auto-refresh, and a realtime gateway client with typed events, intents, automatic reconnect, and resume. Zero runtime dependencies; runs on Node 18+, Bun, Deno, browsers, and the edge.
- dfe290d: Cover the platform API surface added since the last sync. Every addition was verified against
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

- 648b604: Align the SDK with the live Warmbly platform API and add exhaustive test coverage.

  Compatibility fixes (verified against the platform handlers):

  - **emails**: `track` now sends the tracking domain as the `domain` query parameter; `send` is typed with `to`, `body_html`, and `body_plain`; `list` exposes the real `q` and `tag` filters.
  - **contacts**: notes use the `content` field, and `ContactNote` carries the full response shape.
  - **campaigns**: `createAttachment` uploads as `multipart/form-data` (pass a `Blob`/`File`); `createStep` no longer sends a body (the endpoint creates an empty step).
  - **unibox**: `unsnooze` sends `thread_id` as a query parameter.
  - **analytics**: `warmup`, `campaignDaily`, and `compareCampaigns` require the `from`/`to` window (and `ids`) the API enforces.
  - **templates**: `list` returns a plain array (the endpoint is not paginated).
  - **integrations**: list and detail methods unwrap the platform response envelopes.
  - **webhooks** and **api-keys**: `redeliver` and `revoke` are typed as status acknowledgements.
  - **misc**: removed the folder/tag/category list methods that the API does not expose, use the `title` field, and unwrap the team, warmup-routing, and plan envelopes.
  - **oauth**: application listings unwrap their envelopes, and the dashboard-only authorized-apps methods are documented as JWT-only.
  - **core**: rate-limit bodies map `retry_after_ms`, the `X-RateLimit-Reset` header is recognized, and `multipart/form-data` request bodies are passed through.

  The HTTP client, errors, pagination, OAuth, realtime gateway, permissions, and every REST resource now have full test coverage.

All notable changes to `warmbly` are documented here. This file is maintained by
[Changesets](https://github.com/changesets/changesets): each release appends its entry when the
"Version Packages" pull request is merged.
