---
"warmbly": minor
---

**Breaking (types, and request shapes that never matched the server):**

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
