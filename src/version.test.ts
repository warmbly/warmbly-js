import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VERSION } from "./version";

describe("VERSION", () => {
  it("matches the version in package.json", () => {
    // `changeset version` bumps package.json but knows nothing about this constant, so
    // without this assertion the User-Agent silently reports a stale release. It did:
    // 0.2.0 shipped announcing itself as 0.1.0.
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });

  it("is a plain semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });
});
