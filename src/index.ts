import { Env, TelegramUpdate, TelegramMessage } from "./types";
import { WEIGHT_MIN, WEIGHT_MAX } from "./config";
import { parseWeight, isPrivateChat, isPendingActionExpired, getTodayDate } from "./utils";
import { RU } from "./i18n";
import { sendMessage } from "./telegram/api";
import { ensureUser } from "./db/users";
import { getPendingAction, clearPendingAction } from "./db/pending-actions";
import { handleStart, handleSetGroup, handleStatus, handleMe, handleHistoryCommand, handleDebugAddDay, handleDebugDaily, handleDebugWeekly, handleDebugOpenai, handleDebugHelp } from "./handlers/commands";
import { handleWeightInput, handleEditWeight } from "./handlers/weight";
import { handleCallbackQuery } from "./handlers/callback";
import { generateDailyReport, generateWeeklyReport } from "./handlers/reports";
import { runReminders } from "./handlers/reminders";
import { withJobLock, getWeekKey } from "./helpers/job-lock";
import { checkRateLimit } from "./helpers/rate-limit";

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
          const allowed = await checkRateLimit(env.DB, userId, "weight_input");
          if (!allowed) {
            return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.rate_limited);
          }
          return handleEditWeight(env, message, weight);
        } else {
          return sendMessage(
            env.TELEGRAM_BOT_TOKEN,
            message.chat.id,
            RU.invalid_weight(WEIGHT_MIN, WEIGHT_MAX)
          );
        }
      } else if (pendingAction.action === "enter_weight") {
        const weight = parseWeight(text);

        if (weight !== null) {
          const allowed = await checkRateLimit(env.DB, userId, "weight_input");
          if (!allowed) {
            return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.rate_limited);
          }
          await clearPendingAction(env.DB, userId);
          return handleWeightInput(env, message, weight);
        } else {
          return sendMessage(
            env.TELEGRAM_BOT_TOKEN,
            message.chat.id,
            RU.invalid_weight(WEIGHT_MIN, WEIGHT_MAX)
          );
        }
      }
    }
  }

  const weight = parseWeight(text);
  if (weight !== null) {
    if (userId) {
      const allowed = await checkRateLimit(env.DB, userId, "weight_input");
      if (!allowed) {
        return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.rate_limited);
      }
    }
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
      return handleHistoryCommand(env, message, args);
    case "/edit":
      if (userId && isPrivateChat(message)) {
        const { upsertPendingAction } = await import("./db/pending-actions");
        const { getLastWeightByUpdatedAt } = await import("./db/weights");
        
        const lastRecord = await getLastWeightByUpdatedAt(env.DB, userId);
        if (!lastRecord) {
          return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.no_entries_to_edit);
        }
        
        await upsertPendingAction(env.DB, userId, "edit_last");
        return sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          message.chat.id,
          RU.ask_edit_weight(lastRecord.date, lastRecord.weight_kg.toFixed(1))
        );
      }
      return new Response("OK");
    case "/debug_addday":
      return handleDebugAddDay(env, message, args);
    case "/debug_daily":
      return handleDebugDailyWithLock(env, message);
    case "/debug_weekly":
      return handleDebugWeeklyWithLock(env, message);
    case "/debug_openai":
      return handleDebugOpenai(env, message);
    case "/debug_run_reminders":
      return handleDebugRunRemindersWithLock(env, message);
    case "/debug":
      return handleDebugHelp(env, message);
    case "/cancel":
      if (userId) {
        await clearPendingAction(env.DB, userId);
        return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.action_cancelled);
      }
      return new Response("OK");
    default:
      return new Response("OK");
  }
}

async function handleDebugDailyWithLock(env: Env, message: TelegramMessage): Promise<Response> {
  const userId = message.from?.id;
  
  if (!userId || userId.toString() !== env.OWNER_USER_ID) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }
  
  const today = getTodayDate();
  const result = await withJobLock(env, "debug_daily_report", today, async () => {
    await generateDailyReport(env);
  });
  
  if (result.skipped) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "⚠️ Дневной отчёт уже был отправлен сегодня.");
  }
  
  if (result.error) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, `❌ Ошибка: ${result.error}`);
  }
  
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "🔧 [DEBUG] Ежедневный отчёт отправлен.");
}

async function handleDebugWeeklyWithLock(env: Env, message: TelegramMessage): Promise<Response> {
  const userId = message.from?.id;
  
  if (!userId || userId.toString() !== env.OWNER_USER_ID) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }
  
  const weekKey = getWeekKey(new Date());
  const result = await withJobLock(env, "debug_weekly_report", weekKey, async () => {
    await generateWeeklyReport(env);
  });
  
  if (result.skipped) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "⚠️ Недельный отчёт уже был отправлен на этой неделе.");
  }
  
  if (result.error) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, `❌ Ошибка: ${result.error}`);
  }
  
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "🔧 [DEBUG] Еженедельный отчёт отправлен.");
}

async function handleDebugRunRemindersWithLock(env: Env, message: TelegramMessage): Promise<Response> {
  const userId = message.from?.id;
  
  if (!userId || userId.toString() !== env.OWNER_USER_ID) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.owner_only);
  }
  
  if (!isPrivateChat(message)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, RU.private_only);
  }
  
  const today = getTodayDate();
  let stats = { sent: 0, skipped: 0, errors: 0 };
  
  const result = await withJobLock(env, "debug_reminders", today, async () => {
    stats = await runReminders(env);
  });
  
  if (result.skipped) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, "⚠️ Напоминалки уже были отправлены сегодня.");
  }
  
  const reply = `✅ Напоминалки:
отправлено ${stats.sent}
пропущено ${stats.skipped}
ошибок ${stats.errors}`;
  
  return sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, reply);
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

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
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

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const today = getTodayDate();
    
    try {
      if (event.cron === "0 8 * * *") {
        await withJobLock(env, "reminders", today, async () => {
          const stats = await runReminders(env);
          console.log(`Reminders: sent=${stats.sent}, skipped=${stats.skipped}, errors=${stats.errors}`);
        });
      } else if (event.cron === "0 16 * * SUN") {
        const weekKey = getWeekKey(new Date());
        await withJobLock(env, "weekly_report", weekKey, async () => {
          await generateWeeklyReport(env);
        });
      } else if (event.cron === "0 16 * * MON-SAT") {
        await withJobLock(env, "daily_report", today, async () => {
          await generateDailyReport(env);
        });
      }
    } catch (error) {
      console.error("Error in scheduled task:", error);
    }
  },
};
