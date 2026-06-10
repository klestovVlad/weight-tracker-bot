import type { ReportPayload } from "../types";

/** Strips crown/streak emoji and decoration from a display name for chart labels. */
function cleanName(name: string): string {
  return name
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const LOSS_COLOR = "#4CAF50"; // green — lost weight
const GAIN_COLOR = "#FF9800"; // orange — gained

/**
 * Builds a QuickChart horizontal-bar URL showing each participant's change for
 * the period (kg). Privacy-safe: only deltas, never absolute weights — the same
 * numbers already shown in the report text. Returns null if there's nothing to plot.
 */
export function buildTeamChartUrl(payload: ReportPayload, title: string): string | null {
  const entries = payload.submitted
    .filter((u) => u.dayDelta !== null)
    .map((u) => ({ name: cleanName(u.name), delta: Math.round((u.dayDelta as number) * 10) / 10 }))
    .sort((a, b) => a.delta - b.delta); // biggest loss first

  if (entries.length === 0) return null;

  const config = {
    type: "horizontalBar",
    data: {
      labels: entries.map((e) => e.name),
      datasets: [
        {
          data: entries.map((e) => e.delta),
          backgroundColor: entries.map((e) => (e.delta <= 0 ? LOSS_COLOR : GAIN_COLOR)),
        },
      ],
    },
    options: {
      title: { display: true, text: title },
      legend: { display: false },
      scales: {
        xAxes: [{ ticks: { fontSize: 11 }, scaleLabel: { display: true, labelString: "кг" } }],
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  const height = Math.max(220, 60 + entries.length * 38);
  return `https://quickchart.io/chart?format=png&width=700&height=${height}&c=${encoded}`;
}
