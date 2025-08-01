import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import { envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  env: {
    schema: {
      DB_FILE: envField.string({
        context: "server",
        access: "public",
        default: "file:./src/db/db.sql",
      }),
    },
  },
});
