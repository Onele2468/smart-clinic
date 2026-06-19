import { db } from "@workspace/db";
import { clinicSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type ClinicSettingsUpdate = {
  timezone?: string;
  openingTime?: string;
  closingTime?: string;
  workingDays?: number[];
  appointmentSlotDurationMinutes?: number;
  bookingWindowDays?: number;
  maxPatientsPerSlot?: number;
  allowWalkins?: boolean;
  onlineBookingEnabled?: boolean;
  whatsappSelfServiceBookingEnabled?: boolean;
  maxBookingsPerDay?: number | null;
};

export async function getClinicSettings(clinicId: string) {
  const [settings] = await db
    .select()
    .from(clinicSettingsTable)
    .where(eq(clinicSettingsTable.clinicId, clinicId))
    .limit(1);

  if (settings) return settings;

  throw new Error(`Clinic scheduling settings are not configured for clinic ${clinicId}.`);
}

export async function updateClinicSettings(clinicId: string, data: ClinicSettingsUpdate) {
  const updateData: ClinicSettingsUpdate & { updatedAt: Date } = { updatedAt: new Date() };
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.openingTime !== undefined) updateData.openingTime = data.openingTime;
  if (data.closingTime !== undefined) updateData.closingTime = data.closingTime;
  if (data.workingDays !== undefined) updateData.workingDays = data.workingDays;
  if (data.appointmentSlotDurationMinutes !== undefined) {
    updateData.appointmentSlotDurationMinutes = data.appointmentSlotDurationMinutes;
  }
  if (data.bookingWindowDays !== undefined) updateData.bookingWindowDays = data.bookingWindowDays;
  if (data.maxPatientsPerSlot !== undefined) updateData.maxPatientsPerSlot = data.maxPatientsPerSlot;
  if (data.allowWalkins !== undefined) updateData.allowWalkins = data.allowWalkins;
  if (data.onlineBookingEnabled !== undefined) updateData.onlineBookingEnabled = data.onlineBookingEnabled;
  if (data.whatsappSelfServiceBookingEnabled !== undefined) {
    updateData.whatsappSelfServiceBookingEnabled = data.whatsappSelfServiceBookingEnabled;
  }
  if (data.maxBookingsPerDay !== undefined) updateData.maxBookingsPerDay = data.maxBookingsPerDay;

  const [existing] = await db
    .select({ id: clinicSettingsTable.id })
    .from(clinicSettingsTable)
    .where(eq(clinicSettingsTable.clinicId, clinicId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(clinicSettingsTable)
      .set(updateData)
      .where(eq(clinicSettingsTable.clinicId, clinicId))
      .returning();
    return updated;
  }

  if (!data.timezone || !data.openingTime || !data.closingTime || data.bookingWindowDays === undefined) {
    throw new Error("New clinic settings require timezone, openingTime, closingTime, and bookingWindowDays.");
  }

  const [created] = await db
    .insert(clinicSettingsTable)
    .values({
      clinicId,
      timezone: data.timezone,
      openingTime: data.openingTime,
      closingTime: data.closingTime,
      workingDays: data.workingDays ?? [1, 2, 3, 4, 5],
      appointmentSlotDurationMinutes: data.appointmentSlotDurationMinutes ?? 30,
      bookingWindowDays: data.bookingWindowDays,
      maxPatientsPerSlot: data.maxPatientsPerSlot ?? 1,
      allowWalkins: data.allowWalkins ?? false,
      onlineBookingEnabled: data.onlineBookingEnabled ?? true,
      whatsappSelfServiceBookingEnabled: data.whatsappSelfServiceBookingEnabled ?? true,
      maxBookingsPerDay: data.maxBookingsPerDay ?? null,
    })
    .returning();

  return created;
}
