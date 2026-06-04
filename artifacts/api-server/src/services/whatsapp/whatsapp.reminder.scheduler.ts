import { db } from "@workspace/db";
import {
  appointmentsTable,
  clinicsTable,
  consultationNotesTable,
  patientsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { dispatchWhatsAppNotification } from "./whatsapp.service";
import { hasReminderBeenSent } from "./whatsapp.delivery";
import {
  DEFAULT_WHATSAPP_REMINDER_CONFIG,
  parseWhatsappReminderConfig,
} from "./whatsapp.reminders.types";

function formatAppointmentDate(d: Date): string {
  return d.toLocaleString("en-ZA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function processAppointmentReminders(): Promise<void> {
  const clinics = await db
    .select({
      id: clinicsTable.id,
      whatsappEnabled: clinicsTable.whatsappEnabled,
      reminderConfig: clinicsTable.whatsappReminderConfig,
    })
    .from(clinicsTable)
    .where(eq(clinicsTable.whatsappEnabled, true));

  const now = Date.now();

  for (const clinic of clinics) {
    const cfg = parseWhatsappReminderConfig(clinic.reminderConfig);
    if (!cfg.enabled || !cfg.appointmentReminders.enabled) continue;

    for (const hours of cfg.appointmentReminders.hoursBefore) {
      const windowStart = new Date(now + (hours - 0.5) * 60 * 60 * 1000);
      const windowEnd = new Date(now + (hours + 0.5) * 60 * 60 * 1000);
      const reminderKey = `${hours}h`;

      const upcoming = await db
        .select({
          id: appointmentsTable.id,
          patientId: appointmentsTable.patientId,
          scheduledAt: appointmentsTable.scheduledAt,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
          doctorName: usersTable.name,
        })
        .from(appointmentsTable)
        .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
        .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
        .where(
          and(
            eq(appointmentsTable.clinicId, clinic.id),
            sql`${appointmentsTable.status} IN ('scheduled', 'confirmed')`,
            gte(appointmentsTable.scheduledAt, windowStart),
            lte(appointmentsTable.scheduledAt, windowEnd),
          ),
        );

      for (const appt of upcoming) {
        const sent = await hasReminderBeenSent({
          clinicId: clinic.id,
          actionType: "appointment_reminder",
          entityId: appt.id,
          reminderKey,
        });
        if (sent) continue;

        const message = `Reminder: ${appt.patientFirst} ${appt.patientLast} — appointment with Dr ${appt.doctorName ?? ""} on ${formatAppointmentDate(new Date(appt.scheduledAt))}`;
        dispatchWhatsAppNotification({
          clinicId: clinic.id,
          actionType: "appointment_reminder",
          entityId: appt.id,
          message,
          reminderKey,
          patientId: appt.patientId,
        });
      }
    }
  }
}

export async function processFollowUpReminders(): Promise<void> {
  const clinics = await db
    .select({
      id: clinicsTable.id,
      whatsappEnabled: clinicsTable.whatsappEnabled,
      reminderConfig: clinicsTable.whatsappReminderConfig,
    })
    .from(clinicsTable)
    .where(eq(clinicsTable.whatsappEnabled, true));

  const now = new Date();

  for (const clinic of clinics) {
    const cfg = parseWhatsappReminderConfig(clinic.reminderConfig ?? DEFAULT_WHATSAPP_REMINDER_CONFIG);
    if (!cfg.enabled || !cfg.followUpReminders.enabled) continue;

    for (const days of cfg.followUpReminders.daysAfterConsultation) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - days);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const reminderKey = `${days}d`;

      const notes = await db
        .select({
          id: consultationNotesTable.id,
          patientId: consultationNotesTable.patientId,
          updatedAt: consultationNotesTable.updatedAt,
          followUpInstructions: consultationNotesTable.followUpInstructions,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
        })
        .from(consultationNotesTable)
        .innerJoin(patientsTable, eq(consultationNotesTable.patientId, patientsTable.id))
        .where(
          and(
            eq(consultationNotesTable.clinicId, clinic.id),
            eq(consultationNotesTable.status, "completed"),
            gte(consultationNotesTable.updatedAt, dayStart),
            lte(consultationNotesTable.updatedAt, dayEnd),
            sql`${consultationNotesTable.followUpInstructions} IS NOT NULL AND ${consultationNotesTable.followUpInstructions} <> ''`,
          ),
        );

      for (const note of notes) {
        const sent = await hasReminderBeenSent({
          clinicId: clinic.id,
          actionType: "follow_up_reminder",
          entityId: note.id,
          reminderKey,
        });
        if (sent) continue;

        dispatchWhatsAppNotification({
          clinicId: clinic.id,
          actionType: "follow_up_reminder",
          entityId: note.patientId,
          message: `Follow-up reminder for ${note.patientFirst} ${note.patientLast}`,
          reminderKey,
          patientId: note.patientId,
        });
      }
    }
  }
}

export function startWhatsappReminderScheduler(): void {
  const intervalMs = Number(process.env.WHATSAPP_REMINDER_INTERVAL_MS ?? 300_000);
  const run = async () => {
    try {
      await processAppointmentReminders();
      await processFollowUpReminders();
    } catch (err) {
      logger.error({ err }, "[whatsapp] Reminder scheduler tick failed");
    }
  };

  void run();
  setInterval(() => void run(), intervalMs);
  logger.info({ intervalMs }, "[whatsapp] Reminder scheduler started");
}

export function startWhatsappRetryScheduler(): void {
  const intervalMs = Number(process.env.WHATSAPP_RETRY_INTERVAL_MS ?? 120_000);

  const tick = async () => {
    try {
      const { processWhatsappRetries } = await import("./whatsapp.retry.worker");
      await processWhatsappRetries();
    } catch (err) {
      logger.error({ err }, "[whatsapp] Retry scheduler tick failed");
    }
  };

  void tick();
  setInterval(() => void tick(), intervalMs);
  logger.info({ intervalMs }, "[whatsapp] Retry scheduler started");
}
