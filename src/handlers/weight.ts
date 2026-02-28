import { Env, TelegramMessage } from "../types";
import { sendMessage } from "../telegram/api";
import { isPrivateChat, getTodayDate, createAfterWeightMenu } from "../utils";
import { RU, formatDeltaRu } from "../i18n";
import { getUserDisplayName } from "../db/users";
import { getSetting } from "../db/settings";
import {
  saveWeight,
  getPreviousWeight,
  getLastWeightByUpdatedAt,
  updateWeightEntry
} from "../db/weights";
import { clearPendingAction } from "../db/pending-actions";

export async function handleWeightInput(
  env: Env,
  message: TelegramMessage,
  weightKg: number
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return new Response("OK");
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const today = getTodayDate();
  const previousRecord = await getPreviousWeight(env.DB, userId, today);

  await saveWeight(env.DB, userId, today, weightKg);

  let privateReply: string;
  let groupMessage: string;
  const displayName = await getUserDisplayName(env.DB, userId);

  if (previousRecord) {
    const delta = weightKg - previousRecord.weight_kg;
    privateReply = RU.weight_saved(weightKg.toFixed(1), today, formatDeltaRu(delta));
    groupMessage = RU.group_delta(displayName, formatDeltaRu(delta));
  } else {
    privateReply = RU.weight_saved_first(weightKg.toFixed(1), today);
    groupMessage = RU.group_first_entry(displayName);
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, privateReply, {
    reply_markup: createAfterWeightMenu()
  });

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (publicChatId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, groupMessage);
  }

  return new Response("OK");
}

export async function handleEditWeight(
  env: Env,
  message: TelegramMessage,
  weightKg: number
): Promise<Response> {
  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const lastRecord = await getLastWeightByUpdatedAt(env.DB, userId);

  if (!lastRecord) {
    await clearPendingAction(env.DB, userId);
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.no_entries_to_edit);
  }

  await updateWeightEntry(env.DB, lastRecord.id, userId, weightKg);
  await clearPendingAction(env.DB, userId);

  const previousRecord = await getPreviousWeight(env.DB, userId, lastRecord.date);

  let privateReply: string;
  let groupMessage: string;
  const displayName = await getUserDisplayName(env.DB, userId);

  if (previousRecord) {
    const delta = weightKg - previousRecord.weight_kg;
    privateReply = RU.weight_updated(weightKg.toFixed(1), lastRecord.date, formatDeltaRu(delta));
    groupMessage = RU.group_updated(displayName, formatDeltaRu(delta));
  } else {
    privateReply = RU.weight_updated_no_delta(weightKg.toFixed(1), lastRecord.date);
    groupMessage = RU.group_updated_no_delta(displayName);
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, privateReply, {
    reply_markup: createAfterWeightMenu()
  });

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (publicChatId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, groupMessage);
  }

  return new Response("OK");
}
