import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IHintEvent extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  topicId: Types.ObjectId;
  hintLevel: 1 | 2 | 3 | 4 | 5;
  hintText: string;
  requestedAt: Date;
}

const hintEventSchema = new Schema<IHintEvent>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "questions" },
    topicId: { type: Schema.ObjectId, required: true, ref: "programming_topics" },
    hintLevel: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    hintText: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

hintEventSchema.index({ deletedAt: 1 });
hintEventSchema.index({ userId: 1, questionId: 1 });
hintEventSchema.index({ userId: 1, topicId: 1 });

export const HintEvent = model<IHintEvent>("hint_events", hintEventSchema);
export default HintEvent;
