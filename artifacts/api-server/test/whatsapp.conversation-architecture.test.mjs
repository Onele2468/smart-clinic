import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const conversationSource = readFileSync(resolve(here, "../src/services/whatsapp/whatsapp.conversation.ts"), "utf8");
const schedulingSource = readFileSync(resolve(here, "../src/services/scheduling.service.ts"), "utf8");

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

  assert.match(slotHandler, /nextState:\s*"idle"/);
  assert.match(conversationSource, /case "idle":[\s\S]*detectIntent\(/);
  assert.match(conversationSource, /intent === "greeting"[\s\S]*nextState:\s*"awaiting_menu_selection"/);
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
