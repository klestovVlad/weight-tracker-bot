import { Env, TelegramCallbackQuery } from "../types";
import { sendMessage, answerCallbackQuery } from "../telegram/api";
import { isOwner, createMainMenu } from "../utils";
import { RU, formatDeltaRu } from "../i18n";
import { getLastWeightByUpdatedAt, getPreviousWeight, getWeightHistory } from "../db/weights";
import { upsertPendingAction } from "../db/pending-actions";
import { getSetting, setSetting } from "../db/settings";

export async function handleCallbackQuery(
  env: Env,
  callbackQuery: TelegramCallbackQuery
): Promise<Response> {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const message = callbackQuery.message;

  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQuery.id);

  if (!message) {
    return new Response("OK");
  }

  const isPrivate = message.chat.type === "private";
  const isOwnerUser = isOwner(userId, env.OWNER_USER_ID);

  switch (data) {
    case "menu_enter_weight":
      return handleEnterWeight(env, message.chat.id, userId, isPrivate);

    case "menu_edit_last":
      return handleEditLast(env, message.chat.id, userId, isPrivate);

    case "menu_history_7":
      return handleHistoryCallback(env, message.chat.id, userId, isPrivate, 7);

    case "menu_history_30":
      return handleHistoryCallback(env, message.chat.id, userId, isPrivate, 30);

    case "owner_status":
      return handleOwnerStatus(env, message.chat.id, isOwnerUser);

    case "owner_setgroup_here":
      return handleOwnerSetGroup(env, message.chat.id, isOwnerUser, isPrivate);

    case "show_menu":
      return handleShowMenu(env, message.chat.id, isOwnerUser, !isPrivate);

    case "debug_daily":
      return handleDebugDaily(env, message.chat.id, isOwnerUser);

    case "debug_weekly":
      return handleDebugWeekly(env, message.chat.id, isOwnerUser);

    case "debug_openai":
      return handleDebugOpenai(env, message.chat.id, isOwnerUser);

    case "send_report":
      return handleSendReport(env, message.chat.id, isOwnerUser);

    case "menu_help":
      return handleHelp(env, message.chat.id);

    default:
      return new Response("OK");
  }
}

async function handleEnterWeight(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  await upsertPendingAction(env.DB, userId, "enter_weight");

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.ask_weight);
}

async function handleEditLast(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  const lastRecord = await getLastWeightByUpdatedAt(env.DB, userId);

  if (!lastRecord) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.no_entries_to_edit);
  }

  await upsertPendingAction(env.DB, userId, "edit_last");

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    RU.ask_edit_weight(lastRecord.date, lastRecord.weight_kg.toFixed(1))
  );
}

async function handleHistoryCallback(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
  limit: number
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  const records = await getWeightHistory(env.DB, userId, limit);

  if (records.length === 0) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.history_empty);
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
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, header + lines.join("\n"));
}

async function handleOwnerStatus(
  env: Env,
  chatId: number,
  isOwnerUser: boolean
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const groupId = await getSetting(env.DB, "public_chat_id");

  const statusText = groupId
    ? RU.status_with_group(groupId)
    : RU.status_no_group;

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, statusText);
}

async function handleOwnerSetGroup(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  if (isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.must_be_in_group);
  }

  await setSetting(env.DB, "public_chat_id", chatId.toString());

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.group_configured);
}

async function handleShowMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isGroup: boolean
): Promise<Response> {
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.welcome, {
    reply_markup: createMainMenu(isOwnerUser, isGroup)
  });
}

async function handleDebugDaily(
  env: Env,
  chatId: number,
  isOwnerUser: boolean
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const { generateDailyReport } = await import("./reports");
  await generateDailyReport(env);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🔧 Ежедневный отчёт отправлен.");
}

async function handleDebugWeekly(
  env: Env,
  chatId: number,
  isOwnerUser: boolean
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const { generateWeeklyReport } = await import("./reports");
  await generateWeeklyReport(env);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🔧 Еженедельный отчёт отправлен.");
}

async function handleDebugOpenai(
  env: Env,
  chatId: number,
  isOwnerUser: boolean
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  if (!env.OPENAI_API_KEY) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      "❌ OPENAI_API_KEY не настроен."
    );
  }

  const { humanizeReport } = await import("../openai");

  const testPayload = {
    date: "28.02.2026",
    kind: "daily" as const,
    submitted: [
      { name: "Алексей", dayDelta: -0.5, totalDelta: -3.2 },
      { name: "Мария", dayDelta: 0.2, totalDelta: -1.8 },
      { name: "Иван", dayDelta: null, totalDelta: null },
    ],
    missing: ["Ольга", "Дмитрий"],
    hasRegressions: true,
    sumDayDelta: -0.3,
    avgDayDelta: -0.15,
  };

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🤖 Запрос в OpenAI...");

  try {
    const result = await humanizeReport(testPayload, env);

    const response = `🤖 OpenAI ответ:

Intro:
${result.intro || "(пусто)"}

Outro:
${result.outro || "(пусто)"}

Model: ${env.OPENAI_MODEL || "gpt-4o-mini"}`;

    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, response);
  } catch (error) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Ошибка: ${error}`);
  }
}

async function handleSendReport(
  env: Env,
  chatId: number,
  isOwnerUser: boolean
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (!publicChatId) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      "❌ Группа не привязана. Используй /setgroup в группе."
    );
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📤 Отправляю отчёт в группу...");

  const { generateDailyReport } = await import("./reports");
  await generateDailyReport(env);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "✅ Отчёт отправлен!");
}

async function handleHelp(
  env: Env,
  chatId: number
): Promise<Response> {
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.help_message);
}
