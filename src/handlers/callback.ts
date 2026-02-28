import { Env, TelegramCallbackQuery } from "../types";
import { sendMessage, answerCallbackQuery } from "../telegram/api";
import { getLastWeightByUpdatedAt } from "../db/weights";
import { upsertPendingAction } from "../db/pending-actions";

export async function handleCallbackQuery(
  env: Env,
  callbackQuery: TelegramCallbackQuery
): Promise<Response> {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const message = callbackQuery.message;

  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQuery.id);

  if (!message || message.chat.type !== "private") {
    return new Response("OK");
  }

  if (data === "edit_last") {
    const lastRecord = await getLastWeightByUpdatedAt(env.DB, userId);

    if (!lastRecord) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        "No entries to edit."
      );
      return new Response("OK");
    }

    await upsertPendingAction(env.DB, userId, "edit_last");

    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `Send the new weight to replace your last entry (${lastRecord.date}: ${lastRecord.weight_kg.toFixed(1)} kg).`
    );
  }

  return new Response("OK");
}
