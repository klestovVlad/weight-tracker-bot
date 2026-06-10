import { describe, it, expect } from "vitest";
import { parseSeasonSetup } from "../src/helpers/season";

describe("parseSeasonSetup", () => {
  it("parses name, days and goal", () => {
    expect(parseSeasonSetup("Лето | 28 | 20")).toEqual({ name: "Лето", days: 28, goalKg: 20 });
  });
  it("parses without a goal", () => {
    expect(parseSeasonSetup("Весна | 14")).toEqual({ name: "Весна", days: 14, goalKg: null });
  });
  it("accepts comma decimals for the goal", () => {
    expect(parseSeasonSetup("X | 7 | 5,5")?.goalKg).toBe(5.5);
  });
  it("rejects bad input", () => {
    expect(parseSeasonSetup("Лето")).toBeNull();
    expect(parseSeasonSetup("Лето | abc")).toBeNull();
    expect(parseSeasonSetup("Лето | 0")).toBeNull();
    expect(parseSeasonSetup("Лето | 28 | -5")).toBeNull();
    expect(parseSeasonSetup("| 28")).toBeNull();
  });
});
