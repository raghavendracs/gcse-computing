export function getEvalModel(): string {
  return process.env.EVAL_MODEL ?? "claude-haiku-4-5-20251001";
}

export function getSeedModel(): string {
  return process.env.SEED_MODEL ?? "claude-sonnet-4-6";
}
