import { describe, it, expect } from "vitest";
import { pickReminderKind, type ReminderContext } from "../src/helpers/reminder-text";

const base: ReminderContext = {
  frequency: "daily",
  streakAtRisk: 0,
  daysSinceLast: 1,
  goalRemainingKg: null,
};

describe("pickReminderKind", () => {
  it("onboards a user who never logged", () => {
    expect(pickReminderKind({ ...base, daysSinceLast: null })).toBe("onboarding");
  });

  it("nudges toward a goal that is almost reached", () => {
    expect(pickReminderKind({ ...base, goalRemainingKg: 1.5 })).toBe("goal");
  });

  it("does not use goal nudge when goal is far away", () => {
    expect(pickReminderKind({ ...base, goalRemainingKg: 8 })).toBe("default");
  });

  it("protects an at-risk daily streak", () => {
    expect(pickReminderKind({ ...base, streakAtRisk: 5 })).toBe("streak");
  });

  it("does not use streak nudge for weekly users", () => {
    expect(pickReminderKind({ ...base, frequency: "weekly", streakAtRisk: 5 })).toBe("default");
  });

  it("prioritizes goal over streak", () => {
    expect(pickReminderKind({ ...base, streakAtRisk: 9, goalRemainingKg: 1 })).toBe("goal");
  });

  it("welcomes back a cold user", () => {
    expect(pickReminderKind({ ...base, daysSinceLast: 7 })).toBe("comeback");
  });

  it("falls back to default for an active recent user", () => {
    expect(pickReminderKind(base)).toBe("default");
  });
});
