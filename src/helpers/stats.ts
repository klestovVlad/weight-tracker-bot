import { WeightRecord } from "../types";
import { getTodayDate } from "../utils";

const SPARKLINE_CHARS = "▁▂▃▄▅▆▇█";

export interface ProgressStats {
  lastRecord: WeightRecord | null;
  dayDelta: number | null;
  periodDelta: number | null;
  streak: number;
  checkedInToday: boolean;
  count: number;
  period: number;
  minWeight: number | null;
  maxWeight: number | null;
  sparkline: string;
  recentEntries: Array<{ date: string; weight: number }>;
}

export function calculateStreak(records: WeightRecord[]): number {
  if (records.length === 0) return 0;

  const sortedByDateDesc = [...records].sort((a, b) => 
    b.date.localeCompare(a.date)
  );

  let streak = 1;
  let prevDate = new Date(sortedByDateDesc[0].date);

  for (let i = 1; i < sortedByDateDesc.length; i++) {
    const currentDate = new Date(sortedByDateDesc[i].date);
    const diffDays = Math.round(
      (prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      streak++;
      prevDate = currentDate;
    } else {
      break;
    }
  }

  return streak;
}

export function generateSparkline(records: WeightRecord[]): string {
  if (records.length < 2) return "";

  const sortedAsc = [...records].sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  const weights = sortedAsc.map(r => r.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min;

  if (range === 0) {
    return SPARKLINE_CHARS[4].repeat(weights.length);
  }

  const maxIndex = SPARKLINE_CHARS.length - 1;

  return weights
    .map(w => {
      const normalized = (w - min) / range;
      const charIndex = Math.round(normalized * maxIndex);
      return SPARKLINE_CHARS[charIndex];
    })
    .join("");
}

export function computeProgressStats(
  records: WeightRecord[],
  period: number
): ProgressStats {
  const today = getTodayDate();
  
  if (records.length === 0) {
    return {
      lastRecord: null,
      dayDelta: null,
      periodDelta: null,
      streak: 0,
      checkedInToday: false,
      count: 0,
      period,
      minWeight: null,
      maxWeight: null,
      sparkline: "",
      recentEntries: [],
    };
  }

  const sortedDesc = [...records].sort((a, b) => 
    b.date.localeCompare(a.date)
  );

  const sortedAsc = [...records].sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  const lastRecord = sortedDesc[0];
  const firstRecord = sortedAsc[0];
  const checkedInToday = lastRecord.date === today;

  let dayDelta: number | null = null;
  if (sortedDesc.length >= 2) {
    dayDelta = lastRecord.weight_kg - sortedDesc[1].weight_kg;
  }

  let periodDelta: number | null = null;
  if (sortedAsc.length >= 2) {
    periodDelta = lastRecord.weight_kg - firstRecord.weight_kg;
  }

  const weights = records.map(r => r.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  const streak = calculateStreak(records);
  const sparkline = generateSparkline(records);

  const recentLimit = period <= 7 ? 7 : 10;
  const recentEntries = sortedDesc.slice(0, recentLimit).map(r => ({
    date: r.date,
    weight: r.weight_kg,
  }));

  return {
    lastRecord,
    dayDelta,
    periodDelta,
    streak,
    checkedInToday,
    count: records.length,
    period,
    minWeight,
    maxWeight,
    sparkline,
    recentEntries,
  };
}

export function formatDateRu(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}`;
}
