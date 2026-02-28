export const RU = {
  // Welcome & Menu
  welcome: `👋 Привет! Я помогу отслеживать твой вес.

🔒 Твой вес виден только тебе
📊 В группу отправляется только изменение (дельта)
⏰ Напоминалки приходят в личку (после нажатия Start)

Используй кнопки ниже 👇`,

  welcome_group: `👋 Этот бот работает в личных сообщениях.

Напиши мне в личку и нажми Start, чтобы начать отслеживать вес.`,

  // Buttons
  btn_enter_weight: "✅ Внести вес",
  btn_history_7: "📈 7 дней",
  btn_history_30: "📅 30 дней",
  btn_edit_last: "✏️ Изменить",
  btn_help: "ℹ️ Как пользоваться",
  btn_chart: "📊 График",
  btn_vacation: "🌴 Отпуск",
  btn_leaderboard: "🏆 Лидерборд",
  btn_back: "⬅️ Назад",
  btn_status: "⚙️ Статус",
  btn_setgroup: "👥 Привязать группу",
  btn_debug_daily: "🔧 Дневной",
  btn_debug_weekly: "🔧 Недельный",
  btn_debug_openai: "🤖 Тест AI",
  btn_send_report: "📤 Отчёт в группу",

  // Chart
  chart_pick_period: "📊 Выбери период для графика:",
  chart_not_enough_data: "Недостаточно данных для графика. Внеси хотя бы 2 записи 🙂",
  chart_caption: (delta: string, min: string, max: string) =>
    `Δ за период: ${delta} • мин ${min} • макс ${max}`,
  chart_title_7: "Вес — 7 дней",
  chart_title_30: "Вес — 30 дней",
  chart_title_90: "Вес — 90 дней",
  chart_title_180: "Вес — 180 дней",
  chart_title_all: "Вес — с начала",

  // Vacation
  vacation_pick: "🌴 На сколько дней поставить паузу?",
  vacation_set: (date: string) =>
    `Ок 🙂 Поставила паузу до ${date}. Напоминалки приходить не будут.`,
  vacation_off: "Пауза снята ✅",
  vacation_returned: "Похоже, ты вернулся 🙂 Пауза снята.",

  // Leaderboard
  leaderboard_pick: "🏆 Какой лидерборд показать?",
  leaderboard_week_delta_title: "🏆 Лидерборд недели (по изменению)",
  leaderboard_checkins_title: "🏆 Лидерборд регулярности (7 дней)",
  leaderboard_line_delta: (pos: number, name: string, delta: string, checkins: number) =>
    `${pos}) ${name}: ${delta} (${checkins}/7)`,
  leaderboard_line_checkins: (pos: number, name: string, checkins: number, streak: number) =>
    `${pos}) ${name}: ${checkins}/7 • без пропусков ${streak}`,
  leaderboard_no_data: "Нет данных за эту неделю.",

  // Help
  help_message: `ℹ️ **Как пользоваться ботом:**

**Внести вес:**
Просто отправь число, например: 87.4
Или нажми кнопку "✅ Внести вес"

**Изменить последнюю запись:**
Нажми "✏️ Изменить" и отправь новый вес

**Посмотреть прогресс:**
Кнопки "📈 7 дней" и "📅 30 дней"

**Приватность:**
🔒 Твой точный вес видишь только ты
📊 В группу уходит только изменение (+0.5 кг)

**Напоминалки:**
⏰ Приходят в 11:00 если ты не внёс вес
Работают только после того, как ты нажал Start`,

  // Weight input
  ask_weight: "📝 Отправь свой вес (например: 87.4)",
  weight_saved: (weight: string, date: string, delta: string) =>
    `✅ Сохранено: ${weight} кг (${date})\nИзменение: ${delta}`,
  weight_saved_first: (weight: string, date: string) =>
    `✅ Сохранено: ${weight} кг (${date})\n🎉 Первая запись!`,
  weight_updated: (weight: string, date: string, delta: string) =>
    `✏️ Обновлено: ${weight} кг (${date})\nИзменение: ${delta}`,
  weight_updated_no_delta: (weight: string, date: string) =>
    `✏️ Обновлено: ${weight} кг (${date})`,

  // Group messages (delta only, no absolute weights)
  group_delta: (name: string, delta: string) => `${name}: ${delta}`,
  group_first_entry: (name: string) => `${name}: первая запись 🎉`,
  group_updated: (name: string, delta: string) => `${name}: ${delta} (обновлено)`,
  group_updated_no_delta: (name: string) => `${name}: запись обновлена`,

  // Edit flow
  ask_edit_weight: (date: string, weight: string) =>
    `📝 Отправь новый вес для записи ${date} (сейчас: ${weight} кг)`,
  no_entries_to_edit: "❌ Нет записей для редактирования",

  // History & Progress
  history_header: (count: number) => `📊 Последние ${count} записей:\n`,
  history_empty: "📭 Записей пока нет. Отправь свой первый вес!",
  
  progress_header: (days: number) => `Прогресс за ${days} дней\n`,
  progress_last_entry: (date: string, weight: string) =>
    `📍 Последняя запись: ${date} — ${weight} кг`,
  progress_day_delta: (delta: string) => `Сегодня: Δ ${delta}`,
  progress_period_delta: (delta: string) => `За период: Δ ${delta}`,
  progress_streak: (days: number) => `🔥 Без пропусков: ${days} дней`,
  progress_checkins: (count: number, total: number) => `Отметок: ${count}/${total}`,
  progress_min_max: (min: string, max: string) => `мин ${min} — макс ${max}`,
  progress_not_today: "⚠️ Сегодня не отмечался",

  // /me command
  me_last_weight: (weight: string, date: string) =>
    `📍 Последний вес: ${weight} кг (${date})`,
  me_delta: (delta: string, date: string) =>
    `Изменение: ${delta} с ${date}`,
  me_no_records: "📭 Записей пока нет. Отправь свой первый вес!",

  // Status (owner only)
  status_with_group: (groupId: string) =>
    `⚙️ Статус бота:\nПривязанная группа: ${groupId}`,
  status_no_group: "⚙️ Статус бота:\nГруппа не привязана",
  group_configured: "✅ Группа привязана!",
  group_configured_with_link: (link: string) =>
    `✅ Группа привязана!

📢 Ребята, чтобы получать напоминалки и вносить вес, откройте бота в личке и нажмите Start:
${link}`,
  group_configured_no_link: `✅ Группа привязана!

📢 Ребята, чтобы получать напоминалки и вносить вес, найдите бота и нажмите Start.`,
  bot_username_set: (username: string) =>
    `✅ Username бота сохранён: @${username}`,
  bot_username_usage: "Использование: /setbotusername <username>\nПример: /setbotusername weight_tracker_bot",

  // Errors & validation
  invalid_weight: (min: number, max: number) =>
    `❌ Неверный вес. Укажи число от ${min} до ${max} кг.`,
  owner_only: "🔒 Эта команда доступна только владельцу бота.",
  private_only: "💬 Эта команда работает только в личном чате.",
  must_be_in_group: "👥 Эту команду нужно использовать в группе.",
  action_cancelled: "❌ Действие отменено.",
  rate_limited: "Слишком часто 😅 Подожди минутку и попробуй снова.",

  // Debug (owner only)
  debug_usage: "Использование: /debug_addday <смещение> <вес>\nПример: /debug_addday -2 85.5",
  debug_invalid_offset: "❌ Неверное смещение. Укажи целое число (например: -2, -1, 0).",
  debug_inserted: (weight: string, date: string, delta: string) =>
    `🔧 [DEBUG] Добавлено: ${weight} кг (${date})\nИзменение: ${delta}`,
  debug_inserted_first: (weight: string, date: string) =>
    `🔧 [DEBUG] Добавлено: ${weight} кг (${date}). Первая запись.`,

  // Daily report
  report_daily_header: "📊 Отчёт за сегодня:\n",
  report_daily_line: (name: string, dayDelta: string, totalDelta: string) =>
    `• ${name}: сегодня ${dayDelta} | всего ${totalDelta}`,
  report_daily_first: (name: string) =>
    `• ${name}: первая запись | всего —`,
  report_daily_no_prev: (name: string, totalDelta: string) =>
    `• ${name}: сегодня — | всего ${totalDelta}`,
  report_no_entries_today: "📭 Сегодня никто не отметился.",

  // Weekly report
  report_weekly_header: "📈 Итоги недели:\n",
  report_weekly_line: (name: string, weekDelta: string, totalDelta: string, checkins: number) =>
    `• ${name}: неделя ${weekDelta} | всего ${totalDelta} (${checkins}/7)`,
  report_weekly_no_week: (name: string, totalDelta: string, checkins: number) =>
    `• ${name}: неделя — | всего ${totalDelta} (${checkins}/7)`,
  report_no_entries_week: "📭 На этой неделе никто не отмечался.",

  // Common
  no_data: "—",
};

export function formatDeltaRu(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} кг`;
}
