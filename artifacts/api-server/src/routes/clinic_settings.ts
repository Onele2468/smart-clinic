import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";
import { getClinicSettings, updateClinicSettings } from "../services/clinic-settings.service";
import {
  NOTIFICATION_PREFERENCE_KEYS,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notifications/notification-preferences.service";

const router: IRouter = Router();

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:mm format");

const UpdateClinicSettingsBody = z.object({
  timezone: z.string().min(1).optional(),
  openingTime: timeString.optional(),
  opening_time: timeString.optional(),
  closingTime: timeString.optional(),
  closing_time: timeString.optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
  booking_window_days: z.number().int().min(1).max(365).optional(),
  allowWalkins: z.boolean().optional(),
  allow_walkins: z.boolean().optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  working_days: z.array(z.number().int().min(0).max(6)).optional(),
  appointmentSlotDurationMinutes: z.number().int().min(5).max(240).optional(),
  appointment_slot_duration_minutes: z.number().int().min(5).max(240).optional(),
  maxPatientsPerSlot: z.number().int().min(1).max(100).optional(),
  max_patients_per_slot: z.number().int().min(1).max(100).optional(),
  onlineBookingEnabled: z.boolean().optional(),
  online_booking_enabled: z.boolean().optional(),
  whatsappSelfServiceBookingEnabled: z.boolean().optional(),
  whatsapp_self_service_booking_enabled: z.boolean().optional(),
  maxBookingsPerDay: z.number().int().min(1).nullable().optional(),
  max_bookings_per_day: z.number().int().min(1).nullable().optional(),
});

const NotificationPreferencesBody = z.object(
  Object.fromEntries(NOTIFICATION_PREFERENCE_KEYS.map((key) => [key, z.boolean().optional()])) as Record<
    (typeof NOTIFICATION_PREFERENCE_KEYS)[number],
    z.ZodOptional<z.ZodBoolean>
  >,
);

router.get(
  "/clinic-settings/:clinicId",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const settings = await getClinicSettings(clinicId);
    res.json(settings);
  },
);

router.put(
  "/clinic-settings/:clinicId",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const parsed = UpdateClinicSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updated = await updateClinicSettings(clinicId, {
      timezone: parsed.data.timezone,
      openingTime: parsed.data.openingTime ?? parsed.data.opening_time,
      closingTime: parsed.data.closingTime ?? parsed.data.closing_time,
      workingDays: parsed.data.workingDays ?? parsed.data.working_days,
      appointmentSlotDurationMinutes:
        parsed.data.appointmentSlotDurationMinutes ?? parsed.data.appointment_slot_duration_minutes,
      bookingWindowDays: parsed.data.bookingWindowDays ?? parsed.data.booking_window_days,
      maxPatientsPerSlot: parsed.data.maxPatientsPerSlot ?? parsed.data.max_patients_per_slot,
      allowWalkins: parsed.data.allowWalkins ?? parsed.data.allow_walkins,
      onlineBookingEnabled: parsed.data.onlineBookingEnabled ?? parsed.data.online_booking_enabled,
      whatsappSelfServiceBookingEnabled:
        parsed.data.whatsappSelfServiceBookingEnabled ?? parsed.data.whatsapp_self_service_booking_enabled,
      maxBookingsPerDay: parsed.data.maxBookingsPerDay ?? parsed.data.max_bookings_per_day,
    });
    res.json(updated);
  },
);

router.get(
  "/clinic-settings/:clinicId/notification-preferences",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    res.json(await getNotificationPreferences(clinicId));
  },
);

router.put(
  "/clinic-settings/:clinicId/notification-preferences",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const parsed = NotificationPreferencesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    res.json(await updateNotificationPreferences(clinicId, parsed.data));
  },
);

export default router;
