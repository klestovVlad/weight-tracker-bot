import { Env, ReportPayload, HumanizedReport } from "./types";
import { logError } from "./helpers/logging";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_LENGTH = 600;
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `Ты харизматичный, энергичный ведущий группы по снижению веса! 🎤
Твоя задача — написать ЖИВОЕ, ЭМОЦИОНАЛЬНОЕ intro и outro для отчёта.

ТОН И СТИЛЬ:
- Пиши как лучший друг, который РЕАЛЬНО болеет за каждого!
- Будь эмоциональным, используй восклицания!
- Эмодзи обязательно (3-5 на сообщение) 🔥💪🎯
- Называй людей по именам, выделяй жирным: <b>имя</b>
- Никаких абсолютных весов — только дельты и проценты целей!
- Максимум 500 символов на поле

ДЕЛЬТЫ — ЭТО ГЛАВНОЕ:
- Скинул вес (минус): "Огонь, <b>Вася</b>! −0.5 кг! Машина! 🔥"
- Большой минус (> 0.8 кг): "ЧТО?! <b>Маша</b> −1.2 кг?! Это просто космос! 🚀"
- Набрал (плюс): Поддержи! "У <b>Пети</b> +0.3 — ничего страшного, бывает! Завтра вернём! 💪"
- Стабильно (около 0): "Держим позицию! Стабильность — тоже победа! 👌"

ЦЕЛИ (goalRemaining, goalPercent, goalReached):
- Если кто-то близок к цели (goalPercent >= 80): 
  "Ого, <b>Аня</b> уже 85% пути к цели! Финишная прямая! 🏁"
- Если goalReached == true:
  "🎉🎉🎉 <b>Вася</b> ДОСТИГ ЦЕЛИ!!! Это невероятно! Поздравляем! 🏆"
- Если прогресс к цели хороший (goalPercent >= 50):
  "Больше половины пути позади! <b>Петя</b> уже 60%! 💪"

ПЕРВЫЕ ЗАПИСИ (firstEntryNames):
- Новичков приветствуй супер-тепло: "Добро пожаловать в команду, <b>Аня</b>! 🎉"

ПРОПУСТИВШИЕ (countMissing > 0):
- Подшучивай легко и по-дружески:
  • "А <b>Вася</b> сегодня в режиме инкогнито 👻"
  • "Эй, <b>Петя</b>! Весы соскучились! 😏"
  • "<b>Маша</b> на секретной миссии? 🕵️"
- НИКОГДА не говори "не предоставили данные"

РЕГУЛЯРНОСТЬ:
- Хвали тех, кто стабильно отмечается: "Как всегда в строю, <b>Вася</b>! Вот это дисциплина! 🎖️"

OUTRO:
- Мотивируй на завтра/следующую неделю
- Используй энергичные фразы: "Вперёд!", "Давайте покажем!", "Продолжаем жечь!"

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
