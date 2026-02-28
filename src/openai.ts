import { Env, ReportPayload, HumanizedReport } from "./types";
import { logError } from "./helpers/logging";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_LENGTH = 600;
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `Ты дружелюбный ведущий группы по отслеживанию веса.
Твоя задача — написать живое, эмоциональное intro и outro для отчёта.

СТИЛЬ:
- Пиши как друг, который болеет за успехи каждого
- Используй эмодзи в меру (2-4 на сообщение)
- Будь конкретным: называй имена, упоминай их результаты
- Имена выделяй жирным: <b>имя</b>
- Никогда не упоминай абсолютные веса, только дельты (изменения)
- Максимум 400 символов на поле

КОММЕНТИРУЙ ДЕЛЬТЫ:
- Если кто-то скинул (отрицательная дельта):
  Похвали! "Отлично, <b>Вася</b>! −0.5 кг — так держать! 💪"
- Если кто-то набрал (положительная дельта):
  Поддержи без осуждения: "У <b>Пети</b> +0.3 — бывает, завтра наверстаем 🙂"
- Если у кого-то большой прогресс (|дельта| > 1 кг):
  Отметь особо: "Вау, <b>Маша</b> −1.2 кг! Это впечатляет! 🔥"
- Если у всех стабильно (дельты около 0):
  "Стабильность — тоже результат! 👌"

ПЕРВЫЕ ЗАПИСИ (firstEntryNames не пустой):
- Имена новичков указаны в массиве firstEntryNames
- Это их ПЕРВАЯ запись в системе — приветствуй тепло: "Добро пожаловать, <b>Аня</b>! 🎉"
- Если firstEntryNames пустой — значит сегодня новичков нет, не упоминай первые записи

ПРОПУСТИВШИЕ (countMissing > 0):
- Подшучивай по-дружески:
  • "А <b>Вася</b> опять в режиме невидимки 👻"
  • "Эй, <b>Петя</b>! Весы скучают 😏"
  • "<b>Маша</b> видимо на секретной миссии 🕵️"
- НЕ говори "не предоставили данные" — это сухо

РЕГУЛЯРНЫЕ УЧАСТНИКИ:
- Хвали тех, кто отмечается каждый день
- "Молодец, <b>Вася</b>, как всегда в строю! 💪"

Ответь строго JSON:
{"intro": "...", "outro": "..."}`;

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
  }
  
  allowed.add(String(payload.submitted.length));
  allowed.add(String(payload.missing.length));
  allowed.add(String(Math.abs(payload.sumDayDelta).toFixed(1)));
  allowed.add(String(Math.abs(payload.avgDayDelta).toFixed(2)));
  
  for (let i = 0; i <= 31; i++) {
    allowed.add(String(i));
  }
  
  return allowed;
}

function containsSuspiciousNumbers(text: string, allowedNumbers: Set<string>): boolean {
  const numbers = text.match(/\d+\.?\d*/g) || [];
  
  for (const num of numbers) {
    const normalized = parseFloat(num);
    if (normalized >= 30 && normalized <= 300) {
      if (!allowedNumbers.has(num) && !allowedNumbers.has(normalized.toFixed(1))) {
        return true;
      }
    }
  }
  
  return false;
}

export async function humanizeReport(
  payload: ReportPayload,
  env: Env
): Promise<HumanizedReport> {
  const fallback: HumanizedReport = { intro: "", outro: "" };

  if (!env.OPENAI_API_KEY) {
    return fallback;
  }

  const model = env.OPENAI_MODEL || DEFAULT_MODEL;

  const userPrompt = `Сделай дружескую сводку для этих данных:
${JSON.stringify(payload, null, 2)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logError(`OpenAI API error: ${response.status}`);
      return fallback;
    }

    const data = await response.json() as {
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

    let parsed: HumanizedReport;
    try {
      parsed = JSON.parse(jsonMatch[0]) as HumanizedReport;
    } catch {
      return fallback;
    }

    if (typeof parsed.intro !== "string" || typeof parsed.outro !== "string") {
      return fallback;
    }

    const allowedNumbers = extractAllowedNumbers(payload);
    
    if (containsSuspiciousNumbers(parsed.intro, allowedNumbers) ||
        containsSuspiciousNumbers(parsed.outro, allowedNumbers)) {
      logError("OpenAI response contains suspicious numbers, using fallback");
      return fallback;
    }

    return {
      intro: parsed.intro.slice(0, MAX_LENGTH),
      outro: parsed.outro.slice(0, MAX_LENGTH),
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
