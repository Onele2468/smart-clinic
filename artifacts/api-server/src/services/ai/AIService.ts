import { generateWithOllama } from "./ollama.service";

export class AIService {
  /**
   * General AI chat
   */
  async chat(prompt: string) {
    return generateWithOllama(prompt);
  }

  /**
   * Summarize a doctor's consultation
   */
  async summarizeConsultation(data: unknown) {
    throw new Error("Not implemented");
  }

  /**
   * Explain a prescription to a patient
   */
  async explainMedication(data: unknown) {
    throw new Error("Not implemented");
  }

  /**
   * Explain laboratory results
   */
  async explainLabResults(data: unknown) {
    throw new Error("Not implemented");
  }

  /**
   * Generate a notification or WhatsApp message
   */
  async generateNotification(data: unknown) {
    throw new Error("Not implemented");
  }
}

export const aiService = new AIService();