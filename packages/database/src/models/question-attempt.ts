import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IAttemptTestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  hidden: boolean;
}

export interface IQuestionAttempt extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  topicId: Types.ObjectId;
  attemptNumber: number;
  submittedCode: string;
  testResults: IAttemptTestResult[];
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  feedback: {
    text: string;
    strengths: string[];
    missingPoints: string[];
    syntaxValid: boolean;
    errorCategory: "syntax" | "logic" | "runtime" | null;
  };
  pointsAwardedThisAttempt: number;
  hintsUsedCount: number;
  timeSpentSeconds: number;
}

const questionAttemptSchema = new Schema<IQuestionAttempt>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "questions" },
    topicId: { type: Schema.ObjectId, required: true, ref: "programming_topics" },
    attemptNumber: { type: Number, required: true, default: 1 },
    submittedCode: { type: String, required: true },
    testResults: [
      {
        input: { type: String },
        expectedOutput: { type: String },
        actualOutput: { type: String },
        passed: { type: Boolean },
        hidden: { type: Boolean, default: false },
      },
    ],
    testsPassed: { type: Number, default: 0 },
    testsFailed: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    feedback: {
      text: { type: String, default: "" },
      strengths: [{ type: String }],
      missingPoints: [{ type: String }],
      syntaxValid: { type: Boolean, default: true },
      errorCategory: { type: String, enum: ["syntax", "logic", "runtime", null], default: null },
    },
    pointsAwardedThisAttempt: { type: Number, default: 0 },
    hintsUsedCount: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

questionAttemptSchema.index({ deletedAt: 1 });
questionAttemptSchema.index({ userId: 1, topicId: 1 });
questionAttemptSchema.index({ userId: 1, questionId: 1 });
questionAttemptSchema.index({ createdAt: -1 });

export const QuestionAttempt = model<IQuestionAttempt>(
  "question_attempts",
  questionAttemptSchema,
);
export default QuestionAttempt;
