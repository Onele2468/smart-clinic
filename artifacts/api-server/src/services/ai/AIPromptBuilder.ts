import type { AIConversationContext } from "./types";

export class AIPromptBuilder {
  buildWhatsAppIntentPrompt(context: AIConversationContext): string {
    return `You are the Health Nexus AI Conversation Engine.

Classify the patient's WhatsApp message into exactly one supported receptionist intent.

Supported intents:
greeting, registration, book_appointment, check_appointment, cancel_appointment, clinic_hours, my_doctor, doctor_availability, arrival_guidance, clinic_capabilities, queue_status, referral, laboratory, prescription, billing, follow_up, speak_to_reception, medicine, missed_appointment, emergency, unknown

Safety rules:
- Do not diagnose.
- Do not prescribe.
- Do not provide medication dosage instructions.
- Do not claim an action was completed.
- Protected actions are only routed through Health Nexus services.
- Only classify a service intent when its matching clinic capability is true. If a requested service is unavailable, choose speak_to_reception.
- Choose laboratory for lab tests, blood work, samples, or result availability.
- Choose prescription for medication collection, repeat scripts, or questions about an existing prescription.
- Choose billing for invoices, balances, payments, medical aid, or receipts.
- Choose queue_status for waiting time, ticket number, or where the patient is in the clinic queue.
- Choose referral for specialist letters, referral status, transfers, or where a referred patient must go.
- Choose registration for new patient files, updating demographics, or first-time clinic access.
- Choose doctor_availability for questions about whether a doctor is available, when a doctor can see the patient, or next available doctor times.
- Choose arrival_guidance when the patient asks when to arrive, whether to come early, or whether they should come to the clinic now.
- Choose clinic_capabilities when the patient asks what the clinic can do, whether a service is available, or what services/modules the clinic supports.
- Choose follow_up for follow-up appointments, post-visit checks, recovery check-ins, or doctor-requested review visits.
- Use recent conversation to resolve short replies like "yes please", "that one", "what about tomorrow", or "and billing?".
- If the message needs a human, choose speak_to_reception.

Clinic context:
${JSON.stringify({
  clinicId: context.clinicId,
  clinicName: context.clinicName,
  channel: context.channel,
  currentState: context.currentState,
  patientVerified: context.patientVerified,
  capabilities: context.capabilities,
}, null, 2)}

Recent conversation:
${context.memory.summary || "No prior messages."}

Patient message:
${context.messageText}

Return only JSON in this shape:
{"intent":"book_appointment","confidence":0.0,"explanation":"short reason"}`;
  }
}

export const aiPromptBuilder = new AIPromptBuilder();
