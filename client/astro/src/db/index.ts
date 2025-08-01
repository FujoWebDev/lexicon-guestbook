import { DB_FILE } from "astro:env/server";
import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";

export const db = drizzle({ connection: { url: DB_FILE } });
