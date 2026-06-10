/** Milestone badges for total weight lost since start. Pure / testable. */

export interface LossBadge {
  /** Kilograms lost to earn this badge. */
  kg: number;
  icon: string;
  label: string;
}

export const LOSS_BADGES: LossBadge[] = [
  { kg: 3, icon: "🥉", label: "−3 кг" },
  { kg: 5, icon: "🥈", label: "−5 кг" },
  { kg: 10, icon: "🥇", label: "−10 кг" },
  { kg: 15, icon: "🏆", label: "−15 кг" },
  { kg: 20, icon: "💎", label: "−20 кг" },
  { kg: 30, icon: "👑", label: "−30 кг" },
];

/** Badges earned for a given total loss (kg, positive = lost). */
export function earnedLossBadges(lostKg: number): LossBadge[] {
  return LOSS_BADGES.filter((b) => lostKg >= b.kg);
}

/** The next loss badge to aim for, or null if all are earned. */
export function nextLossBadge(lostKg: number): LossBadge | null {
  return LOSS_BADGES.find((b) => lostKg < b.kg) ?? null;
}
