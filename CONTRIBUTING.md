# Contributing to warmbly-js

Thanks for your interest in improving the Warmbly SDK. This guide covers everything you need to
get set up and land a change.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- [Node.js](https://nodejs.org) 20 or newer (the repo pins a version in `.nvmrc`)
- [pnpm](https://pnpm.io) 10 or newer (`corepack enable` will provide it)

The SDK itself ships with zero runtime dependencies and targets Node, Bun, Deno, browsers, and
the edge, so please avoid adding runtime dependencies or runtime-specific APIs in the core.

## Getting started

```bash
git clone https://github.com/warmbly/warmbly-js.git
cd warmbly-js
pnpm install
```

## Project layout

```
src/
  core/         shared HTTP client, errors, pagination, config, utilities
  resources/    REST resource clients (campaigns, contacts, mailboxes, ...)
  oauth/        OAuth2 authorization-code flow, PKCE, token store, app management
  gateway/      realtime WebSocket gateway client (typed events, resume, heartbeat)
  webhooks/     webhook signature verification
  permissions.ts  permission bitmask helper and scope mapping
  client.ts     the top-level Warmbly client
  index.ts      public entry point
```

## Common scripts

| Command | What it does |
| --- | --- |
| `pnpm build` | Build the dual ESM/CJS bundle and type declarations with tsup |
| `pnpm dev` | Rebuild on change |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm lint` | Lint and format-check with Biome |
| `pnpm lint:fix` | Apply safe lint and format fixes |
| `pnpm check:publish` | Validate the publishable package with publint |
| `pnpm check:exports` | Validate type resolution with "Are the types wrong" |

## Making a change

1. Create a branch from `main` (for example `feat/contacts-bulk-update` or `fix/retry-after`).
2. Write code and tests. Every source file has a colocated `*.test.ts`; new behavior needs coverage.
3. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before pushing.
4. Add a changeset for any user-facing change:
   ```bash
   pnpm changeset
   ```
   Pick the bump type and write a short, user-facing summary. Commit the generated file.
5. Open a pull request. Fill in the template and link any related issues.

## Commit and PR conventions

We use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`,
`test:`, `refactor:`, `chore:`, `ci:`, `build:`. Keep the subject line specific. Versioning and the
changelog are driven by Changesets, not by commit messages, so always add a changeset for releasable
changes.

## Code style

- TypeScript strict mode. No `any` in public types; prefer `unknown` plus generics.
- Document every exported symbol with TSDoc and at least one `@example`.
- Keep comments short: one line stating the non-obvious intent.
- Avoid em dashes in prose and comments.
- Formatting and linting are handled by Biome; run `pnpm lint:fix` to apply.

## Releasing

Maintainers merge the automated "Version Packages" pull request that Changesets opens. Merging it
publishes the new version to npm with provenance. You do not need to publish manually.
