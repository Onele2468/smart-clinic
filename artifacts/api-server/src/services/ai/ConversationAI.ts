import { aiAuditLayer } from "./AIAuditLayer";
import { aiConfidenceScoring } from "./AIConfidenceScoring";
import { aiContextEngine } from "./AIContextEngine";
import { aiPromptBuilder } from "./AIPromptBuilder";
import { aiSafetyLayer } from "./AISafetyLayer";
import { generateWithOllama } from "./ollama.service";
import type {
  AIConversationDecision,
  AIConversationContext,
  AIConversationIntent,
  AIConversationMemoryMessage,
} from "./types";

const SUPPORTED_INTENTS = new Set<AIConversationIntent>([
  "greeting",
  "registration",
  "book_appointment",
  "check_appointment",
  "cancel_appointment",
  "clinic_hours",
  "my_doctor",
  "doctor_availability",
  "arrival_guidance",
  "clinic_capabilities",
  "queue_status",
  "referral",
  "laboratory",
  "prescription",
  "billing",
  "follow_up",
  "speak_to_reception",
  "medicine",
  "missed_appointment",
  "emergency",
  "unknown",
]);

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function inferFromMemory(text: string, recentMessages?: AIConversationMemoryMessage[]): AIConversationIntent {
  const normalized = normalize(text);
  if (!/^(yes|yes please|please|ok|okay|sure|that one|sounds good|go ahead|what about tomorrow|tomorrow|and .+)$/i.test(normalized)) {
    return "unknown";
  }

  const previous = [...(recentMessages ?? [])].reverse().find((message) => message.text && message.text !== text);
  const previousText = normalize(previous?.text ?? "");
  if (!previousText) return "unknown";
  if (/\b(follow-up|follow up|review visit|recovery check)\b/.test(previousText)) return "follow_up";
  if (/\b(appointment|available appointments|available times|book|schedule)\b/.test(previousText)) return "book_appointment";
  if (/\b(queue|ticket|waiting|called)\b/.test(previousText)) return "queue_status";
  if (/\b(lab|laboratory|result|blood|sample)\b/.test(previousText)) return "laboratory";
  if (/\b(prescription|medicine|medication|pharmacy|script)\b/.test(previousText)) return "prescription";
  if (/\b(invoice|billing|payment|balance|receipt)\b/.test(previousText)) return "billing";
  if (/\b(referral|specialist|transfer)\b/.test(previousText)) return "referral";
  if (/\b(reception|human|contact you|call you)\b/.test(previousText)) return "speak_to_reception";
  return "unknown";
}

function ruleIntent(text: string, recentMessages?: AIConversationMemoryMessage[]): AIConversationIntent {
  const normalized = normalize(text);
  if (!normalized) return "unknown";
  const memoryIntent = inferFromMemory(text, recentMessages);
  if (memoryIntent !== "unknown") return memoryIntent;
  if (["1", "book", "appointment"].includes(normalized)) return "book_appointment";
  if (["2", "check"].includes(normalized)) return "check_appointment";
  if (["3", "cancel"].includes(normalized)) return "cancel_appointment";
  if (["4", "hours"].includes(normalized)) return "clinic_hours";
  if (["5", "doctor"].includes(normalized)) return "my_doctor";
  if (["6", "reception", "help"].includes(normalized)) return "speak_to_reception";
  if (/\b(register|registration|new patient|new file|clinic file|update my details|change my details)\b/.test(normalized)) return "registration";
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howzit|hie)\b/i.test(normalized)) return "greeting";
  if (/\b(follow-up|follow up|review appointment|review visit|post[- ]?visit|check[- ]?up|recovery check)\b/.test(normalized)) return "follow_up";
  if (/\b(book|appointment|see a doctor|consult|clinic visit|my child is sick|sick|flu|cough|fever|headache|pain|reschedule)\b/.test(normalized)) {
    return "book_appointment";
  }
  if (/\b(cancel|call off|cannot come|can't come)\b/.test(normalized)) return "cancel_appointment";
  if (/\b(when.*open|open|close|hours|time.*clinic)\b/.test(normalized)) return "clinic_hours";
  if (/\b(my doctor|who is my doctor|assigned doctor)\b/.test(normalized)) return "my_doctor";
  if (/\b(doctor.*available|available doctor|when.*doctor|doctor.*free|next available|who can see me)\b/.test(normalized)) return "doctor_availability";
  if (/\b(when should i arrive|what time should i come|come early|arrival|should i come now|when must i come|get there)\b/.test(normalized)) return "arrival_guidance";
  if (/\b(what services|do you offer|can you do|available services|capabilities|do you have|is .* available)\b/.test(normalized)) return "clinic_capabilities";
  if (/\b(reception|receptionist|speak to someone|human|help|call me|urgent)\b/.test(normalized)) return "speak_to_reception";
  if (/\b(check.*appointment|when.*appointment|next appointment)\b/.test(normalized)) return "check_appointment";
  if (/\b(queue|waiting|ticket|how long|called yet|my turn|where am i)\b/.test(normalized)) return "queue_status";
  if (/\b(referral|refer|specialist|transfer|referral letter|referred)\b/.test(normalized)) return "referral";
  if (/\b(lab|laboratory|blood|urine|sample|test result|results|x-ray|scan)\b/.test(normalized)) return "laboratory";
  if (/\b(prescription|repeat script|script|pharmacy|collect.*medicine|medication|medicine|pills)\b/.test(normalized)) return "prescription";
  if (/\b(bill|billing|invoice|payment|pay|paid|balance|account|receipt|medical aid|cost|price)\b/.test(normalized)) return "billing";
  if (/\b(missed|miss)\b.*\bappointment\b/.test(normalized)) return "missed_appointment";
  return "unknown";
}

function parseModelDecision(raw: string): { intent: AIConversationIntent; confidence?: unknown; explanation?: string } | null {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as { intent?: unknown; confidence?: unknown; explanation?: unknown };
    const intent = typeof parsed.intent === "string" ? parsed.intent : "unknown";
    if (!SUPPORTED_INTENTS.has(intent as AIConversationIntent)) return null;
    return {
      intent: intent as AIConversationIntent,
      confidence: parsed.confidence,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : undefined,
    };
  } catch {
    return null;
  }
}

function unavailableCapability(intent: AIConversationIntent, capabilities: AIConversationContext["capabilities"]): string | null {
  const requiredCapability: Partial<Record<AIConversationIntent, keyof AIConversationContext["capabilities"]>> = {
    book_appointment: "appointments",
    check_appointment: "appointments",
    cancel_appointment: "cancellations",
    clinic_hours: "clinicHours",
    my_doctor: "doctorLookup",
    doctor_availability: "doctorLookup",
    arrival_guidance: "appointments",
    queue_status: "queueStatus",
    referral: "referrals",
    laboratory: "laboratory",
    prescription: "prescriptions",
    medicine: "prescriptions",
    billing: "billing",
    follow_up: "appointments",
  };
  const capability = requiredCapability[intent];
  return capability && !capabilities[capability] ? capability : null;
}

export class ConversationAI {
  async interpretWhatsAppMessage(input: {
    clinicId: string;
    clinicName: string;
    currentState: string;
    patientId?: string | null;
    messageText: string;
    recentMessages?: AIConversationMemoryMessage[];
    fallbackIntent?: AIConversationIntent;
    capabilities?: Partial<AIConversationContext["capabilities"]>;
  }): Promise<AIConversationDecision> {
    const context = aiContextEngine.buildConversationContext({
      channel: "whatsapp",
      clinicId: input.clinicId,
      clinicName: input.clinicName,
      currentState: input.currentState,
      patientId: input.patientId ?? null,
      messageText: input.messageText,
      recentMessages: input.recentMessages,
      capabilities: input.capabilities,
    });

    const safety = aiSafetyLayer.assess(input.messageText);
    const safetyOverride = aiSafetyLayer.overrideDecision(safety);
    if (safetyOverride) {
      const decision: AIConversationDecision = {
        intent: safetyOverride.intent,
        confidence: aiConfidenceScoring.score({
          fallbackMatched: true,
          safetyOverride: true,
          parsedModel: false,
        }),
        safety,
        explanation: safetyOverride.explanation,
        suggestedReply: safetyOverride.suggestedReply,
        source: safetyOverride.source,
      };
      aiAuditLayer.recordDecision(context, decision);
      return decision;
    }

    const fallbackIntent = input.fallbackIntent ?? ruleIntent(input.messageText, input.recentMessages);
    const unavailable = unavailableCapability(fallbackIntent, context.capabilities);
    if (unavailable) {
      const decision: AIConversationDecision = {
        intent: "speak_to_reception",
        confidence: aiConfidenceScoring.score({
          fallbackMatched: true,
          safetyOverride: false,
          parsedModel: false,
        }),
        safety,
        explanation: `Clinic capability ${unavailable} is unavailable.`,
        suggestedReply:
          "This service is not currently available through this clinic's WhatsApp service. I have asked reception to help you.",
        source: "rules",
      };
      aiAuditLayer.recordDecision(context, decision);
      return decision;
    }
    const prompt = aiPromptBuilder.buildWhatsAppIntentPrompt(context);

    try {
      const modelResult = await generateWithOllama(prompt);
      const parsed = parseModelDecision(modelResult.response);
      if (parsed) {
        const modelUnavailable = unavailableCapability(parsed.intent, context.capabilities);
        if (modelUnavailable) {
          const decision: AIConversationDecision = {
            intent: "speak_to_reception",
            confidence: aiConfidenceScoring.score({
              modelConfidence: parsed.confidence,
              fallbackMatched: fallbackIntent !== "unknown",
              safetyOverride: false,
              parsedModel: true,
            }),
            safety,
            explanation: `Clinic capability ${modelUnavailable} is unavailable.`,
            suggestedReply:
              "This service is not currently available through this clinic's WhatsApp service. I have asked reception to help you.",
            source: "rules",
          };
          aiAuditLayer.recordDecision(context, decision);
          return decision;
        }
        const decision: AIConversationDecision = {
          intent: parsed.intent,
          confidence: aiConfidenceScoring.score({
            modelConfidence: parsed.confidence,
            fallbackMatched: fallbackIntent !== "unknown",
            safetyOverride: false,
            parsedModel: true,
          }),
          safety,
          explanation: parsed.explanation ?? "AI classified the patient message.",
          source: "model",
        };
        aiAuditLayer.recordDecision(context, decision);
        return decision;
      }
    } catch (err) {
      aiAuditLayer.recordFailure(context, err);
    }

    const decision: AIConversationDecision = {
      intent: fallbackIntent,
      confidence: aiConfidenceScoring.score({
        fallbackMatched: fallbackIntent !== "unknown",
        safetyOverride: false,
        parsedModel: false,
      }),
      safety,
      explanation: "Used deterministic workflow fallback.",
      source: "rules",
    };
    aiAuditLayer.recordDecision(context, decision);
    return decision;
  }
}

export const conversationAI = new ConversationAI();
