# Examples

Small, focused examples for the warmbly SDK.

| File | Shows |
| --- | --- |
| [`rest.ts`](./rest.ts) | Auth, auto-pagination, idempotent mutations, typed errors |
| [`oauth.ts`](./oauth.ts) | Authorization-code flow with PKCE and an auto-refreshing client |
| [`gateway.ts`](./gateway.ts) | Realtime events with intents, lifecycle, resume |

Run any of them with [`tsx`](https://github.com/privatenumber/tsx):

```bash
WARMBLY_API_KEY=wmbly_... npx tsx examples/rest.ts
```
