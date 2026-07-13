import type { AIConversationDecision, AIConversationIntent, AISafetyAssessment } from "./types";

const EMERGENCY_PATTERN =
  /\b(chest pain|can't breathe|cannot breathe|difficulty breathing|shortness of breath|severe bleeding|bleeding heavily|unconscious|passed out|fainted|stroke|face drooping|seizure|convulsion|suicide|kill myself|overdose|poison|poisoning|serious accident|car accident|severe allergic|anaphylaxis|not waking up|blue lips|emergency)\b/i;

const CLINICAL_DECISION_PATTERN =
  /\b(diagnose|what do i have|should i take|can i take|prescribe|dosage|dose|stop taking|increase my medication)\b/i;

export class AISafetyLayer {
  assess(messageText: string): AISafetyAssessment {
    if (EMERGENCY_PATTERN.test(messageText)) {
      return {
        allowed: true,
        emergency: true,
        requiresHumanHandover: true,
        reason: "Emergency language detected.",
      };
    }

    if (CLINICAL_DECISION_PATTERN.test(messageText)) {
      return {
        allowed: true,
        emergency: false,
        requiresHumanHandover: true,
        reason: "Clinical decision request requires staff review.",
      };
    }

    return {
      allowed: true,
      emergency: false,
      requiresHumanHandover: false,
    };
  }

  overrideDecision(assessment: AISafetyAssessment): Pick<AIConversationDecision, "intent" | "suggestedReply" | "explanation" | "source"> | null {
    if (assessment.emergency) {
      return {
        intent: "emergency",
        suggestedReply:
          "This may be urgent. Please go to the nearest emergency department or call local emergency services now. I have also asked reception to follow up.",
        explanation: assessment.reason ?? "Emergency escalation required.",
        source: "safety",
      };
    }

    if (assessment.requiresHumanHandover) {
      return {
        intent: "speak_to_reception" as AIConversationIntent,
        suggestedReply: undefined,
        explanation: assessment.reason ?? "Human handover required.",
        source: "safety",
      };
    }

    return null;
  }
}

export const aiSafetyLayer = new AISafetyLayer();
