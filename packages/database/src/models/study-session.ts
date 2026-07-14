import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IStudySession extends BaseMongodbSchema {
  userId: Types.ObjectId;
  mode: "theory" | "coding" | "mixed" | "timed" | "review";
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  questionIds: Types.ObjectId[];
  summary: {
    questionsAttempted: number;
    averageScore: number;
    hintsUsed: number;
  };
}

const studySessionSchema = new Schema<IStudySession>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    mode: {
      type: String,
      enum: ["theory", "coding", "mixed", "timed", "review"],
      required: true,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, required: false },
    durationSeconds: { type: Number, required: false },
    questionIds: [{ type: Schema.ObjectId, ref: "questions" }],
    summary: {
      questionsAttempted: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      hintsUsed: { type: Number, default: 0 },
    },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

studySessionSchema.index({ userId: 1 });
studySessionSchema.index({ deletedAt: 1 });
studySessionSchema.index({ startedAt: -1 });

export const StudySession = model<IStudySession>("study_sessions", studySessionSchema);
export default StudySession;
