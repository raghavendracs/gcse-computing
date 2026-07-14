import { Schema, model } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IProgrammingTopic extends BaseMongodbSchema {
  area: string;           // top-level nav section, e.g. "Fundamentals"
  areaSortOrder: number;  // order of the area in the sidebar
  name: string;           // sub-area, e.g. "Variables & assignment"
  slug: string;           // unique kebab id, e.g. "variables-assignment"
  description: string;
  sortOrder: number;      // order of the sub-area within its area
}

const programmingTopicSchema = new Schema<IProgrammingTopic>(
  {
    area: { type: String, required: true },
    areaSortOrder: { type: Number, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    sortOrder: { type: Number, required: true },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

programmingTopicSchema.index({ areaSortOrder: 1, sortOrder: 1 });
programmingTopicSchema.index({ slug: 1 }, { unique: true });

export const ProgrammingTopic = model<IProgrammingTopic>(
  "programming_topics",
  programmingTopicSchema,
);
export default ProgrammingTopic;
