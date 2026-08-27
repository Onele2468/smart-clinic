import { aiMemory } from "./AIMemory";
import type {
  AIChannel,
  AIConversationContext,
  AIConversationMemoryMessage,
} from "./types";

export class AIContextEngine {
  buildConversationContext(input: {
    channel: AIChannel;
    clinicId?: string;
    clinicName?: string;
    currentState?: string;
    patientId?: string | null;
    messageText: string;
    recentMessages?: AIConversationMemoryMessage[];
    capabilities?: Partial<AIConversationContext["capabilities"]>;
  }): AIConversationContext {
    return {
      channel: input.channel,
      clinicId: input.clinicId,
      clinicName: input.clinicName,
      currentState: input.currentState,
      patientId: input.patientId ?? null,
      patientVerified: Boolean(input.patientId),
      messageText: input.messageText,
      memory: aiMemory.build(input.recentMessages ?? []),
      capabilities: {
        // Capabilities must be supplied by the authorised channel/service. Never
        // assume a clinic provides a service when its configuration is unknown.
        appointments: input.capabilities?.appointments ?? false,
        cancellations: input.capabilities?.cancellations ?? false,
        clinicHours: input.capabilities?.clinicHours ?? false,
        doctorLookup: input.capabilities?.doctorLookup ?? false,
        queueStatus: input.capabilities?.queueStatus ?? false,
        referrals: input.capabilities?.referrals ?? false,
        laboratory: input.capabilities?.laboratory ?? false,
        prescriptions: input.capabilities?.prescriptions ?? false,
        billing: input.capabilities?.billing ?? false,
        receptionHandover: input.capabilities?.receptionHandover ?? false,
      },
    };
  }
}

export const aiContextEngine = new AIContextEngine();
