export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  OWNER_USER_ID: string;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_to_message_id?: number;
  reply_markup?: InlineKeyboardMarkup;
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

interface WeightRecord {
  id: number;
  user_id: number;
  date: string;
  weight_kg: number;
  created_at: string;
  updated_at: string;
}

interface PendingAction {
  user_id: number;
  action: string;
  created_at: string;
}

const WEIGHT_MIN = 30;
const WEIGHT_MAX = 300;
const TIMEZONE = "Asia/Nicosia";
const PENDING_ACTION_TTL_HOURS = 24;

// ============== Telegram API ==============

async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  options?: SendMessageOptions
): Promise<Response> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text,
  };

  if (options?.parse_mode) {
    body.parse_mode = options.parse_mode;
  }
  if (options?.reply_to_message_id) {
    body.reply_to_message_id = options.reply_to_message_id;
  }
  if (options?.reply_markup) {
    body.reply_markup = options.reply_markup;
  }

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<Response> {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;

  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  };

  if (text) {
    body.text = text;
  }

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createEditButton(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "✏️ Edit last", callback_data: "edit_last" }]
    ]
  };
}

// ============== Utilities ==============

function getDisplayName(user: TelegramUser): string {
  if (user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name;
}

function getTodayDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} kg`;
}

function parseWeight(text: string): number | null {
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

function isPrivateChat(message: TelegramMessage): boolean {
  return message.chat.type === "private";
}

function isPendingActionExpired(createdAt: string): boolean {
  const created = new Date(createdAt + "Z");
  const now = new Date();
  const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  return diffHours > PENDING_ACTION_TTL_HOURS;
}

// ============== Database Operations ==============

async function ensureUser(db: D1Database, user: TelegramUser): Promise<void> {
  const displayName = getDisplayName(user);

  await db
    .prepare(
      `INSERT INTO users (user_id, display_name, username, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         username = excluded.username`
    )
    .bind(user.id, displayName, user.username ?? null)
    .run();
}

async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const result = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();

  return result?.value ?? null;
}

async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .bind(key, value)
    .run();
}

async function getUserDisplayName(db: D1Database, userId: number): Promise<string> {
  const result = await db
    .prepare("SELECT display_name FROM users WHERE user_id = ?")
    .bind(userId)
    .first<{ display_name: string }>();

  return result?.display_name ?? "Unknown";
}

// ============== Pending Actions ==============

async function getPendingAction(
  db: D1Database,
  userId: number
): Promise<PendingAction | null> {
  return db
    .prepare("SELECT * FROM pending_actions WHERE user_id = ?")
    .bind(userId)
    .first<PendingAction>();
}

async function upsertPendingAction(
  db: D1Database,
  userId: number,
  action: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO pending_actions (user_id, action, created_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         action = excluded.action,
         created_at = datetime('now')`
    )
    .bind(userId, action)
    .run();
}

async function clearPendingAction(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare("DELETE FROM pending_actions WHERE user_id = ?")
    .bind(userId)
    .run();
}

// ============== Weight Operations ==============

async function saveWeight(
  db: D1Database,
  userId: number,
  date: string,
  weightKg: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO weights (user_id, date, weight_kg, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id, date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         updated_at = datetime('now')`
    )
    .bind(userId, date, weightKg)
    .run();
}

async function getLastWeight(
  db: D1Database,
  userId: number
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<WeightRecord>();
}

async function getLastWeightByUpdatedAt(
  db: D1Database,
  userId: number
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<WeightRecord>();
}

async function getPreviousWeight(
  db: D1Database,
  userId: number,
  beforeDate: string
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ? AND date < ?
       ORDER BY date DESC
       LIMIT 1`
    )
    .bind(userId, beforeDate)
    .first<WeightRecord>();
}

async function updateWeightEntry(
  db: D1Database,
  recordId: number,
  userId: number,
  newWeightKg: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE weights
       SET weight_kg = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(newWeightKg, recordId, userId)
    .run();
}

async function getWeightHistory(
  db: D1Database,
  userId: number,
  days: number
): Promise<WeightRecord[]> {
  const result = await db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT ?`
    )
    .bind(userId, days)
    .all<WeightRecord>();

  return result.results ?? [];
}

// ============== Helpers ==============

function isOwner(userId: number, ownerUserId: string): boolean {
  return userId.toString() === ownerUserId;
}

// ============== Weight Tracking ==============

async function handleWeightInput(
  env: Env,
  message: TelegramMessage,
  weightKg: number
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return new Response("OK");
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const today = getTodayDate();

  const previousRecord = await getPreviousWeight(env.DB, userId, today);

  await saveWeight(env.DB, userId, today, weightKg);

  let privateReply: string;
  let groupMessage: string;
  const displayName = await getUserDisplayName(env.DB, userId);

  if (previousRecord) {
    const delta = weightKg - previousRecord.weight_kg;
    privateReply = `Saved ${weightKg.toFixed(1)} kg for ${today}. Δ ${formatDelta(delta)}`;
    groupMessage = `${displayName}: Δ ${formatDelta(delta)}`;
  } else {
    privateReply = `Saved ${weightKg.toFixed(1)} kg for ${today}. First entry!`;
    groupMessage = `${displayName}: first entry`;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, privateReply, {
    reply_markup: createEditButton()
  });

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (publicChatId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, groupMessage);
  }

  return new Response("OK");
}

async function handleEditWeight(
  env: Env,
  message: TelegramMessage,
  weightKg: number
): Promise<Response> {
  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const lastRecord = await getLastWeightByUpdatedAt(env.DB, userId);

  if (!lastRecord) {
    await clearPendingAction(env.DB, userId);
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "No entries to edit."
    );
  }

  await updateWeightEntry(env.DB, lastRecord.id, userId, weightKg);
  await clearPendingAction(env.DB, userId);

  const previousRecord = await getPreviousWeight(env.DB, userId, lastRecord.date);

  let privateReply: string;
  let groupMessage: string;
  const displayName = await getUserDisplayName(env.DB, userId);

  if (previousRecord) {
    const delta = weightKg - previousRecord.weight_kg;
    privateReply = `Updated entry for ${lastRecord.date} to ${weightKg.toFixed(1)} kg. Δ ${formatDelta(delta)}`;
    groupMessage = `${displayName}: Δ ${formatDelta(delta)} (updated)`;
  } else {
    privateReply = `Updated entry for ${lastRecord.date} to ${weightKg.toFixed(1)} kg.`;
    groupMessage = `${displayName}: entry updated`;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, privateReply, {
    reply_markup: createEditButton()
  });

  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (publicChatId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, groupMessage);
  }

  return new Response("OK");
}

// ============== Callback Query Handler ==============

async function handleCallbackQuery(
  env: Env,
  callbackQuery: TelegramCallbackQuery
): Promise<Response> {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const message = callbackQuery.message;

  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQuery.id);

  if (!message || message.chat.type !== "private") {
    return new Response("OK");
  }

  if (data === "edit_last") {
    const lastRecord = await getLastWeightByUpdatedAt(env.DB, userId);

    if (!lastRecord) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        "No entries to edit."
      );
      return new Response("OK");
    }

    await upsertPendingAction(env.DB, userId, "edit_last");

    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `Send the new weight to replace your last entry (${lastRecord.date}: ${lastRecord.weight_kg.toFixed(1)} kg).`
    );
  }

  return new Response("OK");
}

// ============== Command Handlers ==============

async function handleStart(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const welcomeText = `Welcome to Weight Tracker Bot!

Send your weight in private chat:
• 87.4
• 87,4
• вес 87.4
• /w 87.4

After saving, use ✏️ Edit last button to correct mistakes.

Commands:
/me - Show your last weight
/history 7 - Show last 7 entries
/history 30 - Show last 30 entries
/status - Bot status (owner only)
/setgroup - Configure group (owner only)`;

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, welcomeText);
}

async function handleSetGroup(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command is only available to the bot owner."
    );
  }

  if (message.chat.type === "private") {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command must be used in a group."
    );
  }

  await setSetting(env.DB, "public_chat_id", message.chat.id.toString());

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "Group configured.");
}

async function handleStatus(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const userId = message.from?.id;

  if (!userId || !isOwner(userId, env.OWNER_USER_ID)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command is only available to the bot owner."
    );
  }

  const groupId = await getSetting(env.DB, "public_chat_id");

  const statusText = groupId
    ? `Bot status:\nConfigured group ID: ${groupId}`
    : "Bot status:\nGroup not set.";

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, statusText);
}

async function handleMe(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command only works in private chat."
    );
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const lastRecord = await getLastWeight(env.DB, userId);

  if (!lastRecord) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "No weight records found. Send your weight to start tracking!"
    );
  }

  const previousRecord = await getPreviousWeight(env.DB, userId, lastRecord.date);

  let replyText = `Last weight: ${lastRecord.weight_kg.toFixed(1)} kg (${lastRecord.date})`;

  if (previousRecord) {
    const delta = lastRecord.weight_kg - previousRecord.weight_kg;
    replyText += `\nΔ ${formatDelta(delta)} from ${previousRecord.date}`;
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, replyText);
}

async function handleHistory(
  env: Env,
  message: TelegramMessage,
  args: string
): Promise<Response> {
  if (!isPrivateChat(message)) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "This command only works in private chat."
    );
  }

  const userId = message.from?.id;
  if (!userId) {
    return new Response("OK");
  }

  const days = parseInt(args, 10) || 7;
  const limitedDays = Math.min(Math.max(days, 1), 90);

  const records = await getWeightHistory(env.DB, userId, limitedDays);

  if (records.length === 0) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      "No weight records found."
    );
  }

  const lines = records.map((record, index) => {
    const weight = record.weight_kg.toFixed(1);
    const nextRecord = records[index + 1];

    if (nextRecord) {
      const delta = record.weight_kg - nextRecord.weight_kg;
      return `${record.date}: ${weight} kg (Δ ${formatDelta(delta)})`;
    }
    return `${record.date}: ${weight} kg`;
  });

  const header = `Last ${records.length} entries:\n\n`;
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, header + lines.join("\n"));
}

// ============== Message Router ==============

async function handleMessage(env: Env, message: TelegramMessage): Promise<Response> {
  if (message.from) {
    await ensureUser(env.DB, message.from);
  }

  const userId = message.from?.id;
  const text = message.text?.trim() ?? "";

  if (userId && isPrivateChat(message)) {
    const pendingAction = await getPendingAction(env.DB, userId);

    if (pendingAction) {
      if (isPendingActionExpired(pendingAction.created_at)) {
        await clearPendingAction(env.DB, userId);
      } else if (pendingAction.action === "edit_last") {
        const weight = parseWeight(text);

        if (weight !== null) {
          return handleEditWeight(env, message, weight);
        } else {
          return sendMessage(
            env.TELEGRAM_BOT_TOKEN,
            message.chat.id,
            `Invalid weight. Please send a number between ${WEIGHT_MIN} and ${WEIGHT_MAX} kg.`
          );
        }
      }
    }
  }

  const weight = parseWeight(text);
  if (weight !== null) {
    return handleWeightInput(env, message, weight);
  }

  const parts = text.split(/\s+/);
  const command = parts[0].split("@")[0];
  const args = parts.slice(1).join(" ");

  switch (command) {
    case "/start":
      return handleStart(env, message);
    case "/setgroup":
      return handleSetGroup(env, message);
    case "/status":
      return handleStatus(env, message);
    case "/me":
      return handleMe(env, message);
    case "/history":
      return handleHistory(env, message, args);
    case "/cancel":
      if (userId) {
        await clearPendingAction(env.DB, userId);
        return sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          message.chat.id,
          "Action cancelled."
        );
      }
      return new Response("OK");
    default:
      return new Response("OK");
  }
}

async function handleUpdate(env: Env, update: TelegramUpdate): Promise<Response> {
  if (update.callback_query) {
    return handleCallbackQuery(env, update.callback_query);
  }

  if (update.message) {
    return handleMessage(env, update.message);
  }

  return new Response("OK");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Weight Tracker Bot Webhook", { status: 200 });
    }

    try {
      const update: TelegramUpdate = await request.json();
      return handleUpdate(env, update);
    } catch (error) {
      console.error("Error processing update:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
