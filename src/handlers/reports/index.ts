import { Env } from "../../types";
import { sendMessage } from "../../telegram/api";
import { getSetting } from "../../db/settings";
import { RU } from "../../i18n";
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
  if (!payload) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      RU.report_no_entries_today,
    );
    return;
  }

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
  if (!payload) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      RU.report_no_entries_week,
    );
    return;
  }

  await sendReport(env, chatId, payload);
}

export async function generateMonthlyReport(
  env: Env,
  overrides?: ReportTarget,
): Promise<void> {
  const chatId =
    overrides?.targetChatId ?? (await getSetting(env.DB, "public_chat_id"));
  if (!chatId) return;

  const payload = await buildMonthlyPayload(env);
  if (!payload) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      RU.report_no_entries_month,
    );
    return;
  }

  await sendReport(env, chatId, payload);
}
