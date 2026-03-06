import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IUser extends BaseMongodbSchema {
  email: string;
  passwordHash: string;
  fullName: string;
  role: "parent" | "student";
  parentId?: Types.ObjectId;
  examBoardPreference?: "OCR" | "AQA" | "Edexcel";
  aiModelPreference?: "accurate" | "balanced" | "budget";
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ["parent", "student"], required: true },
    parentId: { type: Schema.ObjectId, ref: "users", required: false },
    examBoardPreference: {
      type: String,
      enum: ["OCR", "AQA", "Edexcel"],
      required: false,
    },
    aiModelPreference: {
      type: String,
      enum: ["accurate", "balanced", "budget"],
      default: "balanced",
      required: false,
    },
    lastLoginAt: { type: Date, required: false },
  },
  { timestamps: true },
);

userSchema.index({ parentId: 1 });
userSchema.index({ role: 1 });

export const User = model<IUser>("users", userSchema);
export default User;
