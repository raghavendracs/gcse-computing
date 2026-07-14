import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IQuestionProgress extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  topicId: Types.ObjectId;
  bestPointsAwarded: number;
  bestTestsPassed: number;
  solved: boolean;
  attemptsCount: number;
}

const questionProgressSchema = new Schema<IQuestionProgress>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "questions" },
    topicId: { type: Schema.ObjectId, required: true, ref: "programming_topics" },
    bestPointsAwarded: { type: Number, default: 0 },
    bestTestsPassed: { type: Number, default: 0 },
    solved: { type: Boolean, default: false },
    attemptsCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

questionProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true });
questionProgressSchema.index({ userId: 1, topicId: 1 });

export const QuestionProgress = model<IQuestionProgress>(
  "question_progress",
  questionProgressSchema,
);
export default QuestionProgress;
