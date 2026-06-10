import { Env, TelegramMessage } from "../types";
import { sendMessage } from "../telegram/api";
import { isPrivateChat, isOwner, getDateWithOffset, parseWeight, createMainMenu } from "../utils";
import { WEIGHT_MIN, WEIGHT_MAX } from "../config";
import { RU, formatDeltaRu } from "../i18n";
import { getSetting, setSetting } from "../db/settings";
import { getLastWeight, getPreviousWeight, getWeightHistory, saveWeight } from "../db/weights";
import { getHeightCm } from "../db/user-settings";
import { computeBmi, bmiCategory } from "../helpers/health";
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport } from "./reports";

export async function handleStart(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;
  const isOwnerUser = userId ? isOwner(userId, env.OWNER_USER_ID) : false;
  const isGroup = message.chat.type !== "private";

  if (isGroup) {
    const botUsername = await getSetting(env.DB, "bot_username");
    if (botUsername) {
      const link = `https://t.me/${botUsername}?start=from_group`;
      return sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `${RU.welcome_group}\n\n${link}`
      );
    }
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.welcome_group);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.welcome, {
    reply_markup: createMainMenu(isOwnerUser, false)
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

  const botUsername = await getSetting(env.DB, "bot_username");
  
  if (botUsername) {
    const link = `https://t.me/${botUsername}?start=from_group`;
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.group_configured_with_link(link));
  }
  
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.group_configured_no_link);
}

export async function handleSetBotUsername(
  env: Env,
  message: TelegramMessage,
  args: string
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const username = args.trim().replace(/^@/, "");
  
  if (!username) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.bot_username_usage);
  }

  await setSetting(env.DB, "bot_username", username);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.bot_username_set(username));
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

  const heightCm = await getHeightCm(env.DB, userId);
  const bmi = computeBmi(lastRecord.weight_kg, heightCm);
  if (bmi !== null) {
    const cat = bmiCategory(bmi);
    replyText += "\n" + RU.me_bmi(bmi.toFixed(1), cat.emoji, cat.label);
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

  const { computeProgressStats, formatDateRu } = await import("../helpers/stats");
  const stats = computeProgressStats(records, limitedDays);

  const lines: string[] = [];

  const header = stats.trendEmoji 
    ? `${stats.trendEmoji} ${RU.progress_header(limitedDays)}`
    : RU.progress_header(limitedDays);
  lines.push(header);

  if (stats.lastRecord) {
    const dateFormatted = formatDateRu(stats.lastRecord.date);
    lines.push(RU.progress_last_entry(dateFormatted, stats.lastRecord.weight_kg.toFixed(1)));
  }

  if (stats.dayDelta !== null) {
    lines.push(RU.progress_day_delta(formatDeltaRu(stats.dayDelta)));
  }

  if (stats.periodDelta !== null) {
    lines.push(RU.progress_period_delta(formatDeltaRu(stats.periodDelta)));
  }

  lines.push(RU.progress_streak(stats.streak));
  lines.push(RU.progress_checkins(stats.count, limitedDays));

  if (!stats.checkedInToday) {
    lines.push(RU.progress_not_today);
  }

  if (stats.minWeight !== null && stats.maxWeight !== null) {
    lines.push(RU.progress_min_max(stats.minWeight.toFixed(1), stats.maxWeight.toFixed(1)));
  }

  if (stats.recentEntries.length > 0) {
    lines.push("");
    lines.push("📋 Записи:");
    for (const entry of stats.recentEntries) {
      const dateFormatted = formatDateRu(entry.date);
      lines.push(`${dateFormatted}: ${entry.weight.toFixed(1)} кг`);
    }
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, lines.join("\n"));
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

  const date = getDateWithOffset(offsetDays);

  if (parts[1].toLowerCase() === "null" || parts[1].toLowerCase() === "delete") {
    const { deleteWeight } = await import("../db/weights");
    const deleted = await deleteWeight(env.DB, userId, date);
    
    if (deleted) {
      return sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `🗑️ [DEBUG] Удалена запись за ${date}`
      );
    } else {
      return sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `❌ [DEBUG] Запись за ${date} не найдена`
      );
    }
  }

  const weightKg = parseWeight(parts[1]);
  if (weightKg === null) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      RU.invalid_weight(WEIGHT_MIN, WEIGHT_MAX)
    );
  }

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

/**
 * DEBUG: Test OpenAI integration with a sample payload.
 * Usage: /debug_openai
 * 
 * OWNER ONLY. Shows intro/outro generated by OpenAI.
 */
export async function handleDebugOpenai(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  if (!env.OPENAI_API_KEY) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "❌ OPENAI_API_KEY не настроен. Добавь секрет через wrangler."
    );
  }

  const { humanizeReport } = await import("../openai");

  const testPayload = {
    date: "28.02.2026",
    kind: "daily" as const,
    submitted: [
      { name: "Алексей", dayDelta: -0.5, totalDelta: -3.2, goalRemaining: 2.1, goalPercent: 65, goalReached: false },
      { name: "Мария", dayDelta: 0.2, totalDelta: -1.8 },
      { name: "Иван", dayDelta: null, totalDelta: null },
    ],
    missing: ["Ольга", "Дмитрий"],
    hasRegressions: true,
    sumDayDelta: -0.3,
    sumTotalDelta: -5.0,
    avgDayDelta: -0.15,
    firstEntryCount: 1,
    firstEntryNames: ["Иван"],
    countSubmitted: 3,
    countMissing: 2,
    leader: { name: "Алексей", dayDelta: -0.5 },
    goalsInfo: [{ name: "Алексей", remaining: 2.1, percent: 65, reached: false }],
  };

  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    "🔧 Отправляю тестовый запрос в OpenAI..."
  );

  try {
    const result = await humanizeReport(testPayload, env);

    const response = `🤖 **OpenAI Response:**

**Message:**
${result.message || "(пусто)"}

**Model:** ${env.OPENAI_MODEL || "gpt-4o-mini"}`;

    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, response);
  } catch (error) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `❌ Ошибка OpenAI: ${error}`
    );
  }
}

/**
 * DEBUG: Show all admin commands.
 * Usage: /debug
 * 
 * OWNER ONLY.
 */
export async function handleDebugHelp(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const helpText = `🔧 **Админские команды:**

/debug — эта справка
/debug_users — кто отметился, цели
/debug_addday <смещение> <вес> — добавить запись
  • /debug_addday -1 85.5 — вчера
  • /debug_addday 0 null — удалить сегодня
/debug_daily — отправить дневной отчёт
/debug_weekly — отправить недельный отчёт
/debug_openai — тест OpenAI с фейк-данными
/debug_run_reminders — отправить напоминалки
/debug_reset_all — удалить ВСЕ записи веса
/report daily|weekly|monthly — отправить отчёт
/setgroup — привязать группу (в группе)
/setbotusername <name> — сохранить username бота
/status — статус бота`;

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, helpText);
}

export async function handleResetAllWeightsConfirm(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return new Response("OK");
  }

  const userId = message.from?.id;
  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.reset_confirm, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: RU.btn_confirm_reset, callback_data: "admin_reset_confirm" },
          { text: RU.btn_cancel_reset, callback_data: "admin_reset_cancel" }
        ]
      ]
    }
  });
}

const reportCooldowns: Map<string, number> = new Map();

export async function handleReport(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return new Response("OK");
  }

  const userId = message.from?.id;
  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (!publicChatId) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.report_group_not_set);
  }

  const text = message.text || "";
  const parts = text.split(/\s+/);
  const reportType = parts[1]?.toLowerCase();

  if (!reportType || !["daily", "weekly", "monthly"].includes(reportType)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.report_usage);
  }

  const cooldownKey = `report_${reportType}`;
  const now = Date.now();
  const lastRun = reportCooldowns.get(cooldownKey) || 0;

  if (now - lastRun < 60000) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.report_cooldown);
  }

  reportCooldowns.set(cooldownKey, now);

  try {
    if (reportType === "daily") {
      await generateDailyReport(env);
    } else if (reportType === "weekly") {
      await generateWeeklyReport(env);
    } else if (reportType === "monthly") {
      await generateMonthlyReport(env);
    }
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.report_sent);
  } catch (error) {
    reportCooldowns.delete(cooldownKey);
    throw error;
  }
}

export async function handleDebugUsers(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return new Response("OK");
  }

  const userId = message.from?.id;
  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }

  const { getAllUsers } = await import("../db/users");
  const { getUsersWithWeightOnDate } = await import("../db/weights");
  const { getGoal } = await import("../db/goals");
  const { getTodayDate } = await import("../utils");

  const today = getTodayDate();
  const allUsers = await getAllUsers(env.DB);
  const usersToday = await getUsersWithWeightOnDate(env.DB, today);
  const todayIds = new Set(usersToday.map(u => u.user_id));

  let report = `📊 **Статус пользователей** (${today})\n\n`;

  report += `**✅ Отметились сегодня (${usersToday.length}):**\n`;
  if (usersToday.length > 0) {
    for (const user of usersToday) {
      report += `• ${user.display_name}\n`;
    }
  } else {
    report += "Никто\n";
  }

  const notToday = allUsers.filter(u => !todayIds.has(u.user_id));
  report += `\n**❌ Не отметились (${notToday.length}):**\n`;
  if (notToday.length > 0) {
    for (const user of notToday) {
      report += `• ${user.display_name}\n`;
    }
  } else {
    report += "Все отметились! 🎉\n";
  }

  const usersWithGoals: string[] = [];
  const usersWithoutGoals: string[] = [];
  for (const user of allUsers) {
    const goal = await getGoal(env.DB, user.user_id);
    if (goal) {
      usersWithGoals.push(user.display_name);
    } else {
      usersWithoutGoals.push(user.display_name);
    }
  }

  report += `\n**🎯 Установили цель (${usersWithGoals.length}):**\n`;
  if (usersWithGoals.length > 0) {
    report += usersWithGoals.map(n => `• ${n}`).join("\n") + "\n";
  } else {
    report += "Никто\n";
  }

  report += `\n**Без цели (${usersWithoutGoals.length}):**\n`;
  if (usersWithoutGoals.length > 0) {
    report += usersWithoutGoals.map(n => `• ${n}`).join("\n") + "\n";
  } else {
    report += "У всех есть цель! 🎉\n";
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, report, { parse_mode: "Markdown" });
}
