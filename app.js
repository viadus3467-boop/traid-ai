const STORAGE_KEYS = {
  introSeen: "trade-ai-intro-seen",
  token: "trade-ai-token",
  language: "trade-ai-language",
  theme: "trade-ai-theme",
  notifications: "trade-ai-notifications",
  sounds: "trade-ai-sounds",
  signalLimit: "trade-ai-signal-limit",
  apiBase: "trade-ai-api-base",
  tradeCapital: "trade-ai-trade-capital",
};

const API_BASE_URL = String(window.TRADE_AI_API_BASE || localStorage.getItem(STORAGE_KEYS.apiBase) || "").replace(/\/$/, "");
const LIVE_REFRESH_MS = 60_000;

const translations = {
  ru: {
    appName: "Trade Ai",
    brandLine: "AI trading product",
    intro: [
      {
        title: "Только сильные сигналы",
        body: "Приложение показывает LONG и SHORT только при сильном совпадении фильтров.",
      },
      {
        title: "Понятные входы",
        body: "В каждом сигнале есть вход, тейк, стоп, уверенность AI и причина.",
      },
      {
        title: "FREE и PLUS",
        body: "FREE: до 2 сигналов в час. PLUS: до 10 сигналов в час и активация через промокод.",
      },
      {
        title: "Без финансовых советов",
        body: "Trade Ai не гарантирует прибыль. Торговля всегда связана с риском.",
      },
    ],
    auth: {
      title: "Вход в Trade Ai",
      subtitle: "Регистрация и вход через backend",
      login: "Вход",
      register: "Регистрация",
      google: "Продолжить с Google",
      apple: "Продолжить с Apple / iCloud",
      or: "или",
      name: "Имя",
      email: "Email",
      password: "Пароль",
      submitLogin: "Войти",
      submitRegister: "Создать аккаунт",
      invalid: "Проверьте email и пароль.",
      registerOk: "Аккаунт создан.",
      loginOk: "Вход выполнен.",
    },
    nav: {
      home: "Главная",
      market: "Рынок",
      filters: "Фильтры",
      settings: "Настройки",
    },
    home: {
      title: "Сигналы",
      bestSetup: "Лучший сетап",
      noSignals: "Сильных сигналов сейчас нет",
      noSignalsCopy: "AI пропускает шум и ждёт подтверждений.",
      limit: "Лимит",
      mood: "Настроение рынка",
      viewMarket: "Смотреть рынок",
      plusCopy: "До 10 сигналов в час, выбор пар и приоритетные уведомления.",
      notificationsTitle: "Включите сигнальные уведомления",
      notificationsCopy: "Откройте настройки и включите уведомления, чтобы сильные LONG и SHORT сигналы приходили вовремя.",
      notificationsButton: "Открыть уведомления",
    },
    market: {
      title: "Рынок в реальном времени",
      filtered: "Выбрана пара",
      clearFilter: "Показать все пары",
      watchPair: "Открыть пару",
      mood: "Режим",
      trend: "Тренд",
      volatility: "Волатильность",
      status: "Статус",
      price: "Цена",
      ready: "Сигнал готов",
      forming: "Формируется",
      waiting: "Ожидание",
      opportunity: "Opportunity",
      calm: "Calm",
      volatile: "Volatile",
      dangerous: "Dangerous",
    },
    signal: {
      long: "LONG",
      short: "SHORT",
      entry: "Вход",
      takeProfit: "Тейк",
      stopLoss: "Стоп",
      confidence: "AI Confidence",
      time: "Время",
      life: "Срок",
      strong: "Сильный сигнал",
      medium: "Средний сигнал",
      weak: "Слабый сигнал",
    },
    settings: {
      title: "Настройки",
      account: "Аккаунт",
      language: "Язык",
      theme: "Тема",
      notifications: "Уведомления",
      sounds: "Звуки",
      subscription: "Подписка",
      signalLimit: "Лимит сигналов",
      dark: "Тёмная",
      light: "Светлая",
      ru: "Русский",
      en: "English",
      on: "Включено",
      off: "Выключено",
      plus: "PLUS",
      free: "FREE",
      price: "$20 / month",
      buy: "Попробовать бесплатно 7 дней",
      paymentTitle: "Способ оплаты",
      payStore: "App Store / Google Play",
      payCard: "Запустить trial 7 дней (карта обязательна)",
      payCrypto: "USDT TRC20 Invoice",
      paymentClose: "Закрыть",
      trialNote: "После 7 дней подписка PLUS продлевается автоматически: $20/месяц.",
      onboarding: "Ознакомление",
      showIntro: "Показать снова",
      logout: "Выйти",
      promoTitle: "Промокод PLUS",
      promoPlaceholder: "Введите промокод",
      promoButton: "Активировать PLUS",
      promoHint: "Чтобы включить PLUS навсегда бесплатно, введите промокод ниже.",
      promoForever: "PLUS активирован навсегда.",
      installTitle: "Установить на iPhone",
      installLead: "Без Mac приложение можно запустить как Web App через Safari на iPhone.",
      installStepOne: "1. Откройте этот сайт на iPhone именно в Safari.",
      installStepTwo: "2. Нажмите Поделиться и выберите «Добавить на экран Домой».",
      installStepThree: "3. Включите «Open as Web App», затем нажмите «Добавить».",
      installReady: "Приложение уже открыто как Web App.",
      legalTitle: "Конфиденциальность и ответственность",
      legalLead: "Мы сохраняем только данные, которые нужны для работы аккаунта, настроек и подписки.",
      legalData: "Имя, email, настройки, статус подписки и история сигналов используются только для доступа к сервису и персонализации.",
      legalSignals: "Trade Ai показывает аналитические LONG/SHORT сигналы и рыночные сценарии, но не управляет вашими сделками и не обещает результат.",
      legalPayments: "Доступ к PLUS в этой версии включается только промокодом. Платёжные данные здесь не запрашиваются.",
      legalWarning: "Мы не несем ответственность за ваши деньги, сделки, убытки, ликвидации или любую торговую активность. Приложение предоставляет только аналитические сигналы и не является финансовой рекомендацией.",
    },
    actions: {
      next: "Далее",
      back: "Назад",
      skip: "Пропустить",
      start: "Начать",
      enable: "Включить",
      disable: "Выключить",
    },
    misc: {
      risk: "Trade Ai does not provide financial advice. Trading involves risk.",
      languageUpdated: "Язык обновлён.",
      themeUpdated: "Тема обновлена.",
      notificationsOn: "Уведомления включены.",
      notificationsOff: "Уведомления выключены.",
      soundsOn: "Звук включён.",
      soundsOff: "Звук выключен.",
      planUpgraded: "PLUS активирован.",
      promoActivated: "Промокод принят. PLUS включен навсегда.",
      promoInvalid: "Неверный промокод. PLUS не активирован.",
      logout: "Вы вышли из аккаунта.",
      pairOpened: "Открыт рынок по выбранной паре.",
      signalLimitUpdated: "Лимит сигналов обновлён.",
      checkoutRedirect: "Открываю защищённый checkout...",
      cryptoReady: "Инвойс готов. Оплатите по адресу ниже.",
      trialStarted: "На следующем экране нужно привязать карту для 7-дневного trial.",
      storeBillingInfo: "Для публикации в App Store и Google Play используйте встроенные подписки магазинов.",
      apiError: "Ошибка сервера. Повторите чуть позже.",
      sessionRequired: "Сессия завершена. Войдите снова.",
      oauthRedirect: "Открываю внешний вход...",
    },
  },
  en: {
    appName: "Trade Ai",
    brandLine: "AI trading product",
    intro: [
      {
        title: "Only strong signals",
        body: "The app shows LONG and SHORT only when filters align strongly.",
      },
      {
        title: "Clear execution blocks",
        body: "Each signal has entry, take profit, stop loss, AI confidence, and reason.",
      },
      {
        title: "FREE and PLUS",
        body: "FREE: up to 2 signals per hour. PLUS: up to 10 signals per hour and activation by promo code.",
      },
      {
        title: "No financial advice",
        body: "Trade Ai does not guarantee profit. Trading always involves risk.",
      },
    ],
    auth: {
      title: "Welcome to Trade Ai",
      subtitle: "Register or log in using backend account",
      login: "Log In",
      register: "Register",
      google: "Continue with Google",
      apple: "Continue with Apple / iCloud",
      or: "or",
      name: "Name",
      email: "Email",
      password: "Password",
      submitLogin: "Log In",
      submitRegister: "Create account",
      invalid: "Please check email and password.",
      registerOk: "Account created.",
      loginOk: "Logged in successfully.",
    },
    nav: {
      home: "Home",
      market: "Market",
      filters: "Filters",
      settings: "Settings",
    },
    home: {
      title: "Signals",
      bestSetup: "Best setup",
      noSignals: "No strong signals now",
      noSignalsCopy: "AI is filtering noise and waiting for confirmation.",
      limit: "Limit",
      mood: "Market mood",
      viewMarket: "View market",
      plusCopy: "Up to 10 signals per hour, pair selection, and priority notifications.",
      notificationsTitle: "Turn on signal notifications",
      notificationsCopy: "Open settings and enable notifications so strong LONG and SHORT signals reach you on time.",
      notificationsButton: "Open notifications",
    },
    market: {
      title: "Real-time market",
      filtered: "Selected pair",
      clearFilter: "Show all pairs",
      watchPair: "Open pair",
      mood: "Mood",
      trend: "Trend",
      volatility: "Volatility",
      status: "Status",
      price: "Price",
      ready: "Signal ready",
      forming: "Forming",
      waiting: "Waiting",
      opportunity: "Opportunity",
      calm: "Calm",
      volatile: "Volatile",
      dangerous: "Dangerous",
    },
    signal: {
      long: "LONG",
      short: "SHORT",
      entry: "Entry",
      takeProfit: "Take Profit",
      stopLoss: "Stop Loss",
      confidence: "AI Confidence",
      time: "Time",
      life: "Lifetime",
      strong: "Strong signal",
      medium: "Medium signal",
      weak: "Weak signal",
    },
    settings: {
      title: "Settings",
      account: "Account",
      language: "Language",
      theme: "Theme",
      notifications: "Notifications",
      sounds: "Sounds",
      subscription: "Subscription",
      signalLimit: "Signal limit",
      dark: "Dark",
      light: "Light",
      ru: "Русский",
      en: "English",
      on: "On",
      off: "Off",
      plus: "PLUS",
      free: "FREE",
      price: "$20 / month",
      buy: "Try 7 days free",
      paymentTitle: "Payment method",
      payStore: "App Store / Google Play",
      payCard: "Start 7-day trial (card required)",
      payCrypto: "USDT TRC20 Invoice",
      paymentClose: "Close",
      trialNote: "After 7 days, PLUS subscription renews automatically at $20/month.",
      onboarding: "Onboarding",
      showIntro: "Show again",
      logout: "Log out",
      promoTitle: "PLUS promo code",
      promoPlaceholder: "Enter promo code",
      promoButton: "Activate PLUS",
      promoHint: "To unlock PLUS for free forever, enter the promo code below.",
      promoForever: "PLUS is activated forever.",
      installTitle: "Install on iPhone",
      installLead: "Without a Mac, the app can run as a Web App through Safari on iPhone.",
      installStepOne: "1. Open this website on iPhone specifically in Safari.",
      installStepTwo: "2. Tap Share and choose Add to Home Screen.",
      installStepThree: "3. Turn on Open as Web App, then tap Add.",
      installReady: "The app is already running as a Web App.",
      legalTitle: "Privacy and responsibility",
      legalLead: "We keep only the data required to run your account, settings, and subscription.",
      legalData: "Name, email, settings, subscription status, and signal history are used only to provide access and personalize the service.",
      legalSignals: "Trade Ai shows analytical LONG/SHORT signals and market scenarios, but it does not manage your trades or promise results.",
      legalPayments: "PLUS access in this version is enabled only by promo code. No payment details are requested here.",
      legalWarning: "We are not responsible for your money, trades, losses, liquidations, or any trading activity. The app provides analytical signals only and is not financial advice.",
    },
    actions: {
      next: "Next",
      back: "Back",
      skip: "Skip",
      start: "Start",
      enable: "Enable",
      disable: "Disable",
    },
    misc: {
      risk: "Trade Ai does not provide financial advice. Trading involves risk.",
      languageUpdated: "Language updated.",
      themeUpdated: "Theme updated.",
      notificationsOn: "Notifications enabled.",
      notificationsOff: "Notifications disabled.",
      soundsOn: "Sound enabled.",
      soundsOff: "Sound disabled.",
      planUpgraded: "PLUS activated.",
      promoActivated: "Promo code accepted. PLUS is now active forever.",
      promoInvalid: "Invalid promo code. PLUS was not activated.",
      logout: "You are logged out.",
      pairOpened: "Pair market opened.",
      signalLimitUpdated: "Signal limit updated.",
      checkoutRedirect: "Opening secure checkout...",
      cryptoReady: "Invoice is ready. Pay to the address below.",
      trialStarted: "The next screen asks for a card to start the 7-day trial.",
      storeBillingInfo: "For App Store and Google Play publishing, use built-in store subscriptions.",
      apiError: "Server error. Try again later.",
      sessionRequired: "Session expired. Please log in again.",
      oauthRedirect: "Opening external sign-in...",
    },
  },
};

translations.ru.settings.notificationsHelp = "Откройте Trade Ai с экрана Домой на iPhone и разрешите push-уведомления Safari/Web App.";
translations.ru.settings.testPush = "Тестовый push";
translations.ru.misc.pushLinked = "Это устройство подключено к web push.";
translations.ru.misc.pushTestSent = "Тестовое уведомление отправлено.";
translations.ru.misc.pushUnsupported = "На этом устройстве web push пока не поддерживается.";
translations.ru.misc.pushPermissionBlocked = "Доступ к уведомлениям заблокирован. Разрешите уведомления для Trade Ai в настройках iPhone или Safari.";
translations.ru.misc.pushUnavailable = "Web push пока недоступен. Завершите деплой и повторите попытку.";
translations.en.settings.notificationsHelp = "Open Trade Ai from the iPhone Home Screen and allow Safari/Web App push notifications.";
translations.en.settings.testPush = "Test push";
translations.en.misc.pushLinked = "This device is connected to web push.";
translations.en.misc.pushTestSent = "Test notification sent.";
translations.en.misc.pushUnsupported = "Web push is not supported on this device yet.";
translations.en.misc.pushPermissionBlocked = "Notification access is blocked. Allow notifications for Trade Ai in iPhone or Safari settings.";
translations.en.misc.pushUnavailable = "Web push is not available yet. Finish the deploy and try again.";
translations.ru.misc.oauthSuccess = "Вход выполнен.";
translations.ru.auth.subtitle = "Вход по email, Google и Apple / iCloud.";
translations.en.misc.oauthSuccess = "Signed in successfully.";
translations.en.auth.subtitle = "Sign in with email, Google, or Apple / iCloud.";
Object.assign(translations.ru.home, {
  sessions: "Торговые сессии",
  watchlist: "Watchlist",
  noTradeTitle: "No trade zone",
  noTradeCopy: "Сейчас AI избегает входов по этим парам и показывает причину.",
  historyTitle: "История сигналов",
  historyEmpty: "Новые сигналы появятся здесь, как только они пройдут фильтры.",
  statsWinRate: "Win rate",
  statsOpen: "Открыто",
});
Object.assign(translations.en.home, {
  sessions: "Trading sessions",
  watchlist: "Watchlist",
  noTradeTitle: "No trade zone",
  noTradeCopy: "AI is avoiding entries on these pairs right now and shows the reason.",
  historyTitle: "Signal history",
  historyEmpty: "New signals will appear here once they pass the filters.",
  statsWinRate: "Win rate",
  statsOpen: "Open",
});
Object.assign(translations.ru.market, {
  details: "Детали пары",
  session: "Сессия",
  structure: "Структура",
  support: "Поддержка",
  resistance: "Сопротивление",
  volume: "Объём",
  change: "Изменение",
  summary: "AI Summary",
  noTrade: "No trade zone",
  noTradeReady: "Причина запрета на вход",
  selectHint: "Выберите пару или откройте её из сигнала.",
});
Object.assign(translations.en.market, {
  details: "Pair details",
  session: "Session",
  structure: "Structure",
  support: "Support",
  resistance: "Resistance",
  volume: "Volume",
  change: "Change",
  summary: "AI Summary",
  noTrade: "No trade zone",
  noTradeReady: "Why trading is blocked",
  selectHint: "Select a pair or open it from a signal.",
});
translations.ru.market.no_trade = "No trade zone";
translations.en.market.no_trade = "No trade zone";
Object.assign(translations.ru.settings, {
  sessions: "Сессии",
  sessionsHint: "Оставьте только те сессии, по которым хотите получать сигналы.",
  pairsTitle: "Валютные пары",
  pairsHint: "Отключайте шумные пары и добавляйте важные в watchlist.",
  watch: "В watchlist",
  unwatch: "Убрать",
  enabled: "Включено",
  disabled: "Выключено",
  pushHistory: "История уведомлений",
  pushHistoryEmpty: "Push-уведомления появятся здесь после отправки.",
});
Object.assign(translations.en.settings, {
  sessions: "Sessions",
  sessionsHint: "Keep only the sessions you want to receive signals from.",
  pairsTitle: "Pairs",
  pairsHint: "Disable noisy pairs and add important ones to the watchlist.",
  watch: "Watchlist",
  unwatch: "Remove",
  enabled: "Enabled",
  disabled: "Disabled",
  pushHistory: "Push history",
  pushHistoryEmpty: "Push notifications will appear here after delivery.",
});
Object.assign(translations.ru.misc, {
  pairSettingsUpdated: "Настройки пар обновлены.",
  sessionsUpdated: "Фильтр сессий обновлён.",
  watchlistUpdated: "Watchlist обновлён.",
});
Object.assign(translations.en.misc, {
  pairSettingsUpdated: "Pair settings updated.",
  sessionsUpdated: "Session filter updated.",
  watchlistUpdated: "Watchlist updated.",
});

translations.uk = JSON.parse(JSON.stringify(translations.en));
Object.assign(translations.uk, {
  appName: "Trade Ai",
  brandLine: "AI trading product",
});
Object.assign(translations.uk.auth, {
  title: "Вхід у Trade Ai",
  subtitle: "Вхід через email, Google або Apple / iCloud.",
  login: "Вхід",
  register: "Реєстрація",
  submitLogin: "Увійти",
  submitRegister: "Створити акаунт",
  name: "Ім'я",
  password: "Пароль",
  invalid: "Перевірте email і пароль.",
  registerOk: "Акаунт створено.",
  loginOk: "Вхід виконано.",
});
Object.assign(translations.uk.nav, {
  home: "Головна",
  market: "Ринок",
  filters: "Фільтри",
  settings: "Налаштування",
});
Object.assign(translations.uk.home, {
  title: "Сигнали",
  bestSetup: "Найкращий сетап",
  noSignals: "Сильних сигналів зараз немає",
  noSignalsCopy: "AI фільтрує шум і чекає на підтвердження.",
  limit: "Ліміт",
  mood: "Настрій ринку",
  viewMarket: "Переглянути ринок",
  plusCopy: "До 10 сигналів на годину, вибір пар і пріоритетні сповіщення.",
  notificationsTitle: "Увімкніть сповіщення про сигнали",
  notificationsCopy: "Відкрийте налаштування й дозвольте сповіщення, щоб сильні LONG і SHORT сигнали приходили вчасно.",
  notificationsButton: "Відкрити сповіщення",
  sessions: "Торгові сесії",
  watchlist: "Watchlist",
  noTradeTitle: "No trade zone",
  noTradeCopy: "AI зараз уникає входів по цих парах і показує причину.",
  historyTitle: "Історія сигналів",
  historyEmpty: "Нові сигнали з'являться тут, коли пройдуть фільтри.",
  statsWinRate: "Win rate",
  statsOpen: "Відкрито",
});
Object.assign(translations.uk.market, {
  title: "Ринок у реальному часі",
  filtered: "Обрана пара",
  clearFilter: "Показати всі пари",
  watchPair: "Відкрити пару",
  mood: "Режим",
  trend: "Тренд",
  volatility: "Волатильність",
  status: "Статус",
  price: "Ціна",
  ready: "Сигнал готовий",
  forming: "Формується",
  waiting: "Очікування",
  details: "Деталі пари",
  session: "Сесія",
  structure: "Структура",
  support: "Підтримка",
  resistance: "Опір",
  volume: "Обсяг",
  change: "Зміна",
  summary: "AI Summary",
  noTrade: "No trade zone",
  noTradeReady: "Причина блокування входу",
  selectHint: "Оберіть пару або відкрийте її із сигналу.",
});
Object.assign(translations.uk.settings, {
  title: "Налаштування",
  account: "Акаунт",
  language: "Мова",
  theme: "Тема",
  notifications: "Сповіщення",
  sounds: "Звуки",
  subscription: "Підписка",
  signalLimit: "Ліміт сигналів",
  dark: "Темна",
  light: "Світла",
  on: "Увімкнено",
  off: "Вимкнено",
  onboarding: "Ознайомлення",
  showIntro: "Показати знову",
  logout: "Вийти",
  promoTitle: "Промокод PLUS",
  promoPlaceholder: "Введіть промокод",
  promoButton: "Активувати PLUS",
  promoHint: "Щоб увімкнути PLUS назавжди безкоштовно, введіть промокод нижче.",
  promoForever: "PLUS активовано назавжди.",
  sessions: "Сесії",
  sessionsHint: "Залиште лише ті сесії, з яких хочете отримувати сигнали.",
  pairsTitle: "Валютні пари",
  pairsHint: "Вимикайте шумні пари й додавайте важливі у watchlist.",
  watch: "У watchlist",
  unwatch: "Прибрати",
  enabled: "Увімкнено",
  disabled: "Вимкнено",
  pushHistory: "Історія сповіщень",
  pushHistoryEmpty: "Push-сповіщення з'являться тут після відправлення.",
});
Object.assign(translations.uk.actions, {
  next: "Далі",
  back: "Назад",
  skip: "Пропустити",
  start: "Почати",
  enable: "Увімкнути",
  disable: "Вимкнути",
});
Object.assign(translations.uk.misc, {
  risk: "Trade Ai не надає фінансових порад. Торгівля пов'язана з ризиком.",
  languageUpdated: "Мову оновлено.",
  themeUpdated: "Тему оновлено.",
  notificationsOn: "Сповіщення увімкнені.",
  notificationsOff: "Сповіщення вимкнені.",
  soundsOn: "Звук увімкнено.",
  soundsOff: "Звук вимкнено.",
  promoActivated: "Промокод прийнято. PLUS активовано назавжди.",
  promoInvalid: "Невірний промокод. PLUS не активовано.",
  logout: "Ви вийшли з акаунта.",
  pairOpened: "Ринок по обраній парі відкрито.",
  signalLimitUpdated: "Ліміт сигналів оновлено.",
  apiError: "Помилка сервера. Спробуйте пізніше.",
  sessionRequired: "Сесію завершено. Увійдіть знову.",
  oauthSuccess: "Вхід виконано.",
  pushLinked: "Цей пристрій підключено до web push.",
  pushUnsupported: "Web push поки не підтримується на цьому пристрої.",
  pushPermissionBlocked: "Доступ до сповіщень заблоковано. Дозвольте сповіщення для Trade Ai у налаштуваннях iPhone або Safari.",
  pushUnavailable: "Web push поки недоступний. Завершіть деплой і повторіть спробу.",
  pairSettingsUpdated: "Налаштування пар оновлено.",
  sessionsUpdated: "Фільтр сесій оновлено.",
  watchlistUpdated: "Watchlist оновлено.",
});
Object.assign(translations.ru.settings, {
  profileTitle: "Профиль",
  changeAvatar: "Сменить аватар",
  clearAvatar: "Убрать",
  languageHint: "Выберите язык интерфейса. Для новых языков используется безопасный fallback.",
  notificationsHint: "Push уже работают, а внутренние уведомления остаются сверху и перекрывают друг друга.",
  tiersTitle: "Планы доступа",
  buyPlus: "Купить PLUS",
  plusPerk: "До 10 сильных сигналов в час, фильтр пар и приоритетные уведомления.",
  proLabel: "ELITE",
  proPerk: "Персональные фильтры, расширенная аналитика и будущие AI-автостратегии.",
  eliteLabel: "ELITE",
  elitePerk: "Персональные фильтры, расширенная аналитика и будущие AI-автостратегии.",
  buySoon: "Скоро через App Store / Google Play",
  supportTitle: "Поддержка",
  supportHint: "Здесь позже появится быстрый переход к вашему Telegram-боту.",
  supportButton: "Скоро Telegram бот",
  exchangeTitle: "Биржа и автоторговля",
  exchangeHint: "Подключение биржи готовим так, чтобы ключи никогда не уходили на наш сервер.",
  exchangeSecurity: "API-ключи будут жить только на вашем устройстве. Сервер их хранить не будет.",
  connectExchange: "Скоро подключение биржи",
  autoEntry: "Автовход в позицию",
  autoEntryHint: "Функция будет доступна только для подписок PLUS и выше.",
});
Object.assign(translations.en.settings, {
  profileTitle: "Profile",
  changeAvatar: "Change avatar",
  clearAvatar: "Clear",
  languageHint: "Choose the app language. New languages use a safe fallback where needed.",
  notificationsHint: "Push is live, and in-app notifications stay pinned to the top stack.",
  tiersTitle: "Access plans",
  buyPlus: "Buy PLUS",
  plusPerk: "Up to 10 strong signals per hour, pair filtering, and priority alerts.",
  proLabel: "ELITE",
  proPerk: "Personal filters, deeper analytics, and future AI automation.",
  eliteLabel: "ELITE",
  elitePerk: "Personal filters, deeper analytics, and future AI automation.",
  buySoon: "Coming soon via App Store / Google Play",
  supportTitle: "Support",
  supportHint: "Your Telegram bot shortcut will appear here later.",
  supportButton: "Telegram bot soon",
  exchangeTitle: "Exchange and automation",
  exchangeHint: "Exchange linking is being prepared so keys never leave your device.",
  exchangeSecurity: "API keys will stay on your device only. They will not be stored on our server.",
  connectExchange: "Exchange connect soon",
  autoEntry: "Auto-entry",
  autoEntryHint: "This feature will be available only on PLUS and higher plans.",
});
Object.assign(translations.uk.settings, {
  profileTitle: "Профіль",
  changeAvatar: "Змінити аватар",
  clearAvatar: "Прибрати",
  languageHint: "Оберіть мову інтерфейсу. Для нових мов працює безпечний fallback.",
  notificationsHint: "Push уже працюють, а внутрішні сповіщення залишаються зверху стеком.",
  tiersTitle: "Плани доступу",
  buyPlus: "Купити PLUS",
  plusPerk: "До 10 сильних сигналів на годину, фільтр пар і пріоритетні сповіщення.",
  proLabel: "ELITE",
  proPerk: "Персональні фільтри, глибша аналітика й майбутня AI-автоматизація.",
  eliteLabel: "ELITE",
  elitePerk: "Персональні фільтри, глибша аналітика й майбутня AI-автоматизація.",
  buySoon: "Скоро через App Store / Google Play",
  supportTitle: "Підтримка",
  supportHint: "Тут пізніше з'явиться швидкий перехід до вашого Telegram-бота.",
  supportButton: "Скоро Telegram бот",
  exchangeTitle: "Біржа й автоторгівля",
  exchangeHint: "Підключення біржі готуємо так, щоб ключі ніколи не йшли на наш сервер.",
  exchangeSecurity: "API-ключі житимуть лише на вашому пристрої. Сервер їх не зберігатиме.",
  connectExchange: "Скоро підключення біржі",
  autoEntry: "Автовхід у позицію",
  autoEntryHint: "Функція буде доступна лише для підписок PLUS і вище.",
});
Object.assign(translations.ru.market, {
  riskPlanner: "Риск-план",
  capital: "Сумма входа",
  riskPerTrade: "Риск на сделку",
  positionSize: "Размер позиции",
  expectedReward: "Потенциал",
  autoStops: "Авто SL / TP",
  autoEntryHint: "Расчёт идёт локально по текущему сигналу, ATR и структуре рынка.",
});
Object.assign(translations.en.market, {
  riskPlanner: "Risk planner",
  capital: "Entry amount",
  riskPerTrade: "Risk per trade",
  positionSize: "Position size",
  expectedReward: "Potential",
  autoStops: "Auto SL / TP",
  autoEntryHint: "This plan is calculated locally from the current signal, ATR, and market structure.",
});
Object.assign(translations.uk.market, {
  riskPlanner: "Risk planner",
  capital: "Сума входу",
  riskPerTrade: "Ризик на угоду",
  positionSize: "Розмір позиції",
  expectedReward: "Потенціал",
  autoStops: "Авто SL / TP",
  autoEntryHint: "План розраховується локально за поточним сигналом, ATR і структурою ринку.",
});
Object.assign(translations.ru.misc, {
  avatarUpdated: "Аватар обновлён.",
  avatarRemoved: "Аватар убран.",
  buySoon: "Покупка подписки скоро будет подключена через App Store и Google Play.",
  supportSoon: "Кнопка поддержки скоро будет вести в вашего Telegram-бота.",
  exchangeSoon: "Подключение биржи и автоторговля скоро появятся.",
  autoEntrySoon: "Автовход будет доступен только для PLUS и старших планов.",
});
Object.assign(translations.en.misc, {
  avatarUpdated: "Avatar updated.",
  avatarRemoved: "Avatar removed.",
  buySoon: "Subscription purchase will be connected through App Store and Google Play soon.",
  supportSoon: "Support will point to your Telegram bot soon.",
  exchangeSoon: "Exchange connection and auto-trading are coming soon.",
  autoEntrySoon: "Auto-entry will be available only on PLUS and higher plans.",
});
Object.assign(translations.uk.misc, {
  avatarUpdated: "Аватар оновлено.",
  avatarRemoved: "Аватар прибрано.",
  buySoon: "Покупку підписки скоро підключимо через App Store і Google Play.",
  supportSoon: "Підтримка скоро вестиме до вашого Telegram-бота.",
  exchangeSoon: "Підключення біржі й автоторгівля скоро з'являться.",
  autoEntrySoon: "Автовхід буде доступний лише для PLUS і старших планів.",
});

const TRANSLATION_FALLBACK = "en";
const LANGUAGE_OPTIONS = [
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "tr", label: "Türkçe" },
  { code: "pl", label: "Polski" },
  { code: "ro", label: "Română" },
  { code: "cs", label: "Čeština" },
  { code: "nl", label: "Nederlands" },
  { code: "sv", label: "Svenska" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "id", label: "Bahasa Indonesia" },
];

const SESSION_LABELS = {
  ru: {
    asia: "Азия",
    london: "Лондон",
    newyork: "Нью-Йорк",
  },
  uk: {
    asia: "Азія",
    london: "Лондон",
    newyork: "Нью-Йорк",
  },
  en: {
    asia: "Asia",
    london: "London",
    newyork: "New York",
  },
};

const HISTORY_STATUS_LABELS = {
  ru: {
    open: "Открыт",
    win: "Плюс",
    loss: "Минус",
    expired: "Истёк",
  },
  uk: {
    open: "Відкрито",
    win: "Плюс",
    loss: "Мінус",
    expired: "Завершено",
  },
  en: {
    open: "Open",
    win: "Win",
    loss: "Loss",
    expired: "Expired",
  },
};

const fallbackSignals = [
  {
    id: "eurusd-long",
    pair: "EUR/USD",
    side: "long",
    entry: "1.0819",
    takeProfit: "1.0887",
    stopLoss: "1.0784",
    confidence: 91,
    time: "09:14 UTC",
    lifetime: "40m",
    reason: {
      ru: "EMA 50 выше EMA 200, RSI подтверждает импульс, MACD расширяется.",
      en: "EMA 50 is above EMA 200, RSI confirms momentum, and MACD is expanding.",
    },
  },
  {
    id: "btcusdt-short",
    pair: "BTC/USDT",
    side: "short",
    entry: "68750",
    takeProfit: "67690",
    stopLoss: "69340",
    confidence: 83,
    time: "09:09 UTC",
    lifetime: "55m",
    reason: {
      ru: "Отбой от сопротивления с ростом объёма и подтверждением MACD вниз.",
      en: "Rejection from resistance with volume pickup and MACD downside confirmation.",
    },
  },
];

const fallbackMarket = [
  { id: "eurusd", pair: "EUR/USD", price: "1.0824", trend: { ru: "Восходящий", en: "Bullish" }, volatility: { ru: "Нормальная", en: "Normal" }, status: "ready" },
  { id: "gbpusd", pair: "GBP/USD", price: "1.2653", trend: { ru: "Нисходящий", en: "Bearish" }, volatility: { ru: "Нормальная", en: "Normal" }, status: "forming" },
  { id: "usdjpy", pair: "USD/JPY", price: "155.12", trend: { ru: "Боковой", en: "Sideways" }, volatility: { ru: "Средняя", en: "Medium" }, status: "waiting" },
  { id: "usdchf", pair: "USD/CHF", price: "0.9092", trend: { ru: "Восходящий", en: "Bullish" }, volatility: { ru: "Нормальная", en: "Normal" }, status: "waiting" },
  { id: "audusd", pair: "AUD/USD", price: "0.6611", trend: { ru: "Нисходящий", en: "Bearish" }, volatility: { ru: "Средняя", en: "Medium" }, status: "forming" },
  { id: "nzdusd", pair: "NZD/USD", price: "0.6078", trend: { ru: "Боковой", en: "Sideways" }, volatility: { ru: "Нормальная", en: "Normal" }, status: "waiting" },
  { id: "usdcad", pair: "USD/CAD", price: "1.3668", trend: { ru: "Восходящий", en: "Bullish" }, volatility: { ru: "Нормальная", en: "Normal" }, status: "forming" },
  { id: "eurjpy", pair: "EUR/JPY", price: "167.92", trend: { ru: "Восходящий", en: "Bullish" }, volatility: { ru: "Высокая", en: "High" }, status: "ready" },
  { id: "gbpjpy", pair: "GBP/JPY", price: "196.34", trend: { ru: "Нисходящий", en: "Bearish" }, volatility: { ru: "Высокая", en: "High" }, status: "waiting" },
  { id: "eurgbp", pair: "EUR/GBP", price: "0.8554", trend: { ru: "Боковой", en: "Sideways" }, volatility: { ru: "Низкая", en: "Low" }, status: "waiting" },
  { id: "btcusdt", pair: "BTC/USDT", price: "68,420", trend: { ru: "Восходящий", en: "Bullish" }, volatility: { ru: "Высокая", en: "High" }, status: "ready" },
  { id: "ethusdt", pair: "ETH/USDT", price: "3,434", trend: { ru: "Восходящий", en: "Bullish" }, volatility: { ru: "Нормальная", en: "Normal" }, status: "forming" },
];

const state = {
  language: localStorage.getItem(STORAGE_KEYS.language) || "ru",
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "dark",
  onboardingSeen: localStorage.getItem(STORAGE_KEYS.introSeen) === "true",
  onboardingStep: 0,
  activeTab: "home",
  authMode: "login",
  notificationsEnabled: localStorage.getItem(STORAGE_KEYS.notifications) === "true",
  soundsEnabled: localStorage.getItem(STORAGE_KEYS.sounds) !== "false",
  token: localStorage.getItem(STORAGE_KEYS.token) || "",
  user: null,
  sessionChecked: false,
  showSplash: false,
  navHidden: false,
  selectedPair: "",
  pendingSettingsSection: "",
  dataLoaded: false,
  liveSignals: [],
  liveMarketPairs: [],
  liveMeta: null,
  liveAnalytics: {},
  signalHistory: [],
  pushHistory: [],
  noTradeZones: [],
  lastSync: 0,
  lastSignalIds: new Set(),
  cryptoInvoice: null,
  paymentSheetOpen: false,
  tradeCapital: Number(localStorage.getItem(STORAGE_KEYS.tradeCapital) || 250),
};

const appRoot = document.getElementById("appRoot");
const toastStack = document.getElementById("toastStack");
let liveRefreshPromise = null;
let liveRefreshIntervalId = null;
let splashTimerId = null;
let lastScrollY = 0;
let audioContext = null;
let serviceWorkerRegistrationPromise = null;

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function renderInstallCard() {
  return `
    <article class="install-card">
      <div>
        <p class="eyebrow">${t("settings.installTitle")}</p>
        <h3 class="settings-title">${t("settings.installTitle")}</h3>
      </div>
      ${
        isStandaloneMode()
          ? `<p class="helper-text">${t("settings.installReady")}</p>`
          : `
            <div class="legal-list">
              <p class="helper-text">${t("settings.installLead")}</p>
              <p class="helper-text">${t("settings.installStepOne")}</p>
              <p class="helper-text">${t("settings.installStepTwo")}</p>
              <p class="helper-text">${t("settings.installStepThree")}</p>
            </div>
          `
      }
    </article>
  `;
}

function renderNotificationPrompt() {
  if (state.notificationsEnabled) {
    return "";
  }

  return `
    <article class="empty-card notification-card">
      <h3 class="section-title">${t("home.notificationsTitle")}</h3>
      <p class="empty-copy">${t("home.notificationsCopy")}</p>
      <div class="notification-card-actions">
        <button class="primary-button" data-action="open-notification-settings" type="button">${t("home.notificationsButton")}</button>
      </div>
    </article>
  `;
}

function resolveLanguageKey(language = state.language) {
  const key = String(language || "").trim().toLowerCase();
  return translations[key] ? key : TRANSLATION_FALLBACK;
}

function getUiLocale(language = state.language) {
  const key = resolveLanguageKey(language);
  const locales = {
    ru: "ru-RU",
    uk: "uk-UA",
    en: "en-GB",
    es: "es-ES",
    pt: "pt-PT",
    de: "de-DE",
    fr: "fr-FR",
    it: "it-IT",
    tr: "tr-TR",
    pl: "pl-PL",
    ro: "ro-RO",
    cs: "cs-CZ",
    nl: "nl-NL",
    sv: "sv-SE",
    ar: "ar-SA",
    hi: "hi-IN",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    id: "id-ID",
  };
  return locales[key] || "en-GB";
}

function getLanguageLabel(code) {
  return LANGUAGE_OPTIONS.find((entry) => entry.code === code)?.label || code.toUpperCase();
}

function localizedText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const language = resolveLanguageKey();
  return value[language] || value[TRANSLATION_FALLBACK] || value.en || Object.values(value).find((entry) => typeof entry === "string") || "";
}

function t(path) {
  const keys = path.split(".");
  for (const language of [resolveLanguageKey(), TRANSLATION_FALLBACK]) {
    const result = keys.reduce((value, key) => value?.[key], translations[language]);
    if (result !== undefined) {
      return result;
    }
  }
  return path;
}

function getApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function getStage() {
  if (!state.onboardingSeen) return "intro";
  if (!state.sessionChecked) return "loading";
  if (!state.user) return "auth";
  return "app";
}

function getLogoMarkup() {
  return `<img class="logo-image" src="assets/logo.png" alt="${t("appName")}" />`;
}

function getSignalWordRu(value) {
  const n = Math.abs(value) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "сигналов";
  if (n1 > 1 && n1 < 5) return "сигнала";
  if (n1 === 1) return "сигнал";
  return "сигналов";
}

function getSignalWordUk(value) {
  const n = Math.abs(value) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "сигналів";
  if (n1 > 1 && n1 < 5) return "сигнали";
  if (n1 === 1) return "сигнал";
  return "сигналів";
}

function formatSignalsPerHour(value) {
  const language = resolveLanguageKey();
  if (language === "ru") {
    return `${value} ${getSignalWordRu(value)} в час`;
  }
  if (language === "uk") {
    return `${value} ${getSignalWordUk(value)} на годину`;
  }
  return `${value} signals/hour`;
}

function applyDocumentState() {
  document.body.dataset.theme = state.theme;
  document.documentElement.lang = resolveLanguageKey();
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", state.theme === "dark" ? "#090909" : "#f2f2f0");
  }
}

function ensureAudioContext() {
  if (audioContext) return audioContext;
  try {
    audioContext = new window.AudioContext();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

function playUiSound(kind = "tap") {
  if (!state.soundsEnabled) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind === "signal" ? "triangle" : "sine";
  let duration = 0.09;
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === "signal") {
    osc.frequency.setValueAtTime(690, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.24);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    duration = 0.24;
  } else {
    osc.frequency.setValueAtTime(420, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  }

  try {
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    return;
  }
}

function syncUserToState(user) {
  state.user = user;
  state.language = user.settings?.language || state.language;
  state.theme = user.settings?.theme || state.theme;
  state.notificationsEnabled = Boolean(user.settings?.notificationsEnabled);
  state.soundsEnabled = "soundsEnabled" in (user.settings || {}) ? Boolean(user.settings?.soundsEnabled) : state.soundsEnabled;
  localStorage.setItem(STORAGE_KEYS.language, state.language);
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  localStorage.setItem(STORAGE_KEYS.notifications, String(state.notificationsEnabled));
  localStorage.setItem(STORAGE_KEYS.sounds, String(state.soundsEnabled));
  localStorage.setItem(STORAGE_KEYS.signalLimit, String(getSignalLimit()));
}

function clearSessionState() {
  state.user = null;
  state.token = "";
  state.authMode = "login";
  state.liveSignals = [];
  state.liveMarketPairs = [];
  state.liveMeta = null;
  state.liveAnalytics = {};
  state.signalHistory = [];
  state.pushHistory = [];
  state.noTradeZones = [];
  state.dataLoaded = false;
  state.lastSignalIds = new Set();
  state.cryptoInvoice = null;
  state.paymentSheetOpen = false;
  localStorage.removeItem(STORAGE_KEYS.token);
}

async function apiRequest(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(getApiUrl(path), {
    method: options.method || "GET",
    headers,
    credentials: "same-origin",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function supportsWebPush() {
  return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

async function getServiceWorkerRegistration() {
  if (!supportsWebPush()) {
    return null;
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register("./sw.js")
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }

  return serviceWorkerRegistrationPromise;
}

async function fetchPushConfig() {
  return apiRequest("/api/push/config");
}

async function subscribeCurrentDeviceToPush() {
  if (!state.user || !state.notificationsEnabled) {
    return false;
  }

  if (!supportsWebPush()) {
    throw new Error(t("misc.pushUnsupported"));
  }

  if (Notification.permission !== "granted") {
    throw new Error(t("misc.pushPermissionBlocked"));
  }

  const config = await fetchPushConfig();
  if (!config.supported || !config.publicKey) {
    throw new Error(t("misc.pushUnavailable"));
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error(t("misc.pushUnsupported"));
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  await apiRequest("/api/push/subscribe", {
    method: "POST",
    body: {
      subscription: subscription.toJSON(),
    },
  });

  return true;
}

async function unsubscribeCurrentDeviceFromPush() {
  const registration = await getServiceWorkerRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) {
    return false;
  }

  await apiRequest("/api/push/unsubscribe", {
    method: "POST",
    body: {
      endpoint: subscription.endpoint,
    },
  }).catch(() => null);

  await subscription.unsubscribe().catch(() => null);
  return true;
}

async function syncPushSubscription() {
  if (!state.user || !state.notificationsEnabled || !supportsWebPush()) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  try {
    return await subscribeCurrentDeviceToPush();
  } catch {
    return false;
  }
}

function getSignalFeed() {
  return state.dataLoaded ? state.liveSignals : fallbackSignals;
}

function getMarketFeed() {
  const source = state.dataLoaded ? state.liveMarketPairs : fallbackMarket;
  if (!state.selectedPair) return source;
  return source.filter((pair) => pair.pair === state.selectedPair);
}

function getAnalyticsFeed() {
  return state.dataLoaded ? state.liveAnalytics : {};
}

function getWatchlist() {
  return Array.isArray(state.user?.settings?.watchlist) ? state.user.settings.watchlist : [];
}

function getEnabledPairs() {
  return Array.isArray(state.user?.settings?.enabledPairs) ? state.user.settings.enabledPairs : [];
}

function getPreferredSessions() {
  return Array.isArray(state.user?.settings?.preferredSessions) ? state.user.settings.preferredSessions : ["asia", "london", "newyork"];
}

function getPairKey(pair) {
  return String(pair || "").replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function getPairAnalytics(pairLabel) {
  return getAnalyticsFeed()[getPairKey(pairLabel)] || null;
}

function getSessionLabel(session) {
  return SESSION_LABELS[resolveLanguageKey()]?.[session] || SESSION_LABELS.en?.[session] || session || "--";
}

function getHistoryStatusLabel(status) {
  return HISTORY_STATUS_LABELS[resolveLanguageKey()]?.[status] || HISTORY_STATUS_LABELS.en?.[status] || status;
}

function formatTimestamp(value) {
  if (!value) return "--";
  const date = new Date(value);
  return date.toLocaleString(getUiLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "--";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getSignalHistoryStats() {
  const history = Array.isArray(state.signalHistory) ? state.signalHistory : [];
  const wins = history.filter((entry) => entry.status === "win").length;
  const losses = history.filter((entry) => entry.status === "loss").length;
  const open = history.filter((entry) => entry.status === "open").length;
  const totalClosed = wins + losses;
  return {
    wins,
    losses,
    open,
    winRate: totalClosed ? Math.round((wins / totalClosed) * 100) : 0,
  };
}

function getSelectedMarketEntry() {
  const market = state.dataLoaded ? state.liveMarketPairs : fallbackMarket;
  if (state.selectedPair) {
    return market.find((entry) => entry.pair === state.selectedPair) || null;
  }

  const watchPair = getWatchlist().find((pair) => market.some((entry) => entry.pair === pair));
  if (watchPair) {
    return market.find((entry) => entry.pair === watchPair) || null;
  }

  return market[0] || null;
}

function getCurrentSignalForPair(pairLabel) {
  return getSignalFeed().find((signal) => signal.pair === pairLabel) || null;
}

function getTradeCapital() {
  const capital = Number(state.tradeCapital || 0);
  return Number.isFinite(capital) && capital > 0 ? capital : 250;
}

function getAvatarMarkup() {
  const avatar = state.user?.settings?.avatarDataUrl;
  if (typeof avatar === "string" && avatar.startsWith("data:image/")) {
    return `<img class="avatar-image" src="${avatar}" alt="${state.user?.name || t("appName")}" />`;
  }
  return `<span class="avatar-fallback">${(state.user?.name || "T").trim().charAt(0).toUpperCase()}</span>`;
}

function buildRiskPlan(entry, analytics, signal, pairLabel) {
  const capital = getTradeCapital();
  const entryPrice = Number(String(entry).replace(/,/g, ""));
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return null;
  }

  let stop = Number(String(signal?.stopLoss || "").replace(/,/g, ""));
  let target = Number(String(signal?.takeProfit || "").replace(/,/g, ""));
  const direction = signal?.side || (Number(analytics?.ema50) >= Number(analytics?.ema200) ? "long" : "short");
  const atrPercent = Math.max(Number(analytics?.atrPercent || 0), pairLabel?.includes("USDT") ? 1.1 : 0.35);

  if (!Number.isFinite(stop) || stop <= 0) {
    const distance = entryPrice * (atrPercent / 100) * (pairLabel?.includes("USDT") ? 0.7 : 0.9);
    stop = direction === "long" ? entryPrice - distance : entryPrice + distance;
  }

  if (!Number.isFinite(target) || target <= 0) {
    const riskDistance = Math.abs(entryPrice - stop) || entryPrice * 0.005;
    target = direction === "long" ? entryPrice + riskDistance * 1.9 : entryPrice - riskDistance * 1.9;
  }

  const riskAmount = capital * 0.01;
  const stopDistance = Math.abs(entryPrice - stop);
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return null;
  }

  const positionSize = riskAmount / stopDistance;
  const rewardDistance = Math.abs(target - entryPrice);
  const rewardAmount = rewardDistance * positionSize;

  return {
    capital,
    riskAmount,
    stop,
    target,
    positionSize,
    rewardAmount,
  };
}

function renderSparkline(points = []) {
  if (!Array.isArray(points) || points.length < 2) {
    return "";
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 240;
  const height = 72;
  const coordinates = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return `
    <div class="sparkline-box">
      <svg viewBox="0 0 ${width} ${height}" class="sparkline" aria-hidden="true">
        <polyline points="${coordinates}" />
      </svg>
    </div>
  `;
}

function getSignalLimit() {
  if (state.user?.signalLimit) return Number(state.user.signalLimit);
  const fallback = Number(localStorage.getItem(STORAGE_KEYS.signalLimit) || 2);
  const max = state.user?.plan === "plus" ? 10 : 2;
  return Math.max(1, Math.min(max, fallback));
}

function getPlanInfo() {
  const plus = state.user?.plan === "plus";
  const maxLimit = plus ? 10 : 2;
  return {
    plus,
    label: plus ? t("settings.plus") : t("settings.free"),
    maxLimit,
    currentLimit: getSignalLimit(),
    copy: plus ? t("home.plusCopy") : formatSignalsPerHour(2),
  };
}

function getSignalLevel(signal) {
  if (signal.confidence >= 88) return { key: "strong", label: t("signal.strong") };
  if (signal.confidence >= 76) return { key: "medium", label: t("signal.medium") };
  return { key: "weak", label: t("signal.weak") };
}

function getSignalNotificationTitle(signal) {
  const language = resolveLanguageKey();
  if (language === "ru") {
    return `Внимание: новый сигнал - ${signal.pair}`;
  }
  if (language === "uk") {
    return `Увага: новий сигнал - ${signal.pair}`;
  }

  return `Attention: new signal - ${signal.pair}`;
}

function getSignalNotificationBody(signal) {
  const level = getSignalLevel(signal);
  const direction = signal.side === "long" ? "LONG" : "SHORT";
  const language = resolveLanguageKey();

  if (language === "ru") {
    return `${signal.pair} - ${direction}\nСила: ${level.label}\n${t("signal.entry")}: ${signal.entry} | TP: ${signal.takeProfit} | SL: ${signal.stopLoss}`;
  }
  if (language === "uk") {
    return `${signal.pair} - ${direction}\nСила: ${level.label}\n${t("signal.entry")}: ${signal.entry} | TP: ${signal.takeProfit} | SL: ${signal.stopLoss}`;
  }

  return `${signal.pair} - ${direction}\nStrength: ${level.label}\n${t("signal.entry")}: ${signal.entry} | TP: ${signal.takeProfit} | SL: ${signal.stopLoss}`;
}

function getStatusLabel(status) {
  return t(`market.${status}`) || status;
}

function getMoodLabel() {
  return t(`market.${state.liveMeta?.mood || "calm"}`) || "Calm";
}

function getVisibleSignals() {
  const limit = getSignalLimit();
  return [...getSignalFeed()].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

function layoutToasts() {
  const list = Array.from(toastStack.querySelectorAll(".toast"));
  list.forEach((node, index) => {
    node.style.setProperty("--stack-offset", `${index * 6}px`);
    node.style.zIndex = String(200 - index);
  });
}

function showToast(title, body, tone = "info") {
  const toast = document.createElement("article");
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<strong>${title}</strong><p>${body}</p>`;
  toastStack.prepend(toast);
  layoutToasts();

  window.setTimeout(() => {
    toast.classList.add("leaving");
  }, 1400);

  window.setTimeout(() => {
    toast.remove();
    layoutToasts();
  }, 1800);
}

function showSignalNotification(signal) {
  if (!state.notificationsEnabled || typeof Notification === "undefined") {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const level = getSignalLevel(signal);
  const badge = level.key === "strong" ? "🟢" : level.key === "medium" ? "🟡" : "🔴";
  const title = `${badge} ${level.label} • ${signal.pair}`;
  const body = `${t(`signal.${signal.side}`)} • ${t("signal.entry")}: ${signal.entry} • TP: ${signal.takeProfit} • SL: ${signal.stopLoss}`;

  const notificationTitle = getSignalNotificationTitle(signal);
  const notificationBody = getSignalNotificationBody(signal);

  try {
    new Notification(notificationTitle, {
      body: notificationBody,
      icon: "assets/logo.png",
      tag: `signal-${signal.id}`,
    });
  } catch {
    return;
  }
}

function clearSplashTimer() {
  if (!splashTimerId) return;
  window.clearTimeout(splashTimerId);
  splashTimerId = null;
}

function scheduleSplashDismiss() {
  if (!state.showSplash || splashTimerId) return;
  splashTimerId = window.setTimeout(() => {
    splashTimerId = null;
    state.showSplash = false;
    render();
  }, 900);
}

async function refreshMarketData(force = false) {
  if (getStage() !== "app") return;
  const stale = Date.now() - state.lastSync > LIVE_REFRESH_MS;
  if (!force && !stale && state.dataLoaded) return;
  if (!force && liveRefreshPromise) return liveRefreshPromise;

  const params = new URLSearchParams();
  if (state.activeTab === "market" && state.selectedPair) params.set("pair", state.selectedPair);

  liveRefreshPromise = (async () => {
    try {
      const payload = await apiRequest(`/api/dashboard${params.size ? `?${params}` : ""}`);
      const nextSignals = Array.isArray(payload.signals) ? payload.signals : [];
      const previousIds = new Set(state.lastSignalIds);
      const incomingIds = new Set(nextSignals.map((signal) => signal.id));

      state.liveSignals = nextSignals;
      state.liveMarketPairs = Array.isArray(payload.market) ? payload.market : [];
      state.liveMeta = payload.meta || null;
      state.liveAnalytics = payload.analytics || {};
      state.signalHistory = Array.isArray(payload.signalHistory) ? payload.signalHistory : [];
      state.pushHistory = Array.isArray(payload.pushHistory) ? payload.pushHistory : [];
      state.noTradeZones = Array.isArray(payload.noTradeZones) ? payload.noTradeZones : [];
      state.lastSync = Date.now();
      state.dataLoaded = true;
      if (payload.user) {
        syncUserToState(payload.user);
      }
      state.lastSignalIds = incomingIds;

      const newSignal = nextSignals.find((signal) => !previousIds.has(signal.id));
      if (newSignal && state.notificationsEnabled) {
        const level = getSignalLevel(newSignal);
        showToast(`${level.label} • ${newSignal.pair}`, `${t(`signal.${newSignal.side}`)} ${newSignal.entry}`, newSignal.side);
        playUiSound("signal");
        showSignalNotification(newSignal);
      }

      render();
    } catch (error) {
      if (error?.status === 401) {
        showToast(t("appName"), t("misc.sessionRequired"), "info");
        clearSessionState();
        render();
        return;
      }
      state.dataLoaded = false;
    } finally {
      liveRefreshPromise = null;
    }
  })();

  return liveRefreshPromise;
}

function ensureLiveRefreshLoop() {
  if (liveRefreshIntervalId || getStage() !== "app") return;
  liveRefreshIntervalId = window.setInterval(() => {
    void refreshMarketData();
  }, LIVE_REFRESH_MS);
}

function stopLiveRefreshLoop() {
  if (!liveRefreshIntervalId) return;
  window.clearInterval(liveRefreshIntervalId);
  liveRefreshIntervalId = null;
}

async function savePreferences(patch, toastKey) {
  try {
    const payload = await apiRequest("/api/profile", { method: "PATCH", body: patch });
    syncUserToState(payload.user);
    if (toastKey) {
      showToast(t("appName"), t(toastKey), "info");
    }
    playUiSound("tap");
    render();
  } catch {
    showToast(t("appName"), t("misc.apiError"), "info");
  }
}

async function toggleNotifications() {
  if (!state.notificationsEnabled) {
    if (!supportsWebPush()) {
      showToast(t("appName"), t("misc.pushUnsupported"), "info");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "denied") {
      showToast(t("appName"), t("misc.pushPermissionBlocked"), "info");
      return;
    }

    if (permission !== "granted") {
      return;
    }

    await savePreferences({ notificationsEnabled: true }, "misc.notificationsOn");

    try {
      await subscribeCurrentDeviceToPush();
      showToast(t("appName"), t("misc.pushLinked"), "info");
    } catch (error) {
      showToast(t("appName"), error instanceof Error ? error.message : t("misc.pushUnavailable"), "info");
    }
    return;
  }

  await unsubscribeCurrentDeviceFromPush();
  await savePreferences({ notificationsEnabled: false }, "misc.notificationsOff");
}

async function sendTestPush() {
  try {
    await subscribeCurrentDeviceToPush();
    await apiRequest("/api/push/test", {
      method: "POST",
      body: {},
    });
    showToast(t("appName"), t("misc.pushTestSent"), "info");
  } catch (error) {
    showToast(t("appName"), error instanceof Error ? error.message : t("misc.pushUnavailable"), "info");
  }
}

async function toggleSounds() {
  await savePreferences(
    { soundsEnabled: !state.soundsEnabled },
    !state.soundsEnabled ? "misc.soundsOn" : "misc.soundsOff",
  );
}

async function setLanguage(language) {
  await savePreferences({ language }, "misc.languageUpdated");
}

async function setTheme(theme) {
  await savePreferences({ theme }, "misc.themeUpdated");
}

async function setSignalLimit(limit) {
  await savePreferences({ signalLimit: Number(limit) }, "misc.signalLimitUpdated");
}

async function updateAvatar(file) {
  if (!(file instanceof File)) {
    return;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Avatar read failed."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Avatar load failed."));
    img.src = dataUrl;
  });

  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  const nextAvatar = canvas.toDataURL("image/jpeg", 0.9);
  await savePreferences({ avatarDataUrl: nextAvatar }, "misc.avatarUpdated");
}

async function clearAvatar() {
  await savePreferences({ avatarDataUrl: "" }, "misc.avatarRemoved");
}

async function togglePreferredSession(session) {
  const current = new Set(getPreferredSessions());
  if (current.has(session) && current.size === 1) {
    return;
  }

  if (current.has(session)) {
    current.delete(session);
  } else {
    current.add(session);
  }

  await savePreferences({ preferredSessions: [...current] }, "misc.sessionsUpdated");
  void refreshMarketData(true);
}

async function toggleEnabledPair(pair) {
  const current = new Set(getEnabledPairs());
  if (current.has(pair) && current.size === 1) {
    return;
  }

  if (current.has(pair)) {
    current.delete(pair);
  } else {
    current.add(pair);
  }

  await savePreferences({ enabledPairs: [...current] }, "misc.pairSettingsUpdated");
  void refreshMarketData(true);
}

async function toggleWatchlistPair(pair) {
  const current = new Set(getWatchlist());
  if (current.has(pair)) {
    current.delete(pair);
  } else if (current.size < 8) {
    current.add(pair);
  }

  await savePreferences({ watchlist: [...current] }, "misc.watchlistUpdated");
  void refreshMarketData(true);
}

function saveTradeCapital(value) {
  const nextValue = Math.max(10, Number(value || 0));
  state.tradeCapital = Number.isFinite(nextValue) ? nextValue : 250;
  localStorage.setItem(STORAGE_KEYS.tradeCapital, String(state.tradeCapital));
  render();
}

function showSubscriptionPlaceholder() {
  showToast(t("appName"), t("misc.buySoon"), "info");
}

function showSupportPlaceholder() {
  showToast(t("appName"), t("misc.supportSoon"), "info");
}

function showExchangePlaceholder() {
  showToast(t("appName"), t("misc.exchangeSoon"), "info");
}

function showAutoEntryPlaceholder() {
  showToast(t("appName"), t("misc.autoEntrySoon"), "info");
}

async function activatePromoCode(form) {
  const formData = new FormData(form);
  const code = String(formData.get("code") || "").trim();

  try {
    const payload = await apiRequest("/api/promo/activate", {
      method: "POST",
      body: { code },
    });
    if (payload.user) {
      syncUserToState(payload.user);
      render();
      await refreshMarketData(true);
    }
    showToast(t("appName"), t("misc.promoActivated"), "long");
  } catch (error) {
    showToast(t("appName"), error?.message === "Invalid promo code." ? t("misc.promoInvalid") : (error instanceof Error ? error.message : t("misc.apiError")), "info");
  }
}

async function startCheckout(provider) {
  try {
    const payload = await apiRequest("/api/payments/checkout", {
      method: "POST",
      body: { provider },
    });

    if (payload.mode === "redirect" && payload.checkoutUrl) {
      showToast(t("appName"), t("misc.trialStarted"), "info");
      showToast(t("appName"), t("misc.checkoutRedirect"), "info");
      window.location.href = payload.checkoutUrl;
      return;
    }

      if (payload.mode === "crypto" && payload.invoice) {
        state.cryptoInvoice = payload.invoice;
        showToast(t("appName"), t("misc.cryptoReady"), "info");
        render();
        return;
      }
    } catch (error) {
      showToast(t("appName"), error instanceof Error ? error.message : t("misc.apiError"), "info");
    }
  }

async function startOAuth(provider) {
  try {
    const payload = await apiRequest(`/api/auth/oauth/start?provider=${encodeURIComponent(provider)}`);
    if (!payload?.url) {
      throw new Error(t("misc.apiError"));
    }
    showToast(t("appName"), t("misc.oauthRedirect"), "info");
    window.location.href = payload.url;
  } catch (error) {
    showToast(t("appName"), error instanceof Error ? error.message : t("misc.apiError"), "info");
  }
}

function applyNavigationStateFromUrl() {
  const url = new URL(window.location.href);
  const nextTab = String(url.searchParams.get("tab") || "").trim();
  const nextPair = String(url.searchParams.get("pair") || "").trim();

  if (["home", "market", "filters", "settings"].includes(nextTab)) {
    state.activeTab = nextTab;
  }

  state.selectedPair = nextPair || "";
}

function openPaymentSheet() {
  state.paymentSheetOpen = true;
  playUiSound("tap");
  render();
}

function closePaymentSheet() {
  state.paymentSheetOpen = false;
  render();
}

async function loadSession() {
  state.sessionChecked = false;
  applyNavigationStateFromUrl();
  render();
  try {
    const payload = await apiRequest("/api/session");
    if (payload.user) {
      syncUserToState(payload.user);
      state.showSplash = true;
    } else {
      clearSessionState();
    }
  } catch {
    clearSessionState();
  } finally {
    state.sessionChecked = true;
    render();
    if (state.user) {
      void refreshMarketData(true);
      void syncPushSubscription();
    }
  }
}

async function handleAuthSubmit(form) {
  const formData = new FormData(form);
  const endpoint = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
  const wasRegister = state.authMode === "register";
  const body = {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "").trim(),
  };
  if (state.authMode === "register") {
    body.name = String(formData.get("name") || "").trim();
  }

  try {
    const payload = await apiRequest(endpoint, { method: "POST", body });
    state.token = payload.token;
    localStorage.setItem(STORAGE_KEYS.token, state.token);
    syncUserToState(payload.user);
    state.authMode = "login";
    state.showSplash = true;
    showToast(t("appName"), wasRegister ? t("auth.registerOk") : t("auth.loginOk"), "info");
    render();
    void refreshMarketData(true);
    void syncPushSubscription();
  } catch {
    showToast(t("appName"), t("auth.invalid"), "info");
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore network errors on logout
  }
  clearSessionState();
  state.authMode = "login";
  state.cryptoInvoice = null;
  showToast(t("appName"), t("misc.logout"), "info");
  render();
}

function handleIntroAction(action) {
  const lastStep = t("intro").length - 1;
  if (action === "next-intro" && state.onboardingStep < lastStep) {
    state.onboardingStep += 1;
    playUiSound("tap");
    render();
    return;
  }
  if (action === "prev-intro" && state.onboardingStep > 0) {
    state.onboardingStep -= 1;
    playUiSound("tap");
    render();
    return;
  }
  if (action === "finish-intro" || action === "skip-intro") {
    state.onboardingSeen = true;
    state.authMode = "register";
    localStorage.setItem(STORAGE_KEYS.introSeen, "true");
    playUiSound("tap");
    render();
  }
}

function renderLoading() {
  return `
    <div class="auth-screen">
      <article class="auth-card">
        <div class="brand">
          <div class="logo-mark">${getLogoMarkup()}</div>
          <div class="brand-copy">
            <p class="eyebrow">${t("appName")}</p>
            <h1 class="auth-title">${t("appName")}</h1>
          </div>
        </div>
        <p class="auth-copy">Loading session...</p>
      </article>
    </div>
  `;
}

function renderIntro() {
  const slides = t("intro");
  const slide = slides[state.onboardingStep];
  const featureLineSafe = state.onboardingStep === 0
    ? "AI / EMA / RSI / MACD"
    : state.onboardingStep === 1
      ? "Entry / TP / SL / Confidence"
      : state.onboardingStep === 2
        ? "FREE / PLUS / ELITE"
        : "Risk control / no noise / no promises";
  const featureLine = featureLineSafe;
  return `
    <div class="intro-screen">
      <article class="intro-card">
        <div class="intro-hero">
          <div class="logo-mark intro-logo">${getLogoMarkup()}</div>
          <div class="intro-hero-copy">
            <p class="eyebrow">${t("brandLine")}</p>
            <div class="intro-pill-row">
              <span class="small-chip">${state.onboardingStep + 1} / ${slides.length}</span>
              <span class="small-chip">LONG / SHORT</span>
            </div>
          </div>
        </div>
        <div class="intro-copy-block">
          <h1 class="intro-title">${slide.title}</h1>
          <p class="intro-copy">${slide.body}</p>
        </div>
        <div class="intro-feature-card">
          <span class="plan-badge">${t("appName")}</span>
          <p class="helper-text">${featureLineSafe}</p>
        </div>
        <div class="intro-dots">
          ${slides.map((_, index) => `<div class="intro-dot ${index === state.onboardingStep ? "active" : ""}"></div>`).join("")}
        </div>
        <div class="intro-footer">
          <button class="ghost-button" data-action="skip-intro" type="button">${t("actions.skip")}</button>
          <div class="auth-switch">
            ${state.onboardingStep > 0 ? `<button class="action-button" data-action="prev-intro" type="button">${t("actions.back")}</button>` : ""}
            <button class="primary-button" data-action="${state.onboardingStep === slides.length - 1 ? "finish-intro" : "next-intro"}" type="button">
              ${state.onboardingStep === slides.length - 1 ? t("actions.start") : t("actions.next")}
            </button>
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderAuth() {
  const isRegister = state.authMode === "register";
  return `
    <div class="auth-screen">
      <article class="auth-card">
        <div class="auth-hero">
          <div class="logo-mark auth-logo">${getLogoMarkup()}</div>
          <div class="brand-copy auth-brand-copy">
            <p class="eyebrow">${t("brandLine")}</p>
            <h1 class="auth-title">${t("auth.title")}</h1>
          </div>
        </div>
        <div class="auth-mode">
          <button class="auth-tab ${!isRegister ? "active" : ""}" data-action="set-auth-mode" data-mode="login" type="button">${t("auth.login")}</button>
          <button class="auth-tab ${isRegister ? "active" : ""}" data-action="set-auth-mode" data-mode="register" type="button">${t("auth.register")}</button>
        </div>
        <div class="oauth-actions">
          <button class="ghost-button" data-action="oauth-google" type="button">${t("auth.google")}</button>
          <button class="ghost-button" data-action="oauth-apple" type="button">${t("auth.apple")}</button>
        </div>
        <div class="auth-divider"><span class="auth-divider-pill">${t("auth.or")}</span></div>
        <form id="authForm">
          ${isRegister ? `<label class="field"><span>${t("auth.name")}</span><input name="name" type="text" required /></label>` : ""}
          <label class="field"><span>${t("auth.email")}</span><input name="email" type="email" required /></label>
          <label class="field"><span>${t("auth.password")}</span><input name="password" type="password" minlength="4" required /></label>
          <button class="primary-button" type="submit">${isRegister ? t("auth.submitRegister") : t("auth.submitLogin")}</button>
        </form>
      </article>
    </div>
  `;
}

function renderTopbar() {
  const plan = getPlanInfo();
  return `
    <header class="topbar">
      <div class="topbar-main">
        <h1 class="topbar-title">${t("appName")}</h1>
      </div>
      <div class="topbar-side">
        <span class="plan-badge">${plan.label}</span>
        <span class="small-chip">${formatSignalsPerHour(plan.currentLimit)}</span>
      </div>
    </header>
  `;
}

function renderSessionFilterCard() {
  const preferredSessions = new Set(getPreferredSessions());
  return `
    <article class="settings-card compact-card">
      <div class="settings-head compact-section-head">
        <h3 class="settings-title">${t("home.sessions")}</h3>
      </div>
      <div class="chip-grid">
        ${["asia", "london", "newyork"].map((session) => `
          <button
            class="filter-chip ${preferredSessions.has(session) ? "active" : ""}"
            data-action="toggle-session-setting"
            data-session="${session}"
            type="button"
          >${getSessionLabel(session)}</button>
        `).join("")}
      </div>
    </article>
  `;
}

function renderWatchlistCard() {
  const watchlist = getWatchlist();
  const emptyCopy = resolveLanguageKey() === "ru"
    ? "Добавьте пары в watchlist, чтобы быстро открывать их из отдельной вкладки."
    : resolveLanguageKey() === "uk"
      ? "Додайте пари у watchlist, щоб швидко відкривати їх з окремої вкладки."
      : "Add pairs to the watchlist to open them quickly from this tab.";

  return `
    <article class="settings-card compact-card">
      <div class="settings-head compact-section-head">
        <h3 class="settings-title">${t("home.watchlist")}</h3>
      </div>
      ${
        watchlist.length
          ? `
            <div class="compact-chip-list">
              ${watchlist.map((pair) => `
                <button class="filter-chip active compact-chip" data-action="open-pair-market" data-pair="${pair}" type="button">${pair}</button>
              `).join("")}
            </div>
          `
          : `<p class="helper-text">${emptyCopy}</p>`
      }
    </article>
  `;
}

function renderNoTradeZoneCard() {
  if (!Array.isArray(state.noTradeZones) || !state.noTradeZones.length) {
    return "";
  }

  return `
    <article class="settings-card compact-card">
      <div class="settings-head">
        <div>
          <p class="eyebrow">${t("home.noTradeTitle")}</p>
          <h3 class="settings-title">${t("home.noTradeTitle")}</h3>
        </div>
      </div>
      <p class="helper-text">${t("home.noTradeCopy")}</p>
      <div class="activity-list">
        ${state.noTradeZones.slice(0, 4).map((entry) => `
          <article class="activity-item">
            <div class="activity-head">
              <strong>${entry.pair}</strong>
              <span class="small-chip">${getSessionLabel(entry.session)}</span>
            </div>
            <p class="helper-text">${localizedText(entry.reason)}</p>
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

function renderSignalHistoryCard() {
  const stats = getSignalHistoryStats();
  const history = Array.isArray(state.signalHistory) ? state.signalHistory : [];

  return `
    <article class="settings-card compact-card">
      <div class="settings-head">
        <div>
          <p class="eyebrow">${t("home.historyTitle")}</p>
          <h3 class="settings-title">${t("home.historyTitle")}</h3>
        </div>
      </div>
      <div class="hero-stats history-stats">
        <div class="hero-stat">
          <span class="meta-label">${t("home.statsWinRate")}</span>
          <strong class="meta-value">${stats.winRate}%</strong>
        </div>
        <div class="hero-stat">
          <span class="meta-label">Win / Loss</span>
          <strong class="meta-value">${stats.wins} / ${stats.losses}</strong>
        </div>
        <div class="hero-stat">
          <span class="meta-label">${t("home.statsOpen")}</span>
          <strong class="meta-value">${stats.open}</strong>
        </div>
        <div class="hero-stat">
          <span class="meta-label">Total</span>
          <strong class="meta-value">${history.length}</strong>
        </div>
      </div>
      ${
        history.length
          ? `
            <div class="activity-list">
              ${history.slice(0, 4).map((entry) => `
                <article class="activity-item">
                  <div class="activity-head">
                    <div class="activity-topline">
                      <span class="side-pill ${entry.side}">${t(`signal.${entry.side}`)}</span>
                      <span class="status-pill status-${entry.status}">${getHistoryStatusLabel(entry.status)}</span>
                    </div>
                    <strong>${entry.pair}</strong>
                  </div>
                  <div class="activity-grid">
                    <span>${t("signal.entry")}: ${formatNumber(entry.entry, 4)}</span>
                    <span>${t("signal.confidence")}: ${entry.confidence}%</span>
                    <span>${t("market.session")}: ${getSessionLabel(entry.session)}</span>
                    <span>${formatTimestamp(entry.createdAt)}</span>
                  </div>
                </article>
              `).join("")}
            </div>
          `
          : `<p class="helper-text">${t("home.historyEmpty")}</p>`
      }
    </article>
  `;
}

function renderMarketDetailCard() {
  const selectedEntry = getSelectedMarketEntry();
  if (!selectedEntry) {
    return `
      <article class="hero-card">
        <div class="hero-head">
          <div>
            <p class="eyebrow">${t("market.details")}</p>
            <h3 class="section-title">${t("market.selectHint")}</h3>
          </div>
        </div>
      </article>
    `;
  }

  const analytics = getPairAnalytics(selectedEntry.pair);
  const signal = getCurrentSignalForPair(selectedEntry.pair);
  const riskPlan = buildRiskPlan(selectedEntry.price, analytics, signal, selectedEntry.pair);
  const sparkline = renderSparkline(analytics?.sparkline || []);

  return `
    <article class="hero-card detail-card">
      <div class="hero-head">
        <div>
          <p class="eyebrow">${t("market.details")}</p>
          <h3 class="section-title">${selectedEntry.pair}</h3>
        </div>
        <span class="status-pill ${selectedEntry.status}">${getStatusLabel(selectedEntry.status)}</span>
      </div>
      ${sparkline}
      <p class="helper-text">${localizedText(selectedEntry.summary) || localizedText(analytics?.summary)}</p>
      <div class="market-grid">
        <div class="market-meta-box"><span class="meta-label">${t("market.session")}</span><strong class="meta-value">${getSessionLabel(selectedEntry.session)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">${t("market.structure")}</span><strong class="meta-value">${localizedText(selectedEntry.marketStructure) || "--"}</strong></div>
        <div class="market-meta-box"><span class="meta-label">EMA 50</span><strong class="meta-value">${formatNumber(analytics?.ema50, 4)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">EMA 200</span><strong class="meta-value">${formatNumber(analytics?.ema200, 4)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">RSI</span><strong class="meta-value">${formatNumber(analytics?.rsi14, 2)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">MACD</span><strong class="meta-value">${formatNumber(analytics?.macd?.histogram, 4)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">${t("market.support")}</span><strong class="meta-value">${formatNumber(analytics?.support, 4)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">${t("market.resistance")}</span><strong class="meta-value">${formatNumber(analytics?.resistance, 4)}</strong></div>
        <div class="market-meta-box"><span class="meta-label">${t("market.volume")}</span><strong class="meta-value">${formatNumber(analytics?.volumeRatio, 2)}x</strong></div>
        <div class="market-meta-box"><span class="meta-label">${t("market.change")}</span><strong class="meta-value">${formatNumber(selectedEntry.changePercent ?? analytics?.changePercent, 2)}%</strong></div>
      </div>
      ${
        localizedText(selectedEntry.noTradeReason)
          ? `
            <div class="warning-card">
              <strong>${t("market.noTradeReady")}</strong>
              <p>${localizedText(selectedEntry.noTradeReason)}</p>
            </div>
          `
          : ""
      }
      <article class="planner-card">
        <div class="settings-head">
          <div>
            <p class="eyebrow">${t("market.riskPlanner")}</p>
            <h3 class="settings-title">${signal ? `${t(`signal.${signal.side}`)} • ${selectedEntry.pair}` : selectedEntry.pair}</h3>
          </div>
          ${signal ? `<span class="small-chip">${signal.confidence}%</span>` : `<span class="small-chip">${t("market.autoStops")}</span>`}
        </div>
        <form id="riskPlannerForm" class="planner-form">
          <label class="field planner-field">
            <span>${t("market.capital")}</span>
            <input name="capital" type="number" min="10" step="10" value="${getTradeCapital()}" />
          </label>
          <button class="ghost-button" type="submit">${t("market.riskPlanner")}</button>
        </form>
        ${
          riskPlan
            ? `
              <div class="market-grid">
                <div class="market-meta-box"><span class="meta-label">${t("market.riskPerTrade")}</span><strong class="meta-value">${formatNumber(riskPlan.riskAmount, 2)}</strong></div>
                <div class="market-meta-box"><span class="meta-label">${t("market.positionSize")}</span><strong class="meta-value">${formatNumber(riskPlan.positionSize, 3)}</strong></div>
                <div class="market-meta-box"><span class="meta-label">${t("market.autoStops")}</span><strong class="meta-value">SL ${formatNumber(riskPlan.stop, 4)} • TP ${formatNumber(riskPlan.target, 4)}</strong></div>
                <div class="market-meta-box"><span class="meta-label">${t("market.expectedReward")}</span><strong class="meta-value">${formatNumber(riskPlan.rewardAmount, 2)}</strong></div>
              </div>
            `
            : ""
        }
        <p class="helper-text">${t("market.autoEntryHint")}</p>
        <div class="subscription-actions">
          <button class="primary-button" data-action="show-auto-entry-info" type="button">${t("settings.autoEntry")}</button>
          <button class="action-button" data-action="show-exchange-info" type="button">${t("settings.connectExchange")}</button>
        </div>
      </article>
    </article>
  `;
}

function renderPairSettingsCard() {
  const enabledPairs = new Set(getEnabledPairs());
  const watchlist = new Set(getWatchlist());
  const market = [...(state.dataLoaded ? state.liveMarketPairs : fallbackMarket)]
    .sort((left, right) => left.pair.localeCompare(right.pair));

  return `
    <article class="settings-card">
      <div class="settings-head compact-section-head">
        <h3 class="settings-title">${t("settings.pairsTitle")}</h3>
      </div>
      <p class="helper-text">${t("settings.pairsHint")}</p>
      <div class="pair-settings-list compact-pair-settings-list">
        ${market.map((pair) => `
          <article class="pair-settings-item compact-pair-settings-item">
            <strong>${pair.pair}</strong>
            <div class="pair-settings-actions compact-pair-settings-actions">
              <button class="chip-button compact-chip ${enabledPairs.has(pair.pair) ? "active" : ""}" data-action="toggle-pair-setting" data-pair="${pair.pair}" type="button">
                ${enabledPairs.has(pair.pair) ? "ON" : "OFF"}
              </button>
              <button class="chip-button compact-chip ${watchlist.has(pair.pair) ? "active" : ""}" data-action="toggle-watchlist" data-pair="${pair.pair}" type="button">
                ${watchlist.has(pair.pair) ? "★" : "+"}
              </button>
            </div>
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

function renderPushHistoryCard() {
  const history = Array.isArray(state.pushHistory) ? state.pushHistory : [];

  return `
    <article class="settings-card">
      <div class="settings-head">
        <div>
          <p class="eyebrow">${t("settings.pushHistory")}</p>
          <h3 class="settings-title">${t("settings.pushHistory")}</h3>
        </div>
      </div>
      ${
        history.length
          ? `
            <div class="activity-list">
              ${history.slice(0, 6).map((entry) => `
                <article class="activity-item">
                  <div class="activity-head">
                    <strong>${entry.title}</strong>
                    <span class="small-chip">${formatTimestamp(entry.sentAt)}</span>
                  </div>
                  <p class="helper-text">${entry.body}</p>
                </article>
              `).join("")}
            </div>
          `
          : `<p class="helper-text">${t("settings.pushHistoryEmpty")}</p>`
      }
    </article>
  `;
}

function renderHomeScreen() {
  const visibleSignals = getVisibleSignals();
  const bestSignal = visibleSignals[0];
  const bestLevel = bestSignal ? getSignalLevel(bestSignal) : null;
  const plan = getPlanInfo();
  const enabledPairsCount = getEnabledPairs().length;

  return `
    <div class="screen-stack">
      <div class="section-header">
        <h2 class="screen-title">${t("home.title")}</h2>
      </div>

      <article class="hero-card">
        <div class="hero-head">
          <div>
            <p class="eyebrow">${t("home.bestSetup")}</p>
            <h3 class="section-title">${bestSignal ? bestSignal.pair : t("home.noSignals")}</h3>
          </div>
          ${bestSignal ? `<span class="level-pill ${bestLevel.key}">${bestLevel.label}</span>` : `<span class="small-chip">${t("market.waiting")}</span>`}
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="meta-label">${t("home.limit")}</span>
            <strong class="meta-value">${formatSignalsPerHour(plan.currentLimit)}</strong>
          </div>
          <div class="hero-stat">
            <span class="meta-label">${t("home.mood")}</span>
            <strong class="meta-value">${getMoodLabel()}</strong>
          </div>
          <div class="hero-stat">
            <span class="meta-label">${t("settings.pairsTitle")}</span>
            <strong class="meta-value">${enabledPairsCount}</strong>
          </div>
        </div>
      </article>

      ${renderNotificationPrompt()}
      ${renderNoTradeZoneCard()}

      ${
        visibleSignals.length
          ? `
            <div class="signal-list">
              ${visibleSignals
                .map((signal) => {
                  const level = getSignalLevel(signal);
                  return `
                    <article class="signal-card">
                      <div class="signal-head">
                        <div>
                          <div class="signal-topline">
                            <span class="side-pill ${signal.side}">${t(`signal.${signal.side}`)}</span>
                            <span class="level-pill ${level.key}">${level.label}</span>
                          </div>
                          <h3 class="signal-pair">${signal.pair}</h3>
                        </div>
                        <span class="quota-pill">${signal.confidence}%</span>
                      </div>
                      <p class="signal-reason">${localizedText(signal.reason)}</p>
                      <div class="signal-grid">
                        <div class="signal-meta"><span class="meta-label">${t("signal.entry")}</span><strong class="meta-value">${signal.entry}</strong></div>
                        <div class="signal-meta"><span class="meta-label">${t("signal.takeProfit")}</span><strong class="meta-value">${signal.takeProfit}</strong></div>
                        <div class="signal-meta"><span class="meta-label">${t("signal.stopLoss")}</span><strong class="meta-value">${signal.stopLoss}</strong></div>
                        <div class="signal-meta"><span class="meta-label">${t("signal.confidence")}</span><strong class="meta-value">${signal.confidence}%</strong></div>
                        <div class="signal-meta"><span class="meta-label">${t("signal.time")}</span><strong class="meta-value">${signal.time}</strong></div>
                        <div class="signal-meta"><span class="meta-label">${t("signal.life")}</span><strong class="meta-value">${signal.lifetime}</strong></div>
                      </div>
                      <button class="ghost-button pair-button" data-action="open-pair-market" data-pair="${signal.pair}" type="button">${t("home.viewMarket")}</button>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `
          : `
            <article class="empty-card">
              <h3 class="section-title">${t("home.noSignals")}</h3>
              <p class="empty-copy">${t("home.noSignalsCopy")}</p>
            </article>
          `
      }

      ${renderSignalHistoryCard()}
    </div>
  `;
}

function renderMarketScreen() {
  const market = getMarketFeed();

  return `
    <div class="screen-stack">
      <div class="section-header">
        <h2 class="screen-title">${t("market.title")}</h2>
      </div>

      <article class="hero-card">
        <div class="hero-head">
          <div>
            <p class="eyebrow">${t("market.mood")}</p>
            <h3 class="section-title">${getMoodLabel()}</h3>
          </div>
          ${
            state.selectedPair
              ? `
                <span class="selected-pair-chip">
                  <span class="selected-pair-label">${t("market.filtered")}</span>
                  <strong>${state.selectedPair}</strong>
                </span>
              `
              : `<span class="small-chip">${market.length}</span>`
          }
        </div>
        ${state.selectedPair ? `<button class="action-button" data-action="clear-pair-filter" type="button">${t("market.clearFilter")}</button>` : ""}
      </article>

      ${renderMarketDetailCard()}

      <div class="market-list">
        ${market
          .map(
            (pair) => `
              <article class="market-card">
                <div class="market-head">
                  <div class="market-pair">${pair.pair}</div>
                  <div class="market-price">
                    <strong>${pair.price}</strong>
                    <span class="status-pill ${pair.status}">${getStatusLabel(pair.status)}</span>
                  </div>
                </div>
                <div class="market-grid">
                  <div class="market-meta-box"><span class="meta-label">${t("market.trend")}</span><strong class="meta-value">${localizedText(pair.trend) || pair.trend}</strong></div>
                  <div class="market-meta-box"><span class="meta-label">${t("market.volatility")}</span><strong class="meta-value">${localizedText(pair.volatility) || pair.volatility}</strong></div>
                  <div class="market-meta-box"><span class="meta-label">${t("market.status")}</span><strong class="meta-value">${getStatusLabel(pair.status)}</strong></div>
                  <div class="market-meta-box"><span class="meta-label">${t("market.price")}</span><strong class="meta-value">${pair.price}</strong></div>
                </div>
                <button class="ghost-button pair-button" data-action="open-pair-market" data-pair="${pair.pair}" type="button">${t("market.watchPair")}</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderFiltersScreen() {
  return `
    <div class="screen-stack filters-screen">
      <div class="section-header">
        <h2 class="screen-title">${t("nav.filters")}</h2>
      </div>

      ${renderSessionFilterCard()}
      ${renderWatchlistCard()}
      ${renderPairSettingsCard()}
    </div>
  `;
}

function renderSignalLimitOptions() {
  const max = state.user?.plan === "plus" ? 10 : 2;
  const options = max === 10 ? [2, 4, 6, 8, 10] : [1, 2];
  const current = getSignalLimit();
  return `
    <div class="switcher signal-limit-picker">
      ${options
        .map(
          (value) => `
            <button class="theme-option ${current === value ? "active" : ""}" data-action="set-signal-limit" data-value="${value}" type="button">
              ${value}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSettingsScreen() {
  const plan = getPlanInfo();
  const activeLanguage = resolveLanguageKey();
  const hasAvatar = Boolean(state.user?.settings?.avatarDataUrl);

  return `
    <div class="screen-stack">
      <div class="section-header">
        <h2 class="screen-title">${t("settings.title")}</h2>
      </div>

      <article class="account-card">
        <div class="account-head">
          <div class="account-profile">
            <div class="avatar-shell">${getAvatarMarkup()}</div>
            <div>
              <p class="eyebrow">${t("settings.profileTitle")}</p>
              <h3 class="account-name">${state.user?.name || "-"}</h3>
              <p class="account-copy">${state.user?.email || ""}</p>
            </div>
          </div>
          <div class="topbar-side">
            <span class="plan-badge">${plan.label}</span>
            <span class="small-chip">${formatSignalsPerHour(plan.currentLimit)}</span>
          </div>
        </div>
        <div class="subscription-actions">
          <label class="ghost-button upload-button" for="avatarInput">${t("settings.changeAvatar")}</label>
          ${hasAvatar ? `<button class="action-button" data-action="clear-avatar" type="button">${t("settings.clearAvatar")}</button>` : ""}
        </div>
        <input id="avatarInput" class="hidden-input" type="file" accept="image/png,image/jpeg,image/webp" />
      </article>

      <article class="settings-card">
        <div class="settings-head">
          <div>
            <p class="eyebrow">${t("settings.language")}</p>
            <h3 class="settings-title">${t("settings.language")}</h3>
          </div>
        </div>
        <p class="helper-text">${t("settings.languageHint")}</p>
        <div class="language-grid">
          ${LANGUAGE_OPTIONS.map((language) => `
            <button
              class="language-option ${activeLanguage === language.code ? "active" : ""}"
              data-action="set-language"
              data-language="${language.code}"
              type="button"
            >${getLanguageLabel(language.code)}</button>
          `).join("")}
        </div>
      </article>

      <article class="settings-card">
        <div class="settings-head">
          <div><p class="eyebrow">${t("settings.theme")}</p><h3 class="settings-title">${t("settings.theme")}</h3></div>
        </div>
        <div class="switcher">
          <button class="theme-option ${state.theme === "dark" ? "active" : ""}" data-action="set-theme" data-theme="dark" type="button">${t("settings.dark")}</button>
          <button class="theme-option ${state.theme === "light" ? "active" : ""}" data-action="set-theme" data-theme="light" type="button">${t("settings.light")}</button>
        </div>
      </article>

      <article class="settings-card" data-settings-section="notifications">
        <div class="settings-list">
          <div class="settings-row">
            <span>${t("settings.notifications")}</span>
            <button class="ghost-button" data-action="toggle-notifications" type="button">${state.notificationsEnabled ? t("actions.disable") : t("actions.enable")}</button>
          </div>
          <div class="settings-row">
            <span>${t("settings.sounds")}</span>
            <button class="ghost-button" data-action="toggle-sounds" type="button">${state.soundsEnabled ? t("actions.disable") : t("actions.enable")}</button>
          </div>
        </div>
        <p class="helper-text">${t("settings.notificationsHint")}</p>
      </article>

      <article class="subscription-card">
        <div class="subscription-head">
          <div>
            <p class="eyebrow">${t("settings.tiersTitle")}</p>
            <h3 class="settings-title">${t("settings.subscription")}</h3>
          </div>
          <span class="small-chip">${formatSignalsPerHour(plan.currentLimit)}</span>
        </div>
        <div class="tier-grid">
          <article class="tier-card ${plan.plus ? "active" : ""}">
            <span class="plan-badge">${t("settings.plus")}</span>
            <strong>${t("settings.buyPlus")}</strong>
            <p class="helper-text">${t("settings.plusPerk")}</p>
          </article>
          <article class="tier-card">
            <span class="plan-badge">${t("settings.eliteLabel")}</span>
            <strong>${t("settings.buySoon")}</strong>
            <p class="helper-text">${t("settings.elitePerk")}</p>
          </article>
        </div>
        <p class="subscription-copy">${plan.plus ? t("home.plusCopy") : t("settings.promoHint")}</p>
        <div class="settings-row">
          <span>${t("settings.signalLimit")}</span>
          <strong>${formatSignalsPerHour(getSignalLimit())}</strong>
        </div>
        ${renderSignalLimitOptions()}
        ${!plan.plus ? `<button class="primary-button" data-action="buy-plus" type="button">${t("settings.buyPlus")}</button>` : ""}
        ${
          !plan.plus
            ? `
                <form id="promoForm" class="promo-form">
                  <label class="field">
                    <span>${t("settings.promoTitle")}</span>
                    <input name="code" type="text" placeholder="${t("settings.promoPlaceholder")}" autocomplete="off" required />
                  </label>
                  <button class="primary-button" type="submit">${t("settings.promoButton")}</button>
                </form>
                <p class="helper-text">${t("settings.promoHint")}</p>
              `
              : `<p class="helper-text">${t("settings.promoForever")}</p>`
        }
      </article>

      <article class="settings-card">
        <div class="settings-head">
          <div>
            <p class="eyebrow">${t("settings.exchangeTitle")}</p>
            <h3 class="settings-title">${t("settings.exchangeTitle")}</h3>
          </div>
        </div>
        <p class="helper-text">${t("settings.exchangeHint")}</p>
        <p class="helper-text">${t("settings.exchangeSecurity")}</p>
        <div class="subscription-actions">
          <button class="primary-button" data-action="show-exchange-info" type="button">${t("settings.connectExchange")}</button>
          <button class="action-button" data-action="show-auto-entry-info" type="button">${t("settings.autoEntry")}</button>
        </div>
        <p class="helper-text">${t("settings.autoEntryHint")}</p>
      </article>

      <article class="settings-card">
        <div class="settings-head">
          <div>
            <p class="eyebrow">${t("settings.supportTitle")}</p>
            <h3 class="settings-title">${t("settings.supportTitle")}</h3>
          </div>
        </div>
        <p class="helper-text">${t("settings.supportHint")}</p>
        <button class="ghost-button" data-action="show-support-info" type="button">${t("settings.supportButton")}</button>
      </article>

      ${renderInstallCard()}

      <article class="settings-card">
        <div class="settings-list">
          <div class="settings-row">
            <span>${t("settings.onboarding")}</span>
              <button class="action-button" data-action="reopen-intro" type="button">${t("settings.showIntro")}</button>
          </div>
          <div class="settings-row">
            <span>${t("settings.logout")}</span>
            <button class="action-button danger-button" data-action="logout" type="button">${t("settings.logout")}</button>
            </div>
          </div>
        </article>

        <article class="legal-card">
          <div>
            <p class="eyebrow">${t("settings.legalTitle")}</p>
            <h3 class="settings-title">${t("settings.legalTitle")}</h3>
          </div>
          <div class="legal-list">
            <p class="helper-text">${t("settings.legalLead")}</p>
            <p class="helper-text">${t("settings.legalData")}</p>
            <p class="helper-text">${t("settings.legalSignals")}</p>
            <p class="helper-text">${t("settings.legalPayments")}</p>
          </div>
          <p class="legal-warning">${t("settings.legalWarning")}</p>
        </article>

        <p class="helper-text">${t("misc.risk")}</p>
      </div>
    `;
  }

function renderPaymentSheet() {
  return "";
}

function renderNav() {
  return `
    <nav class="nav-bar ${state.navHidden ? "is-hidden" : ""}">
      <button class="nav-item ${state.activeTab === "home" ? "active" : ""}" data-action="set-tab" data-tab="home" type="button">${t("nav.home")}</button>
      <button class="nav-item ${state.activeTab === "market" ? "active" : ""}" data-action="set-tab" data-tab="market" type="button">${t("nav.market")}</button>
      <button class="nav-item ${state.activeTab === "filters" ? "active" : ""}" data-action="set-tab" data-tab="filters" type="button">${t("nav.filters")}</button>
      <button class="nav-item ${state.activeTab === "settings" ? "active" : ""}" data-action="set-tab" data-tab="settings" type="button">${t("nav.settings")}</button>
    </nav>
  `;
}

function renderLaunchSplash() {
  const letters = Array.from("TRADE AI")
    .map((letter, index) => `<span class="launch-letter ${letter === " " ? "space" : ""}" style="--letter-index:${index}">${letter === " " ? "&nbsp;" : letter}</span>`)
    .join("");
  return `
    <div class="launch-splash" aria-hidden="true">
      <div class="launch-orb"></div>
      <div class="launch-stack">
        <div class="launch-logo">${getLogoMarkup()}</div>
        <div class="launch-wordmark">${letters}</div>
      </div>
    </div>
  `;
}

function renderApp() {
  const screen = state.activeTab === "market"
    ? renderMarketScreen()
    : state.activeTab === "filters"
      ? renderFiltersScreen()
      : state.activeTab === "settings"
        ? renderSettingsScreen()
        : renderHomeScreen();
  return `
      <div class="app-shell">
        ${renderTopbar()}
        <main class="screens">${screen}</main>
        ${renderNav()}
        ${state.showSplash ? renderLaunchSplash() : ""}
      </div>
    `;
  }

function render() {
  applyDocumentState();
  const stage = getStage();

  if (stage === "intro") {
    stopLiveRefreshLoop();
    clearSplashTimer();
    appRoot.innerHTML = renderIntro();
    return;
  }

  if (stage === "loading") {
    stopLiveRefreshLoop();
    clearSplashTimer();
    appRoot.innerHTML = renderLoading();
    return;
  }

  if (stage === "auth") {
    stopLiveRefreshLoop();
    clearSplashTimer();
    appRoot.innerHTML = renderAuth();
    return;
  }

  appRoot.innerHTML = renderApp();
  scheduleSplashDismiss();
  ensureLiveRefreshLoop();
  focusPendingSettingsSection();
}

function setActiveTab(nextTab) {
  state.activeTab = nextTab;
  state.navHidden = false;
  state.paymentSheetOpen = false;
  render();
  const screens = document.querySelector(".screens");
  if (screens) {
    screens.classList.remove("tab-transition");
    void screens.offsetWidth;
    screens.classList.add("tab-transition");
  }
  if (nextTab === "market") {
    void refreshMarketData(true);
  }
}

function focusPendingSettingsSection() {
  if (state.activeTab !== "settings" || !state.pendingSettingsSection) {
    return;
  }

  const section = state.pendingSettingsSection;
  state.pendingSettingsSection = "";

  window.requestAnimationFrame(() => {
    const target = document.querySelector(`[data-settings-section="${section}"]`);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    target.classList.add("is-focused");
    window.setTimeout(() => {
      target.classList.remove("is-focused");
    }, 1600);
  });
}

function handleScroll() {
  const currentScrollY = window.scrollY;
  state.navHidden = false;
  const nav = document.querySelector(".nav-bar");
  if (nav) {
    nav.classList.remove("is-hidden");
  }
  lastScrollY = currentScrollY;
}

function handleClick(event) {
  const origin = event.target instanceof Element ? event.target : event.target?.parentElement;
  const button = origin?.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (["next-intro", "prev-intro", "finish-intro", "skip-intro"].includes(action)) {
    handleIntroAction(action);
    return;
  }

  if (action === "set-auth-mode") {
    state.authMode = button.dataset.mode || "login";
    playUiSound("tap");
    render();
    return;
  }

  if (action === "set-tab") {
    playUiSound("tap");
    setActiveTab(button.dataset.tab || "home");
    return;
  }

  if (action === "open-notification-settings") {
    state.pendingSettingsSection = "notifications";
    playUiSound("tap");
    setActiveTab("settings");
    return;
  }

  if (action === "open-payment-sheet" || action === "start-trial" || action === "buy-plus") {
    showSubscriptionPlaceholder();
    return;
  }

  if (action === "payment-sheet") {
    return;
  }

  if (action === "close-payment-sheet") {
    closePaymentSheet();
    return;
  }

  if (action === "open-pair-market") {
    state.selectedPair = String(button.dataset.pair || "");
    playUiSound("tap");
    showToast(t("appName"), t("misc.pairOpened"), "info");
    setActiveTab("market");
    return;
  }

  if (action === "clear-pair-filter") {
    state.selectedPair = "";
    playUiSound("tap");
    setActiveTab("market");
    return;
  }

  if (action === "set-language") {
    void setLanguage(String(button.dataset.language || "ru"));
    return;
  }

  if (action === "set-theme") {
    void setTheme(String(button.dataset.theme || "dark"));
    return;
  }

  if (action === "toggle-notifications") {
    void toggleNotifications();
    return;
  }

  if (action === "toggle-sounds") {
    void toggleSounds();
    return;
  }

  if (action === "set-signal-limit") {
    void setSignalLimit(Number(button.dataset.value || 1));
    return;
  }

  if (action === "checkout") {
    closePaymentSheet();
    void startCheckout(String(button.dataset.provider || "stripe"));
    return;
  }

  if (action === "oauth-google") {
    void startOAuth("google");
    return;
  }

  if (action === "oauth-apple") {
    void startOAuth("apple");
    return;
  }

  if (action === "toggle-session-setting") {
    void togglePreferredSession(String(button.dataset.session || ""));
    return;
  }

  if (action === "toggle-pair-setting") {
    void toggleEnabledPair(String(button.dataset.pair || ""));
    return;
  }

  if (action === "toggle-watchlist") {
    void toggleWatchlistPair(String(button.dataset.pair || ""));
    return;
  }

  if (action === "clear-avatar") {
    void clearAvatar();
    return;
  }

  if (action === "show-support-info") {
    showSupportPlaceholder();
    return;
  }

  if (action === "show-exchange-info") {
    showExchangePlaceholder();
    return;
  }

  if (action === "show-auto-entry-info") {
    showAutoEntryPlaceholder();
    return;
  }

  if (action === "store-billing-info") {
    closePaymentSheet();
    showToast(t("appName"), t("misc.storeBillingInfo"), "info");
    return;
  }

  if (action === "reopen-intro") {
    state.onboardingSeen = false;
    state.onboardingStep = 0;
    localStorage.setItem(STORAGE_KEYS.introSeen, "false");
    playUiSound("tap");
    render();
    return;
  }

  if (action === "logout") {
    void logout();
  }
}

function handleSubmit(event) {
  if (!(event.target instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (event.target.id === "authForm") {
    void handleAuthSubmit(event.target);
    return;
  }
  if (event.target.id === "promoForm") {
    void activatePromoCode(event.target);
    return;
  }
  if (event.target.id === "riskPlannerForm") {
    const formData = new FormData(event.target);
    saveTradeCapital(formData.get("capital"));
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === "avatarInput") {
    const file = target.files?.[0];
    target.value = "";
    if (file) {
      void updateAvatar(file).catch(() => {
        showToast(t("appName"), t("misc.apiError"), "info");
      });
    }
  }
}

async function resetServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    return;
  }
}

async function applyCheckoutStatusFromUrl() {
  const url = new URL(window.location.href);
  const status = url.searchParams.get("checkout");
  const sessionId = url.searchParams.get("session_id");
  if (!status) return;
  if (status === "success") {
    if (sessionId && state.token) {
      try {
        const payload = await apiRequest(`/api/payments/confirm?session_id=${encodeURIComponent(sessionId)}`);
        if (payload.user) {
          syncUserToState(payload.user);
          render();
        }
      } catch (error) {
        showToast(t("appName"), error instanceof Error ? error.message : t("misc.apiError"), "info");
      }
    }
    showToast(t("appName"), t("misc.planUpgraded"), "long");
  }
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", url.toString());
}

async function applyOauthStatusFromUrl() {
  const url = new URL(window.location.href);
  const status = String(url.searchParams.get("oauth") || "").trim();
  const message = String(url.searchParams.get("message") || "").trim();
  if (!status) return;

  if (status === "success") {
    showToast(t("appName"), t("misc.oauthSuccess"), "info");
  } else {
    showToast(t("appName"), message || t("misc.apiError"), "info");
  }

  url.searchParams.delete("oauth");
  url.searchParams.delete("provider");
  url.searchParams.delete("message");
  window.history.replaceState({}, "", url.toString());
}

async function registerServiceWorker() {
  if (!supportsWebPush()) {
    return;
  }

  try {
    await getServiceWorkerRegistration();
  } catch {
    return;
  }
}

document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
window.addEventListener("scroll", handleScroll, { passive: true });

render();
void applyCheckoutStatusFromUrl();
void applyOauthStatusFromUrl();
void loadSession();
void registerServiceWorker();
