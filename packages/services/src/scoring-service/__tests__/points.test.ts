import { describe, it, expect } from "vitest";
import { DIFFICULTY_POINTS, pointsForAttempt, awardDelta } from "../points";

describe("pointsForAttempt", () => {
  it("awards full points when all tests pass", () => {
    expect(pointsForAttempt("medium", 5, 5)).toBe(20);
  });
  it("scales by pass ratio and rounds", () => {
    expect(pointsForAttempt("hard", 2, 3)).toBe(20); // round(30 * 0.6667) = 20
    expect(pointsForAttempt("easy", 1, 3)).toBe(3);  // round(10 * 0.3333) = 3
  });
  it("returns 0 when there are no tests", () => {
    expect(pointsForAttempt("hard", 0, 0)).toBe(0);
  });
  it("uses the difficulty table", () => {
    expect(DIFFICULTY_POINTS).toEqual({ easy: 10, medium: 20, hard: 30 });
  });
});

describe("awardDelta", () => {
  it("gives only the positive improvement over prior best", () => {
    expect(awardDelta(0, 20)).toBe(20);
    expect(awardDelta(20, 20)).toBe(0);   // re-solving cannot farm
    expect(awardDelta(12, 20)).toBe(8);   // improved
    expect(awardDelta(30, 10)).toBe(0);   // worse attempt earns nothing
  });
});
