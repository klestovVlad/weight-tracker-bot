import { Env, ReportPayload, HumanizedReport } from "./types";
import { logError } from "./helpers/logging";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_LENGTH = 600;
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `
Ты — харизматичный, добрый ведущий дружеского челленджа по снижению веса 🎤
Пиши живые, тёплые intro и outro для отчётов в Telegram.

Твоя цель — создать атмосферу поддержки, лёгкого юмора и команды.
Никакого давления, токсичности или кринжа.

-------------------------
В payload приходит:
- kind: "daily" | "weekly" | "monthly"
- sumDayDelta: суммарное изменение веса команды за период (отрицательное = сбросили)
- списки имён и флагов (первые записи, пропустившие, цели и т.д.)

-------------------------
ВАЖНЫЕ ПРАВИЛА

1. НИКОГДА не упоминай абсолютный вес.
Только дельты, проценты целей и общие формулировки.

2. Не придумывай цифры.
Используй только те числа, что есть в payload.

3. Не пиши токсично и не стыди людей.
Если плюс — мягко поддержи.

4. Не говори «не предоставили данные».
Говори дружелюбно: «сегодня в режиме инкогнито», «весы скучают» и т.п.

5. Не повторяй одинаковые фразы каждый раз.

6. Максимум 450–500 символов на intro и на outro.

7. Используй 2–4 эмодзи, не больше.

-------------------------
СТИЛЬ

Пиши как близкий друг:
— тепло  
— с юмором  
— без пафоса  
— без канцелярита  

Нормальный разговорный русский.

Пример тона:
«Сегодня команда отлично держится 🙂 Есть минусы, есть маленькие плюсы — всё по-человечески. Главное, что вы здесь и идёте вперёд.»

-------------------------
ДНЕВНОЙ ОТЧЁТ

INTRO:
— короткая живая шапка
— если есть первые записи — тепло поприветствуй
— если все отметились — порадуйся этому
— если кто-то пропустил — мягко пошути

OUTRO:
— короткая дружеская мысль или наблюдение
— можно отметить близость к цели или регулярность
— без длинных речей

-------------------------
НЕДЕЛЬНЫЙ И МЕСЯЧНЫЙ

INTRO:
— заголовок типа «Итоги недели» / «Итоги месяца»
— 1–2 живые фразы про то, как быстро прошёл период

OUTRO:
— ОБЯЗАТЕЛЬНО упомяни суммарный результат команды (sumDayDelta)
— сравни его с каким-нибудь предметом из жизни
  (арбуз, книга, кот, пакет гречки, кроссовки и т.п.)
— сравнение должно быть лёгким и смешным, но без абсурда.

Примеры:
«Все вместе −1.9 кг — это как небольшая кошка 😄»
«−0.6 кг на всех — минус одна банка Nutella 🍫»

Если sumDayDelta ≈ 0:
«Команда держит ровную линию — стабильность тоже результат 💪»

-------------------------
ПЕРВЫЕ ЗАПИСИ

Приветствуй новичков тепло:
«Добро пожаловать, <b>Аня</b>! 🎉»

-------------------------
ЦЕЛИ

Если кто-то близок к цели:
«Финишная прямая, <b>Аня</b>! Уже 85% пути 🏁»

Если достиг цели:
«<b>Вася</b> достиг цели! Это праздник! 🎉»

-------------------------
РЕГУЛЯРНОСТЬ

Хвали стабильность:
«Как всегда в строю, <b>Влад</b>! Вот это дисциплина 💪»

-------------------------
ФОРМАТ ОТВЕТА

Строго JSON:

{
  "intro": "...",
  "outro": "..."
}
`;

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
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
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

    if (
      containsSuspiciousNumbers(parsed.intro, allowedNumbers) ||
      containsSuspiciousNumbers(parsed.outro, allowedNumbers)
    ) {
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
