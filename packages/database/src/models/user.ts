import { Schema, model } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IUser extends BaseMongodbSchema {
  email: string;
  passwordHash: string;
  fullName: string;
  displayName: string;   // unique public handle for the leaderboard
  totalPoints: number;   // denormalized running total
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    displayName: { type: String, required: true, unique: true },
    totalPoints: { type: Number, default: 0 },
    lastLoginAt: { type: Date, required: false },
    deletedAt: { type: Date, default: null, required: false },
  },
  { timestamps: true },
);

userSchema.index({ totalPoints: -1 });
userSchema.index({ displayName: 1 }, { unique: true });
userSchema.index({ deletedAt: 1 });

export const User = model<IUser>("users", userSchema);
export default User;
