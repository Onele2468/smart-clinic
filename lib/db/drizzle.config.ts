import { defineConfig } from "drizzle-kit";
import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

function getDbUrl(): string {
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    return `postgresql://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  throw new Error("No database configuration found. Set DATABASE_URL or PGHOST.");
}

export default defineConfig({
  schema: "C:/Users/Fctec/Desktop/Health-Nexus/Health-Nexus/lib/db/src/schema/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDbUrl(),
  },
});
