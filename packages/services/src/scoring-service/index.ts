import { QuestionProgress, User } from "@gcse/database";
import { Types } from "mongoose";
import { pointsForAttempt, awardDelta } from "./points";
import { applyAttemptInput, type ApplyAttemptInput, type ApplyAttemptResult } from "./models";

class ScoringService {
  async applyAttempt(input: ApplyAttemptInput): Promise<ApplyAttemptResult> {
    const data = await applyAttemptInput.parseAsync(input);
    const userId = new Types.ObjectId(data.userId);
    const questionId = new Types.ObjectId(data.questionId);
    const topicId = new Types.ObjectId(data.topicId);

    const pointsThisAttempt = pointsForAttempt(data.difficulty, data.testsPassed, data.totalTests);
    const solvedNow = data.totalTests > 0 && data.testsPassed === data.totalTests;

    const progress = await QuestionProgress.findOne({ userId, questionId });
    const priorBest = progress?.bestPointsAwarded ?? 0;
    const delta = awardDelta(priorBest, pointsThisAttempt);
    const newBest = Math.max(priorBest, pointsThisAttempt);

    await QuestionProgress.updateOne(
      { userId, questionId },
      {
        $set: {
          topicId,
          bestPointsAwarded: newBest,
          bestTestsPassed: Math.max(progress?.bestTestsPassed ?? 0, data.testsPassed),
          solved: (progress?.solved ?? false) || solvedNow,
        },
        $inc: { attemptsCount: 1 },
        $setOnInsert: { userId, questionId },
      },
      { upsert: true },
    );

    let newTotalPoints = 0;
    if (delta > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: userId, deletedAt: null },
        { $inc: { totalPoints: delta } },
        { new: true },
      );
      newTotalPoints = updated?.totalPoints ?? 0;
    } else {
      const u = await User.findOne({ _id: userId, deletedAt: null });
      newTotalPoints = u?.totalPoints ?? 0;
    }

    return { pointsThisAttempt, delta, newBest, solved: (progress?.solved ?? false) || solvedNow, newTotalPoints };
  }
}

export default ScoringService;
