import { describe, it, expect, vi, beforeEach } from "vitest";
import AuthService from "../index";

// Mock the database module
vi.mock("@gcse/database", () => ({
  User: {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
  },
}));

const authService = new AuthService("test-jwt-secret-32chars-long-ok!");

describe("AuthService - hashPassword / verifyPassword", () => {
  it("hashes a password to a bcrypt string", async () => {
    const hash = await authService.hashPassword("mypassword123");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe("mypassword123");
  });

  it("verifies correct password", async () => {
    const hash = await authService.hashPassword("mypassword123");
    const valid = await authService.verifyPassword("mypassword123", hash);
    expect(valid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await authService.hashPassword("mypassword123");
    const valid = await authService.verifyPassword("wrongpassword", hash);
    expect(valid).toBe(false);
  });
});

describe("AuthService - generateToken / verifyToken", () => {
  it("generates a JWT string", () => {
    const token = authService.generateToken({ userId: "abc123", role: "student" });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies a valid token and returns payload", () => {
    const payload = { userId: "abc123", role: "parent" as const };
    const token = authService.generateToken(payload);
    const decoded = authService.verifyToken(token);
    expect(decoded?.userId).toBe("abc123");
    expect(decoded?.role).toBe("parent");
  });

  it("returns null for tampered token", () => {
    const token = authService.generateToken({ userId: "x", role: "student" });
    const result = authService.verifyToken(token + "tampered");
    expect(result).toBeNull();
  });

  it("returns null for completely invalid token", () => {
    expect(authService.verifyToken("not.a.token")).toBeNull();
  });
});
