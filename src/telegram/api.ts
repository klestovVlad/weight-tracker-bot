import { SendMessageOptions } from "../types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);

    if (response.ok) {
      return response;
    }

    if (response.status === 403 || response.status === 400) {
      return response;
    }

    if (response.status === 429) {
      const data = await response.clone().json() as { parameters?: { retry_after?: number } };
      const retryAfter = data.parameters?.retry_after ?? 5;
      if (attempt < retries) {
        await sleep(Math.min(retryAfter * 1000, 10000));
        continue;
      }
    }

    if (response.status >= 500 && attempt < retries) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }

    return response;
  }

  throw new Error("Max retries exceeded");
}

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

  return fetchWithRetry(url, {
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

  return fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendPhoto(
  token: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string
): Promise<Response> {
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
  };

  if (caption) {
    body.caption = caption;
  }

  return fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function editMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
): Promise<Response> {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  return fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
