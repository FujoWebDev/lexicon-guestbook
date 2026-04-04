import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import authProto from "@fujocoded/authproto";

// https://astro.build/config
export default defineConfig({
  output: "server",
  server: {
    host: true,
  },
  adapter: node({ mode: "standalone" }),
  integrations: [
    authProto({
      driver: {
        name: "memory",
      },
      scopes: {
        genericData: true,
      },
      applicationName: "My guestbook",
      applicationDomain: "https://authfujo.fujocoded.com",
    }),
  ],
  env: {
    schema: {
      GUESTBOOK_APPVIEW_DOMAIN: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },
});
