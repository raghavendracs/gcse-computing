import { Schema, model } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IModule extends BaseMongodbSchema {
  examBoard: "OCR" | "AQA" | "Edexcel" | "generic";
  moduleCode: string;
  moduleName: string;
  topicName: string;
  topicType: "theory" | "programming" | "mixed";
  description: string;
  specReferences: string[];
  difficultyBands: ("easy" | "medium" | "hard")[];
  sortOrder: number;
}

const moduleSchema = new Schema<IModule>(
  {
    examBoard: {
      type: String,
      enum: ["OCR", "AQA", "Edexcel", "generic"],
      required: true,
    },
    moduleCode: { type: String, required: true },
    moduleName: { type: String, required: true },
    topicName: { type: String, required: true },
    topicType: {
      type: String,
      enum: ["theory", "programming", "mixed"],
      required: true,
    },
    description: { type: String, required: true },
    specReferences: [{ type: String }],
    difficultyBands: [{ type: String, enum: ["easy", "medium", "hard"] }],
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

moduleSchema.index({ examBoard: 1 });
moduleSchema.index({ moduleCode: 1 });
moduleSchema.index({ topicType: 1 });
moduleSchema.index({ sortOrder: 1 });

export const Module = model<IModule>("modules", moduleSchema);
export default Module;
