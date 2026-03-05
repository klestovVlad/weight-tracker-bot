import { Env, ReportPayload } from "../../types";
import { sendMessage, sendSticker } from "../../telegram/api";
import { getSetting } from "../../db/settings";
import { humanizeReport } from "../../openai";
import { pickMemeObject } from "../../helpers/meme";
import { getMemeImageUrl } from "../../helpers/meme-image";
import { logError } from "../../helpers/logging";

export async function sendReport(
  env: Env,
  publicChatId: string,
  payload: ReportPayload,
): Promise<void> {
  const result = await humanizeReport(payload, env);
  const { message, meme } = result;

  const withMeme =
    payload.kind === "weekly" || payload.kind === "monthly";
  const memesDisabled = (await getSetting(env.DB, "memes_enabled")) === "false";
  const memesEnabled = withMeme && !memesDisabled;

  // Report text first, then image (sticker or photo)
  if (!message.trim()) return;
  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, message, {
    parse_mode: "HTML",
  });

  if (memesEnabled) {
    const baseObject = meme?.object ?? pickMemeObject(payload.sumDayDelta);
    const memeObject = baseObject.startsWith("sticker:") || baseObject.startsWith("[sticker]")
      ? baseObject
      : `sticker: ${baseObject}`;
    const imageResult = await getMemeImageUrl(
      env,
      memeObject,
      payload.sumDayDelta,
    );
    if (
      imageResult != null &&
      (typeof imageResult === "string" || "b64" in imageResult)
    ) {
      await sendSticker(
        env.TELEGRAM_BOT_TOKEN,
        publicChatId,
        imageResult,
      );
    } else if (imageResult != null && "error" in imageResult) {
      logError(`Report meme image failed: ${imageResult.error}`);
    } else {
      logError("Report meme image: no URL/b64 returned (check OPENAI_API_KEY and limits)");
    }
  }
}
