import { db } from "@workspace/db";
import {
  appointmentCancellationsTable,
  appointmentsTable,
  clinicBotSettingsTable,
  clinicMembersTable,
  clinicsTable,
  departmentsTable,
  doctorProfilesTable,
  notificationsTable,
  patientsTable,
  receptionRequestsTable,
  staffAvailabilityTable,
  usersTable,
  whatsappConversationsTable,
  whatsappMessagesTable,
  whatsappStateHistoryTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { logActivity, logActivityAsync } from "../../lib/activityLogger";
import { deliverPatientWhatsAppMessage, normalizePhoneNumber } from "./whatsapp.service";
import type { ClinicWhatsAppConfig } from "./whatsapp.types";
import {
  findAvailableSlots as findSchedulingAvailableSlots,
  getClinicSchedulingSettings,
  getClinicTimezone,
  validateAppointmentSlot,
  type AppointmentSlot,
} from "../scheduling.service";

/*
Authoritative WhatsApp conversation state machine

Current State -> Incoming Message -> Handler -> Next State

idle -> any message -> detectIntent, handleIdleIntent -> awaiting_menu_selection | awaiting_booking_reason | awaiting_cancel_reason | idle
awaiting_menu_selection -> menu number -> handleMenuSelection -> awaiting_booking_reason | awaiting_cancel_reason | idle
awaiting_id_number -> SA ID or 6 -> handleConversationState -> awaiting_menu_selection | awaiting_id_number | idle
awaiting_booking_reason -> free text reason -> handleBookingReason -> awaiting_booking_slot_selection | idle
awaiting_booking_slot_selection -> numeric slot choice -> handleSlotSelection -> idle
awaiting_booking_slot_selection -> non-numeric text -> handleSlotSelection -> awaiting_booking_slot_selection
awaiting_cancel_reason -> free text reason -> handleCancelReason -> awaiting_cancel_confirmation
awaiting_cancel_confirmation -> YES or other text -> handleCancelConfirmation -> idle
legacy awaiting_department_selection / awaiting_doctor_selection / awaiting_booking_confirmation -> any message -> reset to idle

Only idle runs intent detection. Active states log INTENT_SKIPPED and consume the message through their state handler.
Booking completion always transitions to idle and clears temporary booking data.
*/

export type ConversationState =
  | "idle"
  | "awaiting_menu_selection"
  | "awaiting_patient_verification"
  | "awaiting_id_number"
  | "awaiting_department_selection"
  | "awaiting_doctor_selection"
  | "awaiting_booking_reason"
  | "awaiting_booking_slot_selection"
  | "awaiting_booking_confirmation"
  | "awaiting_cancel_reason"
  | "awaiting_cancel_confirmation"
  | "awaiting_reception_request";

type Intent =
  | "greeting"
  | "book_appointment"
  | "check_appointment"
  | "cancel_appointment"
  | "clinic_hours"
  | "my_doctor"
  | "speak_to_reception"
  | "medicine"
  | "missed_appointment"
  | "unknown";

type EngineConfig = ClinicWhatsAppConfig & { clinicName: string };

type ConversationData = {
  visitReason?: string;
  departmentName?: string;
  slots?: AppointmentSlot[];
  selectedSlot?: AppointmentSlot;
  cancelReason?: string;
  appointmentId?: string;
};

type StateMachineResult = {
  reply: string;
  nextState?: ConversationState | null;
  patientId?: string | null;
  data?: ConversationData;
  intent?: Intent | null;
};

type DoctorCandidate = {
  doctorId: string;
  doctorName: string;
  departmentName: string;
  staffStatus: string;
  maxPatientsPerDay: number;
  appointmentDurationMinutes: number;
  preferenceRank: number;
};

const RECEPTION_ROLES = ["clinic_admin", "receptionist", "doctor", "nurse"];
const ACTIVE_APPOINTMENT_STATUSES = ["scheduled", "confirmed", "checked_in"];
const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_DAILY_CAPACITY = 20;
const BOOKING_FLOW_TIMEOUT_MS = 15 * 60_000;
const BOOKING_FLOW_STATES: ConversationState[] = [
  "awaiting_department_selection",
  "awaiting_doctor_selection",
  "awaiting_booking_reason",
  "awaiting_booking_slot_selection",
  "awaiting_booking_confirmation",
];
const RESTART_BOOKING_FLOW_COMMANDS = new Set(["hi", "hello", "hey", "start", "menu", "help"]);

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function normalizeForIntent(text: string): string {
  return cleanText(text).toLowerCase();
}

function isGreeting(text: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|howzit|hie)\b/i.test(cleanText(text));
}

function shouldRestartBookingFlow(text: string): boolean {
  return RESTART_BOOKING_FLOW_COMMANDS.has(normalizeForIntent(text));
}

function isBookingFlowState(state: string): state is ConversationState {
  return BOOKING_FLOW_STATES.includes(state as ConversationState);
}

function hasBookingFlowExpired(lastMessageAt: Date | string, now: Date): boolean {
  return now.getTime() - new Date(lastMessageAt).getTime() > BOOKING_FLOW_TIMEOUT_MS;
}

function detectIntent(text: string): Intent {
  const normalized = normalizeForIntent(text);
  if (!normalized) return "unknown";
  if (["1", "book", "appointment"].includes(normalized)) return "book_appointment";
  if (["2", "check"].includes(normalized)) return "check_appointment";
  if (["3", "cancel"].includes(normalized)) return "cancel_appointment";
  if (["4", "hours"].includes(normalized)) return "clinic_hours";
  if (["5", "doctor"].includes(normalized)) return "my_doctor";
  if (["6", "reception", "help"].includes(normalized)) return "speak_to_reception";
  if (isGreeting(normalized)) return "greeting";
  if (/\b(book|appointment|see a doctor|consult|clinic visit|my child is sick|sick|flu|cough|fever|headache|pain)\b/.test(normalized)) {
    return "book_appointment";
  }
  if (/\b(cancel|call off|cannot come|can't come|reschedule)\b/.test(normalized)) return "cancel_appointment";
  if (/\b(when.*open|open|close|hours|time.*clinic)\b/.test(normalized)) return "clinic_hours";
  if (/\b(my doctor|who is my doctor|assigned doctor)\b/.test(normalized)) return "my_doctor";
  if (/\b(reception|receptionist|speak to someone|human|help|call me|urgent)\b/.test(normalized)) return "speak_to_reception";
  if (/\b(check.*appointment|when.*appointment|next appointment)\b/.test(normalized)) return "check_appointment";
  if (/\b(medicine|medication|pills|prescription|repeat script)\b/.test(normalized)) return "medicine";
  if (/\b(missed|miss)\b.*\bappointment\b/.test(normalized)) return "missed_appointment";
  return "unknown";
}

function buildWelcome(clinicName: string, custom?: string | null): string {
  const greeting = custom?.trim() || "Hello. How can I help you today?";
  return `${greeting}

1. Book Appointment
2. Check Appointment
3. Cancel Appointment
4. Clinic Hours
5. My Doctor
6. Speak To Reception

Reply with a number.`;
}

function formatDateTime(date: Date, timeZone: string): string {
  return date.toLocaleString("en-ZA", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-ZA", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-ZA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getConversationData(value: unknown): ConversationData {
  return parseJsonObject(value) as ConversationData;
}

function mapDepartmentFromReason(reason: string): string {
  const text = normalizeForIntent(reason);
  if (/\b(pregnan|antenatal|baby coming|women|gynae|period|contraception)\b/.test(text)) return "Women's Health";
  if (/\b(skin|rash|eczema|itch|acne|burn)\b/.test(text)) return "Dermatology";
  if (/\b(child|baby|infant|toddler|son|daughter)\b/.test(text)) return "General Practice";
  if (/\b(flu|cold|cough|fever|headache|sore throat|chest|stomach|pain|medicine|medication)\b/.test(text)) {
    return "General Practice";
  }
  return "General Practice";
}

async function getBotSettings(clinicId: string) {
  const [settings] = await db
    .select()
    .from(clinicBotSettingsTable)
    .where(eq(clinicBotSettingsTable.clinicId, clinicId))
    .limit(1);
  return settings ?? null;
}

async function getOrCreateConversation(params: {
  clinicId: string;
  patientPhone: string;
  patientId?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(whatsappConversationsTable)
    .where(
      and(
        eq(whatsappConversationsTable.clinicId, params.clinicId),
        eq(whatsappConversationsTable.phoneNumber, params.patientPhone),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(whatsappConversationsTable)
      .set({
        patientId: existing.patientId ?? params.patientId ?? null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConversationsTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  try {
    const [created] = await db
      .insert(whatsappConversationsTable)
      .values({
        clinicId: params.clinicId,
        patientId: params.patientId ?? null,
        phoneNumber: params.patientPhone,
        currentState: "idle",
        stateData: {},
        lastMessageAt: new Date(),
        isActive: true,
      })
      .returning();
    return created!;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [createdByConcurrentRequest] = await db
      .select()
      .from(whatsappConversationsTable)
      .where(
        and(
          eq(whatsappConversationsTable.clinicId, params.clinicId),
          eq(whatsappConversationsTable.phoneNumber, params.patientPhone),
        ),
      )
      .limit(1);
    if (!createdByConcurrentRequest) throw err;
    return createdByConcurrentRequest;
  }
}

async function setConversationState(params: {
  clinicId: string;
  conversationId: string;
  fromState: string;
  toState: ConversationState;
  intent?: Intent | null;
  messageText?: string;
  patientId?: string | null;
  data?: ConversationData;
}) {
  await db
    .update(whatsappConversationsTable)
    .set({
      currentState: params.toState,
      patientId: params.patientId ?? undefined,
      stateData: params.data ?? {},
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversationsTable.id, params.conversationId));

  logger.info(
    {
      clinicId: params.clinicId,
      conversationId: params.conversationId,
      patientId: params.patientId ?? null,
      fromState: params.fromState,
      toState: params.toState,
      intent: params.intent ?? null,
    },
    "CONVERSATION_STATE_TRANSITION",
  );

  await db.insert(whatsappStateHistoryTable).values({
    clinicId: params.clinicId,
    conversationId: params.conversationId,
    fromState: params.fromState,
    toState: params.toState,
    intent: params.intent ?? null,
    messageText: params.messageText?.slice(0, 1000) ?? null,
    metadata: params.data ?? {},
  });
}

async function resetConversationToIdle(params: {
  clinicId: string;
  conversationId: string;
  fromState: string;
  patientId?: string | null;
  reason: "booking_flow_expired" | "booking_flow_restarted" | "conversation_reset";
  messageText?: string;
  messageId?: string | null;
}) {
  logger.info(
    {
      clinicId: params.clinicId,
      conversationId: params.conversationId,
      patientId: params.patientId ?? null,
      fromState: params.fromState,
      toState: "idle",
      reason: params.reason,
      messageId: params.messageId ?? null,
    },
    "CONVERSATION_RESET",
  );

  await setConversationState({
    clinicId: params.clinicId,
    conversationId: params.conversationId,
    fromState: params.fromState,
    toState: "idle",
    intent: null,
    messageText: params.messageText,
    patientId: params.patientId,
    data: {},
  });
}

async function storeChatMessage(params: {
  clinicId: string;
  conversationId: string;
  patientId?: string | null;
  direction: "inbound" | "outbound";
  phone: string;
  text: string;
  metaMessageId?: string | null;
}): Promise<boolean> {
  if (params.direction === "inbound" && params.metaMessageId) {
    const [existing] = await db
      .select({ id: whatsappMessagesTable.id })
      .from(whatsappMessagesTable)
      .where(
        and(
          eq(whatsappMessagesTable.clinicId, params.clinicId),
          eq(whatsappMessagesTable.direction, "inbound"),
          eq(whatsappMessagesTable.metaMessageId, params.metaMessageId),
        ),
      )
      .limit(1);

    if (existing) {
      logger.info(
        {
          clinicId: params.clinicId,
          conversationId: params.conversationId,
          patientId: params.patientId ?? null,
          messageId: params.metaMessageId,
        },
        "MESSAGE_DEDUPED",
      );
      return false;
    }
  }

  try {
    await db.insert(whatsappMessagesTable).values({
      clinicId: params.clinicId,
      patientId: params.patientId ?? null,
      conversationId: params.conversationId,
      direction: params.direction,
      actionType: params.direction === "inbound" ? "incoming_patient_message" : "conversation_reply",
      recipientPhone: params.phone,
      bodyPreview: params.text.slice(0, 500),
      messageText: params.text,
      metaMessageId: params.metaMessageId ?? null,
      deliveryStatus: params.direction === "inbound" ? "read" : params.metaMessageId ? "sent" : "pending",
      sentAt: params.direction === "outbound" && params.metaMessageId ? new Date() : null,
    });
  } catch (err) {
    if (params.direction === "inbound" && params.metaMessageId && isUniqueViolation(err)) {
      logger.info(
        {
          clinicId: params.clinicId,
          conversationId: params.conversationId,
          patientId: params.patientId ?? null,
          messageId: params.metaMessageId,
        },
        "MESSAGE_DEDUPED",
      );
      return false;
    }
    throw err;
  }
  return true;
}

async function resolvePatientByPhone(clinicId: string, phone: string) {
  const digits = normalizePhoneNumber(phone);
  if (!digits) return null;
  const local = digits.startsWith("27") ? `0${digits.slice(2)}` : digits;
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(
      and(
        eq(patientsTable.clinicId, clinicId),
        or(
          eq(patientsTable.contactNumber, digits),
          eq(patientsTable.contactNumber, `+${digits}`),
          eq(patientsTable.contactNumber, local),
        ),
      ),
    )
    .limit(1);
  return patient ?? null;
}

async function resolvePatientByIdNumber(clinicId: string, idNumber: string) {
  const normalized = idNumber.replace(/\s/g, "");
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(and(eq(patientsTable.clinicId, clinicId), eq(patientsTable.governmentIdNumber, normalized)))
    .limit(1);
  return patient ?? null;
}

async function sendReply(params: {
  config: EngineConfig;
  conversationId: string;
  patientId?: string | null;
  toPhone: string;
  body: string;
  logContext: Record<string, unknown>;
}) {
  const delivered = await deliverPatientWhatsAppMessage({
    config: params.config,
    toPhone: params.toPhone,
    body: params.body,
    logContext: params.logContext,
  });
  await storeChatMessage({
    clinicId: params.config.clinicId,
    conversationId: params.conversationId,
    patientId: params.patientId,
    direction: "outbound",
    phone: params.toPhone,
    text: params.body,
    metaMessageId: delivered.metaMessageId ?? null,
  });
}

async function notifyClinicStaff(params: {
  clinicId: string;
  type: string;
  title: string;
  message: string;
}) {
  const recipients = await db
    .select({ userId: clinicMembersTable.userId })
    .from(clinicMembersTable)
    .where(
      and(
        eq(clinicMembersTable.clinicId, params.clinicId),
        eq(clinicMembersTable.status, "active"),
        inArray(clinicMembersTable.role, RECEPTION_ROLES),
      ),
    );

  if (recipients.length === 0) return;

  await db.insert(notificationsTable).values(
    recipients.map((recipient) => ({
      clinicId: params.clinicId,
      userId: recipient.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      isRead: false,
    })),
  );
}

async function getUpcomingAppointment(clinicId: string, patientId: string) {
  const [appointment] = await db
    .select({
      id: appointmentsTable.id,
      patientId: appointmentsTable.patientId,
      doctorId: appointmentsTable.doctorId,
      doctorName: usersTable.name,
      scheduledAt: appointmentsTable.scheduledAt,
      status: appointmentsTable.status,
      durationMinutes: appointmentsTable.durationMinutes,
      visitReason: appointmentsTable.visitReason,
    })
    .from(appointmentsTable)
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        eq(appointmentsTable.patientId, patientId),
        gte(appointmentsTable.scheduledAt, new Date()),
        inArray(appointmentsTable.status, ACTIVE_APPOINTMENT_STATUSES),
      ),
    )
    .orderBy(asc(appointmentsTable.scheduledAt))
    .limit(1);
  return appointment ?? null;
}

async function getLastPatientDoctor(clinicId: string, patientId: string): Promise<string | null> {
  const [last] = await db
    .select({ doctorId: appointmentsTable.doctorId })
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.clinicId, clinicId), eq(appointmentsTable.patientId, patientId)))
    .orderBy(desc(appointmentsTable.scheduledAt))
    .limit(1);
  return last?.doctorId ?? null;
}

async function getPatientDoctorOwnership(clinicId: string, patientId: string) {
  const [patient] = await db
    .select({
      primaryDoctorId: patientsTable.primaryDoctorId,
      backupDoctorId: patientsTable.backupDoctorId,
    })
    .from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
    .limit(1);

  return {
    primaryDoctorId: patient?.primaryDoctorId ?? null,
    backupDoctorId: patient?.backupDoctorId ?? null,
  };
}

async function getDoctorById(clinicId: string, doctorId: string, departmentName: string): Promise<DoctorCandidate | null> {
  const [row] = await db
    .select({
      doctorId: usersTable.id,
      doctorName: usersTable.name,
      staffStatus: staffAvailabilityTable.status,
      departmentName: sql<string>`COALESCE(${departmentsTable.name}, ${departmentName})`,
      maxPatientsPerDay: doctorProfilesTable.maxPatientsPerDay,
      appointmentDurationMinutes: doctorProfilesTable.appointmentDurationMinutes,
    })
    .from(clinicMembersTable)
    .innerJoin(usersTable, eq(clinicMembersTable.userId, usersTable.id))
    .leftJoin(staffAvailabilityTable, and(eq(staffAvailabilityTable.userId, usersTable.id), eq(staffAvailabilityTable.clinicId, clinicId)))
    .leftJoin(doctorProfilesTable, and(eq(doctorProfilesTable.userId, usersTable.id), eq(doctorProfilesTable.clinicId, clinicId)))
    .leftJoin(departmentsTable, eq(departmentsTable.id, doctorProfilesTable.departmentId))
    .where(
      and(
        eq(clinicMembersTable.clinicId, clinicId),
        eq(clinicMembersTable.status, "active"),
        eq(clinicMembersTable.role, "doctor"),
        eq(usersTable.id, doctorId),
        or(sql`${doctorProfilesTable.id} IS NULL`, eq(doctorProfilesTable.isActive, true)),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    departmentName: row.departmentName ?? departmentName,
    staffStatus: row.staffStatus ?? "available",
    maxPatientsPerDay: row.maxPatientsPerDay ?? DEFAULT_DAILY_CAPACITY,
    appointmentDurationMinutes: row.appointmentDurationMinutes ?? DEFAULT_SLOT_MINUTES,
    preferenceRank: 99,
  };
}

async function getDoctors(clinicId: string, departmentName: string): Promise<DoctorCandidate[]> {
  const rows = await db
    .select({
      doctorId: usersTable.id,
      doctorName: usersTable.name,
      staffStatus: staffAvailabilityTable.status,
      departmentName: sql<string>`COALESCE(${departmentsTable.name}, ${departmentName})`,
      maxPatientsPerDay: doctorProfilesTable.maxPatientsPerDay,
      appointmentDurationMinutes: doctorProfilesTable.appointmentDurationMinutes,
    })
    .from(clinicMembersTable)
    .innerJoin(usersTable, eq(clinicMembersTable.userId, usersTable.id))
    .leftJoin(staffAvailabilityTable, and(eq(staffAvailabilityTable.userId, usersTable.id), eq(staffAvailabilityTable.clinicId, clinicId)))
    .leftJoin(doctorProfilesTable, and(eq(doctorProfilesTable.userId, usersTable.id), eq(doctorProfilesTable.clinicId, clinicId)))
    .leftJoin(departmentsTable, eq(departmentsTable.id, doctorProfilesTable.departmentId))
    .where(
      and(
        eq(clinicMembersTable.clinicId, clinicId),
        eq(clinicMembersTable.status, "active"),
        eq(clinicMembersTable.role, "doctor"),
        or(sql`${doctorProfilesTable.id} IS NULL`, eq(doctorProfilesTable.isActive, true)),
        or(
          sql`${doctorProfilesTable.departmentId} IS NULL`,
          sql`LOWER(${departmentsTable.name}) = LOWER(${departmentName})`,
          sql`LOWER(${doctorProfilesTable.specialty}) LIKE ${`%${departmentName.toLowerCase()}%`}`,
        ),
      ),
    );

  if (rows.length > 0) {
    return rows.map((row) => ({
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      departmentName: row.departmentName ?? departmentName,
      staffStatus: row.staffStatus ?? "available",
      maxPatientsPerDay: row.maxPatientsPerDay ?? DEFAULT_DAILY_CAPACITY,
      appointmentDurationMinutes: row.appointmentDurationMinutes ?? DEFAULT_SLOT_MINUTES,
      preferenceRank: 3,
    }));
  }

  const fallback = await db
    .select({
      doctorId: usersTable.id,
      doctorName: usersTable.name,
      staffStatus: staffAvailabilityTable.status,
    })
    .from(clinicMembersTable)
    .innerJoin(usersTable, eq(clinicMembersTable.userId, usersTable.id))
    .leftJoin(staffAvailabilityTable, and(eq(staffAvailabilityTable.userId, usersTable.id), eq(staffAvailabilityTable.clinicId, clinicId)))
    .where(
      and(
        eq(clinicMembersTable.clinicId, clinicId),
        eq(clinicMembersTable.status, "active"),
        eq(clinicMembersTable.role, "doctor"),
      ),
    );

  return fallback.map((row) => ({
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    departmentName,
    staffStatus: row.staffStatus ?? "available",
    maxPatientsPerDay: DEFAULT_DAILY_CAPACITY,
    appointmentDurationMinutes: DEFAULT_SLOT_MINUTES,
    preferenceRank: 4,
  }));
}

async function getOrderedDoctorCandidates(params: {
  clinicId: string;
  patientId: string;
  departmentName: string;
}): Promise<DoctorCandidate[]> {
  const [departmentDoctors, ownership, lastDoctorId] = await Promise.all([
    getDoctors(params.clinicId, params.departmentName),
    getPatientDoctorOwnership(params.clinicId, params.patientId),
    getLastPatientDoctor(params.clinicId, params.patientId),
  ]);

  const doctors = new Map<string, DoctorCandidate>();
  for (const doctor of departmentDoctors) doctors.set(doctor.doctorId, doctor);

  if (lastDoctorId && !doctors.has(lastDoctorId)) {
    const doctor = await getDoctorById(params.clinicId, lastDoctorId, params.departmentName);
    if (doctor) doctors.set(doctor.doctorId, doctor);
  }
  if (ownership.backupDoctorId && !doctors.has(ownership.backupDoctorId)) {
    const doctor = await getDoctorById(params.clinicId, ownership.backupDoctorId, params.departmentName);
    if (doctor) doctors.set(doctor.doctorId, doctor);
  }
  if (ownership.primaryDoctorId && !doctors.has(ownership.primaryDoctorId)) {
    const doctor = await getDoctorById(params.clinicId, ownership.primaryDoctorId, params.departmentName);
    if (doctor) doctors.set(doctor.doctorId, doctor);
  }

  return [...doctors.values()].sort((a, b) => {
    const rank = (doctorId: string, fallback: number) => {
      if (doctorId === ownership.primaryDoctorId) return 0;
      if (doctorId === ownership.backupDoctorId) return 1;
      if (doctorId === lastDoctorId) return 2;
      return fallback;
    };
    const rankDiff = rank(a.doctorId, a.preferenceRank) - rank(b.doctorId, b.preferenceRank);
    if (rankDiff !== 0) return rankDiff;
    const aAvailable = a.staffStatus === "available" ? 0 : 1;
    const bAvailable = b.staffStatus === "available" ? 0 : 1;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;
    return a.doctorName.localeCompare(b.doctorName);
  });
}

async function findSlotsForPatientDepartment(params: {
  clinicId: string;
  patientId: string;
  departmentName: string;
  limit?: number;
}): Promise<AppointmentSlot[]> {
  const settings = await getClinicSchedulingSettings(params.clinicId);
  if (!settings.onlineBookingEnabled || !settings.whatsappSelfServiceBookingEnabled) return [];
  const orderedDoctors = await getOrderedDoctorCandidates({
    clinicId: params.clinicId,
    patientId: params.patientId,
    departmentName: params.departmentName,
  });

  return findSchedulingAvailableSlots({
    clinicId: params.clinicId,
    doctors: orderedDoctors,
    limit: params.limit,
  });
}

async function requirePatient(params: {
  clinicId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
  phone: string;
  patientId?: string | null;
}): Promise<{ patientId?: string; reply?: string; state?: ConversationState }> {
  if (params.patientId) return { patientId: params.patientId };

  const byPhone = await resolvePatientByPhone(params.clinicId, params.phone);
  if (byPhone) {
    return { patientId: byPhone.id };
  }

  return {
    reply: "Please enter your South African ID number so we can find your clinic file.",
    state: "awaiting_id_number",
  };
}

async function handleBook(params: {
  clinicId: string;
  patientId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
}): Promise<StateMachineResult> {
  logger.info(
    {
      clinicId: params.clinicId,
      patientId: params.patientId,
      conversationId: params.conversationId,
    },
    "BOOKING_STARTED",
  );
  const settings = await getClinicSchedulingSettings(params.clinicId);
  if (!settings.onlineBookingEnabled || !settings.whatsappSelfServiceBookingEnabled) {
    await notifyClinicStaff({
      clinicId: params.clinicId,
      type: "booking_assistance_request",
      title: "WhatsApp booking requested",
      message: "A patient requested WhatsApp self-service booking while online booking is disabled.",
    });
    return {
      reply: "Online appointment booking is currently unavailable. Our reception team has been notified and will help you shortly.",
      nextState: "idle",
      patientId: params.patientId,
      intent: params.intent ?? null,
      data: {},
    };
  }
  return {
    reply: "What brings you to the clinic today?",
    nextState: "awaiting_booking_reason",
    patientId: params.patientId,
    intent: params.intent ?? null,
    data: {},
  };
}

async function handleBookingReason(params: {
  clinicId: string;
  patientId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
}): Promise<StateMachineResult> {
  const reason = cleanText(params.messageText);
  const departmentName = mapDepartmentFromReason(reason);
  const slots = await findSlotsForPatientDepartment({
    clinicId: params.clinicId,
    patientId: params.patientId,
    departmentName,
    limit: 3,
  });

  if (slots.length === 0) {
    await notifyClinicStaff({
      clinicId: params.clinicId,
      type: "booking_assistance_request",
      title: "Booking assistance requested",
      message: `A WhatsApp patient needs help booking: ${reason}`,
    });
    return {
      reply: "Thank you. I could not find an open appointment slot right now. Our reception team has been notified and will contact you shortly.",
      nextState: "idle",
      patientId: params.patientId,
      intent: params.intent ?? null,
      data: {},
    };
  }

  const timeZone = await getClinicTimezone(params.clinicId);
  const slotList = slots
    .map((slot, index) => `${index + 1}. ${formatDateTime(new Date(slot.scheduledAt), timeZone)}`)
    .join("\n");

  return {
    reply: `Thank you. The earliest available appointments are:

${slotList}

Please reply with the number you prefer.`,
    nextState: "awaiting_booking_slot_selection",
    patientId: params.patientId,
    intent: params.intent ?? null,
    data: { visitReason: reason, departmentName, slots },
  };
}

async function validateSelectedSlot(params: {
  clinicId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
}) {
  const [doctor] = await db
    .select({
      maxPatientsPerDay: doctorProfilesTable.maxPatientsPerDay,
    })
    .from(clinicMembersTable)
    .leftJoin(doctorProfilesTable, and(eq(doctorProfilesTable.userId, clinicMembersTable.userId), eq(doctorProfilesTable.clinicId, params.clinicId)))
    .where(
      and(
        eq(clinicMembersTable.clinicId, params.clinicId),
        eq(clinicMembersTable.userId, params.doctorId),
        eq(clinicMembersTable.status, "active"),
        eq(clinicMembersTable.role, "doctor"),
      ),
    )
    .limit(1);
  if (!doctor) {
    return {
      available: false,
      reason: "The selected doctor is no longer available for booking.",
      code: "doctor_unavailable",
    };
  }

  return validateAppointmentSlot({
    clinicId: params.clinicId,
    doctorId: params.doctorId,
    scheduledAt: params.scheduledAt,
    durationMinutes: params.durationMinutes,
    maxPatientsPerDay: doctor.maxPatientsPerDay ?? DEFAULT_DAILY_CAPACITY,
  });
}

async function handleSlotSelection(params: {
  clinicId: string;
  patientId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
  data: ConversationData;
}): Promise<StateMachineResult> {
  const selectedIndex = Number.parseInt(cleanText(params.messageText), 10) - 1;
  const slot = params.data.slots?.[selectedIndex];
  if (!slot) {
    return {
      reply: "Please reply with one of the appointment numbers shown above.",
      nextState: "awaiting_booking_slot_selection",
      patientId: params.patientId,
      intent: null,
      data: params.data,
    };
  }
  const scheduledAt = new Date(slot.scheduledAt);

  const validation = await validateSelectedSlot({
    clinicId: params.clinicId,
    doctorId: slot.doctorId,
    scheduledAt,
    durationMinutes: slot.durationMinutes,
  });
  if (!validation.available) {
    logger.warn(
      {
        clinicId: params.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        doctorId: slot.doctorId,
        messageId: null,
        reason: validation.reason,
        code: validation.code,
      },
      "BOOKING_FAILED",
    );
    const slots = await findSlotsForPatientDepartment({
      clinicId: params.clinicId,
      patientId: params.patientId,
      departmentName: params.data.departmentName ?? slot.departmentName,
      limit: 3,
    });
    if (slots.length === 0) {
      await notifyClinicStaff({
        clinicId: params.clinicId,
        type: "booking_assistance_request",
        title: "Booking assistance requested",
        message: "A WhatsApp patient selected a slot that is no longer available and needs help booking.",
      });
      return {
        reply: "I am sorry, that appointment is no longer available. Our reception team has been notified and will help you shortly.",
        nextState: "idle",
        patientId: params.patientId,
        intent: null,
        data: {},
      };
    }
    const timeZone = await getClinicTimezone(params.clinicId);
    const slotList = slots.map((availableSlot, index) => `${index + 1}. ${formatDateTime(new Date(availableSlot.scheduledAt), timeZone)}`).join("\n");
    return {
      reply: `${validation.reason} These are the next available times:

${slotList}

Please reply with the number you prefer.`,
      nextState: "awaiting_booking_slot_selection",
      patientId: params.patientId,
      intent: null,
      data: { ...params.data, selectedSlot: undefined, slots },
    };
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      clinicId: params.clinicId,
      patientId: params.patientId,
      doctorId: slot.doctorId,
      createdById: null,
      scheduledAt,
      type: "consultation",
      status: "scheduled",
      visitReason: params.data.visitReason ?? null,
      notes: "Booked by WhatsApp assistant",
      durationMinutes: slot.durationMinutes,
    })
    .returning();

  await logActivityAsync({
    clinicId: params.clinicId,
    userId: slot.doctorId,
    userRole: "doctor",
    module: "appointments",
    actionType: "appointment_booked",
    type: "appointment_booked",
    message: `Appointment booked by WhatsApp assistant with ${slot.doctorName}`,
    entityId: appointment.id,
    suppressWhatsAppDispatch: true,
  });

  const [patient] = await db
    .select({ primaryDoctorId: patientsTable.primaryDoctorId })
    .from(patientsTable)
    .where(and(eq(patientsTable.id, params.patientId), eq(patientsTable.clinicId, params.clinicId)))
    .limit(1);
  if (patient && !patient.primaryDoctorId) {
    await db
      .update(patientsTable)
      .set({ primaryDoctorId: slot.doctorId, updatedAt: new Date() })
      .where(and(eq(patientsTable.id, params.patientId), eq(patientsTable.clinicId, params.clinicId)));
  }

  logger.info(
    {
      clinicId: params.clinicId,
      patientId: params.patientId,
      conversationId: params.conversationId,
      currentState: "idle",
      detectedIntent: params.intent,
      appointmentId: appointment.id,
      assignedDoctorId: slot.doctorId,
    },
    "BOOKING_COMPLETED",
  );

  const timeZone = await getClinicTimezone(params.clinicId);

  return {
    reply: `Your appointment has been booked.

Doctor: Dr ${slot.doctorName}
Date: ${formatDate(new Date(slot.scheduledAt), timeZone)}
Time: ${formatTime(new Date(slot.scheduledAt), timeZone)}

Thank you.`,
    nextState: "idle",
    patientId: params.patientId,
    intent: null,
    data: {},
  };
}

async function handleCheckAppointment(clinicId: string, patientId: string) {
  const appointment = await getUpcomingAppointment(clinicId, patientId);
  if (!appointment) return "You do not have an upcoming appointment at the moment.";
  const scheduledAt = new Date(appointment.scheduledAt);
  const timeZone = await getClinicTimezone(clinicId);
  return `You have an appointment on:

${formatDate(scheduledAt, timeZone)}
${formatTime(scheduledAt, timeZone)}

Doctor: Dr ${appointment.doctorName}`;
}

async function handleMyDoctor(clinicId: string, patientId: string) {
  const ownership = await getPatientDoctorOwnership(clinicId, patientId);
  const assignedDoctorId = ownership.primaryDoctorId ?? ownership.backupDoctorId;
  const appointment = await getUpcomingAppointment(clinicId, patientId);
  if (appointment) {
    const scheduledAt = new Date(appointment.scheduledAt);
    const timeZone = await getClinicTimezone(clinicId);
    const doctorId = assignedDoctorId ?? appointment.doctorId;
    const [doctor] = await db
      .select({
        name: usersTable.name,
        departmentName: departmentsTable.name,
        specialty: doctorProfilesTable.specialty,
      })
      .from(usersTable)
      .leftJoin(doctorProfilesTable, and(eq(doctorProfilesTable.userId, usersTable.id), eq(doctorProfilesTable.clinicId, clinicId)))
      .leftJoin(departmentsTable, eq(departmentsTable.id, doctorProfilesTable.departmentId))
      .where(eq(usersTable.id, doctorId))
      .limit(1);
    return `Your doctor is Dr ${doctor?.name ?? appointment.doctorName}.

Department: ${doctor?.departmentName ?? doctor?.specialty ?? mapDepartmentFromReason(appointment.visitReason ?? "")}

Next appointment:
${formatDate(scheduledAt, timeZone)} ${formatTime(scheduledAt, timeZone)}`;
  }

  const doctorId = assignedDoctorId ?? (await getLastPatientDoctor(clinicId, patientId));
  if (!doctorId) return "I could not find an assigned doctor yet. Reception can help you with this.";
  const [doctor] = await db
    .select({
      name: usersTable.name,
      departmentName: departmentsTable.name,
      specialty: doctorProfilesTable.specialty,
    })
    .from(usersTable)
    .leftJoin(doctorProfilesTable, and(eq(doctorProfilesTable.userId, usersTable.id), eq(doctorProfilesTable.clinicId, clinicId)))
    .leftJoin(departmentsTable, eq(departmentsTable.id, doctorProfilesTable.departmentId))
    .where(eq(usersTable.id, doctorId))
    .limit(1);
  return `Your doctor is Dr ${doctor?.name ?? "your assigned doctor"}.

Department: ${doctor?.departmentName ?? doctor?.specialty ?? "General Practice"}

You do not have an upcoming appointment right now.`;
}

async function handleCancelStart(params: {
  clinicId: string;
  patientId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
}): Promise<StateMachineResult> {
  const appointment = await getUpcomingAppointment(params.clinicId, params.patientId);
  if (!appointment) {
    return {
      reply: "I could not find an upcoming appointment to cancel.",
      nextState: "idle",
      patientId: params.patientId,
      intent: params.intent ?? null,
      data: {},
    };
  }
  return {
    reply: "Please tell us why you would like to cancel your appointment.",
    nextState: "awaiting_cancel_reason",
    patientId: params.patientId,
    intent: params.intent ?? null,
    data: { appointmentId: appointment.id },
  };
}

async function handleCancelReason(params: {
  clinicId: string;
  patientId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
  data: ConversationData;
}): Promise<StateMachineResult> {
  return {
    reply: `Are you sure you want to cancel this appointment?

Reply YES to confirm.`,
    nextState: "awaiting_cancel_confirmation",
    patientId: params.patientId,
    intent: params.intent ?? null,
    data: { ...params.data, cancelReason: cleanText(params.messageText) },
  };
}

async function handleCancelConfirmation(params: {
  clinicId: string;
  patientId: string;
  conversationId: string;
  currentState: string;
  messageText: string;
  intent?: Intent | null;
  data: ConversationData;
}): Promise<StateMachineResult> {
  if (!/^yes$/i.test(cleanText(params.messageText))) {
    return {
      reply: "No problem. Your appointment has not been cancelled.",
      nextState: "idle",
      patientId: params.patientId,
      intent: params.intent ?? null,
      data: {},
    };
  }

  if (!params.data.appointmentId) {
    return {
      reply: "I could not find the appointment to cancel. Reception can help you.",
      nextState: "idle",
      patientId: params.patientId,
      intent: params.intent ?? null,
      data: {},
    };
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(appointmentsTable.id, params.data.appointmentId), eq(appointmentsTable.clinicId, params.clinicId)))
    .returning();

  if (!appointment) {
    return {
      reply: "I could not find the appointment to cancel. Reception can help you.",
      nextState: "idle",
      patientId: params.patientId,
      intent: params.intent ?? null,
      data: {},
    };
  }

  await db.insert(appointmentCancellationsTable).values({
    clinicId: params.clinicId,
    appointmentId: appointment.id,
    patientId: params.patientId,
    cancellationReason: params.data.cancelReason ?? "No reason provided",
    cancelledBy: "patient_whatsapp",
    cancelledAt: new Date(),
  });

  await notifyClinicStaff({
    clinicId: params.clinicId,
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    message: `A patient cancelled an appointment. Reason: ${params.data.cancelReason ?? "No reason provided"}`,
  });

  logActivity({
    clinicId: params.clinicId,
    userId: appointment.doctorId,
    userRole: "doctor",
    module: "appointments",
    actionType: "appointment_cancelled",
    type: "appointment_cancelled",
    message: `Appointment cancelled by WhatsApp patient. Reason: ${params.data.cancelReason ?? "No reason provided"}`,
    entityId: appointment.id,
  });

  return {
    reply: "Your appointment has been cancelled. Thank you for letting us know.",
    nextState: "idle",
    patientId: params.patientId,
    intent: params.intent ?? null,
    data: {},
  };
}

async function handleClinicHours(clinicId: string) {
  const settings = await getBotSettings(clinicId);
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  const hours = parseJsonObject(settings?.clinicHours);
  const lines = Object.entries(hours)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([day, value]) => `${day}: ${value}`);

  if (lines.length > 0) return `Our clinic hours are:

${lines.join("\n")}`;

  return `Our reception team can confirm today's clinic hours for you.

You can also phone us on ${clinic?.contactNumber ?? "the clinic number"}.`;
}

async function handleReception(params: {
  clinicId: string;
  patientId?: string | null;
  conversationId: string;
  messageText: string;
}) {
  await db.insert(receptionRequestsTable).values({
    clinicId: params.clinicId,
    patientId: params.patientId ?? null,
    conversationId: params.conversationId,
    requestMessage: cleanText(params.messageText) || "Patient requested reception assistance",
    status: "open",
  });
  await notifyClinicStaff({
    clinicId: params.clinicId,
    type: "urgent_reception_request",
    title: "Patient requested reception",
    message: cleanText(params.messageText) || "A WhatsApp patient asked to speak to reception.",
  });
  return "Our reception team has been notified and will contact you shortly.";
}

async function handleMenuSelection(params: {
  config: EngineConfig;
  patientId?: string | null;
  conversationId: string;
  currentState: ConversationState;
  messageText: string;
  phone: string;
  settings: Awaited<ReturnType<typeof getBotSettings>>;
}): Promise<StateMachineResult> {
  const choice = normalizeForIntent(params.messageText);
  if (choice === "1") {
    if (params.settings && !params.settings.bookingEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent: null, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent: null,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent: null, data: {} };

    return handleBook({
      clinicId: params.config.clinicId,
      patientId: patient.patientId!,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent: null,
    });
  }

  if (choice === "2") {
    if (params.settings && !params.settings.selfServiceEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent: null, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent: null,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent: null, data: {} };
    return {
      reply: await handleCheckAppointment(params.config.clinicId, patient.patientId!),
      nextState: "idle",
      patientId: patient.patientId,
      intent: null,
      data: {},
    };
  }

  if (choice === "3") {
    if (params.settings && !params.settings.selfServiceEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent: null, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent: null,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent: null, data: {} };
    return handleCancelStart({
      clinicId: params.config.clinicId,
      patientId: patient.patientId!,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent: null,
    });
  }

  if (choice === "4") {
    return { reply: await handleClinicHours(params.config.clinicId), nextState: "idle", patientId: params.patientId, intent: null, data: {} };
  }

  if (choice === "5") {
    if (params.settings && !params.settings.selfServiceEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent: null, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent: null,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent: null, data: {} };
    return {
      reply: await handleMyDoctor(params.config.clinicId, patient.patientId!),
      nextState: "idle",
      patientId: patient.patientId,
      intent: null,
      data: {},
    };
  }

  if (choice === "6") {
    const reply = await handleReception({
      clinicId: params.config.clinicId,
      patientId: params.patientId,
      conversationId: params.conversationId,
      messageText: params.messageText,
    });
    return { reply, nextState: "idle", patientId: params.patientId, intent: null, data: {} };
  }

  return {
    reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage),
    nextState: "awaiting_menu_selection",
    patientId: params.patientId,
    intent: null,
    data: {},
  };
}

async function handleIdleIntent(params: {
  config: EngineConfig;
  patientId?: string | null;
  conversationId: string;
  currentState: ConversationState;
  messageText: string;
  phone: string;
  settings: Awaited<ReturnType<typeof getBotSettings>>;
  intent: Intent;
}): Promise<StateMachineResult> {
  const intent = params.intent;

  if (intent === "greeting") {
    return {
      reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage),
      nextState: "awaiting_menu_selection",
      patientId: params.patientId,
      intent,
      data: {},
    };
  }

  if (intent === "book_appointment") {
    if (params.settings && !params.settings.bookingEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent, data: {} };

    return handleBook({
      clinicId: params.config.clinicId,
      patientId: patient.patientId!,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent,
    });
  }

  if (intent === "check_appointment") {
    if (params.settings && !params.settings.selfServiceEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent, data: {} };
    return { reply: await handleCheckAppointment(params.config.clinicId, patient.patientId!), nextState: "idle", patientId: patient.patientId, intent, data: {} };
  }

  if (intent === "cancel_appointment") {
    if (params.settings && !params.settings.selfServiceEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent, data: {} };
    return handleCancelStart({
      clinicId: params.config.clinicId,
      patientId: patient.patientId!,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent,
    });
  }

  if (intent === "clinic_hours") {
    return { reply: await handleClinicHours(params.config.clinicId), nextState: "idle", patientId: params.patientId, intent, data: {} };
  }

  if (intent === "my_doctor") {
    if (params.settings && !params.settings.selfServiceEnabled) {
      const reply = await handleReception({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        messageText: params.messageText,
      });
      return { reply, nextState: "idle", patientId: params.patientId, intent, data: {} };
    }

    const patient = await requirePatient({
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      currentState: params.currentState,
      messageText: params.messageText,
      intent,
      phone: params.phone,
      patientId: params.patientId,
    });
    if (patient.reply) return { reply: patient.reply, nextState: patient.state ?? "awaiting_id_number", patientId: params.patientId, intent, data: {} };
    return { reply: await handleMyDoctor(params.config.clinicId, patient.patientId!), nextState: "idle", patientId: patient.patientId, intent, data: {} };
  }

  if (intent === "speak_to_reception" || intent === "medicine" || intent === "missed_appointment") {
    const reply = await handleReception({
      clinicId: params.config.clinicId,
      patientId: params.patientId,
      conversationId: params.conversationId,
      messageText: params.messageText,
    });
    return { reply, nextState: "idle", patientId: params.patientId, intent, data: {} };
  }

  return {
    reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage),
    nextState: "awaiting_menu_selection",
    patientId: params.patientId,
    intent,
    data: {},
  };
}

async function handleConversationState(params: {
  config: EngineConfig;
  conversationId: string;
  currentState: ConversationState;
  data: ConversationData;
  patientId?: string | null;
  phone: string;
  messageText: string;
  settings: Awaited<ReturnType<typeof getBotSettings>>;
  messageId?: string | null;
}): Promise<StateMachineResult> {
  logger.info(
    {
      clinicId: params.config.clinicId,
      conversationId: params.conversationId,
      patientId: params.patientId ?? null,
      currentState: params.currentState,
      messageId: params.messageId ?? null,
    },
    "CONVERSATION_STATE_ENTER",
  );

  if (params.currentState !== "idle") {
    logger.info(
      {
        clinicId: params.config.clinicId,
        conversationId: params.conversationId,
        patientId: params.patientId ?? null,
        currentState: params.currentState,
        messageId: params.messageId ?? null,
      },
      "INTENT_SKIPPED",
    );
  }

  switch (params.currentState) {
    case "awaiting_menu_selection":
      return handleMenuSelection(params);
    case "awaiting_id_number": {
      if (normalizeForIntent(params.messageText) === "6") {
        const reply = await handleReception({
          clinicId: params.config.clinicId,
          patientId: params.patientId,
          conversationId: params.conversationId,
          messageText: params.messageText,
        });
        return { reply, nextState: "idle", patientId: params.patientId, intent: null, data: {} };
      }

      const patient = await resolvePatientByIdNumber(params.config.clinicId, params.messageText);
      if (!patient) {
        return {
          reply: "I could not find that ID number. Please check it and send it again, or reply 6 to speak to reception.",
          nextState: "awaiting_id_number",
          patientId: params.patientId,
          intent: null,
          data: {},
        };
      }

      return {
        reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage),
        nextState: "awaiting_menu_selection",
        patientId: patient.id,
        intent: null,
        data: {},
      };
    }
    case "awaiting_department_selection":
    case "awaiting_doctor_selection":
      logger.info(
        {
          clinicId: params.config.clinicId,
          conversationId: params.conversationId,
          patientId: params.patientId ?? null,
          currentState: params.currentState,
          messageId: params.messageId ?? null,
        },
        "CONVERSATION_RESET",
      );
      return {
        reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage),
        nextState: "idle",
        patientId: params.patientId,
        intent: null,
        data: {},
      };
    case "awaiting_booking_reason":
      if (!params.patientId) {
        return {
          reply: "Please enter your South African ID number so we can find your clinic file.",
          nextState: "awaiting_id_number",
          intent: null,
          data: {},
        };
      }
      return handleBookingReason({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        currentState: params.currentState,
        messageText: params.messageText,
        intent: null,
      });
    case "awaiting_booking_slot_selection":
      if (!params.patientId) {
        return {
          reply: "Please enter your South African ID number so we can find your clinic file.",
          nextState: "awaiting_id_number",
          intent: null,
          data: {},
        };
      }
      return handleSlotSelection({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        currentState: params.currentState,
        messageText: params.messageText,
        intent: null,
        data: params.data,
      });
    case "awaiting_cancel_reason":
      if (!params.patientId) {
        return { reply: "I could not find your clinic file. Reception can help you.", nextState: "idle", intent: null, data: {} };
      }
      return handleCancelReason({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        currentState: params.currentState,
        messageText: params.messageText,
        intent: null,
        data: params.data,
      });
    case "awaiting_cancel_confirmation":
      if (!params.patientId) {
        return { reply: "I could not find your clinic file. Reception can help you.", nextState: "idle", intent: null, data: {} };
      }
      return handleCancelConfirmation({
        clinicId: params.config.clinicId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        currentState: params.currentState,
        messageText: params.messageText,
        intent: null,
        data: params.data,
      });
    case "awaiting_booking_confirmation":
      logger.info(
        {
          clinicId: params.config.clinicId,
          conversationId: params.conversationId,
          patientId: params.patientId ?? null,
          currentState: params.currentState,
          messageId: params.messageId ?? null,
        },
        "CONVERSATION_RESET",
      );
      return {
        reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage),
        nextState: "idle",
        patientId: params.patientId,
        intent: null,
        data: {},
      };
    case "awaiting_patient_verification":
    case "awaiting_reception_request":
      return { reply: buildWelcome(params.config.clinicName, params.settings?.welcomeMessage), nextState: "awaiting_menu_selection", patientId: params.patientId, intent: null, data: {} };
    case "idle":
    default: {
      const intent = detectIntent(params.messageText);
      logger.info(
        {
          clinicId: params.config.clinicId,
          conversationId: params.conversationId,
          patientId: params.patientId ?? null,
          currentState: params.currentState,
          intent,
          messageId: params.messageId ?? null,
        },
        "INTENT_DETECTED",
      );
      return handleIdleIntent({ ...params, intent });
    }
  }
}

export async function runWhatsAppConversationEngine(params: {
  config: EngineConfig;
  fromPhone: string;
  messageText: string;
  metaMessageId?: string | null;
}): Promise<void> {
  const phone = normalizePhoneNumber(params.fromPhone) ?? params.fromPhone;
  const initialPatient = await resolvePatientByPhone(params.config.clinicId, phone);
  const conversation = await getOrCreateConversation({
    clinicId: params.config.clinicId,
    patientPhone: phone,
    patientId: initialPatient?.id ?? null,
  });
  let patientId = conversation.patientId ?? initialPatient?.id ?? null;
  const currentState = conversation.currentState as ConversationState;
  let effectiveState = currentState;
  let effectiveData = getConversationData(conversation.stateData);
  const text = cleanText(params.messageText);
  const settings = await getBotSettings(params.config.clinicId);

  logger.info(
    {
      clinicId: params.config.clinicId,
      patientId,
      conversationId: conversation.id,
      currentState,
      stateData: conversation.stateData,
      lastMessageAt: conversation.lastMessageAt,
      messageId: params.metaMessageId ?? null,
    },
    "[whatsapp] Conversation loaded",
  );

  const inboundStored = await storeChatMessage({
    clinicId: params.config.clinicId,
    conversationId: conversation.id,
    patientId,
    direction: "inbound",
    phone,
    text,
    metaMessageId: params.metaMessageId ?? null,
  });
  if (!inboundStored) return;

  const now = new Date();
  if (isBookingFlowState(effectiveState) && hasBookingFlowExpired(conversation.lastMessageAt, now)) {
    logger.info(
      {
        clinicId: params.config.clinicId,
        patientId,
        conversationId: conversation.id,
        currentState: effectiveState,
        lastMessageAt: conversation.lastMessageAt,
        messageId: params.metaMessageId ?? null,
      },
      "BOOKING_FLOW_EXPIRED",
    );

    await resetConversationToIdle({
      clinicId: params.config.clinicId,
      conversationId: conversation.id,
      fromState: effectiveState,
      patientId,
      reason: "booking_flow_expired",
      messageText: text,
      messageId: params.metaMessageId ?? null,
    });
    effectiveState = "idle";
    effectiveData = {};
  }

  let result: StateMachineResult;
  if (settings && !settings.botEnabled) {
    const reply = "Thank you for your message. Our reception team will contact you shortly.";
    await handleReception({
      clinicId: params.config.clinicId,
      patientId,
      conversationId: conversation.id,
      messageText: text,
    });
    result = { reply, nextState: "idle", patientId, intent: null, data: {} };
  } else {
    result = await handleConversationState({
      config: params.config,
      conversationId: conversation.id,
      currentState: effectiveState,
      data: effectiveData,
      patientId,
      phone,
      messageText: text,
      settings,
      messageId: params.metaMessageId ?? null,
    });
  }

  patientId = result.patientId ?? patientId;

  if (result.nextState) {
    await setConversationState({
      clinicId: params.config.clinicId,
      conversationId: conversation.id,
      fromState: effectiveState,
      toState: result.nextState,
      intent: result.intent,
      messageText: text,
      patientId,
      data: result.data ?? (result.nextState === "idle" || result.nextState === "awaiting_menu_selection" ? {} : effectiveData),
    });
  }

  await db
    .update(whatsappConversationsTable)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(whatsappConversationsTable.id, conversation.id));

  logger.info(
    {
      clinicId: params.config.clinicId,
      patientId,
      conversationId: conversation.id,
      currentState: effectiveState,
      nextState: result.nextState ?? null,
      intent: result.intent ?? null,
      messageId: params.metaMessageId ?? null,
    },
    "CONVERSATION_STATE_EXIT",
  );

  await sendReply({
    config: params.config,
    conversationId: conversation.id,
    patientId,
    toPhone: phone,
    body: result.reply,
    logContext: {
      clinicId: params.config.clinicId,
      patientId,
      conversationId: conversation.id,
      currentState: effectiveState,
      nextState: result.nextState ?? null,
      detectedIntent: result.intent ?? null,
      messageId: params.metaMessageId ?? null,
    },
  });
}
