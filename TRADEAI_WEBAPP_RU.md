# TradeAI Web App: запуск, бэкенд, push и деплой на Render

## Что уже готово

Проект работает как PWA web app с рабочим Node.js-бэкендом.

Внутри уже есть:

- регистрация и вход
- хранение пользователей и настроек
- реальные рыночные данные
- генерация сигналов
- push-уведомления
- SQLite-база
- готовый `render.yaml` для Render

## Откуда берутся реальные данные

Сейчас используются:

- crypto: Binance public klines
- forex: Frankfurter / ECB rates

Сервер регулярно обновляет snapshot рынка и раз в `75` секунд запускает push-loop.
Если сигнал не проходит порог уверенности, он не показывается пользователю.

## Как запустить локально

1. Откройте папку проекта:

```powershell
cd "C:\Users\prost\Documents\New project"
```

2. Установите зависимости:

```powershell
npm install
```

3. Запустите сервер:

```powershell
npm run render:start
```

4. Откройте приложение:

```text
http://localhost:4173
```

Проверка health:

```text
http://localhost:4173/api/health
```

## Переменные окружения

Минимально нужны:

```env
HOST=0.0.0.0
PORT=10000
TRADE_AI_DATA_DIR=/var/data/trade-ai
TRADE_AI_VAPID_SUBJECT=mailto:hello@trade-ai.app
```

Пример лежит в файле:

- [render.tradeai.env.example](/C:/Users/prost/Documents/New%20project/render.tradeai.env.example)

## Как задеплоить на Render

1. Залейте актуальную ветку в GitHub.
2. В Render нажмите `New +`.
3. Выберите `Blueprint` или `Web Service`.
4. Подключите репозиторий `traid-ai`.
5. Убедитесь, что Render использует файл [render.yaml](/C:/Users/prost/Documents/New%20project/render.yaml).
6. Проверьте, что сервис создаётся как:
   - type: `web`
   - runtime: `node`
   - plan: `starter`
   - region: `frankfurt`
7. Проверьте `Start Command`:

```text
npm run render:start
```

8. Добавьте persistent disk:
   - mount path: `/var/data`
   - size: `1 GB`
9. Добавьте env vars из файла `render.tradeai.env.example`.
10. Дождитесь статуса `Live`.

После деплоя проверьте:

- `/api/health`
- регистрацию пользователя
- загрузку dashboard
- включение уведомлений

## Как включить push на iPhone

Push на iPhone для web app работает только если приложение установлено на экран Домой из Safari.

Порядок:

1. Откройте сайт в Safari.
2. Нажмите `Share`.
3. Выберите `Add to Home Screen`.
4. Запустите TradeAI уже с иконки на домашнем экране.
5. Зарегистрируйтесь или войдите.
6. Включите уведомления в приложении.
7. Разрешите push, когда iPhone покажет системное окно.

После этого сильные сигналы будут приходить как обычные web push уведомления.

## Где хранится база

Локально:

- `data/trade-ai.db`

На Render:

- `/var/data/trade-ai/trade-ai.db`

Поэтому persistent disk обязателен, иначе пользователи, push-подписки и история могут потеряться после рестарта.

## Если сигналы временно пустые

Это не всегда ошибка.

Причины:

- рынок не дал достаточно сильный сетап
- провайдер данных временно недоступен
- confidence ниже порога
- пара попала в `no trade zone`

Бэкенд настроен так, чтобы не обещать гарантированную прибыль и не показывать слабые сигналы как надёжные.

## Важные файлы

- [server.mjs](/C:/Users/prost/Documents/New%20project/server.mjs)
- [backend/engine.mjs](/C:/Users/prost/Documents/New%20project/backend/engine.mjs)
- [backend/push.mjs](/C:/Users/prost/Documents/New%20project/backend/push.mjs)
- [backend/store.mjs](/C:/Users/prost/Documents/New%20project/backend/store.mjs)
- [render.yaml](/C:/Users/prost/Documents/New%20project/render.yaml)
- [TRADEAI_RENDER_DEPLOY.md](/C:/Users/prost/Documents/New%20project/TRADEAI_RENDER_DEPLOY.md)
