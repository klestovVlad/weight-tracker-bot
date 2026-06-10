import { Env, InlineKeyboardMarkup } from "../types";
import { sendMessage } from "../telegram/api";
import { RU } from "../i18n";
import { upsertPendingAction } from "../db/pending-actions";
import { isDigestEnabled, setDigestEnabled, setHeightCm } from "../db/user-settings";

export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 250;

const OK = () => new Response("OK");

async function settingsKeyboard(env: Env, userId: number): Promise<InlineKeyboardMarkup> {
  const digestOn = await isDigestEnabled(env.DB, userId);
  return {
    inline_keyboard: [
      [{ text: RU.btn_height, callback_data: "settings_set_height" }],
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
