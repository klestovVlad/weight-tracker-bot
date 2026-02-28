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
    keyboard.push([{ text: RU.btn_edit_last, callback_data: "menu_edit_last" }]);
  }

  if (isOwnerUser) {
    if (isGroup) {
      keyboard.push([{ text: RU.btn_setgroup, callback_data: "owner_setgroup_here" }]);
    }
    keyboard.push([{ text: RU.btn_status, callback_data: "owner_status" }]);
    keyboard.push([{ text: RU.btn_send_report, callback_data: "send_report" }]);
    keyboard.push([
      { text: RU.btn_debug_daily, callback_data: "debug_daily" },
      { text: RU.btn_debug_weekly, callback_data: "debug_weekly" },
      { text: RU.btn_debug_openai, callback_data: "debug_openai" }
    ]);
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
