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

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_to_message_id?: number;
}

async function sendMessage(
  token: string,
  chatId: number,
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

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getDisplayName(user: TelegramUser): string {
  if (user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name;
}

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

function isOwner(userId: number, ownerUserId: string): boolean {
  return userId.toString() === ownerUserId;
}

async function handleStart(
  env: Env,
  message: TelegramMessage
): Promise<Response> {
  const welcomeText = `Welcome! I'm your bot assistant.

Available commands:
/start - Show this message
/status - Show bot status (owner only)
/setgroup - Configure group (owner only, in group)`;

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

async function handleMessage(env: Env, message: TelegramMessage): Promise<Response> {
  if (message.from) {
    await ensureUser(env.DB, message.from);
  }

  const text = message.text?.trim() ?? "";
  const command = text.split(" ")[0].split("@")[0];

  switch (command) {
    case "/start":
      return handleStart(env, message);
    case "/setgroup":
      return handleSetGroup(env, message);
    case "/status":
      return handleStatus(env, message);
    default:
      return new Response("OK");
  }
}

async function handleUpdate(env: Env, update: TelegramUpdate): Promise<Response> {
  if (update.message) {
    return handleMessage(env, update.message);
  }

  return new Response("OK");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Telegram Bot Webhook", { status: 200 });
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
