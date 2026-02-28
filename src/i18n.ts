export const RU = {
  // Welcome & Menu
  welcome: `👋 Привет! Я помогу отслеживать твой вес.

Отправь вес в личном чате:
• 87.4 или 87,4
• вес 87.4
• /w 87.4

Или используй кнопки ниже 👇`,

  // Buttons
  btn_enter_weight: "✅ Внести вес",
  btn_history_7: "📈 7 дней",
  btn_history_30: "📅 30 дней",
  btn_edit_last: "✏️ Изменить",
  btn_status: "⚙️ Статус",
  btn_setgroup: "👥 Привязать группу",
  btn_debug_daily: "🔧 Дневной отчёт",
  btn_debug_weekly: "🔧 Недельный отчёт",

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

  // History
  history_header: (count: number) => `📊 Последние ${count} записей:\n`,
  history_empty: "📭 Записей пока нет. Отправь свой первый вес!",

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

  // Errors & validation
  invalid_weight: (min: number, max: number) =>
    `❌ Неверный вес. Укажи число от ${min} до ${max} кг.`,
  owner_only: "🔒 Эта команда доступна только владельцу бота.",
  private_only: "💬 Эта команда работает только в личном чате.",
  must_be_in_group: "👥 Эту команду нужно использовать в группе.",
  action_cancelled: "❌ Действие отменено.",

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
