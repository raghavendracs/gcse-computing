import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IQuestionAttempt extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  moduleId: Types.ObjectId;
  attemptNumber: number;
  submittedAnswer: string;
  submissionType: "text" | "code";
  assessment: {
    awardedMarks: number;
    maxMarks: number;
    feedback: string;
    missingPoints: string[];
    strengths: string[];
    confidence: number;
  };
  codingAnalysis?: {
    syntaxValid: boolean;
    testsPassed: number;
    testsFailed: number;
    errorCategory: "syntax" | "logic" | "runtime" | null;
    executionPath: "sandbox" | "ai";
  };
  hintsUsedCount: number;
  timeSpentSeconds: number;
}

const questionAttemptSchema = new Schema<IQuestionAttempt>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "generated_questions" },
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    attemptNumber: { type: Number, required: true, default: 1 },
    submittedAnswer: { type: String, required: true },
    submissionType: { type: String, enum: ["text", "code"], required: true },
    assessment: {
      awardedMarks: { type: Number, required: true },
      maxMarks: { type: Number, required: true },
      feedback: { type: String, required: true },
      missingPoints: [{ type: String }],
      strengths: [{ type: String }],
      confidence: { type: Number, required: true },
    },
    codingAnalysis: {
      syntaxValid: { type: Boolean },
      testsPassed: { type: Number },
      testsFailed: { type: Number },
      errorCategory: { type: String, enum: ["syntax", "logic", "runtime", null] },
      executionPath: { type: String, enum: ["sandbox", "ai"] },
    },
    hintsUsedCount: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

questionAttemptSchema.index({ deletedAt: 1 });
questionAttemptSchema.index({ userId: 1, moduleId: 1 });
questionAttemptSchema.index({ userId: 1, questionId: 1 });
questionAttemptSchema.index({ createdAt: -1 });

export const QuestionAttempt = model<IQuestionAttempt>(
  "question_attempts",
  questionAttemptSchema,
);
export default QuestionAttempt;
