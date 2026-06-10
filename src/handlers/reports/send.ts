import { Env, ReportPayload } from "../../types";
import { sendMessage, sendSticker, sendPhoto } from "../../telegram/api";
import { getBoolFlag } from "../../db/settings";
import { RU } from "../../i18n";
import { humanizeReport } from "../../openai";
import { pickMemeObject, headlineDeltaKg } from "../../helpers/meme";
import { buildTeamChartUrl } from "../../helpers/team-chart";
import { getStickerImageUrl } from "../../helpers/sticker-image";
import { getActiveSeason } from "../../db/seasons";
import { computeSeasonProgress } from "../../helpers/season";
import { getTodayDate } from "../../utils";
import { logError } from "../../helpers/logging";

export async function sendReport(
  env: Env,
  publicChatId: string,
  payload: ReportPayload,
): Promise<void> {
  const result = await humanizeReport(payload, env);
  const { message, meme } = result;

  const withImages = payload.kind === "weekly" || payload.kind === "monthly";

  // Report text first, with a season banner on top if a challenge is running.
  if (!message.trim()) return;
  let fullMessage = message;
  const today = getTodayDate();
  const season = await getActiveSeason(env.DB, today);
  if (season) {
    const progress = await computeSeasonProgress(env, season, today);
    const banner = RU.season_banner(
      season.name,
      progress.daysLeft,
      progress.teamLostKg.toFixed(1),
    );
    fullMessage = `${banner}\n\n${message}`;
  }
  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, fullMessage, {
    parse_mode: "HTML",
  });

  if (!withImages) return;

  // Team trend chart (deltas only — privacy-safe), then the mascot sticker.
  if (await getBoolFlag(env.DB, "team_chart_enabled", true)) {
    const title =
      payload.kind === "monthly"
        ? RU.team_chart_title_monthly
        : RU.team_chart_title_weekly;
    const chartUrl = buildTeamChartUrl(payload, title);
    if (chartUrl) {
      try {
        await sendPhoto(env.TELEGRAM_BOT_TOKEN, publicChatId, chartUrl);
      } catch (error) {
        logError("Team chart send failed", error);
      }
    }
  }

  if (await getBoolFlag(env.DB, "memes_enabled", true)) {
    // Meme/sticker features the cumulative team loss, not just the period change.
    const headlineKg = headlineDeltaKg(payload);
    const baseObject = meme?.object ?? pickMemeObject(headlineKg);
    const memeObject =
      baseObject.startsWith("sticker:") || baseObject.startsWith("[sticker]")
        ? baseObject
        : `sticker: ${baseObject}`;
    const imageResult = await getStickerImageUrl(env, memeObject, headlineKg);
    if (
      imageResult != null &&
      (typeof imageResult === "string" || "b64" in imageResult)
    ) {
      await sendSticker(env.TELEGRAM_BOT_TOKEN, publicChatId, imageResult);
    } else if (imageResult != null && "error" in imageResult) {
      logError(`Report meme image failed: ${imageResult.error}`);
    } else {
      logError(
        "Report meme image: no URL/b64 returned (check OPENAI_API_KEY and limits)",
      );
    }
  }
}
