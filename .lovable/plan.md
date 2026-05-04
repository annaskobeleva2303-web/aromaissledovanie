## Цель

Обновить аналитические функции (НЕ трогая `generate-insight`), создать функцию итогового мета-отчёта по маслу, добавить автоматизацию и UI.

---

## 1. База данных (миграция)

Создать таблицу `group_reports` для хранения двух типов групповых отчётов (недельный и итоговый), отдельно от `group_trends`:

```
group_reports
- id, oil_id, report_type ('weekly' | 'final'), period_start, period_end
- report_text, created_at, generated_by (uuid|null)
- unique(oil_id, report_type, period_start)
```

RLS:
- `Users can view reports` — `has_oil_access(uid, oil_id)`
- `Admins can manage reports` — `has_role(uid, 'admin')`

(Сохраняем существующую `group_trends` для обратной совместимости, но новые недельные отчёты пишем уже в `group_reports`. Чтение в UI — объединённое.)

---

## 2. Edge функции

### `generate-personal-summary` (обновить)
- Persona Davana уже стоит — оставить, поднять `max_tokens` до 4096.
- Структура промпта: «Алхимический образ недели» + глубокий коучинговый вопрос (уже близко — уточнить формулировку).
- Sanitize уже есть.
- Модель: `anthropic/claude-sonnet-4-6` через ProxyAPI (уже).
- Soft-fallback: при ошибке/пустом ответе — один retry, потом уведомление админа в `notifications` (для всех админов).

### `generate-group-trends` (обновить)
- **Фильтр `is_public = true`** — добавить в выборку entries.
- Sanitize уже есть.
- `max_tokens` 3000 → **4096**.
- Писать результат в **обе** таблицы: `group_trends` (legacy) и `group_reports` (`report_type='weekly'`).
- После успешной вставки weekly-отчёта: **проверить, не достигли ли 4-го отчёта** по этому маслу. Если да и финального ещё нет за этот цикл — вызвать `generate-final-report` (внутренним fetch с service-role JWT) для этого `oil_id`.
- Soft-fallback при пустом ответе.

### `generate-final-report` (новая)
- Принимает `{ oilId }`, требует admin или service-role.
- Берёт **последние 4 weekly-отчёта** по маслу из `group_reports` (`report_type='weekly'`, по `period_start desc`).
- Если их меньше 4 — возвращает `not_ready`.
- Шлёт в Claude **тексты этих 4 отчётов** (мета-анализ, не сырые транскрипты).
- Persona: Davana, финальный научный вывод об арке трансформации (заземление → раскрытие → углубление → интеграция).
- `max_tokens: 4096`.
- Сохраняет в `group_reports` с `report_type='final'`, `period_start`=начало 1-й недели, `period_end`=конец 4-й.
- Уведомления всем участникам с доступом к маслу.
- Soft-fallback на ошибку.

### Cron
- Еженедельно (`pg_cron`) — `generate-group-trends` (понедельник 06:00 UTC).
- (`generate-personal-summary` оставить как есть, если уже по расписанию.)

---

## 3. UI

### `AdminCodePanel` — новая секция «Групповые отчёты»
- Селект масла + два кнопки:
  - «Сформировать недельный отчёт» → `generate-group-trends` (по выбранному маслу через query param/body).
  - «Сформировать итоговый отчёт» → `generate-final-report` с `oilId`.
- Toast о статусе.

### `GroupField` — лента отчётов
- Заменить блок `group_trends` на объединённую ленту из `group_reports`:
  - Бейдж типа: «Неделя N» / «Итог цикла».
  - Финальный отчёт визуально выделить (золотая рамка/glow).
  - Карусель/архив с навигацией по неделям + закреплённый итоговый.
- Если итоговый есть — показывать первым/закреплённым сверху.

---

## 4. Технические детали

- Все три аналитические функции используют один и тот же блок Davana persona (вынести в строковую константу внутри файла каждой функции — дублирование ок, чтобы не делать shared-модуль).
- Soft-fallback паттерн:
  ```ts
  let aiResponse = await callAI(model);
  if (!aiResponse.ok || !content) {
    aiResponse = await callAI(model); // 1 retry
  }
  if (!ok) notify admins
  ```
- Защита от двойного запуска `generate-final-report`: проверка существования финального отчёта с тем же `period_start`.
- Триггер финала из `generate-group-trends` делается асинхронно (fire-and-forget) — не блокирует ответ.

---

## 5. Порядок работ

1. Миграция `group_reports` (с RLS).
2. Обновить `generate-personal-summary` (max_tokens, fallback, формулировка).
3. Обновить `generate-group-trends` (is_public, dual-write, авто-триггер финала).
4. Создать `generate-final-report`.
5. Cron job (если ещё нет для group-trends).
6. UI: AdminCodePanel — секция отчётов.
7. UI: GroupField — лента `group_reports`.
8. Деплой всех функций.

После шага 1 (миграция) жду подтверждения, потом иду по порядку без остановок.
