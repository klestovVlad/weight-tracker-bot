import { Env, TelegramUpdate, TelegramMessage } from "./types";
import { WEIGHT_MIN, WEIGHT_MAX } from "./config";
import { parseWeight, isPrivateChat, isPendingActionExpired } from "./utils";
import { sendMessage } from "./telegram/api";
import { ensureUser } from "./db/users";
import { getPendingAction, clearPendingAction } from "./db/pending-actions";
import { handleStart, handleSetGroup, handleStatus, handleMe, handleHistory } from "./handlers/commands";
import { handleWeightInput, handleEditWeight } from "./handlers/weight";
import { handleCallbackQuery } from "./handlers/callback";

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
