# Changelog

## 0.4.0

### Minor Changes

- 1d3f3cd: **Breaking (types, and request shapes that never matched the server):**

  - `contacts.search` and `contacts.list` now send `cursor` and `limit` in the query string, as the server reads them. Before, they went in the body, so page two repeated page one and auto-paging never ended.
  - `contacts.add` sends the bare array the server binds, not `{ contacts: [...] }`.
  - `contacts.importPreview(file, { filename })` and `importCommit(file, options, { filename })` now upload multipart, as the server expects. `ContactImportParams` is removed.
  - `contacts.bulkDelete` returns `void` and accepts ids or a selection; `contacts.export` returns the file text; `contacts.lookup` returns `{ contact, match }`; `contacts.listNotes` returns a `Page`; `contacts.deals` returns `Deal[]`.
  - `crm.listTasks`, `listDeals`, `searchTasks` and `searchDeals` return a `Page`; `crm.createTask` requires `title`; `CrmTask` now has the server's real fields.
  - `unibox.thread` returns a `Page`; `unsnooze` returns `void`; reply, snooze and label calls use the server's field names; `UniboxItem.from` is `string[]`.
  - `templates.reorder` takes `{ ids }`; templates use `body_html` and `body_plain`.
  - `integrations.pushConnection` requires its params; `ApiKey.allowed_ips` and `allowed_email_accounts` are optional.

  **New:**

  - `warmbly.placement` (inbox placement tests and batches, seeds, coverage, overview) and `warmbly.emailImages`.
  - `contacts` background imports (`createImport`, `listImports`, `getImport`, `saveImportDraft`, `analyzeImport`, `startImport`, `cancelImport`, `importFailures`) and a typed `ContactSelection` for bulk actions.
  - `campaigns.sendPlan`, per-lead `getLeadHold`, `pauseLead`, `resumeLead`, `getLeadCC`, `setLeadCC`, `suggestLeadCC`, and the placement monitor methods.
  - `crm.bulkUpdateTasks` and `bulkDeleteTasks`, `emails.identity`, `refreshIdentity`, `setDirectTracking`, `updateSync`, `unibox.moveFolder`, `integrations.rotateInboundUrl` and `setSigningKey`, `templates.analyze`, `apiKeys.delete`, and `analytics.direct`, `inboxTagging` and `warmupPlacement`.
  - Gateway events `WARMUP_PLACEMENT`, `PLACEMENT_TEST_UPDATED`, `DIRECT_EMAIL_OPENED`, `DIRECT_EMAIL_CLICKED`, `MAILBOX_IMPORT_PROGRESS` and `CONTACT_IMPORT_PROGRESS`, with `WARMUP`, `PLACEMENT`, `DIRECT` and `IMPORT` intents. Account and email events type `email_account_id`, the key the server sends.
  - 89 newly documented error codes in `ErrorCode`, and many new fields on campaigns, contacts, email accounts, unibox, forms, segments and integrations.
  - `warmbly.integrations.salesforce`: overview, settings, metadata, users, list views, campaigns, import preview, import sources (create, update, run, delete), activity with retry, and `syncNow`.
  - CRM sync on `crm` for HubSpot, Pipedrive and Salesforce: settings, metadata, owners and `mapOwner`, `syncHealth`, `syncNow`, retry and discard of sync failures, backfill, CRM contact records (get, refresh, link, update), and list import (`listLists`, `previewListImport`, `importList`).
  - `contacts.salesforce`, `syncSalesforce` and `unlinkSalesforce`; `integrations.listCommunityApps` and `getCommunityApp`.
  - OAuth apps: `setLogo`, `removeLogo`, `getListing`, `saveListing`, `deleteListing`, and `listWithAccess`, which also returns `developer_access`.
  - The `CRM_SYNCED` gateway event with a `CRM` intent, 35 more error codes (CRM, Salesforce, listing, logo and API-key ceilings), mailbox test participation fields, richer placement observation counts, and `external` references on pipelines, deals, tasks and notes.
  - `warmbly.integrations.apollo` (overview, key replacement, lists, import preview, import sources, enrichment runs) and `warmbly.integrations.clay` (settings), with the `apollo` and `clay` providers.
  - `normalizeIntents` turns `.`, `:`, `-` and spaces into `_`, as the server does, and `ErrorCode` lists the Apollo, Clay, Slack, pool link, mailbox, re-authentication and app attest codes the server sends.

  Server sync through `176d3c24`:

  - `analytics.dashboard` now sends `period` (`7d`, `30d` or `90d`), which is what the server reads. It sent `from` and `to` before, which the dashboard ignores, so the window was always 7 days. It also takes `campaign_ids` and `folder_ids` to narrow the campaign sections, and the response types the `scope` echo (`DashboardParams`, `DashboardAnalytics`, `DashboardScope`).
  - `ReplyBreakdown` types the new `reply_breakdown` in campaign analytics; the new `positive_replies`, `interested_leads` and `positive_reply_rate` fields pass through the report.
  - Campaign estimate and send plan document the new `send_recovery`, `send_cooldown` and `send_authority` states.
  - `SendRecoveryResolution` gains `message_id`, `provider_msg_id` and `thread_id`.
  - `ErrorCode` gains `member_access_restricted`, `invalid_access_resource`, `invalid_access_scope`, `too_many_access_grants` and `owner_access_unrestricted`, returned when a member restricted to selected resources, or a key or app acting for one, calls a route outside their grants.

  Server sync through `ec3e1df7`:

  - The gateway sends an API key or OAuth access token in the `x-warmbly-token` header, because the realtime server now refuses either in the socket URL (close code `4003`). A dashboard connection token still travels in the `token` query parameter. Browsers cannot set WebSocket headers, so there use a connection token (`getToken`); each one opens a single socket, and `getToken` runs before every reconnect.
  - `warmbly.emails.certificates(id)` reads an SMTP/IMAP mailbox's per-server certificate policy (`tls_unverified`, `tls_pin`), with the `MailboxCertificates`, `MailboxServerCertificate` and `MailCertificate` types.
  - `WarmblyAPIError.reason` carries the optional finer key some errors add under one `code`, such as `certificate_untrusted` on `mailbox_tls_failed`.
  - `ErrorCode` gains `session_ended`, `attempt_check_unavailable`, `code_lookup_limited`, `account_suspended`, `account_sending_suspended`, `account_workspace_create_suspended`, `workspace_sending_suspended`, `duplicate_query_parameter`, `duplicate_header`, `invalid_tls_pin`, `mailbox_certificate_not_pinned`, `redirect_target_not_own_domain`, the five `image_*` upload codes, and the reset and invitation codes.
  - Warmup placement counts gain `rescue_missing`, `rescue_failed` and `rescue_unreported`, and per-group `rescue_confirmed`, `rescue_missing` and `rescue_failed`. `rescue_confirmed` is a number on current servers.
  - `Form.redirect_url_active` is `false` when the redirect is not on one of the workspace's own domains.

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
