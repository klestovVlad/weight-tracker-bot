import { Env, TelegramCallbackQuery, InlineKeyboardMarkup } from "../types";
import { sendMessage, answerCallbackQuery } from "../telegram/api";
import { isOwner, createMainMenu } from "../utils";
import { RU, formatDeltaRu } from "../i18n";
import {
  getLastWeightByUpdatedAt,
  getPreviousWeight,
  getWeightHistory,
} from "../db/weights";
import { upsertPendingAction } from "../db/pending-actions";
import { getSetting, setSetting } from "../db/settings";
import { handleChart, getSmartDefaultPeriod } from "./chart";
import { handleSetVacation, handleClearVacation } from "./vacation";
import {
  handleLeaderboardWeekDelta,
  handleLeaderboardCheckins,
} from "./leaderboard";
import { handleGoalMenu, handleGoalSetStart, handleGoalDelete } from "./goal";
import { handleMyAchievements } from "./achievements";
import { setWeighFrequency, type WeighFrequency } from "../db/user-settings";

export async function handleCallbackQuery(
  env: Env,
  callbackQuery: TelegramCallbackQuery,
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

    case "menu_chart":
      return handleChartMenu(env, message.chat.id, userId, isPrivate);

    case "menu_chart_7":
      return handleChartPeriod(env, message.chat.id, userId, isPrivate, 7);
    case "menu_chart_30":
      return handleChartPeriod(env, message.chat.id, userId, isPrivate, 30);
    case "menu_chart_90":
      return handleChartPeriod(env, message.chat.id, userId, isPrivate, 90);
    case "menu_chart_180":
      return handleChartPeriod(env, message.chat.id, userId, isPrivate, 180);
    case "menu_chart_all":
      return handleChartPeriod(env, message.chat.id, userId, isPrivate, "all");

    case "menu_vacation":
      return handleVacationMenu(env, message.chat.id, isPrivate);

    case "vacation_7":
      return handleVacationSet(env, message.chat.id, userId, isPrivate, 7);
    case "vacation_14":
      return handleVacationSet(env, message.chat.id, userId, isPrivate, 14);
    case "vacation_30":
      return handleVacationSet(env, message.chat.id, userId, isPrivate, 30);
    case "vacation_off":
      return handleVacationOff(env, message.chat.id, userId, isPrivate);

    case "menu_frequency":
      return handleFrequencyMenu(env, message.chat.id, isPrivate);
    case "frequency_daily":
      return handleFrequencySet(env, message.chat.id, userId, isPrivate, "daily");
    case "frequency_weekly":
      return handleFrequencySet(env, message.chat.id, userId, isPrivate, "weekly");

    case "menu_leaderboard":
      return handleLeaderboardMenu(env, message.chat.id, isPrivate);

    case "leaderboard_week_delta":
      return handleLeaderboardWeekDeltaCallback(
        env,
        message.chat.id,
        isPrivate,
      );
    case "leaderboard_checkins":
      return handleLeaderboardCheckinsCallback(env, message.chat.id, isPrivate);

    case "menu_my_achievements":
      return handleMyAchievements(env, message.chat.id, userId);

    case "menu_goal":
      return handleGoalMenuCallback(
        env,
        message.chat.id,
        userId,
        message.message_id,
        callbackQuery.id,
        isPrivate,
      );
    case "goal_set":
    case "goal_edit":
      return handleGoalSetCallback(
        env,
        message.chat.id,
        userId,
        callbackQuery.id,
        isPrivate,
      );
    case "goal_delete":
      return handleGoalDeleteCallback(
        env,
        message.chat.id,
        userId,
        callbackQuery.id,
        isPrivate,
      );

    case "menu_back_main":
      return handleShowMenu(env, message.chat.id, isOwnerUser, !isPrivate);

    case "admin_reset_confirm":
      return handleAdminResetConfirm(env, message.chat.id, isOwnerUser);

    case "admin_reset_cancel":
      return handleAdminResetCancel(env, message.chat.id);

    case "owner_admin_menu":
      return handleOwnerAdminMenu(env, message.chat.id, isOwnerUser, isPrivate);

    case "owner_day_status":
      return handleOwnerDayStatus(env, message.chat.id, isOwnerUser, isPrivate);

    case "owner_send_report_menu":
      return handleOwnerReportDestMenu(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
      );

    case "owner_report_dest_group":
      return handleOwnerReportMenuGroup(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
      );

    case "owner_report_dest_chat":
      return handleOwnerReportMenuChat(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
      );

    case "owner_report_daily_group":
      return handleOwnerReportSend(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
        "daily",
        "group",
      );

    case "owner_report_weekly_group":
      return handleOwnerReportSend(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
        "weekly",
        "group",
      );

    case "owner_report_monthly_group":
      return handleOwnerReportSend(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
        "monthly",
        "group",
      );

    case "owner_report_daily_chat":
      return handleOwnerReportSend(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
        "daily",
        "chat",
      );

    case "owner_report_weekly_chat":
      return handleOwnerReportSend(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
        "weekly",
        "chat",
      );

    case "owner_report_monthly_chat":
      return handleOwnerReportSend(
        env,
        message.chat.id,
        isOwnerUser,
        isPrivate,
        "monthly",
        "chat",
      );

    case "owner_debug_meme":
      return handleOwnerDebugMeme(
        env,
        message.chat.id,
        userId,
        isOwnerUser,
        isPrivate,
      );

    default:
      return new Response("OK");
  }
}

async function handleEnterWeight(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
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
  isPrivate: boolean,
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
    RU.ask_edit_weight(lastRecord.date, lastRecord.weight_kg.toFixed(1)),
  );
}

async function handleHistoryCallback(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
  limit: number,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  const records = await getWeightHistory(env.DB, userId, limit);

  if (records.length === 0) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.history_empty);
  }

  const { computeProgressStats, formatDateRu } =
    await import("../helpers/stats");
  const stats = computeProgressStats(records, limit);

  const lines: string[] = [];

  const header = stats.trendEmoji
    ? `${stats.trendEmoji} ${RU.progress_header(limit)}`
    : RU.progress_header(limit);
  lines.push(header);

  if (stats.lastRecord) {
    const dateFormatted = formatDateRu(stats.lastRecord.date);
    lines.push(
      RU.progress_last_entry(
        dateFormatted,
        stats.lastRecord.weight_kg.toFixed(1),
      ),
    );
  }

  if (stats.dayDelta !== null) {
    lines.push(RU.progress_day_delta(formatDeltaRu(stats.dayDelta)));
  }

  if (stats.periodDelta !== null) {
    lines.push(RU.progress_period_delta(formatDeltaRu(stats.periodDelta)));
  }

  lines.push(RU.progress_streak(stats.streak));
  lines.push(RU.progress_checkins(stats.count, limit));

  if (!stats.checkedInToday) {
    lines.push(RU.progress_not_today);
  }

  if (stats.minWeight !== null && stats.maxWeight !== null) {
    lines.push(
      RU.progress_min_max(
        stats.minWeight.toFixed(1),
        stats.maxWeight.toFixed(1),
      ),
    );
  }

  if (stats.recentEntries.length > 0) {
    lines.push("");
    lines.push("📋 Записи:");
    for (const entry of stats.recentEntries) {
      const dateFormatted = formatDateRu(entry.date);
      lines.push(`${dateFormatted}: ${entry.weight.toFixed(1)} кг`);
    }
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, lines.join("\n"));
}

async function handleOwnerStatus(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
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
  isPrivate: boolean,
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
  isGroup: boolean,
): Promise<Response> {
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.welcome, {
    reply_markup: createMainMenu(isOwnerUser, isGroup),
  });
}

async function handleDebugDaily(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const { generateDailyReport } = await import("./reports");
  await generateDailyReport(env);

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    "🔧 Ежедневный отчёт отправлен.",
  );
}

async function handleDebugWeekly(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const { generateWeeklyReport } = await import("./reports");
  await generateWeeklyReport(env);

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    "🔧 Еженедельный отчёт отправлен.",
  );
}

async function handleDebugOpenai(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  if (!env.OPENAI_API_KEY) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      "❌ OPENAI_API_KEY не настроен.",
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
    avgDayDelta: -0.15,
    firstEntryCount: 1,
    firstEntryNames: ["Иван"],
    countSubmitted: 3,
    countMissing: 2,
    leader: { name: "Алексей", dayDelta: -0.5 },
    goalsInfo: [{ name: "Алексей", remaining: 2.1, percent: 65, reached: false }],
  };

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🤖 Запрос в OpenAI...");

  try {
    const result = await humanizeReport(testPayload, env);

    const response = `🤖 OpenAI ответ:

Message:
${result.message || "(пусто)"}

Model: ${env.OPENAI_MODEL || "gpt-4o-mini"}`;

    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, response);
  } catch (error) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Ошибка: ${error}`);
  }
}

async function handleSendReport(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (!publicChatId) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      "❌ Группа не привязана. Используй /setgroup в группе.",
    );
  }

  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    "📤 Отправляю отчёт в группу...",
  );

  const { generateDailyReport } = await import("./reports");
  await generateDailyReport(env);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "✅ Отчёт отправлен!");
}

async function handleHelp(env: Env, chatId: number): Promise<Response> {
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.help_message);
}

function createChartPicker(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "7 дней", callback_data: "menu_chart_7" },
        { text: "30 дней", callback_data: "menu_chart_30" },
      ],
      [
        { text: "90 дней", callback_data: "menu_chart_90" },
        { text: "180 дней", callback_data: "menu_chart_180" },
      ],
      [
        { text: "С начала", callback_data: "menu_chart_all" },
        { text: RU.btn_back, callback_data: "menu_back_main" },
      ],
    ],
  };
}

async function handleChartMenu(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  const records = await getWeightHistory(env.DB, userId, 1000);
  const smartPeriod = getSmartDefaultPeriod(records.length);

  await handleChart(env, chatId, userId, smartPeriod);

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.chart_pick_period, {
    reply_markup: createChartPicker(),
  });
}

async function handleChartPeriod(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
  period: number | "all",
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return handleChart(env, chatId, userId, period);
}

function createVacationPicker(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "7 дней", callback_data: "vacation_7" },
        { text: "14 дней", callback_data: "vacation_14" },
      ],
      [
        { text: "30 дней", callback_data: "vacation_30" },
        { text: "Снять паузу", callback_data: "vacation_off" },
      ],
      [{ text: RU.btn_back, callback_data: "menu_back_main" }],
    ],
  };
}

async function handleVacationMenu(
  env: Env,
  chatId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.vacation_pick, {
    reply_markup: createVacationPicker(),
  });
}

async function handleVacationSet(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
  days: number,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return handleSetVacation(env, chatId, userId, days);
}

async function handleVacationOff(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return handleClearVacation(env, chatId, userId);
}

function createFrequencyPicker(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: RU.frequency_daily, callback_data: "frequency_daily" }],
      [{ text: RU.frequency_weekly, callback_data: "frequency_weekly" }],
      [{ text: RU.btn_back, callback_data: "menu_back_main" }],
    ],
  };
}

async function handleFrequencyMenu(
  env: Env,
  chatId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.frequency_pick, {
    reply_markup: createFrequencyPicker(),
  });
}

async function handleFrequencySet(
  env: Env,
  chatId: number,
  userId: number,
  isPrivate: boolean,
  frequency: WeighFrequency,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  await setWeighFrequency(env.DB, userId, frequency);
  const text =
    frequency === "daily" ? RU.frequency_set_daily : RU.frequency_set_weekly;
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text);
}

function createLeaderboardPicker(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "За неделю (Δ)", callback_data: "leaderboard_week_delta" }],
      [
        {
          text: "Регулярность (7 дней)",
          callback_data: "leaderboard_checkins",
        },
      ],
      [{ text: RU.btn_back, callback_data: "menu_back_main" }],
    ],
  };
}

async function handleLeaderboardMenu(
  env: Env,
  chatId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.leaderboard_pick, {
    reply_markup: createLeaderboardPicker(),
  });
}

async function handleLeaderboardWeekDeltaCallback(
  env: Env,
  chatId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return handleLeaderboardWeekDelta(env, chatId);
}

async function handleLeaderboardCheckinsCallback(
  env: Env,
  chatId: number,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }

  return handleLeaderboardCheckins(env, chatId);
}

async function handleAdminResetConfirm(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
): Promise<Response> {
  if (!isOwnerUser) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.owner_only);
  }

  const result = await env.DB.prepare("DELETE FROM weights").run();
  const count = result.meta?.changes ?? 0;

  await env.DB.prepare("DELETE FROM reminders_sent").run();
  await env.DB.prepare("DELETE FROM cron_runs").run();
  await env.DB.prepare("DELETE FROM pending_actions").run();
  await env.DB.prepare("DELETE FROM user_settings").run();

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.reset_done(count));
}

async function handleAdminResetCancel(
  env: Env,
  chatId: number,
): Promise<Response> {
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.reset_cancelled);
}

async function handleGoalMenuCallback(
  env: Env,
  chatId: number,
  userId: number,
  messageId: number,
  callbackQueryId: string,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  await handleGoalMenu(env, chatId, userId, messageId, callbackQueryId);
  return new Response("OK");
}

async function handleGoalSetCallback(
  env: Env,
  chatId: number,
  userId: number,
  callbackQueryId: string,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  await handleGoalSetStart(env, chatId, userId, callbackQueryId);
  return new Response("OK");
}

async function handleGoalDeleteCallback(
  env: Env,
  chatId: number,
  userId: number,
  callbackQueryId: string,
  isPrivate: boolean,
): Promise<Response> {
  if (!isPrivate) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.private_only);
  }
  await handleGoalDelete(env, chatId, userId, callbackQueryId);
  return new Response("OK");
}

async function handleOwnerAdminMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: RU.btn_admin_day_status, callback_data: "owner_day_status" }],
      [
        {
          text: RU.btn_admin_send_report,
          callback_data: "owner_send_report_menu",
        },
      ],
      [{ text: RU.btn_admin_debug_meme, callback_data: "owner_debug_meme" }],
      [{ text: RU.btn_back, callback_data: "menu_back_main" }],
    ],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_menu_title, {
    reply_markup: keyboard,
  });
}

async function handleOwnerDayStatus(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }

  const { getAllUsers } = await import("../db/users");
  const { getUsersWithWeightOnDate } = await import("../db/weights");
  const { getGoal } = await import("../db/goals");
  const { getUsersOnVacation } = await import("../db/user-settings");
  const { getTodayDate } = await import("../utils");

  const today = getTodayDate();
  const allUsers = await getAllUsers(env.DB);
  const usersToday = await getUsersWithWeightOnDate(env.DB, today);
  const todayIds = new Set(usersToday.map((u) => u.user_id));
  const vacationIds = new Set(await getUsersOnVacation(env.DB, today));

  const checkedIn = usersToday.map((u) => u.display_name);
  const notCheckedIn = allUsers
    .filter((u) => !todayIds.has(u.user_id) && !vacationIds.has(u.user_id))
    .map((u) => u.display_name);
  const onVacation = allUsers
    .filter((u) => vacationIds.has(u.user_id))
    .map((u) => u.display_name);

  const withGoal: string[] = [];
  for (const user of allUsers) {
    const goal = await getGoal(env.DB, user.user_id);
    if (goal) {
      withGoal.push(user.display_name);
    }
  }

  const [, month, day] = today.split("-");
  const year = today.split("-")[0];
  const dateStr = `${day}.${month}.${year}`;

  let text = RU.admin_day_status_title(dateStr) + "\n\n";

  text += RU.admin_checked_in(checkedIn.length) + "\n";
  text +=
    checkedIn.length > 0
      ? checkedIn.map((n) => `• ${n}`).join("\n")
      : RU.admin_nobody;
  text += "\n\n";

  text += RU.admin_not_checked(notCheckedIn.length) + "\n";
  text +=
    notCheckedIn.length > 0
      ? notCheckedIn.map((n) => `• ${n}`).join("\n")
      : RU.admin_nobody;
  text += "\n\n";

  if (onVacation.length > 0) {
    text += RU.admin_on_vacation(onVacation.length) + "\n";
    text += onVacation.map((n) => `• ${n}`).join("\n");
    text += "\n\n";
  }

  text += RU.admin_with_goal(withGoal.length) + "\n";
  text +=
    withGoal.length > 0
      ? withGoal.map((n) => `• ${n}`).join("\n")
      : RU.admin_nobody;

  const keyboard = {
    inline_keyboard: [
      [{ text: RU.btn_back, callback_data: "owner_admin_menu" }],
    ],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, {
    reply_markup: keyboard,
  });
}

async function handleOwnerReportDestMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: RU.btn_report_dest_group, callback_data: "owner_report_dest_group" },
        { text: RU.btn_report_dest_chat, callback_data: "owner_report_dest_chat" },
      ],
      [{ text: RU.btn_back, callback_data: "owner_admin_menu" }],
    ],
  };

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    RU.admin_report_dest_title,
    { reply_markup: keyboard },
  );
}

async function handleOwnerReportMenuGroup(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: RU.btn_report_daily, callback_data: "owner_report_daily_group" }],
      [{ text: RU.btn_report_weekly, callback_data: "owner_report_weekly_group" }],
      [{ text: RU.btn_report_monthly, callback_data: "owner_report_monthly_group" }],
      [{ text: RU.btn_back, callback_data: "owner_send_report_menu" }],
    ],
  };

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    RU.admin_report_menu_title,
    { reply_markup: keyboard },
  );
}

async function handleOwnerReportMenuChat(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: RU.btn_report_daily, callback_data: "owner_report_daily_chat" }],
      [{ text: RU.btn_report_weekly, callback_data: "owner_report_weekly_chat" }],
      [{ text: RU.btn_report_monthly, callback_data: "owner_report_monthly_chat" }],
      [{ text: RU.btn_back, callback_data: "owner_send_report_menu" }],
    ],
  };

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    RU.admin_report_menu_title,
    { reply_markup: keyboard },
  );
}

const reportCooldowns: Map<string, number> = new Map();

async function handleOwnerReportSend(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
  reportType: "daily" | "weekly" | "monthly",
  destination: "group" | "chat",
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }

  const { getSetting } = await import("../db/settings");

  if (destination === "group") {
    const publicChatId = await getSetting(env.DB, "public_chat_id");
    if (!publicChatId) {
      return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_group_not_set);
    }
  }

  const cooldownKey = `owner_report_${reportType}_${destination}`;
  const now = Date.now();
  const lastRun = reportCooldowns.get(cooldownKey) || 0;

  if (now - lastRun < 60000) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      RU.admin_report_cooldown,
    );
  }

  reportCooldowns.set(cooldownKey, now);

  const { generateDailyReport, generateWeeklyReport, generateMonthlyReport } =
    await import("./reports");
  const overrides =
    destination === "chat" ? { targetChatId: String(chatId) } : undefined;

  try {
    if (reportType === "daily") {
      await generateDailyReport(env, overrides);
    } else if (reportType === "weekly") {
      await generateWeeklyReport(env, overrides);
    } else if (reportType === "monthly") {
      await generateMonthlyReport(env, overrides);
    }

    const sentText =
      destination === "chat"
        ? RU.admin_report_sent_chat(reportType)
        : RU.admin_report_sent(reportType);
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, sentText);
  } catch (error) {
    reportCooldowns.delete(cooldownKey);
    throw error;
  }
}

async function handleOwnerDebugMeme(
  env: Env,
  chatId: number,
  userId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isOwnerUser || !isPrivate) {
    return new Response("OK");
  }
  await upsertPendingAction(env.DB, userId, "debug_meme");
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.debug_meme_ask);
}
