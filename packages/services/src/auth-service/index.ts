import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "@gcse/database";
import { Types } from "mongoose";
import {
  LoginPayload,
  SignupPayload,
  UpdateProfilePayload,
  loginPayload,
  signupPayload,
  updateProfilePayload,
} from "./models";

interface JWTPayload {
  userId: string;
}

class AuthService {
  constructor(private readonly jwtSecret: string) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: "7d" });
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch {
      return null;
    }
  }

  async signup(input: SignupPayload) {
    const data = await signupPayload.parseAsync(input);

    const existingEmail = await User.findOne({ email: data.email.toLowerCase(), deletedAt: null });
    if (existingEmail) throw new Error("Email already registered");

    const existingDisplayName = await User.findOne({ displayName: data.displayName, deletedAt: null });
    if (existingDisplayName) throw new Error("Display name taken");

    const passwordHash = await this.hashPassword(data.password);
    const user = await User.insertOne({
      email: data.email.toLowerCase(),
      passwordHash,
      fullName: data.fullName.trim(),
      displayName: data.displayName.trim(),
    });

    return this.toPublicUser(user);
  }

  async login(input: LoginPayload) {
    const data = await loginPayload.parseAsync(input);
    const user = await User.findOne({ email: data.email.toLowerCase(), deletedAt: null });
    if (!user) throw new Error("Invalid email or password");

    const valid = await this.verifyPassword(data.password, user.passwordHash);
    if (!valid) throw new Error("Invalid email or password");

    await User.findOneAndUpdate(
      { _id: user._id, deletedAt: null },
      { $set: { lastLoginAt: new Date() } },
    );

    const token = this.generateToken({ userId: user._id.toString() });

    return { token, user: this.toPublicUser(user) };
  }

  async getUserById(id: string) {
    const user = await User.findOne({
      $and: [{ _id: new Types.ObjectId(id) }, { deletedAt: null }],
    });
    if (!user) throw new Error("User not found");
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfilePayload) {
    const data = await updateProfilePayload.parseAsync(input);
    const updateFields: Record<string, unknown> = {};
    if (data.fullName) updateFields.fullName = data.fullName.trim();
    if (data.displayName) {
      const existingDisplayName = await User.findOne({
        displayName: data.displayName,
        _id: { $ne: new Types.ObjectId(userId) },
        deletedAt: null,
      });
      if (existingDisplayName) throw new Error("Display name taken");
      updateFields.displayName = data.displayName.trim();
    }

    if (Object.keys(updateFields).length === 0) throw new Error("No fields to update");

    const user = await User.findOneAndUpdate(
      { _id: new Types.ObjectId(userId), deletedAt: null },
      { $set: updateFields },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return this.toPublicUser(user);
  }

  private toPublicUser(user: any) {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    // Legacy/pre-rewrite records may lack displayName (or fullName). Derive a
    // sensible fallback so the public user shape is always valid in any DB state.
    const email = str(user.email);
    const fullName = str(user.fullName) || email.split("@")[0] || "User";
    const displayName = str(user.displayName) || fullName.split(/\s+/)[0] || email.split("@")[0] || "User";
    return {
      id: user._id.toString(),
      email,
      fullName,
      displayName,
      totalPoints: typeof user.totalPoints === "number" ? user.totalPoints : 0,
      createdAt: user.createdAt?.toString(),
      updatedAt: user.updatedAt?.toString(),
    };
  }
}

export default AuthService;
