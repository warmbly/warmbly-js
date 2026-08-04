import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // macOS writes `._name` sidecars next to every file on non-HFS+ volumes
    // (external drives, network shares). They match the include glob and fail
    // to parse, so a checkout on such a volume reports a phantom failure for
    // every test file. .gitignore covers committing them; vitest does not read it.
    exclude: [...defaultExclude, "**/._*"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts", "src/**/types.ts"],
    },
  },
});
