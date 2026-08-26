import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// DATABASE_URL is preferred, with discrete PG* variables supported for local
// and managed PostgreSQL runtimes.
let pool: InstanceType<typeof Pool>;

const dbHost = process.env.PGHOST ?? "";

if (process.env.DATABASE_URL) {
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
  const isLocal = dbHost === "localhost" || dbHost === "127.0.0.1";
  pool = new Pool({
    host: dbHost,
    port: parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: isLocal ? false : { rejectUnauthorized: false },
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
      "Set DATABASE_URL or provide PGHOST, PGUSER, PGPASSWORD, and PGDATABASE.",
  );
}

export { pool };
export const db = drizzle(pool, { schema });

export * from "./schema";
