import { Env, TelegramMessage } from "../types";
import { sendMessage } from "../telegram/api";
import { isPrivateChat, getTodayDate, formatDelta, createEditButton } from "../utils";
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
    privateReply = `Saved ${weightKg.toFixed(1)} kg for ${today}. Δ ${formatDelta(delta)}`;
    groupMessage = `${displayName}: Δ ${formatDelta(delta)}`;
  } else {
    privateReply = `Saved ${weightKg.toFixed(1)} kg for ${today}. First entry!`;
    groupMessage = `${displayName}: first entry`;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, privateReply, {
    reply_markup: createEditButton()
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
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "No entries to edit."
    );
  }

  await updateWeightEntry(env.DB, lastRecord.id, userId, weightKg);
  await clearPendingAction(env.DB, userId);

  const previousRecord = await getPreviousWeight(env.DB, userId, lastRecord.date);

  let privateReply: string;
  let groupMessage: string;
  const displayName = await getUserDisplayName(env.DB, userId);

  if (previousRecord) {
    const delta = weightKg - previousRecord.weight_kg;
    privateReply = `Updated entry for ${lastRecord.date} to ${weightKg.toFixed(1)} kg. Δ ${formatDelta(delta)}`;
    groupMessage = `${displayName}: Δ ${formatDelta(delta)} (updated)`;
  } else {
    privateReply = `Updated entry for ${lastRecord.date} to ${weightKg.toFixed(1)} kg.`;
    groupMessage = `${displayName}: entry updated`;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, privateReply, {
    reply_markup: createEditButton()
  });

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (publicChatId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, groupMessage);
  }

  return new Response("OK");
}
