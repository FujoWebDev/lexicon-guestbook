import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import authProto from "@fujocoded/authproto";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    authProto({
      applicationName: "My guestbook",
      applicationDomain: "https://authfujo.fujocoded.com",
      defaultDevUser: "essentialrandom.bsky.social",
    }),
  ],
});
