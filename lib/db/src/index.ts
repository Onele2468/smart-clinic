import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Determine which database connection to use, in priority order:
//
//  1. PGHOST=helium  — Replit native PG; only resolves inside the dev container.
//     Never used in production autoscale containers.
//
//  2. DATABASE_URL    — Used for everything else:
//     • Production: Replit injects a Neon DATABASE_URL automatically when the
//       app is published (as long as no DATABASE_URL secret overrides it).
//     • Dev fallback: any explicit DATABASE_URL secret/env that is not helium-based.
//
//  If neither is configured the server will crash on startup with a clear message.

let pool: InstanceType<typeof Pool>;

const dbHost = process.env.PGHOST ?? "";
const isHeliumDev =
  dbHost === "helium" &&
  !!process.env.PGUSER &&
  !!process.env.PGPASSWORD &&
  !!process.env.PGDATABASE;

if (isHeliumDev) {
  pool = new Pool({
    host: dbHost,
    port: parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER!,
    password: process.env.PGPASSWORD!,
    database: process.env.PGDATABASE!,
    ssl: false,
  });
  pool.on("connect", (client) => {
    // Force all unqualified table references to resolve to public schema.
    // Prevents accidental reads from auth.users when search_path is customized.
    client.query("SET search_path TO public").catch(() => {});
  });
  // Log the host used at startup (no password)
  if (process.env.NODE_ENV !== "test") {
    process.nextTick(() => {
      console.log(`[db] Connected via helium (dev native PG): ${dbHost}/${process.env.PGDATABASE}`);
    });
  }
} else if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  let dbHostname = "";
  try {
    dbHostname = new URL(dbUrl).hostname;
  } catch {
    dbHostname = "unknown";
  }
  const isLocal = dbHostname === "localhost" || dbHostname === "127.0.0.1";
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  pool.on("connect", (client) => {
    client.query("SET search_path TO public").catch(() => {});
  });
  if (process.env.NODE_ENV !== "test") {
    process.nextTick(() => {
      console.log(`[db] Connected via DATABASE_URL: host=${dbHostname}`);
    });
  }
} else if (dbHost && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
  pool = new Pool({
    host: dbHost,
    port: parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
  });
  pool.on("connect", (client) => {
    client.query("SET search_path TO public").catch(() => {});
  });
  if (process.env.NODE_ENV !== "test") {
    process.nextTick(() => {
      console.log(`[db] Connected via PGHOST: ${dbHost}/${process.env.PGDATABASE}`);
    });
  }
} else {
  throw new Error(
    "[db] No database connection configured. " +
    "In production: publish the app so Replit provisions a Neon database and injects DATABASE_URL. " +
    "In development: Replit sets PGHOST=helium automatically. " +
    "Alternatively set DATABASE_URL manually.",
  );
}

export { pool };
export const db = drizzle(pool, { schema });

export * from "./schema";
