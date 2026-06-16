# Finora

Finora — iPhone-first PWA для личных и семейных финансов с тёмным Apple-style интерфейсом, нижней навигацией, статистикой, семейными расходами, целями накопления, импортом/экспортом и PIN-кодом.

## Что внутри

- `React + TypeScript + Vite + Tailwind CSS + Framer Motion + Lucide React`
- `Express + TypeScript`
- `SQLite` как локальный рабочий движок
- `Postgres snapshot sync` для Render Free: если задан `DATABASE_URL`, состояние автоматически сохраняется в Postgres после каждой мутации и восстанавливается на старте
- `PWA`: manifest, service worker, standalone launch
- `iPhone-first` layout с safe-area и адаптированной нижней навигацией

## Функции

- доходы и расходы
- история операций с фильтрами и поиском
- статистика за день, неделю, месяц и год
- семейные участники
- цели накопления
- лимиты бюджета по категориям
- быстрые шаблоны расходов
- экспорт `JSON` и `CSV`
- импорт `JSON`
- PIN-код с хэшированием
- ручной безопасный сброс статистики

## Локальный запуск

```bash
npm install
npm run dev
```

- клиент: `http://localhost:5173`
- API: `http://localhost:3001`

Продакшн-сборка:

```bash
npm run build
npm start
```

## Переменные окружения

Смотрите [.env.example](/C:/Users/prost/Documents/New%20project/finance-pwa/.env.example).

- `PORT` — порт Express-сервера
- `DATABASE_PATH` — путь к локальной SQLite-базе
- `DATABASE_URL` — опциональный Postgres URL для durable snapshot sync
- `SESSION_SECRET` — секрет для PIN-session токенов
- `PGSSL` — установите `true`, если ваш Postgres требует SSL

## Как работает хранение

### Локально

По умолчанию Finora хранит рабочие данные в SQLite-файле по `DATABASE_PATH`.

### Render Free

У Render Free веб-сервисов файловая система эфемерная, поэтому для надёжного хранения в этом проекте используется схема:

1. приложение работает на локальной SQLite в `/tmp/finance.sqlite`
2. после каждого изменения полное состояние сохраняется в Render Postgres
3. при следующем старте состояние автоматически восстанавливается из Postgres

Это позволяет не зависеть от эфемерной файловой системы free web service.

## Деплой на Render

### Вариант 1: через Blueprint

В репозитории есть [render.yaml](/C:/Users/prost/Documents/New%20project/finance-pwa/render.yaml).

Если ваш основной репозиторий содержит несколько проектов, при создании Blueprint укажите путь к файлу `finance-pwa/render.yaml`.

### Вариант 2: вручную через Dashboard

1. Создайте `Postgres`-базу Render.
2. Создайте `Web Service`.
3. Укажите:
   - Root Directory: `finance-pwa`
   - Runtime: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Добавьте переменные окружения:
   - `DATABASE_PATH=/tmp/finance.sqlite`
   - `DATABASE_URL=<Render Postgres connection string>`
   - `SESSION_SECRET=<любой длинный секрет>`
5. Если используете внешний Postgres URL с обязательным SSL, добавьте `PGSSL=true`.

## Важное замечание по Render

- Без `DATABASE_URL` приложение продолжит работать, но на Render Free данные в локальном SQLite не переживут рестарт контейнера.
- С `DATABASE_URL` включается snapshot sync в Postgres, и состояние восстанавливается после рестартов.
- Если вы используете платный Render persistent disk, можно хранить SQLite и напрямую на диске.

## Структура проекта

- `src/` — клиентское приложение
- `server/` — Express API и finance-логика
- `public/` — PWA assets и service worker
- `render.yaml` — Render blueprint

## Проверка перед отдачей

- production build проходит: `npm run build`
- `GET /api/health` отвечает `200`
- мобильный UI проверен в in-app браузере на viewport `390x844`
## Google Auth

Чтобы включить регистрацию и вход через Google:

1. Создайте `OAuth 2.0 Client ID` в Google Cloud Console.
2. Добавьте `Authorized redirect URI`:
   - локально: `http://localhost:3001/api/auth/google/callback`
   - на Render: `https://<your-service>.onrender.com/api/auth/google/callback`
3. Задайте переменные окружения:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`

Если `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` не заданы, приложение продолжит работать без обязательного Google-входа.
