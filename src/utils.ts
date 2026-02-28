import { WEIGHT_MIN, WEIGHT_MAX, TIMEZONE, PENDING_ACTION_TTL_HOURS } from "./config";
import { TelegramUser, TelegramMessage, InlineKeyboardMarkup } from "./types";

export function getDisplayName(user: TelegramUser): string {
  if (user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name;
}

export function getTodayDate(): string {
  const now = new Date();
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
      [{ text: "✏️ Edit last", callback_data: "edit_last" }]
    ]
  };
}
