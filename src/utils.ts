import { WEIGHT_MIN, WEIGHT_MAX, TIMEZONE, PENDING_ACTION_TTL_HOURS } from "./config";
import { TelegramUser, TelegramMessage, InlineKeyboardMarkup, InlineKeyboardButton } from "./types";
import { RU } from "./i18n";

export function getDisplayName(user: TelegramUser): string {
  if (user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name;
}

export function getTodayDate(): string {
  return getDateWithOffset(0);
}

export function getDateWithOffset(offsetDays: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/** Previous calendar day (YYYY-MM-DD). Used for streak in Asia/Nicosia context. */
export function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Day of week for date string (YYYY-MM-DD). 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return d.getUTCDay();
}

export function isSunday(dateStr: string): boolean {
  return getDayOfWeek(dateStr) === 0;
}

/** Whole days between two date strings (YYYY-MM-DD); positive if `to` is after `from`. */
export function getDaysBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr + "T12:00:00.000Z").getTime();
  const to = new Date(toStr + "T12:00:00.000Z").getTime();
  return Math.round((to - from) / 86400000);
}

/** Monday of the week containing the given date (YYYY-MM-DD). Week is Mon–Sun. */
export function getStartOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysToMonday);
  return d.toISOString().slice(0, 10);
}

export const STREAK_LEVELS: Array<{ days: number; icon: string }> = [
  { days: 3, icon: "🔹" },
  { days: 7, icon: "🔸" },
  { days: 14, icon: "⭐" },
  { days: 30, icon: "🔥" },
  { days: 60, icon: "💎" },
  { days: 90, icon: "👑" },
];

/** Highest level icon for streak; empty string if streak < 3. */
export function getStreakIcon(streak: number): string {
  if (streak < 3) return "";
  let icon = "";
  for (const { days, icon: i } of STREAK_LEVELS) {
    if (streak >= days) icon = i;
  }
  return icon;
}

/** Next level threshold (days) for streak; null if already at max (90+). */
export function getNextStreakLevel(streak: number): number | null {
  for (const { days } of STREAK_LEVELS) {
    if (streak < days) return days;
  }
  return null;
}

export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} kg`;
}

export function parseWeight(text: string): number | null {
  const normalized = text.toLowerCase().trim();

  const patterns = [
    /^\/w\s+([\d.,]+)$/,
    /^вес\s+([\d.,]+)$/i,
    /^([\d.,]+)$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const weightStr = match[1].replace(",", ".");
      const weight = parseFloat(weightStr);

      if (!isNaN(weight) && weight >= WEIGHT_MIN && weight <= WEIGHT_MAX) {
        return Math.round(weight * 10) / 10;
      }
    }
  }

  return null;
}

export function isPrivateChat(message: TelegramMessage): boolean {
  return message.chat.type === "private";
}

export function isPendingActionExpired(createdAt: string): boolean {
  const created = new Date(createdAt + "Z");
  const now = new Date();
  const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  return diffHours > PENDING_ACTION_TTL_HOURS;
}

export function isOwner(userId: number, ownerUserId: string): boolean {
  return userId.toString() === ownerUserId;
}

export function createEditButton(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: RU.btn_edit_last, callback_data: "menu_edit_last" }]
    ]
  };
}

export function createMainMenu(isOwnerUser: boolean, isGroup: boolean): InlineKeyboardMarkup {
  const keyboard: InlineKeyboardButton[][] = [];

  if (!isGroup) {
    keyboard.push([{ text: RU.btn_enter_weight, callback_data: "menu_enter_weight" }]);
    keyboard.push([
      { text: RU.btn_history_7, callback_data: "menu_history_7" },
      { text: RU.btn_history_30, callback_data: "menu_history_30" }
    ]);
    keyboard.push([
      { text: RU.btn_chart, callback_data: "menu_chart" },
      { text: RU.btn_leaderboard, callback_data: "menu_leaderboard" }
    ]);
    keyboard.push([
      { text: RU.btn_edit_last, callback_data: "menu_edit_last" },
      { text: RU.btn_goal, callback_data: "menu_goal" }
    ]);
    keyboard.push([
      { text: RU.btn_achievements, callback_data: "menu_my_achievements" },
      { text: RU.btn_vacation, callback_data: "menu_vacation" }
    ]);
    keyboard.push([{ text: RU.btn_help, callback_data: "menu_help" }]);
    keyboard.push([{ text: RU.btn_frequency, callback_data: "menu_frequency" }]);
  }

  if (isOwnerUser) {
    if (isGroup) {
      keyboard.push([{ text: RU.btn_setgroup, callback_data: "owner_setgroup_here" }]);
    } else {
      keyboard.push([{ text: RU.btn_admin, callback_data: "owner_admin_menu" }]);
    }
  }

  return { inline_keyboard: keyboard };
}

export function createAfterWeightMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: RU.btn_history_7, callback_data: "menu_history_7" },
        { text: RU.btn_edit_last, callback_data: "menu_edit_last" }
      ]
    ]
  };
}
