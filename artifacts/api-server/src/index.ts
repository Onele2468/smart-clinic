import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await pool.query("SELECT 1");
    logger.info("Database connectivity verified OK");

    const { startWhatsappReminderScheduler, startWhatsappRetryScheduler } = await import(
      "./services/whatsapp/whatsapp.reminder.scheduler"
    );
    startWhatsappReminderScheduler();
    startWhatsappRetryScheduler();
  } catch (dbErr) {
    logger.error(
      { err: dbErr },
      "STARTUP DB CHECK FAILED — database is unreachable. " +
      "In production: ensure DATABASE_URL is injected (delete any Supabase DATABASE_URL secret and republish). " +
      "In development: ensure PGHOST/PGUSER/PGPASSWORD/PGDATABASE are set.",
    );
  }
});
