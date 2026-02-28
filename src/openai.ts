import { Env, ReportPayload, HumanizedReport } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_LENGTH = 400;

const SYSTEM_PROMPT = `Ты дружелюбный ассистент группы по отслеживанию веса. 
Твоя задача — написать короткое intro и outro для ежедневного или еженедельного отчёта.

Правила:
- Пиши на русском языке
- Используй дружелюбный, мотивирующий тон
- Можно использовать эмодзи, но не слишком много
- intro: приветствие и краткий обзор результатов (кто молодец, кто отстаёт)
- outro: мотивация, пожелания на завтра/неделю
- Никогда не упоминай конкретные веса, только дельты
- Каждое поле максимум 400 символов

Ответь строго в формате JSON:
{"intro": "...", "outro": "..."}`;

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
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text());
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

    const parsed = JSON.parse(jsonMatch[0]) as HumanizedReport;

    if (typeof parsed.intro !== "string" || typeof parsed.outro !== "string") {
      return fallback;
    }

    return {
      intro: parsed.intro.slice(0, MAX_LENGTH),
      outro: parsed.outro.slice(0, MAX_LENGTH),
    };
  } catch (error) {
    console.error("OpenAI humanize error:", error);
    return fallback;
  }
}
