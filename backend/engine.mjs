import { CRYPTO_PAIRS, SUPPORTED_PAIRS } from "./pairs.mjs";
import { getPlanSignalCap, normalizePlan } from "./preferences.mjs";
import { atr, clamp, ema, macd, percentChange, rsi, supportResistance, trailingAverage } from "./indicators.mjs";
import { fetchBinanceCandles } from "./providers/binance.mjs";
import { fetchFrankfurterCandles } from "./providers/frankfurter.mjs";

const CACHE_TTL_MS = 60_000;
let snapshotCache = null;

function chunkArray(values, chunkSize) {
  const chunks = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function formatPrice(value, decimals) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatSignalTime(timestamp) {
  return `${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(timestamp)} UTC`;
}

function formatLifetime(pair) {
  return pair.market === "crypto" ? "90m" : "1d";
}

function getSessionKey(timestamp = Date.now()) {
  const hour = new Date(timestamp).getUTCHours();
  if (hour < 8) {
    return "asia";
  }
  if (hour < 16) {
    return "london";
  }
  return "newyork";
}

function getSessionLabel(session) {
  if (session === "asia") {
    return { ru: "Азия", en: "Asia" };
  }
  if (session === "london") {
    return { ru: "Лондон", en: "London" };
  }
  return { ru: "Нью-Йорк", en: "New York" };
}

function getTrendLabel(direction) {
  if (direction === "bullish") {
    return { ru: "Восходящий", en: "Bullish" };
  }
  if (direction === "bearish") {
    return { ru: "Нисходящий", en: "Bearish" };
  }
  return { ru: "Боковой", en: "Sideways" };
}

function getVolatilityLabel(level) {
  if (level === "normal") {
    return { ru: "Нормальная", en: "Normal" };
  }
  if (level === "high") {
    return { ru: "Высокая", en: "High" };
  }
  return { ru: "Низкая", en: "Low" };
}

function getMarketStructureLabel(direction, rsiValue, histogram) {
  if (direction === "bullish" && rsiValue >= 55 && histogram > 0) {
    return { ru: "Бычья структура", en: "Bullish structure" };
  }
  if (direction === "bearish" && rsiValue <= 45 && histogram < 0) {
    return { ru: "Медвежья структура", en: "Bearish structure" };
  }
  return { ru: "Нейтральная структура", en: "Neutral structure" };
}

function buildReason(side, confirmations) {
  const selected = confirmations.slice(0, 3);

  if (side === "long") {
    return {
      ru: selected.length
        ? `${selected.join(", ")}. LONG показывается только при сильном совпадении фильтров.`
        : "Чистого LONG-сетапа нет. AI пропускает шум.",
      en: selected.length
        ? `${selected.join(", ")}. LONG is shown only after strong filter alignment.`
        : "The market has no clean LONG setup. AI is skipping noise.",
    };
  }

  return {
    ru: selected.length
      ? `${selected.join(", ")}. SHORT показывается только при сильном совпадении фильтров.`
      : "Чистого SHORT-сетапа нет. AI пропускает шум.",
    en: selected.length
      ? `${selected.join(", ")}. SHORT is shown only after strong filter alignment.`
      : "The market has no clean SHORT setup. AI is skipping noise.",
  };
}

function getVolatilityState(currentAtrPercent) {
  if (currentAtrPercent > 2.8) {
    return "high";
  }
  if (currentAtrPercent < 0.35) {
    return "low";
  }
  return "normal";
}

function getVolumeState(volumeRatio) {
  if (volumeRatio >= 1.12) {
    return "spike";
  }
  if (volumeRatio <= 0.82) {
    return "low";
  }
  return "steady";
}

function buildNoTradeReason({ sideways, volatilityState, volumeState, supportDistance, resistanceDistance }) {
  if (volatilityState === "high") {
    return {
      key: "volatility",
      ru: "No trade zone: волатильность слишком высокая.",
      en: "No trade zone: volatility is too high.",
    };
  }

  if (volumeState === "low") {
    return {
      key: "volume",
      ru: "No trade zone: слабое участие объёма.",
      en: "No trade zone: market participation is too weak.",
    };
  }

  if (supportDistance > 2.2 && resistanceDistance > 2.2) {
    return {
      key: "levels",
      ru: "No trade zone: цена далеко от ключевых уровней.",
      en: "No trade zone: price is too far from key levels.",
    };
  }

  if (sideways) {
    return {
      key: "trend",
      ru: "No trade zone: тренд слабый и импульс не подтверждён.",
      en: "No trade zone: trend is weak and momentum is not confirmed.",
    };
  }

  return {
    key: "waiting",
    ru: "Пока нет чистого сетапа. AI ждёт подтверждения.",
    en: "No clean setup yet. AI is waiting for confirmation.",
  };
}

function buildAiSummary({ trendDirection, volumeState, breakoutLikely, noTradeReason }) {
  if (noTradeReason) {
    return {
      ru: noTradeReason.ru,
      en: noTradeReason.en,
    };
  }

  if (trendDirection === "bullish" && breakoutLikely && volumeState === "spike") {
    return {
      ru: "Тренд бычий, объём усиливается, возможен пробой вверх.",
      en: "Trend is bullish, volume is rising, and an upside breakout is possible.",
    };
  }

  if (trendDirection === "bearish" && breakoutLikely && volumeState === "spike") {
    return {
      ru: "Тренд медвежий, объём усиливается, возможен пробой вниз.",
      en: "Trend is bearish, volume is rising, and a downside breakout is possible.",
    };
  }

  if (trendDirection === "bullish") {
    return {
      ru: "Тренд бычий. Импульс формируется, рынок ищет подтверждение.",
      en: "Trend is bullish. Momentum is building and the market is looking for confirmation.",
    };
  }

  if (trendDirection === "bearish") {
    return {
      ru: "Тренд медвежий. Импульс формируется, рынок ищет подтверждение.",
      en: "Trend is bearish. Momentum is building and the market is looking for confirmation.",
    };
  }

  return {
    ru: "Рынок нейтральный. Сильного преимущества пока нет.",
    en: "The market is neutral. There is no strong edge yet.",
  };
}

function buildSparkline(closes) {
  return closes.slice(-24).map((value) => Number(value.toFixed(6)));
}

function analyzePair(pair, candles) {
  if (!candles || candles.length < 220) {
    const session = getSessionKey();
    const noTradeReason = {
      ru: "No trade zone: данных пока недостаточно.",
      en: "No trade zone: there is not enough market data yet.",
    };

    return {
      id: pair.id,
      pair: pair.pair,
      price: "n/a",
      trend: getTrendLabel("sideways"),
      volatility: getVolatilityLabel("low"),
      status: "no_trade",
      session,
      sessionLabel: getSessionLabel(session),
      marketStructure: getMarketStructureLabel("sideways", 50, 0),
      summary: noTradeReason,
      noTradeReason,
      signal: null,
      diagnostics: {
        pair: pair.pair,
        session,
        sessionLabel: getSessionLabel(session),
        noTradeZone: true,
        confidence: 0,
        noTradeReason,
        summary: noTradeReason,
        sparkline: [],
        marketStructure: getMarketStructureLabel("sideways", 50, 0),
      },
    };
  }

  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume ?? 0);
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsi14 = rsi(closes, 14);
  const macdValue = macd(closes);
  const levels = supportResistance(candles, 40);
  const currentAtr = atr(candles, 14);
  const atrPercent = last.close ? (currentAtr / last.close) * 100 : 0;
  const volatilityState = getVolatilityState(atrPercent);
  const volatilityLabel = getVolatilityLabel(volatilityState);
  const volumeAverage = trailingAverage(volumes, 20);
  const volumeRatio = volumeAverage ? last.volume / volumeAverage : 0;
  const volumeState = getVolumeState(volumeRatio);
  const trendDirection = ema50 > ema200 ? "bullish" : ema50 < ema200 ? "bearish" : "sideways";
  const trendLabel = getTrendLabel(trendDirection);
  const trendStrength = Math.abs(percentChange(ema50, ema200));
  const supportDistance = Math.abs(percentChange(last.close, levels.support));
  const resistanceDistance = Math.abs(percentChange(levels.resistance, last.close));
  const breakoutLikely = last.close > levels.resistance * 0.997 || last.close < levels.support * 1.003;
  const sideways = trendStrength < 0.12 && rsi14 > 46 && rsi14 < 54 && Math.abs(macdValue.histogram) < last.close * 0.0008;
  const noTradeReason = buildNoTradeReason({
    sideways,
    volatilityState,
    volumeState,
    supportDistance,
    resistanceDistance,
  });
  const noTradeZone = Boolean(noTradeReason && (sideways || volatilityState === "high" || volumeState === "low" || (supportDistance > 2.2 && resistanceDistance > 2.2)));
  const session = getSessionKey(last.time);
  const sessionLabel = getSessionLabel(session);
  const marketStructure = getMarketStructureLabel(trendDirection, rsi14, macdValue.histogram);

  let longScore = 0;
  let shortScore = 0;
  const longReasons = [];
  const shortReasons = [];

  if (trendDirection === "bullish") {
    longScore += 24;
    longReasons.push("EMA 50 выше EMA 200");
  }

  if (trendDirection === "bearish") {
    shortScore += 24;
    shortReasons.push("EMA 50 ниже EMA 200");
  }

  if (rsi14 >= 55) {
    longScore += 14;
    longReasons.push("RSI подтверждает импульс");
  }

  if (rsi14 <= 45) {
    shortScore += 14;
    shortReasons.push("RSI подтверждает слабость");
  }

  if (macdValue.line > macdValue.signal && macdValue.histogram > 0) {
    longScore += 14;
    longReasons.push("MACD усиливается вверх");
  }

  if (macdValue.line < macdValue.signal && macdValue.histogram < 0) {
    shortScore += 14;
    shortReasons.push("MACD разворачивается вниз");
  }

  if (supportDistance <= 1.1 || last.close > levels.resistance * 0.997) {
    longScore += 18;
    longReasons.push("Цена держится возле поддержки");
  }

  if (resistanceDistance <= 1.1 || last.close < levels.support * 1.003) {
    shortScore += 18;
    shortReasons.push("Цена реагирует на сопротивление");
  }

  if (volumeRatio >= 1.08) {
    longScore += 12;
    shortScore += 12;
    longReasons.push(pair.market === "crypto" ? "Есть volume spike" : "Есть рост участия");
    shortReasons.push(pair.market === "crypto" ? "Есть volume spike" : "Есть рост участия");
  }

  if (volatilityState === "normal") {
    longScore += 10;
    shortScore += 10;
  }

  const longAligned = trendDirection === "bullish" && rsi14 >= 57 && macdValue.line > macdValue.signal && macdValue.histogram > 0;
  const shortAligned = trendDirection === "bearish" && rsi14 <= 43 && macdValue.line < macdValue.signal && macdValue.histogram < 0;
  const pressureBonus = volumeState === "spike" ? 7 : volumeState === "steady" ? 3 : 0;

  if (longAligned) {
    longScore += 8 + pressureBonus;
    longReasons.push("Тренд и импульс идеально совпадают");
  }

  if (shortAligned) {
    shortScore += 8 + pressureBonus;
    shortReasons.push("Тренд и импульс идеально совпадают");
  }

  if (breakoutLikely && longAligned && last.close >= previous.close) {
    longScore += 6;
  }

  if (breakoutLikely && shortAligned && last.close <= previous.close) {
    shortScore += 6;
  }

  const dominantSide = longScore >= shortScore ? "long" : "short";
  const dominantScore = dominantSide === "long" ? longScore : shortScore;
  const confirmations = dominantSide === "long" ? longReasons : shortReasons;
  const confirmationCount = confirmations.length;
  const confidence = clamp(Math.round(dominantScore - (noTradeZone ? 18 : 0) - (sideways ? 8 : 0)), 0, 99);
  const ready = !noTradeZone && confidence >= 68 && confirmationCount >= 3;
  const forming = !ready && !noTradeZone && confidence >= 52 && confirmationCount >= 2;
  const status = noTradeZone ? "no_trade" : ready ? "ready" : forming ? "forming" : "waiting";
  const stopLossDistance = pair.market === "crypto"
    ? clamp((atrPercent * 0.65) / 100, 0.0065, 0.02)
    : clamp((atrPercent * 0.85) / 100, 0.0026, 0.0085);
  const takeProfitDistance = pair.market === "crypto"
    ? clamp(stopLossDistance * 1.9, 0.012, 0.038)
    : clamp(stopLossDistance * 2.05, 0.0055, 0.017);
  const price = last.close;
  const entry = formatPrice(price, pair.decimals);
  const takeProfit = dominantSide === "long"
    ? formatPrice(price * (1 + takeProfitDistance), pair.decimals)
    : formatPrice(price * (1 - takeProfitDistance), pair.decimals);
  const stopLoss = dominantSide === "long"
    ? formatPrice(price * (1 - stopLossDistance), pair.decimals)
    : formatPrice(price * (1 + stopLossDistance), pair.decimals);
  const summary = buildAiSummary({
    trendDirection,
    volumeState,
    breakoutLikely,
    noTradeReason: status === "no_trade" ? noTradeReason : null,
  });

  const signal = ready
    ? {
        id: `${pair.id}-${dominantSide}`,
        pair: pair.pair,
        side: dominantSide,
        entry,
        takeProfit,
        stopLoss,
        confidence,
        time: formatSignalTime(last.time),
        lifetime: formatLifetime(pair),
        session,
        marketStructure,
        reason: buildReason(dominantSide, confirmations),
      }
    : null;

  return {
    id: pair.id,
    pair: pair.pair,
    price: formatPrice(price, pair.decimals),
    trend: trendLabel,
    volatility: volatilityLabel,
    status,
    session,
    sessionLabel,
    marketStructure,
    summary,
    noTradeReason: status === "no_trade" ? noTradeReason : null,
    changePercent: Number(percentChange(last.close, previous.close).toFixed(2)),
    signal,
    diagnostics: {
      pair: pair.pair,
      session,
      sessionLabel,
      confidence,
      noTradeZone: status === "no_trade",
      noTradeReason: status === "no_trade" ? noTradeReason : null,
      summary,
      marketStructure,
      ema50,
      ema200,
      rsi14: Number(rsi14.toFixed(2)),
      macd: macdValue,
      support: levels.support,
      resistance: levels.resistance,
      atrPercent: Number(atrPercent.toFixed(2)),
      volumeRatio: Number(volumeRatio.toFixed(2)),
      volumeState,
      changePercent: Number(percentChange(last.close, previous.close).toFixed(2)),
      sparkline: buildSparkline(closes),
    },
  };
}

function getMarketMood(marketRows) {
  const readyCount = marketRows.filter((pair) => pair.status === "ready").length;
  const noTradeCount = marketRows.filter((pair) => pair.status === "no_trade").length;

  if (readyCount >= 3 && noTradeCount <= 2) {
    return "opportunity";
  }
  if (noTradeCount >= Math.ceil(marketRows.length / 2)) {
    return "dangerous";
  }
  if (readyCount <= 1) {
    return "calm";
  }
  return "volatile";
}

async function fetchCryptoMap() {
  const pairMap = new Map();
  const groups = chunkArray(CRYPTO_PAIRS, 8);

  for (const group of groups) {
    const entries = await Promise.all(
      group.map(async (pair) => {
        try {
          const candles = await fetchBinanceCandles(pair.symbol, "15m", 260);
          return [pair.id, candles];
        } catch {
          return [pair.id, []];
        }
      }),
    );

    for (const [pairId, candles] of entries) {
      pairMap.set(pairId, candles);
    }
  }

  return pairMap;
}

async function fetchForexMap() {
  try {
    return await fetchFrankfurterCandles(420);
  } catch {
    return new Map();
  }
}

export async function getSnapshot(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > now) {
    return snapshotCache.payload;
  }

  const [cryptoMap, forexMap] = await Promise.all([fetchCryptoMap(), fetchForexMap()]);

  const market = [];
  const analytics = {};
  const signals = [];

  for (const pair of SUPPORTED_PAIRS) {
    const candles = pair.market === "crypto" ? cryptoMap.get(pair.id) : forexMap.get(pair.id);
    const analysis = analyzePair(pair, candles);
    market.push({
      id: pair.id,
      pair: analysis.pair,
      price: analysis.price,
      trend: analysis.trend,
      volatility: analysis.volatility,
      status: analysis.status,
      session: analysis.session,
      sessionLabel: analysis.sessionLabel,
      marketStructure: analysis.marketStructure,
      summary: analysis.summary,
      noTradeReason: analysis.noTradeReason,
      changePercent: analysis.changePercent,
    });
    analytics[pair.id] = analysis.diagnostics;

    if (analysis.signal) {
      signals.push(analysis.signal);
    }
  }

  signals.sort((left, right) => right.confidence - left.confidence);
  const mood = getMarketMood(market);
  const bestSignal = signals[0] || null;

  const payload = {
    generatedAt: new Date(now).toISOString(),
    signals,
    market,
    meta: {
      mood,
      bestSignal: bestSignal?.pair || null,
      providers: {
        forex: "Frankfurter / ECB daily rates",
        crypto: "Binance public 15m klines",
      },
      providerStatus: {
        cryptoAvailable: cryptoMap.size > 0,
        forexAvailable: forexMap.size > 0,
        stale: false,
      },
      notes: {
        forexVolume: "Forex uses a participation proxy instead of centralized spot volume.",
      },
    },
    analytics,
  };

  if (!signals.length && snapshotCache?.payload) {
    return {
      ...snapshotCache.payload,
      meta: {
        ...(snapshotCache.payload.meta || {}),
        providerStatus: {
          ...(snapshotCache.payload.meta?.providerStatus || {}),
          stale: true,
        },
      },
    };
  }

  snapshotCache = {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  };

  return payload;
}

export async function getDashboard(plan = "free") {
  const snapshot = await getSnapshot(false);
  return {
    ...snapshot,
    signals: snapshot.signals.slice(0, getPlanSignalCap(normalizePlan(plan))),
  };
}
