import { getPairLabelList } from "./pairs.mjs";

export const SESSION_KEYS = ["asia", "london", "newyork"];
export const LANGUAGE_CODES = [
  "en",
  "ru",
  "uk",
  "es",
  "pt",
  "de",
  "fr",
  "it",
  "tr",
  "pl",
  "ro",
  "cs",
  "nl",
  "sv",
  "ar",
  "hi",
  "zh",
  "ja",
  "ko",
  "id",
];

const DEFAULT_WATCHLIST = ["EUR/USD", "BTC/USDT", "ETH/USDT"];
const STATUS_RANK = new Map([
  ["ready", 0],
  ["forming", 1],
  ["waiting", 2],
  ["no_trade", 3],
]);

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function getDefaultEnabledPairs() {
  return getPairLabelList();
}

export function getDefaultPreferredSessions() {
  return [...SESSION_KEYS];
}

export function getDefaultWatchlist() {
  const supported = new Set(getPairLabelList());
  return DEFAULT_WATCHLIST.filter((pair) => supported.has(pair));
}

export function normalizeEnabledPairs(values) {
  const supported = new Set(getPairLabelList());
  const normalized = uniqueStrings(Array.isArray(values) ? values : []).filter((pair) => supported.has(pair));
  return normalized.length ? normalized : getDefaultEnabledPairs();
}

export function normalizePreferredSessions(values) {
  const allowed = new Set(SESSION_KEYS);
  const normalized = uniqueStrings(Array.isArray(values) ? values : [])
    .map((value) => value.toLowerCase())
    .filter((session) => allowed.has(session));
  return normalized.length ? normalized : getDefaultPreferredSessions();
}

export function normalizeWatchlist(values) {
  const supported = new Set(getPairLabelList());
  const normalized = uniqueStrings(Array.isArray(values) ? values : []).filter((pair) => supported.has(pair));
  return normalized.length ? normalized.slice(0, 8) : getDefaultWatchlist();
}

export function ensureUserSettings(settings = {}) {
  return {
    language: LANGUAGE_CODES.includes(String(settings.language || "").trim().toLowerCase())
      ? String(settings.language).trim().toLowerCase()
      : "ru",
    theme: settings.theme === "light" ? "light" : "dark",
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    soundsEnabled: "soundsEnabled" in settings ? Boolean(settings.soundsEnabled) : true,
    enabledPairs: normalizeEnabledPairs(settings.enabledPairs),
    preferredSessions: normalizePreferredSessions(settings.preferredSessions),
    watchlist: normalizeWatchlist(settings.watchlist),
    avatarDataUrl: typeof settings.avatarDataUrl === "string" ? settings.avatarDataUrl : "",
  };
}

export function getVisibleSignalLimit(user) {
  const fallback = user?.plan === "plus" ? 10 : 2;
  return Math.max(1, Number(user?.signalLimit || fallback));
}

export function isPairEnabledForUser(pairLabel, user) {
  return normalizeEnabledPairs(user?.settings?.enabledPairs).includes(pairLabel);
}

export function isSessionEnabledForUser(sessionKey, user) {
  if (!sessionKey) {
    return true;
  }
  return normalizePreferredSessions(user?.settings?.preferredSessions).includes(String(sessionKey).toLowerCase());
}

export function filterSignalsForUser(signals, user, pairFilter = "") {
  return (Array.isArray(signals) ? signals : []).filter((signal) => {
    if (pairFilter && signal.pair !== pairFilter) {
      return false;
    }
    if (!pairFilter && !isPairEnabledForUser(signal.pair, user)) {
      return false;
    }
    return isSessionEnabledForUser(signal.session, user);
  });
}

export function filterMarketForUser(market, user, pairFilter = "") {
  return (Array.isArray(market) ? market : []).filter((entry) => {
    if (pairFilter) {
      return entry.pair === pairFilter;
    }
    if (!isPairEnabledForUser(entry.pair, user)) {
      return false;
    }
    return isSessionEnabledForUser(entry.session, user);
  });
}

export function sortMarketForUser(market, user) {
  const watchlist = normalizeWatchlist(user?.settings?.watchlist);
  const watchRank = new Map(watchlist.map((pair, index) => [pair, index]));

  return [...(Array.isArray(market) ? market : [])].sort((left, right) => {
    const leftWatch = watchRank.has(left.pair) ? watchRank.get(left.pair) : Number.POSITIVE_INFINITY;
    const rightWatch = watchRank.has(right.pair) ? watchRank.get(right.pair) : Number.POSITIVE_INFINITY;

    if (leftWatch !== rightWatch) {
      return leftWatch - rightWatch;
    }

    const leftRank = STATUS_RANK.get(left.status) ?? 99;
    const rightRank = STATUS_RANK.get(right.status) ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return String(left.pair || "").localeCompare(String(right.pair || ""));
  });
}
