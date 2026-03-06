export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  OWNER_USER_ID: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

/** Payload for report generation (daily/weekly/monthly). Sent to OpenAI for intro/outro. */
export interface ReportPayload {
  /** Report date (ISO string). */
  date: string;
  /** Report type: daily check-in, weekly summary, or monthly summary. */
  kind: "daily" | "weekly" | "monthly";
  /** Users who submitted weight for this period. */
  submitted: Array<{
    /** Display name. */
    name: string;
    /** Weight change for this period (kg); null if not applicable (e.g. first entry). */
    dayDelta: number | null;
    /** Total weight change since start (kg); null if not applicable. */
    totalDelta: number | null;
    /** Kg left to reach goal (if goal set). */
    goalRemaining?: number;
    /** Progress to goal 0–100 (if goal set). */
    goalPercent?: number;
    /** True if user reached their goal this period. */
    goalReached?: boolean;
  }>;
  /** Display names of users who did not submit for this period. */
  missing: string[];
  /** True if at least one submitted user gained weight this period. */
  hasRegressions: boolean;
  /** Sum of dayDelta across all submitted users (team total change for the period, kg). */
  sumDayDelta: number;
  /** Average dayDelta per submitted user (kg). */
  avgDayDelta: number;
  /** Number of users with their first ever entry in this period. */
  firstEntryCount: number;
  /** Display names of users with first entry in this period. */
  firstEntryNames: string[];
  /** Number of users who submitted. */
  countSubmitted: number;
  /** Number of users who did not submit. */
  countMissing: number;
  /** Goal progress per user (for highlighting “close to goal” / “reached goal”). */
  goalsInfo?: Array<{
    /** Display name. */
    name: string;
    /** Kg left to goal. */
    remaining: number;
    /** Progress to goal 0–100. */
    percent: number;
    /** True if goal was reached. */
    reached: boolean;
  }>;
  /** Streak achievements (daily report). */
  achievementLines?: Array<{ name: string; icon: string; days: number }>;
  /** Broken streaks (daily report). */
  brokenLines?: Array<{ name: string; streak: number }>;
  /** Pre-computed leader/champion: participant with best (most negative) dayDelta this period. userId set for weekly (to assign crown). */
  leader?: { name: string; dayDelta: number; userId?: number } | null;
  /** Name of user who wears the crown this week (for report text: "Корону теперь носит X"). */
  crownHolderName?: string | null;
}

/** One submitted user in a report payload. */
export type ReportUserDelta = ReportPayload["submitted"][number];

/** Goal info for one user in a report payload. */
export type ReportGoalsInfo = NonNullable<ReportPayload["goalsInfo"]>[number];

export interface GptMeme {
  object: string;
  emoji?: string;
  caption?: string;
}

export interface HumanizedReport {
  /** Full report text (from OpenAI). */
  message: string;
  meme?: GptMeme | null;
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
