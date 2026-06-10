import { Env } from "../../types";
import { getSetting, setCrownUserId } from "../../db/settings";
import { buildDailyPayload } from "./payload-daily";
import { buildWeeklyPayload } from "./payload-weekly";
import { buildMonthlyPayload } from "./payload-monthly";
import { sendReport } from "./send";
import { isLastDayOfMonth } from "./helpers";

export { isLastDayOfMonth } from "./helpers";

export type ReportTarget = { targetChatId?: string };

export async function generateDailyReport(
  env: Env,
  overrides?: ReportTarget,
): Promise<void> {
  const chatId =
    overrides?.targetChatId ?? (await getSetting(env.DB, "public_chat_id"));
  if (!chatId) return;

  const payload = await buildDailyPayload(env);
  // Nobody checked in → stay silent (no "никто не отметился" spam).
  if (!payload) return;

  await sendReport(env, chatId, payload);
}

export async function generateWeeklyReport(
  env: Env,
  overrides?: ReportTarget,
): Promise<void> {
  const chatId =
    overrides?.targetChatId ?? (await getSetting(env.DB, "public_chat_id"));
  if (!chatId) return;

  const payload = await buildWeeklyPayload(env);
  // Nobody weighed this week → stay silent.
  if (!payload) return;

  await sendReport(env, chatId, payload);
  const newCrownUserId = payload.leader?.userId ?? null;
  await setCrownUserId(env.DB, newCrownUserId);
}

export async function generateMonthlyReport(
  env: Env,
  overrides?: ReportTarget,
): Promise<void> {
  const chatId =
    overrides?.targetChatId ?? (await getSetting(env.DB, "public_chat_id"));
  if (!chatId) return;

  const payload = await buildMonthlyPayload(env);
  // Nobody weighed this month → stay silent.
  if (!payload) return;

  await sendReport(env, chatId, payload);
}
