import { CRYPTO_PAIRS, FOREX_PAIRS, SUPPORTED_PAIRS } from "./pairs.mjs";
import { atr, average, clamp, ema, macd, percentChange, rsi, supportResistance, trailingAverage } from "./indicators.mjs";
import { fetchBinanceCandles } from "./providers/binance.mjs";
import { fetchFrankfurterCandles } from "./providers/frankfurter.mjs";

const CACHE_TTL_MS = 60_000;
let snapshotCache = null;

function formatPrice(value, decimals) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatSignalTime(timestamp) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(timestamp) + " UTC";
}

function formatLifetime(pair) {
  return pair.market === "crypto" ? "90m" : "1d";
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

function buildReason(side, confirmations) {
  const selected = confirmations.slice(0, 3);

  if (side === "long") {
    return {
      ru: selected.length
        ? `${selected.join(", ")}. LONG только после сильного совпадения фильтров.`
        : "Рынок без чистого LONG-сценария. AI пропускает шум.",
      en: selected.length
        ? `${selected.join(", ")}. LONG is shown only after strong filter alignment.`
        : "The market has no clean LONG setup. AI is skipping noise.",
    };
  }

  return {
    ru: selected.length
      ? `${selected.join(", ")}. SHORT только после сильного совпадения фильтров.`
      : "Рынок без чистого SHORT-сценария. AI пропускает шум.",
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

function analyzePair(pair, candles) {
  if (!candles || candles.length < 220) {
    return {
      pair: pair.pair,
      price: "n/a",
      trend: getTrendLabel("sideways"),
      volatility: getVolatilityLabel("low"),
      status: "waiting",
      signal: null,
      diagnostics: {
        noTradeZone: true,
        confidence: 0,
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
  const volumeAverage = trailingAverage(volumes, 20);
  const volumeRatio = volumeAverage ? last.volume / volumeAverage : 0;
  const trendDirection = ema50 > ema200 ? "bullish" : ema50 < ema200 ? "bearish" : "sideways";
  const trendStrength = Math.abs(percentChange(ema50, ema200));
  const supportDistance = Math.abs(percentChange(last.close, levels.support));
  const resistanceDistance = Math.abs(percentChange(levels.resistance, last.close));
  const sideways = trendStrength < 0.12 && rsi14 > 46 && rsi14 < 54 && Math.abs(macdValue.histogram) < last.close * 0.0008;
  const noTradeZone = sideways || volatilityState === "high";

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
    longReasons.push("цена держится возле поддержки");
  }

  if (resistanceDistance <= 1.1 || last.close < levels.support * 1.003) {
    shortScore += 18;
    shortReasons.push("цена реагирует на сопротивление");
  }

  if (volumeRatio >= 1.08) {
    longScore += 12;
    shortScore += 12;
    longReasons.push(pair.market === "crypto" ? "есть volume spike" : "есть рост участия");
    shortReasons.push(pair.market === "crypto" ? "есть volume spike" : "есть рост участия");
  }

  if (volatilityState === "normal") {
    longScore += 10;
    shortScore += 10;
  }

  const dominantSide = longScore >= shortScore ? "long" : "short";
  const dominantScore = dominantSide === "long" ? longScore : shortScore;
  const confirmations = dominantSide === "long" ? longReasons : shortReasons;
  const confirmationCount = confirmations.length;
  const confidence = clamp(Math.round(dominantScore - (noTradeZone ? 16 : 0)), 0, 99);
  const ready = !noTradeZone && confidence >= 72 && confirmationCount >= 4;
  const forming = !ready && !noTradeZone && confidence >= 54 && confirmationCount >= 3;
  const status = ready ? "ready" : forming ? "forming" : "waiting";
  const takeProfitDistance = pair.market === "crypto" ? 0.018 : 0.0075;
  const stopLossDistance = pair.market === "crypto" ? 0.01 : 0.004;
  const price = last.close;
  const entry = formatPrice(price, pair.decimals);
  const takeProfit = dominantSide === "long"
    ? formatPrice(price * (1 + takeProfitDistance), pair.decimals)
    : formatPrice(price * (1 - takeProfitDistance), pair.decimals);
  const stopLoss = dominantSide === "long"
    ? formatPrice(price * (1 - stopLossDistance), pair.decimals)
    : formatPrice(price * (1 + stopLossDistance), pair.decimals);

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
        reason: buildReason(dominantSide, confirmations),
      }
    : null;

  return {
    id: pair.id,
    pair: pair.pair,
    price: formatPrice(price, pair.decimals),
    trend: getTrendLabel(trendDirection),
    volatility: getVolatilityLabel(volatilityState),
    status,
    signal,
    diagnostics: {
      confidence,
      noTradeZone,
      ema50,
      ema200,
      rsi14,
      macd: macdValue,
      support: levels.support,
      resistance: levels.resistance,
      atrPercent,
      volumeRatio,
      changePercent: percentChange(last.close, previous.close),
    },
  };
}

function getMarketMood(marketRows) {
  const readyCount = marketRows.filter((pair) => pair.status === "ready").length;
  const waitingCount = marketRows.filter((pair) => pair.status === "waiting").length;

  if (readyCount >= 3 && waitingCount <= 3) {
    return "opportunity";
  }
  if (waitingCount >= 5) {
    return "dangerous";
  }
  if (readyCount <= 1) {
    return "calm";
  }
  return "volatile";
}

async function fetchCryptoMap() {
  const entries = await Promise.all(
    CRYPTO_PAIRS.map(async (pair) => [pair.id, await fetchBinanceCandles(pair.symbol, "15m", 260)]),
  );
  return new Map(entries);
}

export async function getSnapshot(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > now) {
    return snapshotCache.payload;
  }

  const [cryptoMap, forexMap] = await Promise.all([
    fetchCryptoMap(),
    fetchFrankfurterCandles(420),
  ]);

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
      notes: {
        forexVolume: "Forex uses a participation proxy instead of centralized spot volume.",
      },
    },
    analytics,
  };

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
    signals: snapshot.signals.slice(0, plan === "plus" ? 10 : 2),
  };
}
