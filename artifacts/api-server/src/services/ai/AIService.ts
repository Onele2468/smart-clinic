import { conversationAI } from "./ConversationAI";
import { generateWithOllama } from "./ollama.service";
import type { AIConversationMemoryMessage } from "./types";
import { PromptService, type ReviewOnlyPurpose } from "./PromptService";

const MAX_REVIEW_SOURCE_CHARS = 24_000;

function boundedSourceData(sourceData: unknown): unknown {
  const serialized = JSON.stringify(sourceData);
  if (serialized.length <= MAX_REVIEW_SOURCE_CHARS) return sourceData;
  return { truncated: true, source: serialized.slice(0, MAX_REVIEW_SOURCE_CHARS) };
}

export class AIService {
  private prompts = new PromptService();

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

  async reviewOnly(params: {
    clinicId: string;
    staffRole: string;
    purpose: ReviewOnlyPurpose;
    sourceData: unknown;
  }) {
    return generateWithOllama(this.prompts.reviewOnly({
      ...params,
      sourceData: boundedSourceData(params.sourceData),
    }));
  }

  async summarizeConsultation(params: Omit<Parameters<AIService["reviewOnly"]>[0], "purpose">) {
    return this.reviewOnly({ ...params, purpose: "doctor_consultation_summary" });
  }

  async summarizeNurseAssessment(params: Omit<Parameters<AIService["reviewOnly"]>[0], "purpose">) {
    return this.reviewOnly({ ...params, purpose: "nurse_assessment_summary" });
  }

  async explainLabResults(params: Omit<Parameters<AIService["reviewOnly"]>[0], "purpose">) {
    return this.reviewOnly({ ...params, purpose: "laboratory_result_explanation" });
  }

  async explainMedication(params: Omit<Parameters<AIService["reviewOnly"]>[0], "purpose">) {
    return this.reviewOnly({ ...params, purpose: "prescription_explanation" });
  }

  async summarizeBilling(params: Omit<Parameters<AIService["reviewOnly"]>[0], "purpose">) {
    return this.reviewOnly({ ...params, purpose: "billing_summary" });
  }

  async summarizeFollowUp(params: Omit<Parameters<AIService["reviewOnly"]>[0], "purpose">) {
    return this.reviewOnly({ ...params, purpose: "follow_up_summary" });
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
