import { defineConfig } from "drizzle-kit";
import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

console.log("ENV KEYS:", Object.keys(process.env).filter(k =>
  k.includes("DATABASE") ||
  k.includes("SUPABASE") ||
  k.includes("RESEND")
));

// Prefer Replit-native PG vars over DATABASE_URL (which may point to a paused Supabase)
function getDbUrl(): string {
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    return `postgresql://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  throw new Error("No database configuration found. Set PGHOST or DATABASE_URL.");
}

console.log("DATABASE_URL =", process.env.DATABASE_URL);
export default defineConfig({
  schema: "C:/Users/Fctec/Desktop/Health-Nexus/Health-Nexus/lib/db/src/schema/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDbUrl(),
  },
});
