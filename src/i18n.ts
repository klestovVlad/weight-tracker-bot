/** 1 день | 2,3,4 дня | 0,5-20,... дней */
function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

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
  btn_frequency: "📅 Частота взвешивания",
  btn_leaderboard: "🏆 Лидерборд",
  btn_achievements: "🏅 Мои ачивки",
  btn_back: "⬅️ Назад",
  btn_status: "⚙️ Статус",
  btn_setgroup: "👥 Привязать группу",
  btn_admin: "🛠 Админ",

  // Admin menu
  admin_menu_title: "🛠 Панель администратора",
  btn_admin_day_status: "📋 Статус дня",
  btn_admin_send_report: "📣 Отправить отчёт",
  btn_admin_debug_meme: "🔧 Тест мем",
  debug_meme_ask: "Введи дельту в кг (число, например -1.9 или 0.5):",
  debug_meme_sending: "Генерирую картинку…",
  debug_meme_failed: "Не удалось сгенерировать изображение. Проверь OPENAI_API_KEY и лимиты DALL-E.",
  debug_meme_sent: (object: string) => `Мем: «${object}»`,
  admin_day_status_title: (date: string) => `📋 Статус дня — ${date}`,
  admin_checked_in: (count: number) => `✅ Отметились (${count}):`,
  admin_not_checked: (count: number) => `🙈 Не отметились (${count}):`,
  admin_on_vacation: (count: number) => `🌴 В отпуске (${count}):`,
  admin_with_goal: (count: number) => `🎯 С целью (${count}):`,
  admin_nobody: "—",
  admin_report_dest_title: "📣 Куда отправить отчёт?",
  btn_report_dest_group: "👥 В группу",
  btn_report_dest_chat: "💬 В чат",
  admin_report_menu_title: "📣 Выбери тип отчёта:",
  btn_report_daily: "📊 Daily",
  btn_report_weekly: "📅 Weekly",
  btn_report_monthly: "🗓 Monthly",
  admin_report_sent: (type: string) => `✅ Отправила ${type} отчёт в группу`,
  admin_report_sent_chat: (type: string) => `✅ Отправила ${type} отчёт в этот чат`,
  admin_report_cooldown: "⏳ Подожди минутку перед повторной отправкой",
  admin_group_not_set: "❌ Группа не привязана. Используй /setgroup в группе.",

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

  // Weigh-in frequency
  frequency_pick: "📅 Как часто напоминать о взвешивании?",
  frequency_daily: "Ежедневно",
  frequency_weekly: "Еженедельно (воскресенье)",
  frequency_set_daily: "Ок 🙂 Напоминалки будут каждый день. Ты участвуешь в дневном отчёте.",
  frequency_set_weekly: "Ок 🙂 Напоминалка раз в неделю (воскресенье). В дневном отчёте не участвуешь.",

  // Leaderboard
  leaderboard_pick: "🏆 Какой лидерборд показать?",
  leaderboard_week_delta_title: "🏆 Лидерборд недели (по изменению)",
  leaderboard_checkins_title: "🏆 Лидерборд регулярности (7 дней)",
  leaderboard_line_delta: (pos: number, name: string, delta: string, checkins: number) =>
    `${pos}) ${name}: ${delta} (${checkins}/7)`,
  leaderboard_line_checkins: (pos: number, name: string, checkins: number, streak: number) =>
    `${pos}) ${name}: ${checkins}/7 • без пропусков ${streak}`,
  leaderboard_no_data: "Нет данных за эту неделю.",

  // Admin reset
  reset_confirm: "⚠️ Это удалит ВСЕ записи веса у ВСЕХ пользователей!\n\nДля подтверждения нажми кнопку ниже.",
  reset_done: (count: number) => `✅ Удалено ${count} записей веса.`,
  reset_cancelled: "❌ Отменено.",
  btn_confirm_reset: "🗑️ Да, удалить всё",
  btn_cancel_reset: "❌ Отмена",

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
  
  progress_header: (days: number) => `Прогресс за ${days} ${pluralDays(days)}\n`,
  progress_last_entry: (date: string, weight: string) =>
    `📍 Последняя запись: ${date} — ${weight} кг`,
  progress_day_delta: (delta: string) => `Сегодня: Δ ${delta}`,
  progress_period_delta: (delta: string) => `За период: Δ ${delta}`,
  progress_streak: (days: number) => `🔥 Без пропусков: ${days} ${pluralDays(days)}`,
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
    `• <b>${name}</b>: сегодня ${dayDelta} | всего ${totalDelta}`,
  report_daily_first: (name: string) =>
    `• <b>${name}</b>: первая запись | всего —`,
  report_daily_no_prev: (name: string, totalDelta: string) =>
    `• <b>${name}</b>: сегодня — | всего ${totalDelta}`,
  report_no_entries_today: "📭 Сегодня никто не отметился.",
  report_achievements_header: "🏅 Новые ачивки сегодня:",
  report_achievement_line: (name: string, icon: string, days: number) =>
    `• <b>${name}</b>: ${icon} ${days} ${pluralDays(days)} подряд`,
  report_broken_header: "💔 Прервали серию:",
  report_broken_line: (name: string, streak: number) =>
    `• <b>${name}</b> прервал серию из ${streak} ${pluralDays(streak)}`,
  report_heroes_header: "🏆 Герой недели:",
  report_hero_line: (name: string, weekDelta: string, checkins: number) =>
    `• <b>${name}</b> — ${weekDelta} (${checkins}/7)`,

  // Weekly report
  report_weekly_header: "📈 Итоги недели:\n",
  report_weekly_line: (name: string, weekDelta: string, totalDelta: string, checkins: number) =>
    `• <b>${name}</b>: неделя ${weekDelta} | всего ${totalDelta} (${checkins}/7)`,
  report_weekly_no_week: (name: string, totalDelta: string, checkins: number) =>
    `• <b>${name}</b>: неделя — | всего ${totalDelta} (${checkins}/7)`,
  report_no_entries_week: "📭 На этой неделе никто не отмечался.",

  // Monthly report
  report_monthly_header: "📅 Итоги месяца:\n",
  report_monthly_line: (name: string, monthDelta: string, checkins: number, totalDelta: string) =>
    `• <b>${name}</b>: месяц ${monthDelta} (${checkins} отм.) | всего ${totalDelta}`,
  report_monthly_no_delta: (name: string, checkins: number, totalDelta: string) =>
    `• <b>${name}</b>: месяц — (${checkins} отм.) | всего ${totalDelta}`,
  report_no_entries_month: "📭 В этом месяце никто не отмечался.",

  // Goal
  btn_goal: "🎯 Цель",
  goal_menu_title: "🎯 Управление целью",
  btn_goal_set: "➕ Установить цель",
  btn_goal_edit: "✏️ Изменить цель",
  btn_goal_delete: "🗑️ Удалить цель",
  goal_ask_target: "Введи целевой вес (например: 75.0):",
  goal_need_weight_first: "Сначала внеси хотя бы один замер 🙂",
  goal_saved: "🎯 Цель сохранена!",
  goal_current: (target: string, current: string) =>
    `🎯 Цель: ${target} кг\n📍 Сейчас: ${current} кг\n`,
  goal_progress: (percent: number, bar: string, remaining: number) =>
    `Прогресс: ${percent}% ${bar}\nДо цели: ${remaining} кг`,
  goal_reached: "🎯 Цель достигнута! 🎉",
  goal_deleted: "Цель удалена ✅",
  goal_not_set: "У тебя пока нет цели. Хочешь установить?",
  goal_same_as_start: "Цель совпадает со стартом — уже достигнута! 🎉",
  goal_snippet: (remaining: number, percent: number) =>
    `🎯 до цели ${remaining} кг (${percent}%)`,
  goal_snippet_reached: "🎯 цель достигнута ✅",

  // Report command
  report_group_not_set: "Группа не привязана. Используй /setgroup в группе.",
  report_cooldown: "Подожди минутку перед следующим отчётом.",
  report_sent: "Отчёт отправлен в группу ✅",
  report_usage: "Использование: /report daily | weekly | monthly",

  // Achievements (personal screen)
  achievements_title: "🏅 Твои достижения",
  achievements_streak: (days: number, icon: string) =>
    `Текущий стрик: ${days} ${pluralDays(days)} ${icon}`,
  achievements_next: (icon: string, days: number, left: number) =>
    `До следующего уровня (${icon} ${days} ${pluralDays(days)}) осталось: ${left} ${pluralDays(left)}`,
  achievements_level_done: (icon: string, days: number) =>
    `${icon} ${days} ${pluralDays(days)} — достигнуто`,
  achievements_level_in_progress: (icon: string, days: number) =>
    `${icon} ${days} ${pluralDays(days)} — в процессе`,
  achievements_start: (left: number) =>
    `Начало положено 🙂 До первой ачивки (🔹 3 ${pluralDays(3)}) осталось: ${left} ${pluralDays(left)}`,
  achievements_legend: "Ты легенда 👑 Стрик 90+ дней!",
  achievements_history_title: "История уровней:",

  // Common
  no_data: "—",
};

export function formatDeltaRu(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} кг`;
}
