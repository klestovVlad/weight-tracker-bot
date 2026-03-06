import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { RU, formatDeltaRu } from "../i18n";
import { getAllUsers } from "../db/users";
import { getCrownUserId } from "../db/settings";
import { getDateWithOffset, getTodayDate, getStreakIcon } from "../utils";
import { getUserStreak } from "../db/weights";

interface LeaderboardEntry {
  userId: number;
  name: string;
  checkins: number;
  weekDelta: number | null;
  streak: number;
}

async function getWeekData(
  db: D1Database,
  userId: number,
  startDate: string,
  endDate: string
): Promise<{ checkins: number; firstWeight: number | null; lastWeight: number | null }> {
  const result = await db
    .prepare(
      `SELECT date, weight_kg FROM weights 
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`
    )
    .bind(userId, startDate, endDate)
    .all<{ date: string; weight_kg: number }>();

  const records = result.results ?? [];
  if (records.length === 0) {
    return { checkins: 0, firstWeight: null, lastWeight: null };
  }

  return {
    checkins: records.length,
    firstWeight: records[0].weight_kg,
    lastWeight: records[records.length - 1].weight_kg,
  };
}

function nameWithStreakIcon(name: string, icon: string, hasCrown?: boolean): string {
  let n = icon ? `${name} ${icon}` : name;
  if (hasCrown) n = "👑 " + n;
  return n;
}

export async function handleLeaderboardWeekDelta(
  env: Env,
  chatId: number
): Promise<Response> {
  const today = getTodayDate();
  const startDate = getDateWithOffset(-6);
  const [users, crownUserId] = await Promise.all([
    getAllUsers(env.DB),
    getCrownUserId(env.DB),
  ]);

  const entries: LeaderboardEntry[] = [];

  for (const user of users) {
    const data = await getWeekData(env.DB, user.user_id, startDate, today);
    const streakInfo = await getUserStreak(env.DB, user.user_id);
    const streak = streakInfo?.length ?? 0;

    let weekDelta: number | null = null;
    if (data.firstWeight !== null && data.lastWeight !== null && data.checkins >= 2) {
      weekDelta = data.lastWeight - data.firstWeight;
    }

    entries.push({
      userId: user.user_id,
      name: user.display_name,
      checkins: data.checkins,
      weekDelta,
      streak,
    });
  }

  entries.sort((a, b) => {
    if (a.weekDelta === null && b.weekDelta === null) return b.checkins - a.checkins;
    if (a.weekDelta === null) return 1;
    if (b.weekDelta === null) return -1;
    return a.weekDelta - b.weekDelta;
  });

  const top10 = entries.slice(0, 10);

  if (top10.length === 0 || top10.every(e => e.checkins === 0)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.leaderboard_no_data);
  }

  const lines = [RU.leaderboard_week_delta_title, ""];
  for (let idx = 0; idx < top10.length; idx++) {
    const entry = top10[idx];
    const deltaStr = entry.weekDelta !== null ? formatDeltaRu(entry.weekDelta) : "—";
    const icon = getStreakIcon(entry.streak);
    const hasCrown = crownUserId != null && entry.userId === crownUserId;
    const nameWithIcon = nameWithStreakIcon(entry.name, icon, hasCrown);
    lines.push(RU.leaderboard_line_delta(idx + 1, nameWithIcon, deltaStr, entry.checkins));
  }

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, lines.join("\n"));
}

export async function handleLeaderboardCheckins(
  env: Env,
  chatId: number
): Promise<Response> {
  const today = getTodayDate();
  const startDate = getDateWithOffset(-6);
  const [users, crownUserId] = await Promise.all([
    getAllUsers(env.DB),
    getCrownUserId(env.DB),
  ]);

  const entries: LeaderboardEntry[] = [];

  for (const user of users) {
    const data = await getWeekData(env.DB, user.user_id, startDate, today);
    const streakInfo = await getUserStreak(env.DB, user.user_id);
    const streak = streakInfo?.length ?? 0;

    entries.push({
      userId: user.user_id,
      name: user.display_name,
      checkins: data.checkins,
      weekDelta: null,
      streak,
    });
  }

  entries.sort((a, b) => {
    if (b.checkins !== a.checkins) return b.checkins - a.checkins;
    return b.streak - a.streak;
  });

  const top10 = entries.slice(0, 10);

  if (top10.length === 0 || top10.every(e => e.checkins === 0)) {
    return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, RU.leaderboard_no_data);
  }

  const lines = [RU.leaderboard_checkins_title, ""];
  top10.forEach((entry, idx) => {
    const icon = getStreakIcon(entry.streak);
    const hasCrown = crownUserId != null && entry.userId === crownUserId;
    const nameWithIcon = nameWithStreakIcon(entry.name, icon, hasCrown);
    lines.push(RU.leaderboard_line_checkins(idx + 1, nameWithIcon, entry.checkins, entry.streak));
  });

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, lines.join("\n"));
}
