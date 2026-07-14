import { QuestionDraft } from "@gcse/database";
import { Types } from "mongoose";

class QuestionDraftService {
  // Upsert the in-progress draft for a (user, question) pair.
  async saveDraft(input: { userId: string; questionId: string; code: string }): Promise<{ savedAt: string }> {
    const doc = await QuestionDraft.findOneAndUpdate(
      {
        userId: new Types.ObjectId(input.userId),
        questionId: new Types.ObjectId(input.questionId),
      },
      { $set: { code: input.code } },
      { upsert: true, new: true },
    );
    return { savedAt: (doc?.updatedAt ?? new Date()).toString() };
  }

  async getDraft(input: { userId: string; questionId: string }): Promise<{ code: string } | null> {
    const doc = await QuestionDraft.findOne({
      userId: new Types.ObjectId(input.userId),
      questionId: new Types.ObjectId(input.questionId),
    });
    if (!doc) return null;
    return { code: doc.code };
  }
}

export default QuestionDraftService;
