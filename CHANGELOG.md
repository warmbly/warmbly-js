# Changelog

## 0.2.0

### Minor Changes

- ad7ce84: Initial release of the warmbly SDK: a typed REST client, an OAuth2 authorization-code helper with PKCE and token auto-refresh, and a realtime gateway client with typed events, intents, automatic reconnect, and resume. Zero runtime dependencies; runs on Node 18+, Bun, Deno, browsers, and the edge.
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
