import { describe, it, expect } from "vitest";
import { computeStreak, computeWeakAreaFlags, buildSuggestedAction } from "../index";

// ── Streak ────────────────────────────────────────────────────────────────────

describe("computeStreak", () => {
  const today = new Date("2026-03-07");

  it("increments streak when last activity was yesterday", () => {
    const yesterday = new Date("2026-03-06");
    const result = computeStreak(3, yesterday, today);
    expect(result).toBe(4);
  });

  it("keeps streak when last activity is today", () => {
    const result = computeStreak(5, today, today);
    expect(result).toBe(5);
  });

  it("resets streak to 1 when last activity was 2 days ago", () => {
    const twoDaysAgo = new Date("2026-03-05");
    const result = computeStreak(7, twoDaysAgo, today);
    expect(result).toBe(1);
  });

  it("resets streak to 1 when no prior activity", () => {
    const result = computeStreak(0, new Date("2020-01-01"), today);
    expect(result).toBe(1);
  });
});

// ── Weak area flags ───────────────────────────────────────────────────────────

describe("computeWeakAreaFlags", () => {
  it("flags lowAccuracy when averageScore < 50", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 40,
      hintsPerQuestion: 1,
      totalAttempts: 5,
      errorProneFraction: 0,
    });
    expect(flags.lowAccuracy).toBe(true);
    expect(flags.hintDependent).toBe(false);
  });

  it("flags hintDependent when hintsPerQuestion > 2", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 70,
      hintsPerQuestion: 3,
      totalAttempts: 5,
      errorProneFraction: 0,
    });
    expect(flags.hintDependent).toBe(true);
    expect(flags.lowAccuracy).toBe(false);
  });

  it("flags errorProne when >30% of attempts have errors", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 70,
      hintsPerQuestion: 1,
      totalAttempts: 5,
      errorProneFraction: 0.4,
    });
    expect(flags.errorProne).toBe(true);
  });

  it("no flags when stats are healthy", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 80,
      hintsPerQuestion: 1,
      totalAttempts: 5,
      errorProneFraction: 0.1,
    });
    expect(flags.lowAccuracy).toBe(false);
    expect(flags.hintDependent).toBe(false);
    expect(flags.errorProne).toBe(false);
  });
});

// ── Suggested action ──────────────────────────────────────────────────────────

describe("buildSuggestedAction", () => {
  it("returns low accuracy suggestion when only lowAccuracy flagged", () => {
    const action = buildSuggestedAction({ lowAccuracy: true, hintDependent: false, errorProne: false });
    expect(action).toContain("easy");
  });

  it("returns hint suggestion when only hintDependent flagged", () => {
    const action = buildSuggestedAction({ lowAccuracy: false, hintDependent: true, errorProne: false });
    expect(action).toContain("hint");
  });

  it("returns error suggestion when only errorProne flagged", () => {
    const action = buildSuggestedAction({ lowAccuracy: false, hintDependent: false, errorProne: true });
    expect(action).toContain("syntax");
  });
});
