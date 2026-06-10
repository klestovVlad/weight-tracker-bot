import { Env, InlineKeyboardMarkup } from "../types";
import { sendMessage } from "../telegram/api";
import { RU } from "../i18n";
import { getSetting, getBoolFlag, setBoolFlag } from "../db/settings";
import { FEATURE_FLAGS, getFlagDef } from "../config";
import { getAllUsers } from "../db/users";
import {
  getUsersWithWeightOnDate,
  getUsersWithWeightInRange,
  getOverallFirstAndLastByUsers,
} from "../db/weights";
import { getGoalsByUserIds } from "../db/goals";
import { getUsersOnVacation } from "../db/user-settings";
import { getTodayDate, getDateWithOffset, getDaysBetween } from "../utils";
import { upsertPendingAction } from "../db/pending-actions";
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
} from "./reports";

type ReportType = "daily" | "weekly" | "monthly";
type ReportDestination = "group" | "chat";

const DROPPED_OFF_DAYS = 5;
const OK = () => new Response("OK");

/** All admin actions require the owner acting in a private chat. */
function isAuthorized(isOwnerUser: boolean, isPrivate: boolean): boolean {
  return isOwnerUser && isPrivate;
}

const adminMenuKeyboard: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: RU.btn_admin_dashboard, callback_data: "owner_dashboard" },
      { text: RU.btn_admin_day_status, callback_data: "owner_day_status" },
    ],
    [{ text: RU.btn_admin_send_report, callback_data: "owner_send_report_menu" }],
    [
      { text: RU.btn_admin_settings, callback_data: "owner_settings_menu" },
      { text: RU.btn_admin_debug_meme, callback_data: "owner_debug_meme" },
    ],
    [{ text: RU.btn_back, callback_data: "menu_back_main" }],
  ],
};

export async function handleOwnerAdminMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_menu_title, {
    reply_markup: adminMenuKeyboard,
  });
}

/** Builds the settings menu: one toggle per registered feature flag. */
async function buildSettingsKeyboard(env: Env): Promise<InlineKeyboardMarkup> {
  const rows = await Promise.all(
    FEATURE_FLAGS.map(async (flag) => {
      const on = await getBoolFlag(env.DB, flag.key, flag.default);
      return [
        {
          text: RU.admin_flag_button(flag.label, on),
          callback_data: `owner_flag_${flag.key}`,
        },
      ];
    }),
  );
  rows.push([{ text: RU.btn_back, callback_data: "owner_admin_menu" }]);
  return { inline_keyboard: rows };
}

export async function handleOwnerSettingsMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_settings_title, {
    reply_markup: await buildSettingsKeyboard(env),
  });
}

export async function handleToggleFlag(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
  key: string,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  const flag = getFlagDef(key);
  if (!flag) return OK();

  const next = !(await getBoolFlag(env.DB, flag.key, flag.default));
  await setBoolFlag(env.DB, flag.key, next);

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    RU.admin_flag_toggled(flag.label, next),
    { reply_markup: await buildSettingsKeyboard(env) },
  );
}

/**
 * Dashboard: a single screen with participation health.
 * Names and counts only — never weight values (privacy guarantee).
 */
export async function handleOwnerDashboard(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  const today = getTodayDate();
  const weekStart = getDateWithOffset(-6);

  const allUsers = await getAllUsers(env.DB);
  const userIds = allUsers.map((u) => u.user_id);

  const [todayUsers, weekUsers, vacationIds, goals, overall] = await Promise.all([
    getUsersWithWeightOnDate(env.DB, today),
    getUsersWithWeightInRange(env.DB, weekStart, today),
    getUsersOnVacation(env.DB, today),
    getGoalsByUserIds(env.DB, userIds),
    getOverallFirstAndLastByUsers(env.DB, userIds),
  ]);

  const vacationSet = new Set(vacationIds);

  // Dropped off: not on vacation, has prior entries, but nothing for 5+ days.
  const dropped = allUsers
    .filter((u) => !vacationSet.has(u.user_id))
    .map((u) => {
      const stats = overall.get(u.user_id);
      if (!stats) return null;
      const days = getDaysBetween(stats.lastDate, today);
      return days >= DROPPED_OFF_DAYS ? { name: u.display_name, days } : null;
    })
    .filter((x): x is { name: string; days: number } => x !== null)
    .sort((a, b) => b.days - a.days);

  const lines: string[] = [
    RU.admin_dashboard_title,
    "",
    RU.admin_dash_total(allUsers.length),
    RU.admin_dash_today(todayUsers.length, allUsers.length),
    RU.admin_dash_week(weekUsers.length, allUsers.length),
    RU.admin_dash_vacation(vacationSet.size),
    RU.admin_dash_goal(goals.size),
    "",
    RU.admin_dash_dropped(dropped.length),
    dropped.length > 0
      ? dropped.map((d) => RU.admin_dash_dropped_item(d.name, d.days)).join("\n")
      : RU.admin_nobody,
  ];

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: RU.btn_back, callback_data: "owner_admin_menu" }]],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, lines.join("\n"), {
    reply_markup: keyboard,
  });
}

/**
 * Today's participation status: who checked in, who didn't, who's on vacation,
 * who has a goal. Names and counts only — never weight values.
 */
export async function handleOwnerDayStatus(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  const today = getTodayDate();
  const allUsers = await getAllUsers(env.DB);
  const userIds = allUsers.map((u) => u.user_id);

  const [usersToday, vacationIds, goals] = await Promise.all([
    getUsersWithWeightOnDate(env.DB, today),
    getUsersOnVacation(env.DB, today),
    getGoalsByUserIds(env.DB, userIds),
  ]);

  const todayIds = new Set(usersToday.map((u) => u.user_id));
  const vacationSet = new Set(vacationIds);

  const checkedIn = usersToday.map((u) => u.display_name);
  const notCheckedIn = allUsers
    .filter((u) => !todayIds.has(u.user_id) && !vacationSet.has(u.user_id))
    .map((u) => u.display_name);
  const onVacation = allUsers
    .filter((u) => vacationSet.has(u.user_id))
    .map((u) => u.display_name);
  const withGoal = allUsers
    .filter((u) => goals.has(u.user_id))
    .map((u) => u.display_name);

  const [year, month, day] = today.split("-");
  const dateStr = `${day}.${month}.${year}`;

  const namesOrDash = (names: string[]) =>
    names.length > 0 ? names.map((n) => `• ${n}`).join("\n") : RU.admin_nobody;

  let text = RU.admin_day_status_title(dateStr) + "\n\n";
  text += RU.admin_checked_in(checkedIn.length) + "\n" + namesOrDash(checkedIn) + "\n\n";
  text += RU.admin_not_checked(notCheckedIn.length) + "\n" + namesOrDash(notCheckedIn);
  if (onVacation.length > 0) {
    text += "\n\n" + RU.admin_on_vacation(onVacation.length) + "\n" + namesOrDash(onVacation);
  }
  text += "\n\n" + RU.admin_with_goal(withGoal.length) + "\n" + namesOrDash(withGoal);

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: RU.btn_back, callback_data: "owner_admin_menu" }]],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, {
    reply_markup: keyboard,
  });
}

export async function handleOwnerReportDestMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: RU.btn_report_dest_group, callback_data: "owner_report_dest_group" },
        { text: RU.btn_report_dest_chat, callback_data: "owner_report_dest_chat" },
      ],
      [{ text: RU.btn_back, callback_data: "owner_admin_menu" }],
    ],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_report_dest_title, {
    reply_markup: keyboard,
  });
}

function reportTypeKeyboard(destination: ReportDestination): InlineKeyboardMarkup {
  const suffix = destination === "group" ? "group" : "chat";
  return {
    inline_keyboard: [
      [{ text: RU.btn_report_daily, callback_data: `owner_report_daily_${suffix}` }],
      [{ text: RU.btn_report_weekly, callback_data: `owner_report_weekly_${suffix}` }],
      [{ text: RU.btn_report_monthly, callback_data: `owner_report_monthly_${suffix}` }],
      [{ text: RU.btn_back, callback_data: "owner_send_report_menu" }],
    ],
  };
}

export async function handleOwnerReportTypeMenu(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
  destination: ReportDestination,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_report_menu_title, {
    reply_markup: reportTypeKeyboard(destination),
  });
}

const reportCooldowns: Map<string, number> = new Map();
const REPORT_COOLDOWN_MS = 60000;

export async function handleOwnerReportSend(
  env: Env,
  chatId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
  reportType: ReportType,
  destination: ReportDestination,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  if (destination === "group") {
    const publicChatId = await getSetting(env.DB, "public_chat_id");
    if (!publicChatId) {
      return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_group_not_set);
    }
  }

  const cooldownKey = `${reportType}_${destination}`;
  const now = Date.now();
  const lastRun = reportCooldowns.get(cooldownKey) ?? 0;
  if (now - lastRun < REPORT_COOLDOWN_MS) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.admin_report_cooldown);
  }
  reportCooldowns.set(cooldownKey, now);

  const overrides =
    destination === "chat" ? { targetChatId: String(chatId) } : undefined;

  try {
    if (reportType === "daily") await generateDailyReport(env, overrides);
    else if (reportType === "weekly") await generateWeeklyReport(env, overrides);
    else await generateMonthlyReport(env, overrides);

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

export async function handleOwnerDebugMeme(
  env: Env,
  chatId: number,
  userId: number,
  isOwnerUser: boolean,
  isPrivate: boolean,
): Promise<Response> {
  if (!isAuthorized(isOwnerUser, isPrivate)) return OK();

  await upsertPendingAction(env.DB, userId, "debug_meme");
  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.debug_meme_ask);
}
