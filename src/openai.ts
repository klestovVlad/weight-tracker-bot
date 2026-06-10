import { Env, ReportPayload, HumanizedReport } from "./types";
import { logError } from "./helpers/logging";
import { validateGptMeme, analogyExamplesForWeight } from "./helpers/meme";

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

/** Shared voice/formatting guidance — keeps reports warm and varied, not templated. */
const VOICE = `VOICE & FORMAT:
- Write in Russian, like a friendly host of a team chat — warm, a little playful, never robotic.
- This is a short Telegram post. Vary your wording every time; do NOT make it look like a filled-in template.
- Cover the points below in a natural flow. You may merge related points into one sentence, reorder slightly, and choose your own phrasing and emoji. A couple of emoji are fine; don't put one in front of every line.
- When you list people, use "• Имя ±X кг" on separate lines (this part stays structured so it's easy to scan). Keep any achievement icons that are already in the names.
- Keep it concise: a few short paragraphs. No tables, no markdown headers.`;

/** Builds the weight-grounded analogy instruction for the meme/sticker object. */
function analogySection(absKg: number): string {
  const kg = absKg.toFixed(1);
  const examples = analogyExamplesForWeight(absKg);
  return `WEIGHT ANALOGY:
Make the team's total change tangible by comparing ${kg} кг to ONE real, everyday object that weighs about the same — roughly ${kg} кг (within ±30%). The object's REAL weight must be close to ${kg} кг; that is the whole point. Do NOT pick objects whose weight is wildly off, and avoid things with no stable weight.
Good objects near this weight: ${examples}.
Pick something recognizable and a little fun. Weave it into one sentence, e.g. "Это примерно как ведро воды."
SAME OBJECT IN BOTH PLACES: use ONE object only. Put the EXACT SAME phrase you used in the sentence into meme.object — identical words. meme.object must be short (1–4 words), an everyday food or item (never an animal or a person), suitable for an image.`;
}

/** Lighter analogy line for the daily report (no image generated). */
function dailyAnalogyLine(absKg: number): string {
  const kg = absKg.toFixed(1);
  const examples = analogyExamplesForWeight(absKg);
  return `One short, grounded comparison: relate ${kg} кг to a common object that really weighs about ${kg} кг (e.g. ${examples}). Skip it if the change is negligible.`;
}

function dailyPrompt(absKg: number): string {
  return `You write the DAILY Telegram post for a team weight-loss challenge.

Use ONLY the data from the input JSON — never invent numbers or names.

DATA YOU GET:
- date — the day
- sumDayDelta — team change today (kg). Negative = lost, positive = gained
- submitted — people who weighed today: name (may include an achievement icon), dayDelta (change since their last weigh-in, kg)
- missing — people who did not weigh today
- leader — best result of the day { name, dayDelta }, if any
- achievementLines — people who hit a new streak level today { name, icon, days }
- brokenLines — people who missed today and broke a 3+ day streak { name, streak }
- goalsInfo / goalRemaining / goalPercent — progress toward personal goals, if set

WHAT TO COVER (naturally, in your own words — not a fixed list of headed sections):
- The headline: how the team did today (sumDayDelta).
- Who checked in, each with their dayDelta as "• Имя ±X кг" (omit the number only if dayDelta is null). Keep icons in names.
- Who missed today (only if anyone did) — keep it light, no shaming.
- New streak achievements, if any.
- Broken streaks, if any — gentle nudge, not a scold.
- The leader of the day, if present.
- ${dailyAnalogyLine(absKg)}
- Goal progress, only if goalsInfo is present.
- Optionally end with one light, short remark (a tiny fun fact or a joke) — only if it fits naturally.

${VOICE}

OUTPUT: strictly one JSON object, no markdown, no extra text:
${RESPONSE_FORMAT_DAILY}`;
}

function weeklyPrompt(absKg: number): string {
  return `You write the WEEKLY Telegram post for a team weight-loss challenge. It is always about ONE WEEK — say "за неделю", never "month".

Use ONLY the data from the input JSON — never invent numbers or names.

DATA YOU GET:
- date — end of the week
- sumDayDelta — total team change for the week (kg). Negative = lost, positive = gained
- submitted — people who weighed this week: name (may include an icon), dayDelta (their week change, kg)
- missing — people who did not weigh this week
- leader — champion of the week { name, dayDelta }, if any
- crownHolderName — who wears the crown for the coming week (if present, mention it warmly near the champion)
- goalsInfo / goalRemaining / goalPercent — progress toward personal goals, if set

WHAT TO COVER (naturally, in your own words — not a fixed list of headed sections):
- The headline: the team's week (sumDayDelta), always "за неделю".
- The champion of the week, if present; mention the crown holder if given.
- Who checked in, each with their week delta as "• Имя ±X кг". Keep icons in names.
- Who missed the week (only if anyone did) — light tone.
- ${analogySection(absKg)}
- Goal progress, only if goalsInfo is present.
- Optionally close with one short fun fact or joke about health/food — only if it fits.

${VOICE}

OUTPUT: strictly one JSON object, no markdown, no extra text:
${RESPONSE_FORMAT_WITH_MEME}`;
}

function monthlyPrompt(absKg: number): string {
  return `You write the MONTHLY Telegram post for a team weight-loss challenge. It is always about ONE MONTH — say "за месяц".

Use ONLY the data from the input JSON — never invent numbers or names.

DATA YOU GET:
- date — end of the month
- sumDayDelta — total team change for the month (kg). Negative = lost, positive = gained
- submitted — people who weighed this month: name (may include an icon), dayDelta (their month change, kg)
- missing — people who did not weigh this month
- leader — champion of the month { name, dayDelta }, if any
- crownHolderName — current crown holder (if present, mention it warmly near the champion)
- goalsInfo / goalRemaining / goalPercent — progress toward personal goals, if set

WHAT TO COVER (naturally, in your own words — not a fixed list of headed sections):
- The headline: the team's month (sumDayDelta), always "за месяц".
- The champion of the month, if present; mention the crown holder if given.
- Who checked in, each with their month delta as "• Имя ±X кг". Keep icons in names.
- Who missed the month (only if anyone did) — light tone.
- ${analogySection(absKg)}
- Goal progress, only if goalsInfo is present.
- Optionally close with one short fun fact or joke — only if it fits.

${VOICE}

OUTPUT: strictly one JSON object, no markdown, no extra text:
${RESPONSE_FORMAT_WITH_MEME}`;
}

function getSystemPrompt(payload: ReportPayload): string {
  const absKg = Math.abs(payload.sumDayDelta);
  switch (payload.kind) {
    case "weekly":
      return weeklyPrompt(absKg);
    case "monthly":
      return monthlyPrompt(absKg);
    case "daily":
    default:
      return dailyPrompt(absKg);
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
    crownHolderName: payload.crownHolderName ?? undefined,
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
    if (payload.achievementLines?.length)
      base.achievementLines = payload.achievementLines;
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
          { role: "system", content: getSystemPrompt(payload) },
          { role: "user", content: userContent },
        ],
        temperature: 0.85,
        max_tokens: payload.kind === "monthly" ? 1600 : 1200,
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

    const meme = parsed.meme != null ? validateGptMeme(parsed.meme) : null;

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
