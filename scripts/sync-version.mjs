// Writes package.json's version into src/version.ts.
//
// `changeset version` bumps package.json and knows nothing about the VERSION constant the
// User-Agent is built from, so the two drift silently: 0.2.0 shipped announcing itself as
// 0.1.0. Chained after `changeset version` in the `version-packages` script, so the release
// workflow picks it up without a maintainer remembering. `version.test.ts` is the backstop.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const pkgPath = fileURLToPath(new URL("package.json", root));
const versionPath = fileURLToPath(new URL("src/version.ts", root));

const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const source = readFileSync(versionPath, "utf8");

// Match the declaration itself. Testing for the version string anywhere in the file would
// be satisfied by a comment mentioning a version, and the script would report success
// having synchronized nothing.
const declaration = /export const VERSION = "[^"]*";/;
if (!declaration.test(source)) {
  console.error("sync-version: could not find the VERSION declaration in src/version.ts");
  process.exit(1);
}

const updated = source.replace(declaration, `export const VERSION = "${version}";`);

if (updated !== source) {
  writeFileSync(versionPath, updated);
  console.log(`sync-version: src/version.ts -> ${version}`);
} else {
  console.log(`sync-version: already ${version}`);
}
