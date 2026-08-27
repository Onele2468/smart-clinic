import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const conversationSource = readFileSync(resolve(here, "../src/services/whatsapp/whatsapp.conversation.ts"), "utf8");
const schedulingSource = readFileSync(resolve(here, "../src/services/scheduling.service.ts"), "utf8");
const conversationAISource = readFileSync(resolve(here, "../src/services/ai/ConversationAI.ts"), "utf8");
const contextEngineSource = readFileSync(resolve(here, "../src/services/ai/AIContextEngine.ts"), "utf8");
const promptBuilderSource = readFileSync(resolve(here, "../src/services/ai/AIPromptBuilder.ts"), "utf8");
const webhookSource = readFileSync(resolve(here, "../src/routes/whatsapp_webhook.ts"), "utf8");

function extractSwitchCase(source, caseName) {
  const marker = `case "${caseName}":`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing switch case ${caseName}`);
  const next = source.indexOf("\n    case ", start + marker.length);
  const end = next === -1 ? source.indexOf("\n    default:", start + marker.length) : next;
  return source.slice(start, end === -1 ? source.length : end);
}

test("book appointment success exits booking flow and clears temporary data", () => {
  const slotHandler = conversationSource.slice(
    conversationSource.indexOf("async function handleSlotSelection"),
    conversationSource.indexOf("async function handleCheckAppointment"),
  );

  assert.match(slotHandler, /await logActivityAsync\(/);
  assert.match(slotHandler, /suppressWhatsAppDispatch:\s*true/);
  assert.match(slotHandler, /nextState:\s*"idle"/);
  assert.match(slotHandler, /data:\s*\{\}/);
  assert.doesNotMatch(slotHandler, /toState:\s*"awaiting_booking_slot_selection"[\s\S]*BOOKING_COMPLETED/);
});

test("slot selection state never runs intent detection", () => {
  const slotCase = extractSwitchCase(conversationSource, "awaiting_booking_slot_selection");
  assert.doesNotMatch(slotCase, /detectIntent\(/);
  assert.doesNotMatch(slotCase, /handleIdleIntent\(/);
});

test("greeting after completed booking starts from idle", () => {
  const slotHandler = conversationSource.slice(
    conversationSource.indexOf("async function handleSlotSelection"),
    conversationSource.indexOf("async function handleCheckAppointment"),
  );
  const idleHandler = conversationSource.slice(
    conversationSource.indexOf("async function handleIdleIntent"),
    conversationSource.indexOf("async function handleConversationState"),
  );

  assert.match(slotHandler, /nextState:\s*"idle"/);
  assert.match(conversationSource, /case "idle":[\s\S]*detectIntent\(/);
  assert.match(idleHandler, /intent === "greeting"[\s\S]*nextState:\s*"idle"/);
});

test("WhatsApp welcome is natural and does not force a deterministic menu", () => {
  const welcomeBuilder = conversationSource.slice(
    conversationSource.indexOf("function buildWelcome"),
    conversationSource.indexOf("function formatDateTime"),
  );

  assert.match(welcomeBuilder, /How can I help you today\?/);
  assert.doesNotMatch(welcomeBuilder, /Reply with a number/);
  assert.doesNotMatch(welcomeBuilder, /1\. Book Appointment/);
});

test("duplicate webhook messages are ignored before side effects", () => {
  const storeMessage = conversationSource.slice(
    conversationSource.indexOf("async function storeChatMessage"),
    conversationSource.indexOf("async function resolvePatientByPhone"),
  );

  assert.match(storeMessage, /MESSAGE_DEDUPED/);
  assert.match(storeMessage, /isUniqueViolation\(err\)/);
  assert.match(conversationSource, /if \(!inboundStored\) return;/);
});

test("doctor unavailable and slot occupied paths show alternative slots", () => {
  const slotHandler = conversationSource.slice(
    conversationSource.indexOf("async function handleSlotSelection"),
    conversationSource.indexOf("async function handleCheckAppointment"),
  );

  assert.match(slotHandler, /if \(!validation\.available\)/);
  assert.match(slotHandler, /findSlotsForPatientDepartment/);
  assert.match(slotHandler, /These are the next available times/);
});

test("doctor available path creates appointment without alternative slots", () => {
  const fullSlotHandler = conversationSource.slice(
    conversationSource.indexOf("async function handleSlotSelection"),
    conversationSource.indexOf("async function handleCheckAppointment"),
  );
  const slotHandler = fullSlotHandler.slice(
    fullSlotHandler.indexOf("const [appointment] = await db"),
    fullSlotHandler.indexOf("logger.info(", fullSlotHandler.indexOf("const timeZone = await getClinicTimezone")),
  );

  assert.match(slotHandler, /\.insert\(appointmentsTable\)/);
  assert.doesNotMatch(slotHandler, /findSlotsForPatientDepartment/);
});

test("clinic closed and slot occupied validation are owned by SchedulingService", () => {
  assert.match(schedulingSource, /"clinic_closed"/);
  assert.match(schedulingSource, /"slot_occupied"/);
  assert.match(schedulingSource, /getClinicSchedulingSettings/);
  assert.match(schedulingSource, /doctorAvailabilityTable/);
  assert.match(conversationSource, /validateAppointmentSlot/);
});

test("idle WhatsApp intent detection is routed through backend ConversationAI", () => {
  const idleCase = conversationSource.slice(
    conversationSource.indexOf('case "idle":'),
    conversationSource.indexOf("return handleIdleIntent", conversationSource.indexOf('case "idle":')),
  );

  assert.match(idleCase, /conversationAI\.interpretWhatsAppMessage/);
  assert.match(idleCase, /fallbackIntent:\s*fallbackIntent/);
  assert.match(idleCase, /AI_INTENT_DETECTED/);
});

test("AI receptionist supports patient service domains beyond appointments", () => {
  for (const intent of ["registration", "doctor_availability", "arrival_guidance", "clinic_capabilities", "queue_status", "referral", "laboratory", "prescription", "billing", "follow_up", "emergency"]) {
    assert.match(conversationAISource, new RegExp(`"${intent}"`));
    assert.match(conversationSource, new RegExp(`"${intent}"`));
  }
});

test("AI receptionist business actions stay in WhatsApp engine and Workflow Engine", () => {
  assert.match(conversationSource, /workflowAI\.process\(WorkflowEvent\.APPOINTMENT_BOOKED/);
  assert.match(conversationSource, /handleDoctorAvailability/);
  assert.match(conversationSource, /handleArrivalGuidance/);
  assert.match(conversationSource, /handleClinicCapabilities/);
  assert.match(conversationSource, /handleQueueStatus/);
  assert.match(conversationSource, /handleReferralGuidance/);
  assert.match(conversationSource, /handleLaboratoryQuestion/);
  assert.match(conversationSource, /handlePrescriptionQuestion/);
  assert.match(conversationSource, /handleBillingQuestion/);
  assert.match(conversationSource, /handleFollowUp/);
});

test("AI receptionist uses conversation memory and richer operational guidance", () => {
  assert.match(conversationAISource, /inferFromMemory/);
  assert.match(conversationSource, /\.limit\(12\)/);
  assert.match(conversationSource, /estimated wait is/);
  assert.match(conversationSource, /recommend arriving around/);
});

test("ConversationAI does not own database writes or workflow side effects", () => {
  assert.doesNotMatch(conversationAISource, /@workspace\/db/);
  assert.doesNotMatch(conversationAISource, /\.insert\(/);
  assert.doesNotMatch(conversationAISource, /\.update\(/);
  assert.doesNotMatch(conversationAISource, /\.delete\(/);
});

test("WhatsApp resolves clinic-scoped configuration before ConversationAI classification", () => {
  assert.match(conversationSource, /resolveWhatsAppAICapabilityProfile/);
  assert.match(conversationSource, /eq\(departmentsTable\.clinicId, params\.clinicId\)/);
  assert.match(conversationSource, /eq\(departmentsTable\.isActive, true\)/);
  assert.match(conversationSource, /capabilities:\s*capabilityProfile\.capabilities/);
});

test("unknown capability configuration fails closed and unavailable services hand off to reception", () => {
  assert.match(contextEngineSource, /appointments: input\.capabilities\?\.appointments \?\? false/);
  assert.doesNotMatch(contextEngineSource, /appointments: input\.capabilities\?\.appointments \?\? true/);
  assert.match(conversationAISource, /unavailableCapability/);
  assert.match(conversationAISource, /modelUnavailable = unavailableCapability/);
  assert.match(conversationAISource, /intent: "speak_to_reception"/);
  assert.match(conversationAISource, /not currently available through this clinic's WhatsApp service/);
  assert.match(promptBuilderSource, /matching clinic capability is true/);
});

test("capability response is configuration-driven and does not use clinic type", () => {
  const capabilityHandler = conversationSource.slice(
    conversationSource.indexOf("function handleClinicCapabilities"),
    conversationSource.indexOf("async function handleDoctorAvailability"),
  );

  assert.match(capabilityHandler, /params\.capabilities\.laboratory/);
  assert.match(capabilityHandler, /params\.capabilities\.prescriptions/);
  assert.doesNotMatch(capabilityHandler, /clinicType/);
});

test("WhatsApp webhook does not log verification credentials", () => {
  assert.doesNotMatch(webhookSource, /console\.log\("VERIFY TOKEN/);
  assert.doesNotMatch(webhookSource, /console\.log\("TOKEN FROM META/);
});
