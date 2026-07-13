import { conversationAI } from "./ConversationAI";
import { generateWithOllama } from "./ollama.service";
import type { AIConversationMemoryMessage } from "./types";

export class AIService {
  async chat(prompt: string) {
    return generateWithOllama(prompt);
  }

  async interpretWhatsAppMessage(input: {
    clinicId: string;
    clinicName: string;
    currentState: string;
    patientId?: string | null;
    messageText: string;
    recentMessages?: AIConversationMemoryMessage[];
  }) {
    return conversationAI.interpretWhatsAppMessage(input);
  }

  async summarizeConsultation(data: unknown) {
    return generateWithOllama(JSON.stringify({
      task: "summarize_consultation",
      safety: "AI assists only. A clinician must review the summary.",
      data,
    }));
  }

  async explainMedication(data: unknown) {
    return generateWithOllama(JSON.stringify({
      task: "explain_medication",
      safety: "Do not prescribe, change dosage, or replace pharmacist counselling.",
      data,
    }));
  }

  async explainLabResults(data: unknown) {
    return generateWithOllama(JSON.stringify({
      task: "explain_lab_results",
      safety: "Explain in plain language and instruct patient to discuss results with clinical staff.",
      data,
    }));
  }

  async generateNotification(data: unknown) {
    return generateWithOllama(JSON.stringify({
      task: "generate_notification",
      safety: "Administrative messaging only. Do not include sensitive clinical detail unless explicitly supplied by an approved service.",
      data,
    }));
  }
}

export const aiService = new AIService();
