import { Schema, model } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface ISpecTopic extends BaseMongodbSchema {
  code: string;
  title: string;
  examBoard: "OCR" | "AQA" | "Edexcel";
  paper: "01" | "02";
  topicGroup: string;
  topicGroupTitle: string;
  sortOrder: number;
}

const specTopicSchema = new Schema<ISpecTopic>(
  {
    code: { type: String, required: true },
    title: { type: String, required: true },
    examBoard: { type: String, enum: ["OCR", "AQA", "Edexcel"], required: true },
    paper: { type: String, enum: ["01", "02"], required: true },
    topicGroup: { type: String, required: true },
    topicGroupTitle: { type: String, required: true },
    sortOrder: { type: Number, required: true },
  },
  { timestamps: true },
);

specTopicSchema.index({ examBoard: 1, sortOrder: 1 });
specTopicSchema.index({ code: 1, examBoard: 1 }, { unique: true });

export const SpecTopic = model<ISpecTopic>("spec_topics", specTopicSchema);
export default SpecTopic;
