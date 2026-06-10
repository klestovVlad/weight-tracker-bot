import { describe, it, expect } from "vitest";
import {
  getDaysBetween,
  getStreakIcon,
  getNextStreakLevel,
  parseWeight,
  getStartOfWeek,
  getPreviousDay,
  getDayOfWeek,
  isSunday,
} from "../src/utils";

describe("getDaysBetween", () => {
  it("counts whole days forward", () => {
    expect(getDaysBetween("2026-06-01", "2026-06-06")).toBe(5);
  });
  it("is zero for the same day", () => {
    expect(getDaysBetween("2026-06-10", "2026-06-10")).toBe(0);
  });
  it("is negative when 'to' precedes 'from'", () => {
    expect(getDaysBetween("2026-06-10", "2026-06-08")).toBe(-2);
  });
  it("handles month boundaries", () => {
    expect(getDaysBetween("2026-01-31", "2026-02-01")).toBe(1);
  });
});

describe("getStreakIcon", () => {
  it("is empty below the first level", () => {
    expect(getStreakIcon(0)).toBe("");
    expect(getStreakIcon(2)).toBe("");
  });
  it("returns the highest reached level", () => {
    expect(getStreakIcon(3)).toBe("🔹");
    expect(getStreakIcon(12)).toBe("🔸"); // 7 reached, 14 not
    expect(getStreakIcon(30)).toBe("🔥");
    expect(getStreakIcon(999)).toBe("👑");
  });
});

describe("getNextStreakLevel", () => {
  it("returns the next threshold", () => {
    expect(getNextStreakLevel(0)).toBe(3);
    expect(getNextStreakLevel(3)).toBe(7);
    expect(getNextStreakLevel(29)).toBe(30);
  });
  it("returns null at the max level", () => {
    expect(getNextStreakLevel(90)).toBeNull();
    expect(getNextStreakLevel(120)).toBeNull();
  });
});

describe("parseWeight", () => {
  it("parses plain numbers and comma decimals", () => {
    expect(parseWeight("87.4")).toBe(87.4);
    expect(parseWeight("87,4")).toBe(87.4);
  });
  it("parses prefixed formats", () => {
    expect(parseWeight("вес 87.4")).toBe(87.4);
    expect(parseWeight("/w 90")).toBe(90);
  });
  it("rounds to one decimal", () => {
    expect(parseWeight("87.46")).toBe(87.5);
  });
  it("rejects out-of-range and junk", () => {
    expect(parseWeight("10")).toBeNull(); // below WEIGHT_MIN
    expect(parseWeight("500")).toBeNull(); // above WEIGHT_MAX
    expect(parseWeight("hello")).toBeNull();
  });
});

describe("week-date helpers", () => {
  it("getStartOfWeek returns the Monday", () => {
    // 2026-06-10 is a Wednesday → Monday is 2026-06-08
    expect(getStartOfWeek("2026-06-10")).toBe("2026-06-08");
    // Sunday belongs to the week that started the previous Monday
    expect(getStartOfWeek("2026-06-14")).toBe("2026-06-08");
  });
  it("getPreviousDay steps back one calendar day", () => {
    expect(getPreviousDay("2026-03-01")).toBe("2026-02-28");
  });
  it("getDayOfWeek / isSunday agree", () => {
    expect(getDayOfWeek("2026-06-14")).toBe(0);
    expect(isSunday("2026-06-14")).toBe(true);
    expect(isSunday("2026-06-10")).toBe(false);
  });
});
