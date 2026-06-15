import { defineConfig } from "tsup";

// Dual ESM + CJS build with type declarations for both, so `warmbly` works under
// `import` and `require` across Node 18+, Bun, Deno, browsers, and the edge.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  minify: false,
  target: "es2022",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
