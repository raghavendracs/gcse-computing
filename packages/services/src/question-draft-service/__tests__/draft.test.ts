import { describe, it, expect, vi, beforeEach } from "vitest";

const findOneAndUpdate = vi.fn();
const findOne = vi.fn();
vi.mock("@gcse/database", () => ({
  QuestionDraft: {
    findOneAndUpdate: (...a: any[]) => findOneAndUpdate(...a),
    findOne: (...a: any[]) => findOne(...a),
  },
}));

import QuestionDraftService from "../index";

const UID = "0".repeat(24);
const QID = "1".repeat(24);

describe("QuestionDraftService", () => {
  let svc: QuestionDraftService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new QuestionDraftService();
  });

  it("saveDraft upserts and returns a savedAt timestamp", async () => {
    findOneAndUpdate.mockResolvedValue({ code: "print(1)", updatedAt: new Date("2026-07-14T00:00:00Z") });

    const r = await svc.saveDraft({ userId: UID, questionId: QID, code: "print(1)" });

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const opts = findOneAndUpdate.mock.calls[0][2];
    expect(opts.upsert).toBe(true);
    expect(r.savedAt).toBeTruthy();
  });

  it("getDraft returns the stored code", async () => {
    findOne.mockResolvedValue({ code: "x = 1" });
    const r = await svc.getDraft({ userId: UID, questionId: QID });
    expect(r).toEqual({ code: "x = 1" });
  });

  it("getDraft returns null when no draft exists", async () => {
    findOne.mockResolvedValue(null);
    const r = await svc.getDraft({ userId: UID, questionId: QID });
    expect(r).toBeNull();
  });
});
