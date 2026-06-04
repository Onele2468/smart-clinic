import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../artifacts/api-server/.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.log(JSON.stringify({ status: "SKIP", reason: "DATABASE_URL not set" }));
  process.exit(2);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

try {
  const col = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'clinics' AND column_name = 'operational_alerts_config'`,
  );

  let migrations = [];
  try {
    const mig = await pool.query(
      `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10`,
    );
    migrations = mig.rows;
  } catch (err) {
    migrations = [{ note: "drizzle.__drizzle_migrations unavailable", error: String(err.message) }];
  }

  let sample = null;
  if (col.rows.length > 0) {
    const row = await pool.query(
      `SELECT id, operational_alerts_config FROM clinics ORDER BY created_at DESC LIMIT 1`,
    );
    sample = row.rows[0] ?? null;
  }

  console.log(
    JSON.stringify(
      {
        status: col.rows.length > 0 ? "PASS" : "FAIL",
        columnExists: col.rows.length > 0,
        column: col.rows,
        migrations,
        sample,
      },
      null,
      2,
    ),
  );
  process.exit(col.rows.length > 0 ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ status: "FAIL", error: e.message }));
  process.exit(1);
} finally {
  await pool.end();
}
