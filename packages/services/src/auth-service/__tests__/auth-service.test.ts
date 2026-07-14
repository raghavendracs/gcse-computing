import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module - must be before importing AuthService
vi.mock("@gcse/database", () => ({
  User: {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import AuthService from "../index";
import { User } from "@gcse/database";

const authService = new AuthService("test-jwt-secret-32chars-long-ok!");

// Helper to build a fake DB user document
function makeFakeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "user-id-123" },
    email: "alice@example.com",
    fullName: "Alice Smith",
    displayName: "alice",
    passwordHash: "$2b$12$fakehashedpassword",
    totalPoints: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ── bcrypt helpers ─────────────────────────────────────────────────────────────

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

// ── JWT helpers ────────────────────────────────────────────────────────────────

describe("AuthService - generateToken / verifyToken", () => {
  it("generates a JWT string", () => {
    const token = authService.generateToken({ userId: "abc123" });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies a valid token and returns payload", () => {
    const token = authService.generateToken({ userId: "abc123" });
    const decoded = authService.verifyToken(token);
    expect(decoded?.userId).toBe("abc123");
  });

  it("returns null for tampered token", () => {
    const token = authService.generateToken({ userId: "x" });
    const result = authService.verifyToken(token + "tampered");
    expect(result).toBeNull();
  });

  it("returns null for completely invalid token", () => {
    expect(authService.verifyToken("not.a.token")).toBeNull();
  });
});

// ── signup ─────────────────────────────────────────────────────────────────────

describe("AuthService - signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: creates a new user and returns public profile", async () => {
    const fakeUser = makeFakeUser();
    vi.mocked(User.findOne).mockResolvedValueOnce(null); // no existing email
    vi.mocked(User.findOne).mockResolvedValueOnce(null); // no existing displayName
    vi.mocked(User.insertOne).mockResolvedValueOnce(fakeUser as any);

    const result = await authService.signup({
      email: "alice@example.com",
      password: "securepass",
      fullName: "Alice Smith",
      displayName: "alice",
    });

    expect(result.id).toBe("user-id-123");
    expect(result.email).toBe("alice@example.com");
    expect(result.displayName).toBe("alice");
    expect(result.totalPoints).toBe(0);
    // Sensitive fields must not be present
    expect((result as any).passwordHash).toBeUndefined();
    expect((result as any).role).toBeUndefined();
  });

  it("throws 'Email already registered' when email is taken", async () => {
    vi.mocked(User.findOne).mockResolvedValueOnce(makeFakeUser() as any);

    await expect(
      authService.signup({
        email: "alice@example.com",
        password: "securepass",
        fullName: "Alice Smith",
        displayName: "alice",
      }),
    ).rejects.toThrow("Email already registered");
  });

  it("throws 'Display name taken' when displayName is already used", async () => {
    vi.mocked(User.findOne).mockResolvedValueOnce(null);          // email free
    vi.mocked(User.findOne).mockResolvedValueOnce(makeFakeUser() as any); // displayName taken

    await expect(
      authService.signup({
        email: "new@example.com",
        password: "securepass",
        fullName: "New User",
        displayName: "alice",
      }),
    ).rejects.toThrow("Display name taken");
  });

  it("rejects passwords shorter than 8 characters (Zod validation)", async () => {
    await expect(
      authService.signup({
        email: "x@example.com",
        password: "short",
        fullName: "X User",
        displayName: "xuser",
      }),
    ).rejects.toThrow();
  });
});

// ── login ──────────────────────────────────────────────────────────────────────

describe("AuthService - login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: returns token and public user on valid credentials", async () => {
    const plainPassword = "securepass";
    const hash = await authService.hashPassword(plainPassword);
    const fakeUser = makeFakeUser({ passwordHash: hash });

    vi.mocked(User.findOne).mockResolvedValueOnce(fakeUser as any);
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce(fakeUser as any);

    const result = await authService.login({ email: "alice@example.com", password: plainPassword });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(result.user.email).toBe("alice@example.com");
    expect(result.user.displayName).toBe("alice");

    // Token must decode to { userId }
    const decoded = authService.verifyToken(result.token);
    expect(decoded?.userId).toBe("user-id-123");
    expect((decoded as any)?.role).toBeUndefined();
  });

  it("throws 'Invalid email or password' when user not found", async () => {
    vi.mocked(User.findOne).mockResolvedValueOnce(null);

    await expect(
      authService.login({ email: "nobody@example.com", password: "securepass" }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("throws 'Invalid email or password' when password is wrong", async () => {
    const hash = await authService.hashPassword("correctpass");
    const fakeUser = makeFakeUser({ passwordHash: hash });

    vi.mocked(User.findOne).mockResolvedValueOnce(fakeUser as any);

    await expect(
      authService.login({ email: "alice@example.com", password: "wrongpass" }),
    ).rejects.toThrow("Invalid email or password");
  });
});
