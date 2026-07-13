import { logger } from "../../lib/logger";
import type { AIConversationContext, AIConversationDecision } from "./types";

export class AIAuditLayer {
  recordDecision(context: AIConversationContext, decision: AIConversationDecision): void {
    logger.info(
      {
        module: "ai",
        actionType: "ai_conversation_decision",
        clinicId: context.clinicId ?? null,
        patientId: context.patientId ?? null,
        channel: context.channel,
        currentState: context.currentState ?? null,
        intent: decision.intent,
        confidence: decision.confidence.score,
        confidenceLevel: decision.confidence.level,
        source: decision.source,
        safety: {
          emergency: decision.safety.emergency,
          requiresHumanHandover: decision.safety.requiresHumanHandover,
          reason: decision.safety.reason ?? null,
        },
      },
      "AI_CONVERSATION_DECISION",
    );
  }

  recordFailure(context: AIConversationContext, err: unknown): void {
    logger.warn(
      {
        module: "ai",
        actionType: "ai_conversation_failed",
        clinicId: context.clinicId ?? null,
        patientId: context.patientId ?? null,
        channel: context.channel,
        err,
      },
      "AI_CONVERSATION_FAILED",
    );
  }
}

export const aiAuditLayer = new AIAuditLayer();
