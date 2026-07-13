import type { AIConfidenceLevel, AIConfidenceScore } from "./types";

export class AIConfidenceScoring {
  score(input: {
    modelConfidence?: unknown;
    fallbackMatched: boolean;
    safetyOverride: boolean;
    parsedModel: boolean;
  }): AIConfidenceScore {
    if (input.safetyOverride) {
      return { score: 1, level: "high", reason: "Safety policy override matched." };
    }

    const numeric = typeof input.modelConfidence === "number"
      ? input.modelConfidence
      : typeof input.modelConfidence === "string"
        ? Number(input.modelConfidence)
        : Number.NaN;

    const base = Number.isFinite(numeric)
      ? Math.max(0, Math.min(1, numeric))
      : input.fallbackMatched
        ? 0.78
        : 0.35;

    const adjusted = input.parsedModel ? base : Math.min(base, 0.55);
    return {
      score: adjusted,
      level: this.toLevel(adjusted),
      reason: input.parsedModel
        ? "Model returned a structured intent."
        : input.fallbackMatched
          ? "Rule fallback matched a supported workflow intent."
          : "No strong supported intent was detected.",
    };
  }

  private toLevel(score: number): AIConfidenceLevel {
    if (score >= 0.8) return "high";
    if (score >= 0.55) return "medium";
    return "low";
  }
}

export const aiConfidenceScoring = new AIConfidenceScoring();
