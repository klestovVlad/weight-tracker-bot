import { describe, it, expect } from "vitest";
import { computeBmi, bmiCategory } from "../src/helpers/health";

describe("computeBmi", () => {
  it("computes BMI from weight and height", () => {
    expect(computeBmi(80, 180)).toBe(24.7);
    expect(computeBmi(60, 170)).toBe(20.8);
  });
  it("returns null for missing/invalid height", () => {
    expect(computeBmi(80, null)).toBeNull();
    expect(computeBmi(80, 0)).toBeNull();
  });
});

describe("bmiCategory", () => {
  it("classifies WHO bands", () => {
    expect(bmiCategory(17).label).toBe("недовес");
    expect(bmiCategory(22).label).toBe("норма");
    expect(bmiCategory(27).label).toBe("избыточный");
    expect(bmiCategory(33).label).toBe("ожирение");
  });
  it("uses 18.5 / 25 / 30 as boundaries", () => {
    expect(bmiCategory(18.5).label).toBe("норма");
    expect(bmiCategory(25).label).toBe("избыточный");
    expect(bmiCategory(30).label).toBe("ожирение");
  });
});
