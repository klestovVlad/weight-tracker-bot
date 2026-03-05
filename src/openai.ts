import { Env, ReportPayload, HumanizedReport } from "./types";
import { logError } from "./helpers/logging";
import { validateGptMeme } from "./helpers/meme";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_LENGTH = 600;
const MAX_LENGTH_DAILY = 2200;
const MAX_LENGTH_WEEKLY = 2200;
const MAX_LENGTH_MONTHLY = 2200;
const TIMEOUT_MS = 10000;

/** Response format we request from OpenAI and parse. Daily: message only; weekly/monthly: message + meme. */
export interface OpenAIReportResponse {
  message: string;
  meme?: unknown;
}

/** Exact JSON shape we ask for in prompts — must match parsing in humanizeReport. */
const RESPONSE_FORMAT_DAILY = '{ "message": "..." }';
const RESPONSE_FORMAT_WITH_MEME =
  '{ "message": "...", "meme": { "object": "<noun phrase in Russian>", "caption": "<optional>" } }';

const DAILY_REPORT_PROMPT = `You generate daily Telegram reports for a team weight-loss challenge.

INPUT: JSON with statistics for one day. Use ONLY the data from this input; do not invent numbers or names.

AVAILABLE DATA:
- date — report date (display as-is or format nicely)
- sumDayDelta — team weight change today (kg). Negative = lost, positive = gained
- countSubmitted, countMissing — number of people who weighed / who missed (optional for phrasing)
- leader — optional. If present: { name, dayDelta } is the pre-computed "Leader of the day" (best negative dayDelta). Use leader.name and leader.dayDelta in the Leader section. If leader is missing, skip the Leader section or write one short neutral line.
- submitted — array of who weighed today. Each item: name (may include achievement icon emoji after name, e.g. "Вася 🔸"), dayDelta, totalDelta, goalRemaining, goalPercent, goalReached. When listing "Who weighed today", output each name exactly as in submitted (with icon if present).
- missing — names of who did not weigh today (skip section if empty)
- achievementLines — optional. Array of { name, icon, days }: people who reached a new streak level today. If present, add section "🏅 Новые ачивки сегодня" and list each as "• name: icon N дней подряд". Skip section if missing or empty.
- brokenLines — optional. Array of { name, streak }: people who missed today and broke a streak of 3+ days. If present, add section "💔 Прервали серию" and list each as "• name прервал серию из N дней". Skip section if missing or empty.
- goalsInfo — optional array: name, remaining (kg to goal), percent, reached. For "Progress to goal" use remaining as remainingToGoal and totalLost from submitted[].totalDelta per user (negative = lost). Skip section if goalsInfo is missing or empty.

OUTPUT: Strictly a single JSON object (this shape only):
${RESPONSE_FORMAT_DAILY}

The message must be one string containing all sections below, in order. Write in Russian. No "meme" field for daily.

STRUCTURE (keep each section 1–3 sentences; separate sections with a blank line; use bullet • for lists of names):

1. 📉 Итог дня — team change today (sumDayDelta, kg)
2. 👥 Кто отметился — list names from submitted (keep icons in names)
3. 🚫 Пропустили — list names from missing (only if any)
4. 🏅 Новые ачивки сегодня — from achievementLines (only if present)
5. 💔 Прервали серию — from brokenLines (only if present)
6. 👑 Лидер дня — leader.name and leader.dayDelta (kg). Skip if leader missing.
7. ⚖️ Аналогия — compare sumDayDelta to a common object
8. 🎯 Прогресс по целям — from goalsInfo/submitted. Skip if no goals
9. 🔬 Факт дня — one short science fact
10. 😄 Шутка — one light joke

FORMATTING:
- Start each section with emoji + title. One blank line between sections. Use • for list items.
- Short paragraphs, no tables. Concise, motivational, slightly playful tone.

Return only the JSON object, no markdown or extra text.`;

const WEEKLY_REPORT_PROMPT = `You generate weekly Telegram reports for a team weight-loss challenge.

INPUT: JSON with statistics for the week. Use ONLY the data from this input; do not invent numbers or names.

AVAILABLE DATA:
- date — report date / end of week (display as-is or format nicely)
- sumDayDelta — team weight change during the week (kg). Negative = lost, positive = gained
- countSubmitted, countMissing — number of people who weighed / who missed (optional for phrasing)
- leader — optional. If present: { name, dayDelta } is the pre-computed "Champion of the week". Use leader.name and leader.dayDelta in the Champion section. If leader is missing, skip the Champion section or write one short neutral line.
- submitted — array of who weighed this week. Each item: name (may include achievement icon after name, e.g. "Вася 🔸"), dayDelta, totalDelta, goalRemaining, goalPercent, goalReached. When listing participants, output each name exactly as in submitted (with icon if present).
- missing — names of who did not weigh this week (skip section if empty)
- goalsInfo — optional array: name, remaining (kg to goal), percent, reached. For "Progress to goal" use remaining as remainingToGoal and totalLost from submitted[].totalDelta per user (negative = lost). Skip section if goalsInfo is missing or empty.

OUTPUT: Strictly a single JSON object (this shape only):
${RESPONSE_FORMAT_WITH_MEME}

The message must be one string containing all sections below, in order. Write in Russian. The meme.object is used to fetch an image; use the same object you mention in the Analogy section.

STRUCTURE (each section 1–3 sentences; separate sections with a blank line; use bullet • for lists):

1. 📊 Итоги недели — team change (sumDayDelta, kg)
2. 👑 Чемпион недели — leader.name and leader.dayDelta (kg). Skip if leader missing.
3. 👥 Кто отметился — list names from submitted (keep icons in names)
4. 🚫 Пропустили — list names from missing (only if any)
5. ⚖️ Аналогия — compare sumDayDelta to everyday object; use meme.object for image
6. 🎯 Прогресс по целям — from goalsInfo/submitted. Skip if no goals
7. 🔬 Факт недели — one short science fact
8. 😄 Шутка — one light joke

FORMATTING:
- Start each section with emoji + title. One blank line between sections. Use • for list items. Concise, motivational tone.

Return only the JSON object, no markdown or extra text.`;

const MONTHLY_REPORT_PROMPT = `You generate monthly Telegram reports for a team weight-loss challenge.

INPUT: JSON with statistics for the month. Use ONLY the data from this input; do not invent numbers or names.

AVAILABLE DATA:
- date — report date / end of month (display as-is or format nicely)
- sumDayDelta — team weight change during the month (kg). Negative = lost, positive = gained
- countSubmitted, countMissing — number of people who weighed / who missed (optional for phrasing)
- leader — optional. If present: { name, dayDelta } is the pre-computed "Champion of the month". Use leader.name and leader.dayDelta in the Champion section. If leader is missing, skip the Champion section or write one short neutral line.
- submitted — array of who weighed this month. Each item: name (may include achievement icon after name). When listing participants, output each name exactly as in submitted (with icon if present).
- missing — names of who did not weigh this month (skip section if empty)
- goalsInfo — optional array: name, remaining (kg to goal), percent, reached. For "Progress to goal" use remaining as remainingToGoal and totalLost from submitted[].totalDelta per user (negative = lost). Skip section if goalsInfo is missing or empty.

OUTPUT: Strictly a single JSON object (this shape only):
${RESPONSE_FORMAT_WITH_MEME}

The message must be one string containing all sections below, in order. Write in Russian. The meme.object is used to fetch an image; use the same object you mention in the Analogy section.

STRUCTURE (each section 1–3 sentences; separate sections with a blank line; use bullet • for lists):

1. 📊 Итоги месяца — team change (sumDayDelta, kg)
2. 👑 Чемпион месяца — leader.name and leader.dayDelta (kg). Skip if leader missing.
3. 👥 Кто отметился — list names from submitted (keep icons in names)
4. 🚫 Пропустили — list names from missing (only if any)
5. ⚖️ Аналогия — compare sumDayDelta to everyday object; use meme.object for image
6. 🎯 Прогресс по целям — from goalsInfo/submitted. Skip if no goals
7. 🔬 Факт месяца — one short science fact
8. 😄 Шутка — one light joke

FORMATTING:
- Start each section with emoji + title. One blank line between sections. Use • for list items. Concise, motivational tone.

Return only the JSON object, no markdown or extra text.`;

function getSystemPrompt(kind: ReportPayload["kind"]): string {
  switch (kind) {
    case "daily":
      return DAILY_REPORT_PROMPT;
    case "weekly":
      return WEEKLY_REPORT_PROMPT;
    case "monthly":
      return MONTHLY_REPORT_PROMPT;
    default:
      return DAILY_REPORT_PROMPT;
  }
}

/** Minimal report payload for API: only fields used by daily/weekly/monthly prompts. */
function buildMinimalPayloadForApi(payload: ReportPayload): object {
  const base: Record<string, unknown> = {
    date: payload.date,
    sumDayDelta: payload.sumDayDelta,
    countSubmitted: payload.countSubmitted,
    countMissing: payload.countMissing,
    leader: payload.leader ?? undefined,
    submitted: payload.submitted.map((u) => ({
      name: u.name,
      dayDelta: u.dayDelta,
      totalDelta: u.totalDelta,
      goalRemaining: u.goalRemaining,
      goalPercent: u.goalPercent,
      goalReached: u.goalReached,
    })),
    missing: payload.missing,
    goalsInfo: payload.goalsInfo ?? undefined,
  };
  if (payload.kind === "daily") {
    if (payload.achievementLines?.length) base.achievementLines = payload.achievementLines;
    if (payload.brokenLines?.length) base.brokenLines = payload.brokenLines;
  }
  return base;
}

function extractAllowedNumbers(payload: ReportPayload): Set<string> {
  const allowed = new Set<string>();

  for (const user of payload.submitted) {
    if (user.dayDelta !== null) {
      allowed.add(Math.abs(user.dayDelta).toFixed(1));
      allowed.add(String(Math.abs(user.dayDelta)));
    }
    if (user.totalDelta !== null) {
      allowed.add(Math.abs(user.totalDelta).toFixed(1));
      allowed.add(String(Math.abs(user.totalDelta)));
    }
    if (user.goalRemaining != null) {
      allowed.add(user.goalRemaining.toFixed(1));
      allowed.add(String(user.goalRemaining));
    }
    if (user.goalPercent != null) allowed.add(String(user.goalPercent));
  }
  if (payload.goalsInfo) {
    for (const g of payload.goalsInfo) {
      allowed.add(g.remaining.toFixed(1));
      allowed.add(String(g.remaining));
      allowed.add(String(g.percent));
    }
  }

  allowed.add(String(payload.submitted.length));
  allowed.add(String(payload.missing.length));
  allowed.add(String(Math.abs(payload.sumDayDelta).toFixed(1)));
  allowed.add(String(Math.abs(payload.avgDayDelta).toFixed(2)));
  if (payload.leader) {
    allowed.add(Math.abs(payload.leader.dayDelta).toFixed(1));
    allowed.add(String(Math.abs(payload.leader.dayDelta)));
  }

  for (let i = 0; i <= 31; i++) {
    allowed.add(String(i));
  }
  if (payload.achievementLines) {
    for (const a of payload.achievementLines) {
      allowed.add(String(a.days));
    }
  }
  if (payload.brokenLines) {
    for (const b of payload.brokenLines) {
      allowed.add(String(b.streak));
    }
  }

  return allowed;
}

function containsSuspiciousNumbers(
  text: string,
  allowedNumbers: Set<string>,
): boolean {
  const numbers = text.match(/\d+\.?\d*/g) || [];

  for (const num of numbers) {
    const normalized = parseFloat(num);
    if (normalized >= 30 && normalized <= 300) {
      if (
        !allowedNumbers.has(num) &&
        !allowedNumbers.has(normalized.toFixed(1))
      ) {
        return true;
      }
    }
  }

  return false;
}

export async function humanizeReport(
  payload: ReportPayload,
  env: Env,
): Promise<HumanizedReport> {
  const fallback: HumanizedReport = { message: "", meme: null };

  if (!env.OPENAI_API_KEY) {
    return fallback;
  }

  const model = env.OPENAI_MODEL || DEFAULT_MODEL;

  const userContent =
    payload.kind === "daily" ||
    payload.kind === "weekly" ||
    payload.kind === "monthly"
      ? JSON.stringify(buildMinimalPayloadForApi(payload))
      : JSON.stringify(payload);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: getSystemPrompt(payload.kind) },
          { role: "user", content: userContent },
        ],
        temperature: 0.85,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logError(`OpenAI API error: ${response.status}`);
      return fallback;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return fallback;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallback;
    }

    let parsed: OpenAIReportResponse;
    try {
      const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const messageText =
        typeof raw.message === "string"
          ? raw.message
          : [raw.intro, raw.outro]
              .filter((s): s is string => typeof s === "string")
              .join("\n\n");
      parsed = { message: messageText, meme: raw.meme };
    } catch {
      return fallback;
    }

    const message = parsed.message;
    if (!message) {
      return fallback;
    }

    const allowedNumbers = extractAllowedNumbers(payload);
    if (containsSuspiciousNumbers(message, allowedNumbers)) {
      logError("OpenAI response contains suspicious numbers, using fallback");
      return fallback;
    }

    const meme =
      parsed.meme != null ? validateGptMeme(parsed.meme) : null;

    const maxLen =
      payload.kind === "daily"
        ? MAX_LENGTH_DAILY
        : payload.kind === "weekly"
          ? MAX_LENGTH_WEEKLY
          : payload.kind === "monthly"
            ? MAX_LENGTH_MONTHLY
            : MAX_LENGTH;
    return {
      message: message.slice(0, maxLen),
      meme: meme ?? null,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      logError("OpenAI request timed out");
    } else {
      logError("OpenAI humanize error", error);
    }
    return fallback;
  }
}
