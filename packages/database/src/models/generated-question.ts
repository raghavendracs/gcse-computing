import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface ITestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface IGeneratedQuestion extends BaseMongodbSchema {
  moduleId: Types.ObjectId;
  templateId?: Types.ObjectId;
  userId: Types.ObjectId;
  questionType: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  answerFormat: "free_text" | "code" | "multiple_choice";
  maxMarks: number;
  markSchemePoints: string[];
  modelAnswer: string;
  hints: string[];
  testCases: ITestCase[];
  metadata: {
    examBoard: string;
    topicName: string;
    misconceptionNotes: string[];
  };
  usedInSession: boolean;
  supportReady: boolean;
  nextReviewAt?: Date;
}

const generatedQuestionSchema = new Schema<IGeneratedQuestion>(
  {
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    templateId: { type: Schema.ObjectId, required: false, ref: "question_templates" },
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionType: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    questionText: { type: String, required: true },
    answerFormat: {
      type: String,
      enum: ["free_text", "code", "multiple_choice"],
      required: true,
    },
    maxMarks: { type: Number, required: true },
    markSchemePoints: [{ type: String }],
    modelAnswer: { type: String, required: true },
    hints: [{ type: String }],
    testCases: [
      {
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        hidden: { type: Boolean, default: false },
      },
    ],
    metadata: {
      examBoard: { type: String, required: true },
      topicName: { type: String, required: true },
      misconceptionNotes: [{ type: String }],
    },
    usedInSession: { type: Boolean, default: false },
    supportReady: { type: Boolean, default: false },
    nextReviewAt: { type: Date, required: false },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

generatedQuestionSchema.index({ deletedAt: 1 });
generatedQuestionSchema.index({ userId: 1, moduleId: 1 });
generatedQuestionSchema.index({ userId: 1, usedInSession: 1 });
generatedQuestionSchema.index({ createdAt: -1 });
generatedQuestionSchema.index({ userId: 1, nextReviewAt: 1 });

export const GeneratedQuestion = model<IGeneratedQuestion>(
  "generated_questions",
  generatedQuestionSchema,
);
export default GeneratedQuestion;
