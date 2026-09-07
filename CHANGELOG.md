# Changelog

## 0.3.0

### Minor Changes

- Cover the platform API surface added since the last sync (platform `50f50e68` through
  `885a7c2a`). Every addition was verified against the backend route table, handlers, and
  reference docs.

  New namespaces:

  - **`warmbly.segments`**: saved contact audiences with live counts. `list`, `fields`,
    `preview`, CRUD, `setMembers`/`memberModes`/`overrides` for manual pins, and
    `addToCampaign` for a one-time snapshot enrolment.
  - **`warmbly.forms`**: hosted lead-capture forms. CRUD, `listSubmissions`/`deleteSubmission`,
    `stats`, `mintLink` (personalized links, idempotent), `uploadAsset`/`deleteAsset`, and the
    custom forms domain (`getDomain`/`setDomain`/`verifyDomain`).
  - **`warmbly.suppressions`**: the workspace suppression list. `list` (paginated), `add`
    (up to 5000 entries, safe to repeat), and `remove`.
  - **`warmbly.agentTools`**: the AI tool registry over plain HTTP for function-calling agents
    without MCP. `list` in the `warmbly`, `openai`, or `hermes` manifest format, and `call`.
  - **`DeviceAuth`**: the device-code sign-in behind `warmbly auth login`. `start`, `poll`, and
    `waitForApproval`, which polls at the server's interval and maps denial, expiry, and an
    already-claimed code to a typed `DeviceAuthError`.

  New methods on existing namespaces:

  - **emails**: `allowance`, `getTrackingDomain`, `verifyTrackingDomain`, `recordAuthCheck`
    (the write-scoped check that lifts the send gate), `hold`/`release`, `sync`, and the sending
    behaviour profile (`getBehavior`, `updateBehavior`, `behaviorPlan`). `track` now returns the
    full `TrackingDomainStatus`; `update` is typed with `save_to_sent` and `timezone`.
  - **campaigns**: `estimate`, `duplicate`, `forms`, `listSegments`, `setSegments`. `start`
    accepts `acknowledge_list_risk`. `Campaign` carries `kind`, `continuous`, and `idle_since`;
    `CampaignAttachment.step_id` is `string | null`, as the API always serialises it.
  - **contacts**: `verification`, `requestVerification`, `campaigns` (per-campaign progress with
    the next action derived on read), and `segments`. Search is typed with `campaign_ids`,
    `lead_status`, `engagement`, `segment_ids`, and `verification_status`; `add` accepts
    `segments`, `subscribed`, and an imported verification verdict. `timeline` takes `cursor`.
  - **apiKeys**: `revokeSelf`, which needs no scope so any credential can end itself.
  - **unibox**: `folder` on list and `markSeen` (batch or whole-folder sweeps); `UniboxItem`
    carries `snippet`, and `body_html`/`body_plain`/`body_truncated` on `get`.
  - **misc**: `authConfig`, the public deployment capabilities including `websocket_url` and
    `app_url` on a self-hosted instance.

  Gateway:

  - Added the `CAMPAIGN_IDLE`, `ACCOUNT_SYNC_STATE`, `PAGE_HIT`, and `FORM_SUBMISSION_CREATED`
    events with typed payloads, the `FORM` and `PAGE` intents, and the engagement fields on
    `EMAIL_OPENED`/`EMAIL_CLICKED` (`occurred_at`, `machine`, `client`, `device_type`,
    `country_code`, `city`, `link_label`).
  - A `phx_join` refused as `rate_limited` is no longer final: the client emits `rateLimited`
    (now typed as `RateLimitedInfo`, with the `topic`), keeps the socket open, and re-sends the
    join once `retry_after_ms` has elapsed. Pending rejoins are dropped on close.
  - Added the `4005` malformed-topic rejection code.

  Coverage gap closed while auditing the route table:

  - **misc**: `moveFolder`, `moveTag`, and `moveCategory`. All three groups have always exposed
    a reorder route (`PATCH /{folders|tags|categories}/:id/move`), and none of them were
    reachable from the SDK. Each returns the whole list's new order.

  Type corrections (the old fields were never on the wire):

  - **`CampaignStep`** dropped `body` and `delay_days` for the fields the API actually returns:
    `name`, `kind`, `body_plain`/`body_html`, `wait_after` (days, not minutes), `x`/`y`, the
    `conditions` branch tree, and the typed `action` config. `updateStep` takes
    `UpdateCampaignStepParams` instead of an untyped record.
  - **`ImportColumnMapping`** documents the `custom` target spelling and the
    `verification_provider` column, and `contacts.importPreview`/`importCommit` take a typed
    `ContactImportParams` carrying `mapping` and `segment_ids`.
  - **`PaginationMeta.total`** is optional. Several list endpoints (the unibox, audit logs,
    campaign logs, webhook deliveries, suppressions) send `{next_cursor, has_more}` with no
    `total` key at all, so typing it as always present meant a `null` check silently passed on
    `undefined`. Branch on `has_more`.

  Catalog updates:

  - **webhooks**: added `form.submitted` to `WEBHOOK_EVENTS`.
  - **errors**: `WarmblyAPIError.code` is typed as `ErrorCode`, an open union of the documented
    stable codes (`list_bounce_risk`, `leads_undeliverable`, `mailbox_allowance_reached`,
    `storage_limit_reached`, and the rest).

  Signature change to watch for:

  - **`campaigns.start(id, params?, opts?)`** takes the request body as its second argument;
    per-request options moved to a third. `StartCampaignParams` is an open shape, so a call
    that passed `{ timeout }` or `{ maxRetries }` as the second argument still compiles and
    now sends those keys in the body instead of applying them. Move them to the third
    argument: `campaigns.start(id, undefined, { timeout: 5000 })`.

  Release plumbing:

  - The `VERSION` constant the User-Agent is built from had drifted: 0.2.0 shipped announcing
    itself as `warmbly-js/0.1.0`, because `changeset version` bumps package.json and knows
    nothing about that file. `pnpm version-packages` now rewrites it, and `version.test.ts`
    fails the build if the two ever disagree.

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
