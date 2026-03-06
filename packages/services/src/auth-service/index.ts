import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "@gcse/database";
import { Types } from "mongoose";
import {
  LoginPayload,
  SignupParentPayload,
  SignupStudentPayload,
  UpdateProfilePayload,
  loginPayload,
  signupParentPayload,
  signupStudentPayload,
  updateProfilePayload,
} from "./models";

interface JWTPayload {
  userId: string;
  role: "parent" | "student";
  parentId?: string;
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

  async signupParent(input: SignupParentPayload) {
    const data = await signupParentPayload.parseAsync(input);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await this.hashPassword(data.password);
    const user = await User.insertOne({
      email: data.email.toLowerCase(),
      passwordHash,
      fullName: data.fullName.trim(),
      role: "parent" as const,
      aiModelPreference: data.aiModelPreference,
    });

    return this.toPublicUser(user);
  }

  async createStudent(input: SignupStudentPayload) {
    const data = await signupStudentPayload.parseAsync(input);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await this.hashPassword(data.password);
    const user = await User.insertOne({
      email: data.email.toLowerCase(),
      passwordHash,
      fullName: data.fullName.trim(),
      role: "student" as const,
      parentId: new Types.ObjectId(data.parentId),
      examBoardPreference: data.examBoardPreference,
    });

    return this.toPublicUser(user);
  }

  async login(input: LoginPayload) {
    const data = await loginPayload.parseAsync(input);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) throw new Error("Invalid email or password");

    const valid = await this.verifyPassword(data.password, user.passwordHash);
    if (!valid) throw new Error("Invalid email or password");

    await User.findOneAndUpdate(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const token = this.generateToken({
      userId: user._id.toString(),
      role: user.role,
      parentId: user.parentId?.toString(),
    });

    return { token, user: this.toPublicUser(user) };
  }

  async getUserById(id: string) {
    const user = await User.findOne({ _id: new Types.ObjectId(id) });
    if (!user) throw new Error("User not found");
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfilePayload) {
    const data = await updateProfilePayload.parseAsync(input);
    const updateFields: Record<string, unknown> = {};
    if (data.fullName) updateFields.fullName = data.fullName.trim();
    if (data.examBoardPreference) updateFields.examBoardPreference = data.examBoardPreference;
    if (data.aiModelPreference) updateFields.aiModelPreference = data.aiModelPreference;

    if (Object.keys(updateFields).length === 0) throw new Error("No fields to update");

    const user = await User.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { $set: updateFields },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return this.toPublicUser(user);
  }

  async getStudentsForParent(parentId: string) {
    const students = await User.find({
      $and: [{ parentId: new Types.ObjectId(parentId) }, { role: "student" }],
    });
    return students.map((s) => this.toPublicUser(s));
  }

  private toPublicUser(user: any) {
    return {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role as "parent" | "student",
      parentId: user.parentId?.toString(),
      examBoardPreference: user.examBoardPreference as "OCR" | "AQA" | "Edexcel" | undefined,
      aiModelPreference: user.aiModelPreference as "accurate" | "balanced" | "budget" | undefined,
      createdAt: user.createdAt?.toString(),
      updatedAt: user.updatedAt?.toString(),
    };
  }
}

export default AuthService;
