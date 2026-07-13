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
        appointments: input.capabilities?.appointments ?? true,
        cancellations: input.capabilities?.cancellations ?? true,
        clinicHours: input.capabilities?.clinicHours ?? true,
        doctorLookup: input.capabilities?.doctorLookup ?? true,
        queueStatus: input.capabilities?.queueStatus ?? true,
        referrals: input.capabilities?.referrals ?? true,
        laboratory: input.capabilities?.laboratory ?? true,
        prescriptions: input.capabilities?.prescriptions ?? true,
        billing: input.capabilities?.billing ?? true,
        receptionHandover: input.capabilities?.receptionHandover ?? true,
      },
    };
  }
}

export const aiContextEngine = new AIContextEngine();
