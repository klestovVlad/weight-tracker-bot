import { Env, TelegramMessage } from "../types";
import { sendMessage } from "../telegram/api";
import { isPrivateChat, isOwner, getDateWithOffset, parseWeight, createMainMenu } from "../utils";
import { WEIGHT_MIN, WEIGHT_MAX } from "../config";
import { RU, formatDeltaRu } from "../i18n";
import { getSetting, setSetting } from "../db/settings";
import { getLastWeight, getPreviousWeight, getWeightHistory, saveWeight } from "../db/weights";

export async function handleStart(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;
  const isOwnerUser = userId ? isOwner(userId, env.OWNER_USER_ID) : false;
  const isGroup = message.chat.type !== "private";

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.welcome, {
    reply_markup: createMainMenu(isOwnerUser, isGroup)
  });
}

export async function handleSetGroup(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  if (message.chat.type === "private") {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.must_be_in_group);
  }

  await setSetting(env.DB, "public_chat_id", message.chat.id.toString());

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.group_configured);
}

export async function handleStatus(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const groupId = await getSetting(env.DB, "public_chat_id");

  const statusText = groupId
    ? RU.status_with_group(groupId)
    : RU.status_no_group;

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, statusText);
}

export async function handleMe(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.private_only);
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const lastRecord = await getLastWeight(env.DB, userId);

  if (!lastRecord) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.me_no_records);
  }

  const previousRecord = await getPreviousWeight(env.DB, userId, lastRecord.date);

  let replyText = RU.me_last_weight(lastRecord.weight_kg.toFixed(1), lastRecord.date);

  if (previousRecord) {
    const delta = lastRecord.weight_kg - previousRecord.weight_kg;
    replyText += "\n" + RU.me_delta(formatDeltaRu(delta), previousRecord.date);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, replyText);
}

export async function handleHistory(
  env: Env,
  message: TelegramMessage,
  limit: number
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.private_only);
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const limitedDays = Math.min(Math.max(limit, 1), 90);
  const records = await getWeightHistory(env.DB, userId, limitedDays);

  if (records.length === 0) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.history_empty);
  }

  const lines = records.map((record, index) => {
    const weight = record.weight_kg.toFixed(1);
    const nextRecord = records[index + 1];

    if (nextRecord) {
      const delta = record.weight_kg - nextRecord.weight_kg;
      return `${record.date}: ${weight} кг (${formatDeltaRu(delta)})`;
    }
    return `${record.date}: ${weight} кг`;
  });

  const header = RU.history_header(records.length);
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, header + lines.join("\n"));
}

export async function handleHistoryCommand(
  env: Env,
  message: TelegramMessage,
  args: string
): Promise<Response> {
  const days = parseInt(args, 10) || 7;
  return handleHistory(env, message, days);
}

// ============== DEBUG COMMANDS ==============
// These commands are for testing purposes only and accessible only to the owner.

/**
 * DEBUG: Add weight entry with date offset for testing deltas.
 * Usage: /debug_addday <offsetDays> <weight>
 * Example: /debug_addday -2 85.5
 * 
 * OWNER ONLY. Never posts to group.
 */
export async function handleDebugAddDay(
  env: Env,
  message: TelegramMessage,
  args: string
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return new Response("OK");
  }

  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.debug_usage);
  }

  const offsetDays = parseInt(parts[0], 10);
  if (isNaN(offsetDays)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.debug_invalid_offset);
  }

  const weightKg = parseWeight(parts[1]);
  if (weightKg === null) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      RU.invalid_weight(WEIGHT_MIN, WEIGHT_MAX)
    );
  }

  const date = getDateWithOffset(offsetDays);

  await saveWeight(env.DB, userId, date, weightKg);

  const previousRecord = await getPreviousWeight(env.DB, userId, date);

  let replyText: string;
  if (previousRecord) {
    const delta = weightKg - previousRecord.weight_kg;
    replyText = RU.debug_inserted(weightKg.toFixed(1), date, formatDeltaRu(delta));
  } else {
    replyText = RU.debug_inserted_first(weightKg.toFixed(1), date);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, replyText);
}

/**
 * DEBUG: Trigger daily report manually.
 * Usage: /debug_daily
 * 
 * OWNER ONLY.
 */
export async function handleDebugDaily(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const { generateDailyReport } = await import("./reports");
  await generateDailyReport(env);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "🔧 [DEBUG] Ежедневный отчёт отправлен.");
}

/**
 * DEBUG: Trigger weekly report manually.
 * Usage: /debug_weekly
 * 
 * OWNER ONLY.
 */
export async function handleDebugWeekly(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const { generateWeeklyReport } = await import("./reports");
  await generateWeeklyReport(env);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "🔧 [DEBUG] Еженедельный отчёт отправлен.");
}
