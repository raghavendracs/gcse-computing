export type AIModelPreference = "accurate" | "balanced" | "budget";

const MODEL_MAP: Record<AIModelPreference, string> = {
  accurate: "claude-sonnet-4-6",
  balanced: "claude-sonnet-4-6",
  budget: "claude-haiku-4-5-20251001",
};

export function getModelId(preference: AIModelPreference = "balanced"): string {
  return MODEL_MAP[preference];
}
