import type { AIConversationMemory, AIConversationMemoryMessage } from "./types";

export class AIMemory {
  build(messages: AIConversationMemoryMessage[]): AIConversationMemory {
    const recentMessages = messages
      .filter((message) => message.text.trim().length > 0)
      .slice(-8);

    const summary = recentMessages
      .map((message) => `${message.direction}: ${message.text.slice(0, 160)}`)
      .join("\n");

    return { recentMessages, summary };
  }
}

export const aiMemory = new AIMemory();
