import { Env, WeightRecord } from "../types";
import { sendMessage, sendPhoto } from "../telegram/api";
import { RU, formatDeltaRu } from "../i18n";
import { getWeightHistory } from "../db/weights";

interface ChartData {
  labels: string[];
  weights: number[];
  periodDelta: number | null;
  minWeight: number;
  maxWeight: number;
}

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}.${month}`;
}

function getChartTitle(period: number | "all"): string {
  switch (period) {
    case 7: return RU.chart_title_7;
    case 30: return RU.chart_title_30;
    case 90: return RU.chart_title_90;
    case 180: return RU.chart_title_180;
    default: return RU.chart_title_all;
  }
}

function prepareChartData(records: WeightRecord[]): ChartData | null {
  if (records.length < 2) return null;

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(r => formatDateLabel(r.date));
  const weights = sorted.map(r => r.weight_kg);
  const periodDelta = weights[weights.length - 1] - weights[0];
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  return { labels, weights, periodDelta, minWeight, maxWeight };
}

function buildQuickChartUrl(data: ChartData, title: string): string {
  const config = {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Вес",
        data: data.weights,
        fill: false,
        borderColor: "#4CAF50",
        tension: 0.1,
        pointRadius: data.weights.length > 30 ? 0 : 3,
      }]
    },
    options: {
      title: { display: true, text: title },
      legend: { display: false },
      scales: {
        yAxes: [{ ticks: { suggestedMin: data.minWeight - 1, suggestedMax: data.maxWeight + 1 } }]
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?format=png&width=800&height=400&c=${encoded}`;
}

export async function handleChart(
  env: Env,
  chatId: number,
  userId: number,
  period: number | "all"
): Promise<Response> {
  const limit = period === "all" ? 1000 : period;
  const records = await getWeightHistory(env.DB, userId, limit);

  const data = prepareChartData(records);
  if (!data) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.chart_not_enough_data);
  }

  const title = getChartTitle(period);
  const chartUrl = buildQuickChartUrl(data, title);

  const deltaStr = data.periodDelta !== null ? formatDeltaRu(data.periodDelta) : "—";
  const caption = RU.chart_caption(deltaStr, data.minWeight.toFixed(1), data.maxWeight.toFixed(1));

  return sendPhoto(env.TELEGRAM_BOT_TOKEN, chatId, chartUrl, caption);
}

export function getSmartDefaultPeriod(totalEntries: number): number | "all" {
  if (totalEntries < 7) return "all";
  if (totalEntries < 20) return 7;
  return 30;
}
