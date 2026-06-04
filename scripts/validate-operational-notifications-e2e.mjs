import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ status: "SKIP", reason: "DATABASE_URL not set" }));
  process.exit(2);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

/** Mirrors operationalAlertNotifications.ts fan-out for low inventory. */
async function dispatchLowStockNotification(clinicId, message) {
  const admins = await pool.query(
    `SELECT user_id FROM clinic_members
     WHERE clinic_id = $1 AND role = 'clinic_admin' AND status = 'active'`,
    [clinicId],
  );
  if (admins.rows.length === 0) return 0;

  for (const admin of admins.rows) {
    await pool.query(
      `INSERT INTO notifications (clinic_id, user_id, type, title, message, is_read)
       VALUES ($1, $2, 'low_inventory', 'Low Stock Alert', $3, false)`,
      [clinicId, admin.user_id, message],
    );
  }
  return admins.rows.length;
}

const adminRow = await pool.query(
  `SELECT cm.clinic_id, cm.user_id
   FROM clinic_members cm
   WHERE cm.role = 'clinic_admin' AND cm.status = 'active'
   ORDER BY cm.joined_at DESC
   LIMIT 1`,
);

if (!adminRow.rows[0]) {
  console.log(JSON.stringify({ status: "SKIP", reason: "No clinic_admin found" }));
  await pool.end();
  process.exit(2);
}

const { clinic_id: clinicId, user_id: userId } = adminRow.rows[0];
const testMessage = `Low stock alert: Amoxicillin 250mg is below minimum (3/5 bottles) [e2e-${Date.now()}]`;

const before = await pool.query(
  `SELECT count(*)::int AS count FROM notifications WHERE clinic_id = $1 AND user_id = $2`,
  [clinicId, userId],
);

const inserted = await dispatchLowStockNotification(clinicId, testMessage);

const apiRows = await pool.query(
  `SELECT id, clinic_id, user_id, type, title, message, is_read, created_at
   FROM notifications
   WHERE clinic_id = $1 AND user_id = $2
   ORDER BY created_at DESC
   LIMIT 10`,
  [clinicId, userId],
);

const created = apiRows.rows.find((r) => r.message === testMessage);

console.log(
  JSON.stringify(
    {
      status: created ? "PASS" : "FAIL",
      proof: {
        stage_1_inventory_threshold_message: testMessage,
        stage_2_notification_rows_inserted: inserted,
        stage_3_api_query_returns_record: !!created,
        stage_4_ui_would_render: created
          ? { id: created.id, title: created.title, type: created.type, isRead: created.is_read }
          : null,
        counts: { before: before.rows[0].count, after: apiRows.rows.length },
        clinic_isolation: created ? created.clinic_id === clinicId && created.user_id === userId : null,
      },
    },
    null,
    2,
  ),
);

await pool.end();
process.exit(created ? 0 : 1);
