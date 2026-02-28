import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { RU } from "../i18n";
import { setVacationUntil, clearVacation } from "../db/user-settings";
import { getDateWithOffset } from "../utils";

function formatDateRu(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}.${month}`;
}

export async function handleSetVacation(
  env: Env,
  chatId: number,
  userId: number,
  days: number
): Promise<Response> {
  const vacationUntil = getDateWithOffset(days);
  await setVacationUntil(env.DB, userId, vacationUntil);

  const dateFormatted = formatDateRu(vacationUntil);
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.vacation_set(dateFormatted));
}

export async function handleClearVacation(
  env: Env,
  chatId: number,
  userId: number
): Promise<Response> {
  await clearVacation(env.DB, userId);
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.vacation_off);
}
