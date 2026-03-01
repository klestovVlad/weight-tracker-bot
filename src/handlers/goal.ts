import { Env } from "../types";
import { WEIGHT_MIN, WEIGHT_MAX } from "../config";
import { RU } from "../i18n";
import { sendMessage, answerCallbackQuery, editMessageText } from "../telegram/api";
import { getGoal, upsertGoal, deleteGoal, computeGoalProgress, generateProgressBar } from "../db/goals";
import { getLastWeight } from "../db/weights";
import { setPendingAction, clearPendingAction } from "../db/pending-actions";
import { parseWeight } from "../utils";

export async function handleGoalMenu(
  env: Env,
  chatId: number,
  userId: number,
  messageId: number,
  callbackQueryId: string
): Promise<void> {
  const goal = await getGoal(env.DB, userId);

  const buttons = [];
  if (goal) {
    buttons.push([{ text: RU.btn_goal_edit, callback_data: "goal_edit" }]);
    buttons.push([{ text: RU.btn_goal_delete, callback_data: "goal_delete" }]);
  } else {
    buttons.push([{ text: RU.btn_goal_set, callback_data: "goal_set" }]);
  }
  buttons.push([{ text: RU.btn_back, callback_data: "menu_back_main" }]);

  let text = RU.goal_menu_title;
  if (goal) {
    const lastWeight = await getLastWeight(env.DB, userId);
    if (lastWeight) {
      const progress = computeGoalProgress(goal, lastWeight.weight_kg);
      text += "\n\n" + RU.goal_current(
        goal.target_weight_kg.toFixed(1),
        lastWeight.weight_kg.toFixed(1)
      );
      if (progress.reached) {
        text += "\n" + RU.goal_reached;
      } else {
        const bar = generateProgressBar(progress.percent);
        text += RU.goal_progress(progress.percent, bar, progress.remainingKg);
      }
    }
  } else {
    text += "\n\n" + RU.goal_not_set;
  }

  await editMessageText(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, {
    inline_keyboard: buttons,
  });
  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId);
}

export async function handleGoalSetStart(
  env: Env,
  chatId: number,
  userId: number,
  callbackQueryId: string
): Promise<void> {
  const lastWeight = await getLastWeight(env.DB, userId);
  if (!lastWeight) {
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId, RU.goal_need_weight_first);
    return;
  }

  await setPendingAction(env.DB, userId, "goal_set");
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.goal_ask_target);
  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId);
}

export async function handleGoalInput(
  env: Env,
  chatId: number,
  userId: number,
  text: string
): Promise<boolean> {
  const weight = parseWeight(text);
  if (weight === null) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.invalid_weight(WEIGHT_MIN, WEIGHT_MAX));
    return true;
  }

  const lastWeight = await getLastWeight(env.DB, userId);
  if (!lastWeight) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.goal_need_weight_first);
    await clearPendingAction(env.DB, userId);
    return true;
  }

  const startWeight = lastWeight.weight_kg;
  await upsertGoal(env.DB, userId, weight, startWeight);
  await clearPendingAction(env.DB, userId);

  const goal = await getGoal(env.DB, userId);
  if (!goal) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.goal_saved);
    return true;
  }

  const progress = computeGoalProgress(goal, startWeight);

  let reply = RU.goal_saved + "\n\n";
  if (progress.targetWeight === progress.startWeight) {
    reply += RU.goal_same_as_start;
  } else if (progress.reached) {
    reply += RU.goal_reached;
  } else {
    const bar = generateProgressBar(progress.percent);
    reply += RU.goal_progress(progress.percent, bar, progress.remainingKg);
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  return true;
}

export async function handleGoalDelete(
  env: Env,
  chatId: number,
  userId: number,
  callbackQueryId: string
): Promise<void> {
  await deleteGoal(env.DB, userId);
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.goal_deleted);
  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId);
}

export function formatGoalSnippet(remainingKg: number, percent: number, reached: boolean): string {
  if (reached) {
    return RU.goal_snippet_reached;
  }
  return RU.goal_snippet(remainingKg, percent);
}
