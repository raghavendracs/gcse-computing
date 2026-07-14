import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface ITestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
  description: string;
}

export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionType = "write" | "fix" | "extend";

export interface IQuestion extends BaseMongodbSchema {
  topicId: Types.ObjectId;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  questionText: string;
  starterCode?: string;        // present for fix/extend
  testCases: ITestCase[];
  points: number;              // 10 / 20 / 30 by difficulty
  hints: string[];
  modelAnswer: string;
}

const questionSchema = new Schema<IQuestion>(
  {
    topicId: { type: Schema.ObjectId, required: true, ref: "programming_topics" },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    questionType: { type: String, enum: ["write", "fix", "extend"], required: true },
    questionText: { type: String, required: true },
    starterCode: { type: String, required: false },
    testCases: [
      {
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        hidden: { type: Boolean, default: false },
        description: { type: String, default: "" },
      },
    ],
    points: { type: Number, required: true },
    hints: [{ type: String }],
    modelAnswer: { type: String, required: true },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

questionSchema.index({ topicId: 1, difficulty: 1 });
questionSchema.index({ topicId: 1 });
questionSchema.index({ deletedAt: 1 });

export const Question = model<IQuestion>("questions", questionSchema);
export default Question;
