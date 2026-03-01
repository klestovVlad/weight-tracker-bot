export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  OWNER_USER_ID: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

export interface ReportPayload {
  date: string;
  kind: "daily" | "weekly" | "monthly";
  submitted: Array<{
    name: string;
    dayDelta: number | null;
    totalDelta: number | null;
    goalRemaining?: number;
    goalPercent?: number;
    goalReached?: boolean;
  }>;
  missing: string[];
  hasRegressions: boolean;
  sumDayDelta: number;
  avgDayDelta: number;
  firstEntryCount: number;
  firstEntryNames: string[];
  countSubmitted: number;
  countMissing: number;
  goalsInfo?: Array<{
    name: string;
    remaining: number;
    percent: number;
    reached: boolean;
  }>;
}

export interface HumanizedReport {
  intro: string;
  outro: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_to_message_id?: number;
  reply_markup?: InlineKeyboardMarkup;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface WeightRecord {
  id: number;
  user_id: number;
  date: string;
  weight_kg: number;
  created_at: string;
  updated_at: string;
}

export interface PendingAction {
  user_id: number;
  action: string;
  created_at: string;
}
