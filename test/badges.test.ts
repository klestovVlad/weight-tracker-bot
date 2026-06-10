import { describe, it, expect } from "vitest";
import { earnedLossBadges, nextLossBadge, LOSS_BADGES } from "../src/helpers/badges";

describe("earnedLossBadges", () => {
  it("returns nothing below the first threshold", () => {
    expect(earnedLossBadges(2.9)).toEqual([]);
  });
  it("returns all badges at/below the loss", () => {
    expect(earnedLossBadges(11).map((b) => b.kg)).toEqual([3, 5, 10]);
  });
  it("includes a badge exactly at its threshold", () => {
    expect(earnedLossBadges(5).map((b) => b.kg)).toEqual([3, 5]);
  });
});

describe("nextLossBadge", () => {
  it("points to the next milestone", () => {
    expect(nextLossBadge(0)?.kg).toBe(3);
    expect(nextLossBadge(6)?.kg).toBe(10);
  });
  it("is null once everything is earned", () => {
    const top = LOSS_BADGES[LOSS_BADGES.length - 1].kg;
    expect(nextLossBadge(top)).toBeNull();
  });
});
