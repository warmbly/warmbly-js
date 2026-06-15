<div align="center">

# warmbly

**The official Warmbly SDK for JavaScript and TypeScript.**

A typed REST client, an OAuth2 helper, and a realtime gateway in one zero-dependency package. Runs on Node, Bun, Deno, browsers, and the edge.

[![npm version](https://img.shields.io/npm/v/warmbly?color=2563eb&label=npm)](https://www.npmjs.com/package/warmbly)
[![CI](https://img.shields.io/github/actions/workflow/status/warmbly/warmbly-js/ci.yml?branch=main&label=CI)](https://github.com/warmbly/warmbly-js/actions/workflows/ci.yml)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/warmbly?label=min%2Bgzip)](https://bundlephobia.com/package/warmbly)
[![Types](https://img.shields.io/npm/types/warmbly)](https://www.npmjs.com/package/warmbly)
[![Downloads](https://img.shields.io/npm/dm/warmbly?color=2563eb)](https://www.npmjs.com/package/warmbly)
[![License](https://img.shields.io/npm/l/warmbly)](./LICENSE)

</div>

## Highlights

- **Three pillars, one import.** REST resources, the OAuth2 authorization-code flow, and a realtime gateway, all from `warmbly`.
- **Runs everywhere.** Node 18+, Bun, Deno, browsers, and edge runtimes. Built on web standards (`fetch`, `WebSocket`, Web Crypto), with `fetch` and `WebSocket` injectable.
- **Zero runtime dependencies.** Nothing to audit, nothing to bloat your bundle. Tree-shakeable, dual ESM and CommonJS, with full type declarations.
- **Typed end to end.** Every resource, event, error, and option is typed. Gateway events are a typed map, so `gw.on("EMAIL_OPENED", ...)` knows the payload.
- **Resilient by default.** Automatic retries with backoff and jitter, `Retry-After` support, idempotency keys for safe mutation retries, timeouts, and a self-healing gateway that reconnects and resumes.
- **Ergonomic pagination.** List endpoints return a page you can `for await` over; it fetches the next page for you.

## Install

```bash
npm install warmbly
# or
pnpm add warmbly
# or
yarn add warmbly
# or
bun add warmbly
```

> On Node older than 22 the gateway needs a WebSocket. Install the optional peer `ws` (`npm install ws`) and the SDK picks it up automatically, or pass your own with `webSocket`.

## Quick start

```ts
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// List campaigns (auto-paginated)
for await (const campaign of warmbly.campaigns.list()) {
  console.log(campaign.id, campaign.name);
}

// Create a contact
const created = await warmbly.contacts.add([
  { email: "jane@example.com", first_name: "Jane", company: "Acme" },
]);
```

JavaScript works the same way:

```js
const { Warmbly } = require("warmbly");
const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });
```

## Authentication

The Warmbly API authenticates with a bearer credential: either an **API key** for your own scripts (`wmbly_...`) or an **OAuth access token** for apps acting on behalf of a workspace (`wmat_...`). Both go through the same gates, so you pass either one the same way.

```ts
// API key
const warmbly = new Warmbly({ apiKey: "wmbly_..." });

// OAuth access token
const warmbly = new Warmbly({ accessToken: "wmat_..." });

// Or a dynamic provider (for example, auto-refreshing OAuth tokens)
const warmbly = new Warmbly({ getToken: async () => store.currentAccessToken() });
```

## REST API

Resources hang off the client and mirror the API surface:

| Namespace | Covers |
| --- | --- |
| `warmbly.apiKeys` | API keys, usage analytics, permission catalog |
| `warmbly.campaigns` | Campaigns, sequence steps, A/B variants, attachments, lifecycle |
| `warmbly.contacts` | Contacts, search, import/export, notes, timeline, activities |
| `warmbly.emails` | Email accounts (mailboxes), warmup controls, sending |
| `warmbly.unibox` | Unified inbox: threads, replies, labels, snoozes |
| `warmbly.analytics` | Dashboard, deliverability, warmup, and campaign analytics |
| `warmbly.templates` | Reply templates: render, score, duplicate |
| `warmbly.crm` | Pipelines, deals, task types, tasks |
| `warmbly.integrations` | Third-party connections, events, field mappings |
| `warmbly.webhooks` | Webhook endpoints, deliveries, event types |
| `warmbly.misc` | Folders, tags, categories, teams, audit logs, plans, timezones |

### Pagination

List methods return a `Page`. Iterate it to walk every record across pages, or page manually.

```ts
// Iterate everything
for await (const key of warmbly.apiKeys.list()) {
  console.log(key.name, key.status);
}

// Page manually
let page = await warmbly.apiKeys.list({ limit: 50 });
console.log(page.data, page.pagination.next_cursor);
if (page.hasNextPage()) {
  page = (await page.nextPage())!;
}

// Or collect a bounded result set
const all = await warmbly.contacts.list().then((p) => p.toArray());
```

### Errors

Every non-2xx response throws a typed error carrying the status, machine code, and request id.

```ts
import { RateLimitError, NotFoundError, WarmblyAPIError } from "warmbly";

try {
  await warmbly.campaigns.get("does-not-exist");
} catch (err) {
  if (err instanceof NotFoundError) {
    // 404
  } else if (err instanceof RateLimitError) {
    console.log("retry after", err.retryAfter, "seconds");
  } else if (err instanceof WarmblyAPIError) {
    console.error(err.status, err.code, err.requestId);
  }
}
```

| Error | When |
| --- | --- |
| `BadRequestError` | 400 |
| `AuthenticationError` | 401 |
| `PermissionDeniedError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `UnprocessableEntityError` | 422 |
| `RateLimitError` | 429 (carries `retryAfter`) |
| `InternalServerError` | 5xx |
| `WarmblyConnectionError` | network failure, timeout, or abort |

### Retries and idempotency

By default the client retries transient failures (429 and 5xx and network errors) with exponential backoff plus jitter, honoring `Retry-After`. Mutations get an automatic `Idempotency-Key` so a retry never double-executes. You can override per request:

```ts
await warmbly.contacts.add([{ email: "x@example.com" }], {
  idempotencyKey: "import-2026-06-15",
  maxRetries: 5,
  timeout: 10_000,
});
```

### Escape hatch

Any endpoint not yet modeled is one call away:

```ts
const { data } = await warmbly.request("GET", "/timezones");
```

## OAuth2

Build an app that other people connect their Warmbly workspace to. The SDK handles the authorization-code flow with optional PKCE. You never need a token to build URLs or exchange a code.

```ts
import { Warmbly } from "warmbly";

const oauth = new Warmbly.OAuth({
  clientId: "wmcid_...",
  clientSecret: "wmcs_...",
  redirectUri: "https://yourapp.com/oauth/callback",
});

// 1. Send the user to the consent page (with PKCE)
const { url, state, codeVerifier } = await oauth.createAuthorizationUrl({
  scopes: ["read_campaigns", "read_contacts"],
  pkce: true,
});
// Persist `state` and `codeVerifier`, then redirect the user to `url`.

// 2. On the callback, exchange the code for tokens
const tokens = await oauth.exchangeCode({ code, codeVerifier });
// tokens.accessToken, tokens.refreshToken, tokens.expiresAt, tokens.scopes

// 3. Refresh (rotation-aware) and revoke
const next = await oauth.refresh(tokens.refreshToken);
await oauth.revoke(tokens.accessToken);
```

### Auto-refreshing tokens

Wire a token store into the client so REST calls always use a fresh access token, refreshing on expiry and persisting the rotated pair.

```ts
import { Warmbly, MemoryTokenStore, createAutoRefreshingTokenProvider } from "warmbly";

const store = new MemoryTokenStore(tokens);
const getToken = createAutoRefreshingTokenProvider({ oauth, store });

const warmbly = new Warmbly({ getToken });
```

### Managing your apps

With an API key that holds the `API_KEYS` scope you can manage your OAuth applications programmatically:

```ts
const app = await warmbly.oauthApplications.create({
  name: "My App",
  redirect_uris: ["https://yourapp.com/oauth/callback"],
  scopes: Permissions.from("READ_CAMPAIGNS", "READ_CONTACTS").value,
});
console.log(app.client_id, app.client_secret); // secret shown once
```

## Realtime gateway

Subscribe to live workspace events over a single WebSocket. The gateway client identifies, sends heartbeats, reconnects with backoff, and resumes the missed window by sequence number, all on its own. You just register typed handlers.

```ts
const gw = warmbly.gateway({
  orgId: "org_123",
  intents: ["EMAIL", "CAMPAIGN", "CUSTOM"], // filter the stream
});

gw.on("EMAIL_OPENED", (e) => console.log("opened", e.campaign_id));
gw.on("EMAIL_REPLIED", (e) => console.log("reply", e.thread_id));
gw.on("CUSTOM_EVENT", (e) => console.log(e.name, e.payload));

// Lifecycle
gw.on("hello", (h) => console.log("connected at seq", h.seq));
gw.on("reconnecting", ({ attempt, delayMs }) => console.log("retry", attempt, delayMs));
gw.on("error", (err) => console.error(err.message));

await gw.connect();
// ...later
gw.close();
```

**Intents** are event families (`EMAIL`, `CAMPAIGN`, `AUDIT`, `CUSTOM`, and more) that narrow the stream so you only receive and pay the rate budget for what you act on. **Channels** beyond the org stream are joinable too: `gw.joinCampaign(id)`, `gw.joinAccount(id)`, `gw.joinBulk(id)`.

To connect, the token must be an API key with the `REALTIME_SUBSCRIBE` permission, or an OAuth access token with the `realtime_subscribe` scope. The client inherits the token from the `Warmbly` client automatically.

Treat event payloads as invalidation signals: they carry ids, not full state. Refetch over REST when you need the current contents.

## Permissions and scopes

A small helper makes the permission bitmask and OAuth scopes easy to work with.

```ts
import { Permissions } from "warmbly";

const perms = Permissions.from("READ_CAMPAIGNS", "WRITE_CONTACTS");
perms.value;                 // numeric bitmask for the `permissions` field
perms.has("READ_CAMPAIGNS"); // true
perms.toScopes();            // ["read_campaigns", "write_contacts"] for OAuth

Permissions.readOnly();      // the read_only preset
Permissions.fullAccess();    // the full_access preset
```

## Verifying webhooks

If your integration receives webhooks, verify the signature before trusting the payload. Works in any runtime with Web Crypto.

```ts
import { verifyWebhookSignature } from "warmbly";

const ok = await verifyWebhookSignature({
  payload: rawRequestBody, // the exact bytes, before JSON.parse
  header: req.headers["x-warmbly-signature"],
  secret: process.env.WARMBLY_WEBHOOK_SECRET,
});
if (!ok) return res.status(400).end();
```

## Configuration

```ts
const warmbly = new Warmbly({
  apiKey: "wmbly_...",          // or accessToken / getToken
  baseUrl: "https://api.warmbly.com/v1",
  appBaseUrl: "https://app.warmbly.com",
  gatewayUrl: "wss://realtime.warmbly.com",
  organizationId: "org_123",    // default gateway org
  timeout: 60_000,              // ms
  maxRetries: 2,
  fetch: customFetch,           // inject a fetch implementation
  defaultHeaders: { "X-App": "my-app" },
});
```

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` / `accessToken` | none | Bearer credential |
| `getToken` | none | Dynamic token provider, resolved per request |
| `baseUrl` | `https://api.warmbly.com/v1` | REST base URL |
| `appBaseUrl` | `https://app.warmbly.com` | OAuth authorize host |
| `gatewayUrl` | `wss://realtime.warmbly.com` | Gateway WebSocket base |
| `timeout` | `60000` | Per-request timeout in ms |
| `maxRetries` | `2` | Retries on transient failures |
| `fetch` | platform global | Custom `fetch` |
| `defaultHeaders` | `{}` | Headers sent on every request |

## Runtimes

The package ships ESM and CommonJS with type declarations for both, validated in CI with [publint](https://publint.dev) and [Are the types wrong](https://arethetypeswrong.github.io). It is tested on Node 18, 20, and 22, with cross-runtime smoke tests on Bun and Deno.

| Runtime | Supported |
| --- | --- |
| Node.js 18+ | yes (global `fetch`; `ws` peer for the gateway on Node < 22) |
| Bun | yes |
| Deno | yes |
| Browsers | yes |
| Edge and Workers | yes |

## TypeScript

Types are bundled. The SDK targets modern TypeScript with `strict` enabled and exports every public type, including the gateway event map, so editors give you full autocomplete on events, resources, and options.

## Links

- Warmbly API documentation: https://docs.warmbly.com
- Issues: https://github.com/warmbly/warmbly-js/issues
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, scripts, and the pull request flow, and please read the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Warmbly
