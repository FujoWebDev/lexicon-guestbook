import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./index.ts",
    ingestor: "./ingestor.ts",
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node22",
  clean: true,
  sourcemap: true,
});
