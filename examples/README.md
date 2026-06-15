# Examples

End-to-end examples covering the whole warmbly SDK. Every example imports from `warmbly` and uses
real method names. The top-level `.ts` examples typecheck against the SDK source:

```bash
pnpm typecheck:examples
```

Run any example with [`tsx`](https://github.com/privatenumber/tsx) (or `bun`/`deno` for those folders):

```bash
WARMBLY_API_KEY=wmbly_... npx tsx examples/rest.ts
```

## Getting started

| File | Shows |
| --- | --- |
| [`rest.ts`](./rest.ts) | Auth, auto-pagination, idempotent mutations, typed errors |
| [`oauth.ts`](./oauth.ts) | Authorization-code flow with PKCE |
| [`gateway.ts`](./gateway.ts) | Realtime events with intents and lifecycle |

## REST patterns

| File | Shows |
| --- | --- |
| [`pagination.ts`](./pagination.ts) | Three ways to paginate: for-await, manual pages, toArray |
| [`errors-and-retries.ts`](./errors-and-retries.ts) | The typed error hierarchy and per-request retry/timeout/abort overrides |
| [`permissions-and-api-keys.ts`](./permissions-and-api-keys.ts) | Build scopes with `Permissions`, create and manage API keys |
| [`custom-fetch.ts`](./custom-fetch.ts) | Inject a custom `fetch`, set defaults, use the `request()` escape hatch |

## Resources

| File | Shows |
| --- | --- |
| [`campaigns.ts`](./campaigns.ts) | Campaign lifecycle: create, steps, start/stop, logs, test email |
| [`contacts.ts`](./contacts.ts) | Add, search, lookup, notes, timeline, bulk update, export |
| [`mailboxes-warmup.ts`](./mailboxes-warmup.ts) | Email accounts, warmup controls, verification, sending |
| [`unibox.ts`](./unibox.ts) | Unified inbox: threads, replies, labels, snoozes, scheduled |
| [`analytics.ts`](./analytics.ts) | Dashboard, deliverability, warmup, and campaign analytics |
| [`templates.ts`](./templates.ts) | Reply templates: render, score, duplicate, reorder |
| [`crm.ts`](./crm.ts) | Pipelines, deals, task types, and tasks |
| [`integrations.ts`](./integrations.ts) | Connections, events, field mappings, push, bookings |

## OAuth2

| File | Shows |
| --- | --- |
| [`oauth-app-management.ts`](./oauth-app-management.ts) | Create and manage OAuth apps, secrets, webhook endpoints |
| [`oauth-auto-refresh.ts`](./oauth-auto-refresh.ts) | Full PKCE flow plus an auto-refreshing token provider |

## Realtime gateway

| File | Shows |
| --- | --- |
| [`gateway-presence.ts`](./gateway-presence.ts) | Presence state and `updatePresence` |
| [`gateway-channels.ts`](./gateway-channels.ts) | Joining campaign, account, bulk, and user channels |
| [`gateway-custom-events.ts`](./gateway-custom-events.ts) | Custom events and the full lifecycle |

## Webhooks

| File | Shows |
| --- | --- |
| [`webhooks-verify.ts`](./webhooks-verify.ts) | Framework-agnostic signature verification |

## Framework integrations

These import third-party packages and are illustrative (not typechecked here).

| File | Shows |
| --- | --- |
| [`integrations/express-webhooks.ts`](./integrations/express-webhooks.ts) | Express webhook receiver with raw-body verification |
| [`integrations/nextjs-oauth-callback.ts`](./integrations/nextjs-oauth-callback.ts) | Next.js App Router OAuth callback route |
| [`integrations/cloudflare-worker.ts`](./integrations/cloudflare-worker.ts) | Cloudflare Worker using the SDK at the edge |

## Runtimes

| File | Shows |
| --- | --- |
| [`runtimes/node-cjs.cjs`](./runtimes/node-cjs.cjs) | CommonJS `require("warmbly")` |
| [`runtimes/bun.ts`](./runtimes/bun.ts) | Bun |
| [`runtimes/deno.ts`](./runtimes/deno.ts) | Deno (npm: specifier) |
