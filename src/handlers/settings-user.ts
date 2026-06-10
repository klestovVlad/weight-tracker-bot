import { Env, InlineKeyboardMarkup } from "../types";
import { sendMessage } from "../telegram/api";
import { RU } from "../i18n";
import { upsertPendingAction } from "../db/pending-actions";
import {
  isDigestEnabled,
  setDigestEnabled,
  setHeightCm,
  getReminderHour,
  setReminderHour,
} from "../db/user-settings";

export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 250;

const OK = () => new Response("OK");

async function settingsKeyboard(env: Env, userId: number): Promise<InlineKeyboardMarkup> {
  const [digestOn, reminderHour] = await Promise.all([
    isDigestEnabled(env.DB, userId),
    getReminderHour(env.DB, userId),
  ]);
  return {
    inline_keyboard: [
      [{ text: RU.btn_height, callback_data: "settings_set_height" }],
      [{ text: RU.btn_reminder_hour(reminderHour), callback_data: "settings_set_reminder_hour" }],
      [{ text: RU.btn_digest(digestOn), callback_data: "settings_toggle_digest" }],
      [{ text: RU.btn_back, callback_data: "menu_back_main" }],
    ],
  };
}

export async function handleUserSettingsMenu(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.settings_user_title, {
    reply_markup: await settingsKeyboard(env, userId),
  });
}

export async function handleSetHeightStart(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  await upsertPendingAction(env.DB, userId, "set_height");
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.height_ask);
}

export async function handleSetReminderHourStart(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  await upsertPendingAction(env.DB, userId, "set_reminder_hour");
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.reminder_hour_ask);
}

/** Handles an hour value typed after pressing "⏰ Время напоминания". */
export async function handleReminderHourInput(
  env: Env,
  chatId: number,
  userId: number,
  text: string,
): Promise<boolean> {
  const hour = parseInt(text.trim(), 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.reminder_hour_invalid);
    return true;
  }
  await setReminderHour(env.DB, userId, hour);
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.reminder_hour_saved(hour));
  return true;
}

export async function handleToggleDigest(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  const next = !(await isDigestEnabled(env.DB, userId));
  await setDigestEnabled(env.DB, userId, next);
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.digest_toggled(next), {
    reply_markup: await settingsKeyboard(env, userId),
  });
}

/** Handles a height value typed after pressing "📏 Рост". Returns false if not a valid height. */
export async function handleHeightInput(
  env: Env,
  chatId: number,
  userId: number,
  text: string,
): Promise<boolean> {
  const cm = parseInt(text.trim(), 10);
  if (Number.isNaN(cm) || cm < HEIGHT_MIN || cm > HEIGHT_MAX) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.height_invalid);
    return true; // consumed: we asked for height, keep the prompt context clear
  }
  await setHeightCm(env.DB, userId, cm);
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.height_saved(cm));
  return true;
}

export { OK };
