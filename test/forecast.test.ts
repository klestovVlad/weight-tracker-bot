import { describe, it, expect } from "vitest";
import { forecastGoalDate, type ForecastPoint } from "../src/helpers/forecast";

// Steady loss of ~0.1 kg/day from 90.
function steadyLoss(): ForecastPoint[] {
  return [
    { date: "2026-06-01", weightKg: 90.0 },
    { date: "2026-06-06", weightKg: 89.5 },
    { date: "2026-06-11", weightKg: 89.0 },
    { date: "2026-06-16", weightKg: 88.5 },
  ];
}

describe("forecastGoalDate", () => {
  it("projects a future date for a steady downward trend", () => {
    const f = forecastGoalDate(steadyLoss(), 85, "2026-06-16");
    expect(f).not.toBeNull();
    expect(f!.ratePerDay).toBeLessThan(0);
    expect(f!.daysLeft).toBeGreaterThan(0);
    // ~3.5 kg left at ~0.1 kg/day → ~35 days.
    expect(f!.daysLeft).toBeGreaterThan(20);
    expect(f!.daysLeft).toBeLessThan(60);
    expect(f!.etaDate > "2026-06-16").toBe(true);
  });

  it("returns null when the trend moves away from the goal", () => {
    // Losing weight, but goal is ABOVE current → wrong direction.
    expect(forecastGoalDate(steadyLoss(), 95, "2026-06-16")).toBeNull();
  });

  it("returns null with too few points", () => {
    expect(
      forecastGoalDate([{ date: "2026-06-01", weightKg: 90 }], 85, "2026-06-01"),
    ).toBeNull();
  });

  it("returns null for a flat trend", () => {
    const flat: ForecastPoint[] = [
      { date: "2026-06-01", weightKg: 88 },
      { date: "2026-06-05", weightKg: 88 },
      { date: "2026-06-09", weightKg: 88 },
    ];
    expect(forecastGoalDate(flat, 85, "2026-06-09")).toBeNull();
  });

  it("reports 0 days left when already at goal", () => {
    const f = forecastGoalDate(steadyLoss(), 88.5, "2026-06-16");
    expect(f).not.toBeNull();
    expect(f!.daysLeft).toBe(0);
  });
});
