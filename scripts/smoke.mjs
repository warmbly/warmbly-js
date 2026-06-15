// Cross-runtime smoke test: import the built ESM bundle and assert the public surface
// is present. Run under Node, Bun, and Deno in CI to prove real resolution, not just "it compiles".
import * as warmbly from "../dist/index.js";

const required = ["Warmbly", "WarmblyError", "Permissions"];
const missing = required.filter((name) => !(name in warmbly));

if (missing.length > 0) {
  console.error(`warmbly smoke failed, missing exports: ${missing.join(", ")}`);
  if (typeof process !== "undefined" && process.exit) process.exit(1);
  throw new Error(`Missing exports: ${missing.join(", ")}`);
}

console.log(`warmbly smoke ok (${required.join(", ")})`);
