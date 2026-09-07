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
const updated = source.replace(/export const VERSION = "[^"]*";/, `export const VERSION = "${version}";`);

if (updated === source && !source.includes(`"${version}"`)) {
  console.error("sync-version: could not find the VERSION declaration in src/version.ts");
  process.exit(1);
}

if (updated !== source) {
  writeFileSync(versionPath, updated);
  console.log(`sync-version: src/version.ts -> ${version}`);
} else {
  console.log(`sync-version: already ${version}`);
}
