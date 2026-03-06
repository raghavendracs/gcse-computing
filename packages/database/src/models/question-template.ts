import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IQuestionTemplate extends BaseMongodbSchema {
  moduleId: Types.ObjectId;
  questionType:
    | "multiple_choice"
    | "short_answer"
    | "extended"
    | "coding"
    | "trace_table"
    | "fill_gap"
    | "predict_output"
    | "fix_code";
  templateName: string;
  promptTemplate: string;
  generationRules: {
    parameters: string[];
    difficulty: "easy" | "medium" | "hard";
  };
  rubric: {
    maxMarks: number;
    markSchemePoints: string[];
    acceptedConcepts: string[];
    commonMisconceptions: string[];
  };
  hintFramework: string[];
  modelAnswerTemplate: string;
  active: boolean;
}

const questionTemplateSchema = new Schema<IQuestionTemplate>(
  {
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    questionType: {
      type: String,
      enum: [
        "multiple_choice",
        "short_answer",
        "extended",
        "coding",
        "trace_table",
        "fill_gap",
        "predict_output",
        "fix_code",
      ],
      required: true,
    },
    templateName: { type: String, required: true },
    promptTemplate: { type: String, required: true },
    generationRules: {
      parameters: [{ type: String }],
      difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    },
    rubric: {
      maxMarks: { type: Number, required: true },
      markSchemePoints: [{ type: String }],
      acceptedConcepts: [{ type: String }],
      commonMisconceptions: [{ type: String }],
    },
    hintFramework: [{ type: String }],
    modelAnswerTemplate: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

questionTemplateSchema.index({ moduleId: 1 });
questionTemplateSchema.index({ questionType: 1 });
questionTemplateSchema.index({ active: 1 });

export const QuestionTemplate = model<IQuestionTemplate>(
  "question_templates",
  questionTemplateSchema,
);
export default QuestionTemplate;
