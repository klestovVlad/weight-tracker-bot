/** Body Mass Index helpers (personal, shown only in private chat). */

export interface BmiCategory {
  label: string;
  emoji: string;
}

/** BMI rounded to one decimal, or null if height is missing/invalid. */
export function computeBmi(weightKg: number, heightCm: number | null): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** WHO BMI category (Russian). */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: "недовес", emoji: "🟦" };
  if (bmi < 25) return { label: "норма", emoji: "🟢" };
  if (bmi < 30) return { label: "избыточный", emoji: "🟡" };
  return { label: "ожирение", emoji: "🔴" };
}
