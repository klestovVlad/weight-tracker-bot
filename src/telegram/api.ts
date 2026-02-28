import { SendMessageOptions } from "../types";

export async function sendMessage(
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

export async function answerCallbackQuery(
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
