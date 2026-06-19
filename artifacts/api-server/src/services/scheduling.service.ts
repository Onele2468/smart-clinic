import { db } from "@workspace/db";
import { appointmentsTable, doctorAvailabilityTable } from "@workspace/db";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getClinicSettings } from "./clinic-settings.service";

const SLOT_SEARCH_STEP_MINUTES = 15;
const CANCELLED_APPOINTMENT_STATUS = "cancelled";
const AVAILABLE_DOCTOR_AVAILABILITY_STATUS = "available";
const UNAVAILABLE_STAFF_STATUSES = new Set(["offline", "on_break", "unavailable", "leave", "busy", "consultation", "break", "lunch", "off"]);

export type ClinicSchedulingSettings = {
  clinicId: string;
  timezone: string;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: number[];
  appointmentSlotDurationMinutes: number;
  bookingWindowDays: number;
  maxPatientsPerSlot: number;
  allowWalkins: boolean | null;
  onlineBookingEnabled: boolean;
  whatsappSelfServiceBookingEnabled: boolean;
  maxBookingsPerDay: number | null;
};

export type DoctorSchedulingProfile = {
  doctorId: string;
  doctorName: string;
  departmentName: string;
  staffStatus?: string | null;
  maxPatientsPerDay: number;
  appointmentDurationMinutes: number;
};

export type DoctorWorkingWindow = {
  startTime: string;
  endTime: string;
};

export type AppointmentSlot = {
  doctorId: string;
  doctorName: string;
  departmentName: string;
  scheduledAt: string;
  durationMinutes: number;
};

export type AppointmentSlotValidationCode =
  | "slot_available"
  | "booking_window_exceeded"
  | "doctor_unavailable"
  | "clinic_closed"
  | "doctor_daily_capacity_full"
  | "clinic_daily_capacity_full"
  | "slot_occupied";

export type AppointmentSlotValidation = {
  available: boolean;
  code: AppointmentSlotValidationCode;
  reason: string;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export async function getClinicTimezone(clinicId: string): Promise<string> {
  const settings = await getClinicSettings(clinicId);
  return settings.timezone;
}

export async function getClinicSchedulingSettings(clinicId: string): Promise<ClinicSchedulingSettings> {
  const settings = await getClinicSettings(clinicId);
  return {
    clinicId,
    timezone: settings.timezone,
    bookingWindowDays: settings.bookingWindowDays,
    openingTime: settings.openingTime,
    closingTime: settings.closingTime,
    workingDays: Array.isArray(settings.workingDays) ? (settings.workingDays as number[]) : [1, 2, 3, 4, 5],
    appointmentSlotDurationMinutes: settings.appointmentSlotDurationMinutes,
    maxPatientsPerSlot: settings.maxPatientsPerSlot,
    allowWalkins: settings.allowWalkins,
    onlineBookingEnabled: settings.onlineBookingEnabled,
    whatsappSelfServiceBookingEnabled: settings.whatsappSelfServiceBookingEnabled,
    maxBookingsPerDay: settings.maxBookingsPerDay,
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function overlaps(start: Date, end: Date, otherStart: Date, otherEnd: Date): boolean {
  return start < otherEnd && end > otherStart;
}

function localParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatClinicLocalDateTime(date: Date, timeZone: string): string {
  const parts = localParts(date, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return localAsUtc - date.getTime();
}

function dateFromClinicLocalParts(timeZone: string, parts: Omit<LocalDateParts, "second"> & { second?: number }): Date {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(firstPass, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset);
}

function clinicLocalDateAtDayOffset(now: Date, dayOffset: number, timeZone: string): Date {
  const parts = localParts(now, timeZone);
  return dateFromClinicLocalParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day + dayOffset,
    hour: 0,
    minute: 0,
  });
}

function getClinicLocalDayOfWeek(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function parseTimeOnClinicDate(date: Date, time: string, timeZone: string): Date {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? "0");
  const parts = localParts(date, timeZone);

  return dateFromClinicLocalParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  });
}

function getClinicLocalDayBounds(date: Date, timeZone: string): { start: Date; end: Date } {
  const parts = localParts(date, timeZone);
  const start = dateFromClinicLocalParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
  });
  const end = dateFromClinicLocalParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day + 1,
    hour: 0,
    minute: 0,
  });
  return { start, end };
}

function roundUpToStep(date: Date, stepMinutes: number): Date {
  const stepMs = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}

function laterDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function earlierDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function isWithinBookingWindow(scheduledAt: Date, now: Date, bookingWindowDays: number, timeZone: string): boolean {
  if (scheduledAt < now) return false;
  const windowEnd = clinicLocalDateAtDayOffset(now, bookingWindowDays, timeZone);
  return scheduledAt < windowEnd;
}

async function getDayAppointments(clinicId: string, doctorId: string, date: Date, timeZone: string) {
  const { start, end } = getClinicLocalDayBounds(date, timeZone);
  return db
    .select({
      scheduledAt: appointmentsTable.scheduledAt,
      durationMinutes: appointmentsTable.durationMinutes,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.doctorId, doctorId),
        gte(appointmentsTable.scheduledAt, start),
        lt(appointmentsTable.scheduledAt, end),
        ne(appointmentsTable.status, CANCELLED_APPOINTMENT_STATUS),
      ),
    );
}

async function getClinicDayAppointmentCount(clinicId: string, date: Date, timeZone: string): Promise<number> {
  const { start, end } = getClinicLocalDayBounds(date, timeZone);
  const rows = await db
    .select({ scheduledAt: appointmentsTable.scheduledAt })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        gte(appointmentsTable.scheduledAt, start),
        lt(appointmentsTable.scheduledAt, end),
        ne(appointmentsTable.status, CANCELLED_APPOINTMENT_STATUS),
      ),
    );

  return rows.length;
}

export async function getDoctorAvailability(params: {
  clinicId: string;
  doctorId: string;
  dayOfWeek: number;
  timezone?: string;
}): Promise<DoctorWorkingWindow[]> {
  const rows = await db
    .select({
      startTime: doctorAvailabilityTable.startTime,
      endTime: doctorAvailabilityTable.endTime,
      isAvailable: doctorAvailabilityTable.isAvailable,
      status: doctorAvailabilityTable.status,
    })
    .from(doctorAvailabilityTable)
    .where(
      and(
        eq(doctorAvailabilityTable.clinicId, params.clinicId),
        eq(doctorAvailabilityTable.doctorId, params.doctorId),
        eq(doctorAvailabilityTable.dayOfWeek, params.dayOfWeek),
      ),
    );

  const availableRows = rows.filter((row) => row.isAvailable === true && row.status === AVAILABLE_DOCTOR_AVAILABILITY_STATUS);
  logger.info(
    {
      clinic_id: params.clinicId,
      clinicId: params.clinicId,
      doctor_id: params.doctorId,
      doctorId: params.doctorId,
      timezone: params.timezone ?? null,
      current_clinic_local_datetime: params.timezone ? formatClinicLocalDateTime(new Date(), params.timezone) : null,
      currentClinicLocalDateTime: params.timezone ? formatClinicLocalDateTime(new Date(), params.timezone) : null,
      calculated_day_of_week: params.dayOfWeek,
      dayOfWeek: params.dayOfWeek,
      rowsFound: rows.length,
      rowsLoaded: rows.length,
      doctor_availability_rows_loaded: rows.map((row) => ({
        start_time: row.startTime,
        end_time: row.endTime,
        is_available: row.isAvailable,
        status: row.status,
      })),
      availableRows: availableRows.length,
    },
    "DOCTOR_AVAILABILITY_LOOKUP",
  );

  return availableRows.map((row) => ({ startTime: row.startTime, endTime: row.endTime }));
}

export async function getDoctorWorkingWindow(params: {
  clinicId: string;
  doctorId: string;
  date: Date;
  timezone?: string;
}): Promise<DoctorWorkingWindow[]> {
  const timezone = params.timezone ?? (await getClinicTimezone(params.clinicId));
  const dayOfWeek = getClinicLocalDayOfWeek(params.date, timezone);

  logger.info(
    {
      clinic_id: params.clinicId,
      clinicId: params.clinicId,
      doctor_id: params.doctorId,
      doctorId: params.doctorId,
      timezone,
      current_clinic_local_datetime: formatClinicLocalDateTime(new Date(), timezone),
      currentClinicLocalDateTime: formatClinicLocalDateTime(new Date(), timezone),
      date: params.date.toISOString(),
      candidate_clinic_local_datetime: formatClinicLocalDateTime(params.date, timezone),
      calculated_day_of_week: dayOfWeek,
      dayOfWeek,
    },
    "SLOT_GENERATION",
  );

  return getDoctorAvailability({
    clinicId: params.clinicId,
    doctorId: params.doctorId,
    dayOfWeek,
    timezone,
  });
}

export async function isDoctorAvailable(params: {
  clinicId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
  maxPatientsPerDay?: number;
  timezone?: string;
}): Promise<boolean> {
  const validation = await validateAppointmentSlot(params);
  return validation.available;
}

export async function validateAppointmentSlot(params: {
  clinicId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
  maxPatientsPerDay?: number;
  timezone?: string;
  now?: Date;
}): Promise<AppointmentSlotValidation> {
  const settings = await getClinicSchedulingSettings(params.clinicId);
  const timezone = params.timezone ?? settings.timezone;
  const now = params.now ?? new Date();

  if (!isWithinBookingWindow(params.scheduledAt, now, settings.bookingWindowDays, timezone)) {
    return {
      available: false,
      code: "booking_window_exceeded",
      reason: "The selected time is outside the clinic booking window.",
    };
  }
  if (!settings.workingDays.includes(getClinicLocalDayOfWeek(params.scheduledAt, timezone))) {
    return {
      available: false,
      code: "clinic_closed",
      reason: "The clinic is closed on the selected day.",
    };
  }

  const windows = await getDoctorWorkingWindow({
    clinicId: params.clinicId,
    doctorId: params.doctorId,
    date: params.scheduledAt,
    timezone,
  });

  logger.info(
    {
      clinic_id: params.clinicId,
      clinicId: params.clinicId,
      doctor_id: params.doctorId,
      doctorId: params.doctorId,
      timezone,
      current_clinic_local_datetime: formatClinicLocalDateTime(new Date(), timezone),
      currentClinicLocalDateTime: formatClinicLocalDateTime(new Date(), timezone),
      scheduled_at: params.scheduledAt.toISOString(),
      scheduledAt: params.scheduledAt.toISOString(),
      scheduled_at_clinic_local: formatClinicLocalDateTime(params.scheduledAt, timezone),
      calculated_day_of_week: getClinicLocalDayOfWeek(params.scheduledAt, timezone),
      windowsLoaded: windows.length,
      doctorWindows: windows,
      clinicOpeningTime: settings.openingTime,
      clinicClosingTime: settings.closingTime,
    },
    "SLOT_VALIDATION_CONTEXT",
  );

  if (windows.length === 0) {
    return {
      available: false,
      code: "doctor_unavailable",
      reason: "The doctor is not available at that time.",
    };
  }

  const insideWindow = windows.some((window) => {
    const doctorStart = parseTimeOnClinicDate(params.scheduledAt, window.startTime, timezone);
    const doctorEnd = parseTimeOnClinicDate(params.scheduledAt, window.endTime, timezone);
    const clinicStart = settings.openingTime ? parseTimeOnClinicDate(params.scheduledAt, settings.openingTime, timezone) : doctorStart;
    const clinicEnd = settings.closingTime ? parseTimeOnClinicDate(params.scheduledAt, settings.closingTime, timezone) : doctorEnd;
    const start = laterDate(doctorStart, clinicStart);
    const end = earlierDate(doctorEnd, clinicEnd);
    return params.scheduledAt >= start && addMinutes(params.scheduledAt, params.durationMinutes) <= end;
  });
  if (!insideWindow) {
    return {
      available: false,
      code: settings.openingTime || settings.closingTime ? "clinic_closed" : "doctor_unavailable",
      reason: settings.openingTime || settings.closingTime
        ? "The clinic is closed at that time."
        : "The appointment does not fit inside the doctor's working hours.",
    };
  }

  const existing = await getDayAppointments(params.clinicId, params.doctorId, params.scheduledAt, timezone);
  if (params.maxPatientsPerDay !== undefined && existing.length >= params.maxPatientsPerDay) {
    return {
      available: false,
      code: "doctor_daily_capacity_full",
      reason: "The doctor is fully booked for that day.",
    };
  }
  if (settings.maxBookingsPerDay !== null) {
    const clinicBookings = await getClinicDayAppointmentCount(params.clinicId, params.scheduledAt, timezone);
    if (clinicBookings >= settings.maxBookingsPerDay) {
      return {
        available: false,
        code: "clinic_daily_capacity_full",
        reason: "The clinic is fully booked for that day.",
      };
    }
  }

  const slotDurationMinutes = settings.appointmentSlotDurationMinutes || params.durationMinutes;
  const slotEnd = addMinutes(params.scheduledAt, slotDurationMinutes);
  logger.info(
    {
      clinic_id: params.clinicId,
      clinicId: params.clinicId,
      doctor_id: params.doctorId,
      doctorId: params.doctorId,
      timezone,
      current_clinic_local_datetime: formatClinicLocalDateTime(new Date(), timezone),
      scheduledAt: params.scheduledAt.toISOString(),
      scheduled_at: params.scheduledAt.toISOString(),
      scheduled_at_clinic_local: formatClinicLocalDateTime(params.scheduledAt, timezone),
    },
    "APPOINTMENT_COLLISION_CHECK",
  );

  const overlapping = existing.filter((appointment) => {
    const bookedStart = new Date(appointment.scheduledAt);
    const bookedEnd = addMinutes(bookedStart, appointment.durationMinutes ?? slotDurationMinutes);
    return overlaps(params.scheduledAt, slotEnd, bookedStart, bookedEnd);
  });

  if (overlapping.length >= settings.maxPatientsPerSlot) {
    return {
      available: false,
      code: "slot_occupied",
      reason: "That appointment slot has already been booked.",
    };
  }

  return {
    available: true,
    code: "slot_available",
    reason: "The appointment slot is available.",
  };
}

export async function findAvailableSlots(params: {
  clinicId: string;
  doctors: DoctorSchedulingProfile[];
  limit?: number;
  now?: Date;
  timezone?: string;
}): Promise<AppointmentSlot[]> {
  const settings = await getClinicSchedulingSettings(params.clinicId);
  const timezone = params.timezone ?? settings.timezone;
  const limit = params.limit ?? 3;
  const now = params.now ?? new Date();
  const slots: AppointmentSlot[] = [];

  logger.info(
    {
      clinic_id: params.clinicId,
      clinicId: params.clinicId,
      timezone,
      current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
      currentClinicLocalDateTime: formatClinicLocalDateTime(now, timezone),
      bookingWindowDays: settings.bookingWindowDays,
    clinicOpeningTime: settings.openingTime,
      clinicClosingTime: settings.closingTime,
      workingDays: settings.workingDays,
      appointmentSlotDurationMinutes: settings.appointmentSlotDurationMinutes,
      maxPatientsPerSlot: settings.maxPatientsPerSlot,
      maxBookingsPerDay: settings.maxBookingsPerDay,
      doctors: params.doctors.map((doctor) => ({
        doctor_id: doctor.doctorId,
        doctorId: doctor.doctorId,
        doctorName: doctor.doctorName,
        staffStatus: doctor.staffStatus ?? null,
        maxPatientsPerDay: doctor.maxPatientsPerDay,
        appointmentDurationMinutes: doctor.appointmentDurationMinutes,
      })),
      limit,
    },
    "SLOT_SEARCH_START",
  );

  for (let dayOffset = 0; dayOffset < settings.bookingWindowDays && slots.length < limit; dayOffset += 1) {
    const date = clinicLocalDateAtDayOffset(now, dayOffset, timezone);
    const dayOfWeek = getClinicLocalDayOfWeek(date, timezone);
    if (!settings.workingDays.includes(dayOfWeek)) continue;
    let clinicCapacityRemaining =
      settings.maxBookingsPerDay === null
        ? Number.POSITIVE_INFINITY
        : settings.maxBookingsPerDay - (await getClinicDayAppointmentCount(params.clinicId, date, timezone));

    logger.info(
      {
        clinic_id: params.clinicId,
        clinicId: params.clinicId,
        timezone,
        current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
        currentClinicLocalDateTime: formatClinicLocalDateTime(now, timezone),
        search_day_offset: dayOffset,
        candidate_date: date.toISOString(),
        candidate_clinic_local_datetime: formatClinicLocalDateTime(date, timezone),
        calculated_day_of_week: dayOfWeek,
        dayOfWeek,
        clinicCapacityRemaining,
      },
      "SLOT_GENERATION_DAY",
    );

    if (clinicCapacityRemaining <= 0) continue;

    for (const doctor of params.doctors) {
      if (clinicCapacityRemaining <= 0) break;
      if (UNAVAILABLE_STAFF_STATUSES.has(doctor.staffStatus ?? "")) {
        logger.info(
          {
            clinic_id: params.clinicId,
            clinicId: params.clinicId,
            doctor_id: doctor.doctorId,
            doctorId: doctor.doctorId,
            timezone,
            current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
            candidate_clinic_local_datetime: formatClinicLocalDateTime(date, timezone),
            calculated_day_of_week: dayOfWeek,
            staffStatus: doctor.staffStatus ?? null,
          },
          "SLOT_GENERATION_DOCTOR_SKIPPED",
        );
        continue;
      }

      const windows = await getDoctorWorkingWindow({
        clinicId: params.clinicId,
        doctorId: doctor.doctorId,
        date,
        timezone,
      });
      if (windows.length === 0) {
        logger.info(
          {
            clinic_id: params.clinicId,
            clinicId: params.clinicId,
            doctor_id: doctor.doctorId,
            doctorId: doctor.doctorId,
            timezone,
            current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
            candidate_clinic_local_datetime: formatClinicLocalDateTime(date, timezone),
            calculated_day_of_week: dayOfWeek,
            windowsLoaded: 0,
            slots_generated_for_doctor_day: 0,
            reason: "NO_DOCTOR_AVAILABILITY_ROWS_FOR_DAY",
          },
          "SLOT_GENERATION_DOCTOR_DAY_RESULT",
        );
        continue;
      }

      const existing = await getDayAppointments(params.clinicId, doctor.doctorId, date, timezone);
      let capacityRemaining = doctor.maxPatientsPerDay - existing.length;
      let doctorDaySlotsGenerated = 0;
      if (capacityRemaining <= 0) {
        logger.info(
          {
            clinic_id: params.clinicId,
            clinicId: params.clinicId,
            doctor_id: doctor.doctorId,
            doctorId: doctor.doctorId,
            timezone,
            current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
            candidate_clinic_local_datetime: formatClinicLocalDateTime(date, timezone),
            calculated_day_of_week: dayOfWeek,
            existingAppointments: existing.length,
            maxPatientsPerDay: doctor.maxPatientsPerDay,
            slots_generated_for_doctor_day: 0,
            reason: "DOCTOR_DAILY_CAPACITY_FULL",
          },
          "SLOT_GENERATION_DOCTOR_DAY_RESULT",
        );
        continue;
      }

      for (const window of windows) {
        const doctorStart = parseTimeOnClinicDate(date, window.startTime, timezone);
        const doctorEnd = parseTimeOnClinicDate(date, window.endTime, timezone);
        const clinicStart = settings.openingTime ? parseTimeOnClinicDate(date, settings.openingTime, timezone) : doctorStart;
        const clinicEnd = settings.closingTime ? parseTimeOnClinicDate(date, settings.closingTime, timezone) : doctorEnd;
        const start = laterDate(doctorStart, clinicStart);
        const end = earlierDate(doctorEnd, clinicEnd);
        if (start >= end) {
          logger.info(
            {
              clinic_id: params.clinicId,
              clinicId: params.clinicId,
              doctor_id: doctor.doctorId,
              doctorId: doctor.doctorId,
              timezone,
              current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
              candidate_clinic_local_datetime: formatClinicLocalDateTime(date, timezone),
              calculated_day_of_week: dayOfWeek,
              doctorWindow: window,
              clinicOpeningTime: settings.openingTime,
              clinicClosingTime: settings.closingTime,
              effectiveWindowStart: start.toISOString(),
              effectiveWindowEnd: end.toISOString(),
              reason: "CLINIC_BOUNDARY_EXCLUDES_DOCTOR_WINDOW",
            },
            "SLOT_GENERATION_WINDOW_SKIPPED",
          );
          continue;
        }
        const firstPossibleStart = dayOffset === 0 && now > start ? roundUpToStep(now, SLOT_SEARCH_STEP_MINUTES) : start;
        let cursor = firstPossibleStart < start ? start : firstPossibleStart;

        const slotDurationMinutes = settings.appointmentSlotDurationMinutes || doctor.appointmentDurationMinutes;
        while (capacityRemaining > 0 && addMinutes(cursor, slotDurationMinutes) <= end) {
          if (clinicCapacityRemaining <= 0) break;
          const slotEnd = addMinutes(cursor, slotDurationMinutes);
          logger.info(
            {
              clinic_id: params.clinicId,
              clinicId: params.clinicId,
              doctor_id: doctor.doctorId,
              doctorId: doctor.doctorId,
              timezone,
              current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
              scheduledAt: cursor.toISOString(),
              scheduled_at: cursor.toISOString(),
              scheduled_at_clinic_local: formatClinicLocalDateTime(cursor, timezone),
              calculated_day_of_week: getClinicLocalDayOfWeek(cursor, timezone),
              existingAppointments: existing.length,
              alreadyGeneratedSlotsForDoctor: slots.filter((slot) => slot.doctorId === doctor.doctorId).length,
            },
            "APPOINTMENT_COLLISION_CHECK",
          );

          const overlappingCount = [...existing, ...slots.filter((slot) => slot.doctorId === doctor.doctorId)].filter((appointment) => {
            const bookedStart = new Date(appointment.scheduledAt);
            const bookedEnd = addMinutes(bookedStart, appointment.durationMinutes ?? slotDurationMinutes);
            return overlaps(cursor, slotEnd, bookedStart, bookedEnd);
          }).length;

          if (overlappingCount < settings.maxPatientsPerSlot) {
            const slot = {
              doctorId: doctor.doctorId,
              doctorName: doctor.doctorName,
              departmentName: doctor.departmentName,
              scheduledAt: cursor.toISOString(),
              durationMinutes: slotDurationMinutes,
            };
            slots.push(slot);
            doctorDaySlotsGenerated += 1;
            capacityRemaining -= 1;
            clinicCapacityRemaining -= 1;
            logger.info(
              {
                clinic_id: params.clinicId,
                clinicId: params.clinicId,
                doctor_id: doctor.doctorId,
                doctorId: doctor.doctorId,
                timezone,
                current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
                scheduled_at: slot.scheduledAt,
                scheduledAt: slot.scheduledAt,
                scheduled_at_clinic_local: formatClinicLocalDateTime(cursor, timezone),
                calculated_day_of_week: getClinicLocalDayOfWeek(cursor, timezone),
                doctorWindow: window,
                effectiveWindowStart: start.toISOString(),
                effectiveWindowStartClinicLocal: formatClinicLocalDateTime(start, timezone),
                effectiveWindowEnd: end.toISOString(),
                effectiveWindowEndClinicLocal: formatClinicLocalDateTime(end, timezone),
                slots_generated_for_doctor_day: doctorDaySlotsGenerated,
                total_slots_generated: slots.length,
              },
              "SLOT_GENERATED",
            );
            if (slots.length >= limit) break;
          }

          cursor = addMinutes(cursor, SLOT_SEARCH_STEP_MINUTES);
        }

        if (slots.length >= limit) break;
      }

      logger.info(
        {
          clinic_id: params.clinicId,
          clinicId: params.clinicId,
          doctor_id: doctor.doctorId,
          doctorId: doctor.doctorId,
          timezone,
          current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
          candidate_clinic_local_datetime: formatClinicLocalDateTime(date, timezone),
          calculated_day_of_week: dayOfWeek,
          windowsLoaded: windows.length,
          existingAppointments: existing.length,
          slots_generated_for_doctor_day: doctorDaySlotsGenerated,
          total_slots_generated: slots.length,
        },
        "SLOT_GENERATION_DOCTOR_DAY_RESULT",
      );

      if (slots.length >= limit) break;
    }
  }

  const sortedSlots = slots.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  logger.info(
    {
      clinic_id: params.clinicId,
      clinicId: params.clinicId,
      timezone,
      current_clinic_local_datetime: formatClinicLocalDateTime(now, timezone),
      currentClinicLocalDateTime: formatClinicLocalDateTime(now, timezone),
      slots_generated: sortedSlots.length,
      slotsGenerated: sortedSlots.length,
      slots: sortedSlots.map((slot) => ({
        doctor_id: slot.doctorId,
        doctorId: slot.doctorId,
        scheduled_at: slot.scheduledAt,
        scheduledAt: slot.scheduledAt,
        scheduled_at_clinic_local: formatClinicLocalDateTime(new Date(slot.scheduledAt), timezone),
        calculated_day_of_week: getClinicLocalDayOfWeek(new Date(slot.scheduledAt), timezone),
        durationMinutes: slot.durationMinutes,
      })),
    },
    "SLOTS_GENERATED",
  );

  return sortedSlots;
}
