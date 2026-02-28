import { Env, TelegramMessage } from "../types";
import { sendMessage } from "../telegram/api";
import { isPrivateChat, isOwner, formatDelta } from "../utils";
import { getSetting, setSetting } from "../db/settings";
import { getLastWeight, getPreviousWeight, getWeightHistory } from "../db/weights";

export async function handleStart(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const welcomeText = `Welcome to Weight Tracker Bot!

Send your weight in private chat:
• 87.4
• 87,4
• вес 87.4
• /w 87.4

After saving, use ✏️ Edit last button to correct mistakes.

Commands:
/me - Show your last weight
/history 7 - Show last 7 entries
/history 30 - Show last 30 entries
/status - Bot status (owner only)
/setgroup - Configure group (owner only)`;

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, welcomeText);
}

export async function handleSetGroup(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command is only available to the bot owner."
    );
  }

  if (message.chat.type === "private") {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command must be used in a group."
    );
  }

  await setSetting(env.DB, "public_chat_id", message.chat.id.toString());

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "Group configured.");
}

export async function handleStatus(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command is only available to the bot owner."
    );
  }

  const groupId = await getSetting(env.DB, "public_chat_id");

  const statusText = groupId
    ? `Bot status:\nConfigured group ID: ${groupId}`
    : "Bot status:\nGroup not set.";

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, statusText);
}

export async function handleMe(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command only works in private chat."
    );
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const lastRecord = await getLastWeight(env.DB, userId);

  if (!lastRecord) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "No weight records found. Send your weight to start tracking!"
    );
  }

  const previousRecord = await getPreviousWeight(env.DB, userId, lastRecord.date);

  let replyText = `Last weight: ${lastRecord.weight_kg.toFixed(1)} kg (${lastRecord.date})`;

  if (previousRecord) {
    const delta = lastRecord.weight_kg - previousRecord.weight_kg;
    replyText += `\nΔ ${formatDelta(delta)} from ${previousRecord.date}`;
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, replyText);
}

export async function handleHistory(
  env: Env,
  message: TelegramMessage,
  args: string
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command only works in private chat."
    );
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const days = parseInt(args, 10) || 7;
  const limitedDays = Math.min(Math.max(days, 1), 90);

  const records = await getWeightHistory(env.DB, userId, limitedDays);

  if (records.length === 0) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "No weight records found."
    );
  }

  const lines = records.map((record, index) => {
    const weight = record.weight_kg.toFixed(1);
    const nextRecord = records[index + 1];

    if (nextRecord) {
      const delta = record.weight_kg - nextRecord.weight_kg;
      return `${record.date}: ${weight} kg (Δ ${formatDelta(delta)})`;
    }
    return `${record.date}: ${weight} kg`;
  });

  const header = `Last ${records.length} entries:\n\n`;
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, header + lines.join("\n"));
}
