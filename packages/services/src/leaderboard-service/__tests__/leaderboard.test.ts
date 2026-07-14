import { describe, it, expect, vi } from "vitest";

vi.mock("@gcse/database", () => ({
  User: {
    find: vi.fn(() => ({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([
        { displayName: "ada", totalPoints: 90 },
        { displayName: "grace", totalPoints: 40 },
      ]) }) }),
    })),
  },
}));

import LeaderboardService from "../index";

describe("LeaderboardService.top", () => {
  it("returns entries with 1-based ranks", async () => {
    const svc = new LeaderboardService();
    const rows = await svc.top(10);
    expect(rows).toEqual([
      { rank: 1, displayName: "ada", totalPoints: 90 },
      { rank: 2, displayName: "grace", totalPoints: 40 },
    ]);
  });
});
