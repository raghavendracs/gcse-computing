import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IQuestionDraft extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  code: string;
}

const questionDraftSchema = new Schema<IQuestionDraft>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "questions" },
    code: { type: String, default: "" },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

questionDraftSchema.index({ userId: 1, questionId: 1 }, { unique: true });

export const QuestionDraft = model<IQuestionDraft>("question_draft", questionDraftSchema);
export default QuestionDraft;
