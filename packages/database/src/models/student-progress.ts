import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IModuleWeakAreaFlags {
  hintDependent: boolean;
  lowAccuracy: boolean;
  errorProne: boolean;
}

export interface IModuleProgress {
  moduleId: Types.ObjectId;
  moduleName: string;
  totalAttempts: number;
  averageScore: number;
  lastAttemptAt: Date;
  hintsPerQuestion: number;
  weakAreaFlags: IModuleWeakAreaFlags;
}

export interface IWeakArea {
  moduleId: Types.ObjectId;
  moduleName: string;
  reasons: string[];
  suggestedAction: string;
}

export interface IStudentProgress extends BaseMongodbSchema {
  userId: Types.ObjectId;
  streak: {
    currentDays: number;
    lastActivityDate: Date;
  };
  moduleProgress: IModuleProgress[];
  weakAreas: IWeakArea[];
  totalAttempts: number;
}

const studentProgressSchema = new Schema<IStudentProgress>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    streak: {
      currentDays: { type: Number, default: 1 },
      lastActivityDate: { type: Date, required: true },
    },
    moduleProgress: [
      {
        moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
        moduleName: { type: String, required: true },
        totalAttempts: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, required: true },
        hintsPerQuestion: { type: Number, default: 0 },
        weakAreaFlags: {
          hintDependent: { type: Boolean, default: false },
          lowAccuracy: { type: Boolean, default: false },
          errorProne: { type: Boolean, default: false },
        },
      },
    ],
    weakAreas: [
      {
        moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
        moduleName: { type: String, required: true },
        reasons: [{ type: String }],
        suggestedAction: { type: String, required: true },
      },
    ],
    totalAttempts: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

studentProgressSchema.index({ userId: 1 }, { unique: true });
studentProgressSchema.index({ deletedAt: 1 });

export const StudentProgress = model<IStudentProgress>(
  "student_progress",
  studentProgressSchema,
);
export default StudentProgress;
