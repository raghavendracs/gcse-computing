import { Types } from "mongoose";
import { StudentProgress } from "@gcse/database";
import { updateProgressPayload, UpdateProgressPayload } from "./models";

// ── Pure helper functions (exported for unit testing) ─────────────────────────

/**
 * Compute new streak given prior state and today's date.
 * Uses date-only comparison (ignores time).
 */
export function computeStreak(
  currentDays: number,
  lastActivityDate: Date,
  today: Date,
): number {
  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);

  const diffDays = Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return currentDays;          // already counted today
  if (diffDays === 1) return currentDays + 1;      // consecutive day
  return 1;                                         // gap — reset
}

export interface WeakAreaInput {
  averageScore: number;
  hintsPerQuestion: number;
  totalAttempts: number;
  errorProneFraction: number;
}

export function computeWeakAreaFlags(input: WeakAreaInput) {
  return {
    lowAccuracy: input.averageScore < 50,
    hintDependent: input.hintsPerQuestion > 2,
    errorProne: input.errorProneFraction > 0.3,
  };
}

export function buildSuggestedAction(flags: {
  lowAccuracy: boolean;
  hintDependent: boolean;
  errorProne: boolean;
}): string {
  if (flags.errorProne) return "Review syntax rules and trace through your code before running it";
  if (flags.lowAccuracy && flags.hintDependent) return "Attempt questions without hints first — use easy difficulty to rebuild confidence";
  if (flags.lowAccuracy) return "Try easy difficulty to strengthen the basics before moving up";
  if (flags.hintDependent) return "Attempt without hints — use them only when genuinely stuck";
  return "Keep practising to consolidate this topic";
}

// ── Service class ─────────────────────────────────────────────────────────────

class ProgressService {
  async updateAfterAttempt(payload: UpdateProgressPayload): Promise<void> {
    const input = await updateProgressPayload.parseAsync(payload);
    const userId = new Types.ObjectId(input.userId);
    const moduleId = new Types.ObjectId(input.moduleId);
    const now = new Date();
    const scorePercent = input.maxMarks > 0
      ? (input.awardedMarks / input.maxMarks) * 100
      : 0;

    // Fetch existing doc (if any) to compute rolling averages
    const existing = await StudentProgress.findOne({ userId });

    // Compute new streak
    const prevStreak = existing?.streak ?? { currentDays: 0, lastActivityDate: new Date(0) };
    const newStreakDays = computeStreak(prevStreak.currentDays, prevStreak.lastActivityDate, now);

    // Find existing module entry
    const existingModule = existing?.moduleProgress.find(
      (m) => m.moduleId.toString() === moduleId.toString(),
    );

    const prevTotal = existingModule?.totalAttempts ?? 0;
    const prevAvg = existingModule?.averageScore ?? 0;
    const prevHints = existingModule?.hintsPerQuestion ?? 0;

    // Rolling averages
    const newTotal = prevTotal + 1;
    const newAvg = ((prevAvg * prevTotal) + scorePercent) / newTotal;
    const newHints = ((prevHints * prevTotal) + input.hintsUsed) / newTotal;

    // Error prone fraction: tracked via a running count stored implicitly
    // We approximate by re-computing with the new data point
    const prevErrorFrac = existingModule?.weakAreaFlags.errorProne
      ? prevTotal > 0 ? 0.4 : 0   // rough: if flagged, was >30%
      : 0;
    const newErrorCount = (prevErrorFrac * prevTotal) + (input.hadError ? 1 : 0);
    const newErrorFrac = newTotal > 0 ? newErrorCount / newTotal : 0;

    const flags = computeWeakAreaFlags({
      averageScore: newAvg,
      hintsPerQuestion: newHints,
      totalAttempts: newTotal,
      errorProneFraction: newErrorFrac,
    });

    const moduleEntry = {
      moduleId,
      moduleName: input.moduleName,
      totalAttempts: newTotal,
      averageScore: Math.round(newAvg * 10) / 10,
      lastAttemptAt: now,
      hintsPerQuestion: Math.round(newHints * 10) / 10,
      weakAreaFlags: flags,
    };

    if (!existing) {
      // First attempt ever — create document
      const weakAreas = (flags.lowAccuracy || flags.hintDependent || flags.errorProne) && newTotal >= 3
        ? [buildWeakArea(moduleId, input.moduleName, flags)]
        : [];

      await StudentProgress.insertOne({
        userId,
        streak: { currentDays: 1, lastActivityDate: now },
        moduleProgress: [moduleEntry],
        weakAreas,
        totalAttempts: 1,
      });
      return;
    }

    // Update existing module entry or push new one
    const hasModule = existing.moduleProgress.some(
      (m) => m.moduleId.toString() === moduleId.toString(),
    );

    if (hasModule) {
      await StudentProgress.updateOne(
        { userId, "moduleProgress.moduleId": moduleId },
        {
          $set: {
            "moduleProgress.$": moduleEntry,
            "streak.currentDays": newStreakDays,
            "streak.lastActivityDate": now,
          },
          $inc: { totalAttempts: 1 },
        },
      );
    } else {
      await StudentProgress.updateOne(
        { userId },
        {
          $push: { moduleProgress: moduleEntry },
          $set: {
            "streak.currentDays": newStreakDays,
            "streak.lastActivityDate": now,
          },
          $inc: { totalAttempts: 1 },
        },
      );
    }

    // Recompute weak areas across all modules
    const updated = await StudentProgress.findOne({ userId });
    if (!updated) return;

    const newWeakAreas = updated.moduleProgress
      .filter((m) => {
        const { lowAccuracy, hintDependent, errorProne } = m.weakAreaFlags;
        return (lowAccuracy || hintDependent || errorProne) && m.totalAttempts >= 3;
      })
      .map((m) => buildWeakArea(m.moduleId, m.moduleName, m.weakAreaFlags));

    await StudentProgress.updateOne({ userId }, { $set: { weakAreas: newWeakAreas } });
  }

  async getSummary(userId: string) {
    const doc = await StudentProgress.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!doc) return null;
    return doc;
  }
}

function buildWeakArea(
  moduleId: Types.ObjectId,
  moduleName: string,
  flags: { lowAccuracy: boolean; hintDependent: boolean; errorProne: boolean },
) {
  const reasons: string[] = [];
  if (flags.lowAccuracy) reasons.push("Low accuracy");
  if (flags.hintDependent) reasons.push("Heavy hint use");
  if (flags.errorProne) reasons.push("Frequent errors");
  return {
    moduleId,
    moduleName,
    reasons,
    suggestedAction: buildSuggestedAction(flags),
  };
}

export default ProgressService;
