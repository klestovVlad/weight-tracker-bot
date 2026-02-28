import { Env, TelegramUpdate, TelegramMessage } from "./types";
import { WEIGHT_MIN, WEIGHT_MAX } from "./config";
import { parseWeight, isPrivateChat, isPendingActionExpired } from "./utils";
import { RU } from "./i18n";
import { sendMessage } from "./telegram/api";
import { ensureUser } from "./db/users";
import { getPendingAction, clearPendingAction } from "./db/pending-actions";
import { handleStart, handleSetGroup, handleStatus, handleMe, handleHistoryCommand, handleDebugAddDay, handleDebugDaily, handleDebugWeekly, handleDebugOpenai } from "./handlers/commands";
import { handleWeightInput, handleEditWeight } from "./handlers/weight";
import { handleCallbackQuery } from "./handlers/callback";
import { generateDailyReport, generateWeeklyReport } from "./handlers/reports";

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
            RU.invalid_weight(WEIGHT_MIN, WEIGHT_MAX)
          );
        }
      } else if (pendingAction.action === "enter_weight") {
        const weight = parseWeight(text);

        if (weight !== null) {
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
      return handleDebugDaily(env, message);
    case "/debug_weekly":
      return handleDebugWeekly(env, message);
    case "/debug_openai":
      return handleDebugOpenai(env, message);
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
    try {
      if (event.cron === "0 16 * * SUN") {
        await generateWeeklyReport(env);
      } else if (event.cron === "0 16 * * MON-SAT") {
        await generateDailyReport(env);
      }
    } catch (error) {
      console.error("Error in scheduled task:", error);
    }
  },
};
