# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It tracks
which changes should appear in the next release and how they bump the version.

## Adding a changeset

When you make a user-facing change, add a changeset:

```bash
pnpm changeset
```

Pick the bump type and write a short, user-facing summary:

- **patch**: bug fixes and internal changes with no API impact
- **minor**: new, backward-compatible features
- **major**: breaking changes

Commit the generated file in `.changeset/` alongside your code. On merge to `main`, the release
workflow opens a "Version Packages" pull request that applies the bumps and updates the changelog.
Merging that pull request publishes to npm.
