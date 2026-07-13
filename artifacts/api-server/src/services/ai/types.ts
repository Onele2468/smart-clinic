export type AIChannel = "whatsapp" | "api";

export type AIConversationIntent =
  | "greeting"
  | "registration"
  | "book_appointment"
  | "check_appointment"
  | "cancel_appointment"
  | "clinic_hours"
  | "my_doctor"
  | "doctor_availability"
  | "arrival_guidance"
  | "clinic_capabilities"
  | "queue_status"
  | "referral"
  | "laboratory"
  | "prescription"
  | "billing"
  | "follow_up"
  | "speak_to_reception"
  | "medicine"
  | "missed_appointment"
  | "emergency"
  | "unknown";

export type AIConfidenceLevel = "high" | "medium" | "low";

export interface AIConversationMemoryMessage {
  direction: "inbound" | "outbound";
  text: string;
  createdAt?: Date | string | null;
}

export interface AIConversationMemory {
  recentMessages: AIConversationMemoryMessage[];
  summary: string;
}

export interface AIConversationContext {
  channel: AIChannel;
  clinicId?: string;
  clinicName?: string;
  currentState?: string;
  patientId?: string | null;
  patientVerified: boolean;
  messageText: string;
  memory: AIConversationMemory;
  capabilities: {
    appointments: boolean;
    cancellations: boolean;
    clinicHours: boolean;
    doctorLookup: boolean;
    queueStatus: boolean;
    referrals: boolean;
    laboratory: boolean;
    prescriptions: boolean;
    billing: boolean;
    receptionHandover: boolean;
  };
}

export interface AISafetyAssessment {
  allowed: boolean;
  emergency: boolean;
  requiresHumanHandover: boolean;
  reason?: string;
}

export interface AIConfidenceScore {
  score: number;
  level: AIConfidenceLevel;
  reason: string;
}

export interface AIConversationDecision {
  intent: AIConversationIntent;
  confidence: AIConfidenceScore;
  safety: AISafetyAssessment;
  explanation: string;
  suggestedReply?: string;
  source: "safety" | "model" | "rules";
}
