import { FOREX_PAIRS } from "../pairs.mjs";

const FRANKFURTER_API = "https://api.frankfurter.dev/v1";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(daysBack) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - daysBack);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function groupPairsByBase() {
  return FOREX_PAIRS.reduce((groups, pair) => {
    if (!groups.has(pair.base)) {
      groups.set(pair.base, new Set());
    }
    groups.get(pair.base).add(pair.quote);
    return groups;
  }, new Map());
}

function createSyntheticCandles(closes) {
  const candles = [];

  for (let index = 0; index < closes.length; index += 1) {
    const current = closes[index];
    const previousClose = closes[index - 1]?.close ?? current.close;
    const open = previousClose;
    const close = current.close;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    const proxyVolume = Math.abs(close - previousClose) / Math.max(previousClose, 0.00001);

    candles.push({
      time: current.time,
      open,
      high,
      low,
      close,
      volume: proxyVolume,
    });
  }

  return candles;
}

export async function fetchFrankfurterCandles(daysBack = 420) {
  const { start, end } = getDateRange(daysBack);
  const grouped = groupPairsByBase();
  const responses = await Promise.all(
    [...grouped.entries()].map(async ([base, quotes]) => {
      const endpoint = new URL(`${FRANKFURTER_API}/${start}..${end}`);
      endpoint.searchParams.set("base", base);
      endpoint.searchParams.set("symbols", [...quotes].join(","));

      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Frankfurter request failed for ${base}: ${response.status}`);
      }

      return {
        base,
        payload: await response.json(),
      };
    }),
  );

  const pairMap = new Map();

  for (const pair of FOREX_PAIRS) {
    const source = responses.find((entry) => entry.base === pair.base);
    const rates = source?.payload?.rates ?? {};
    const closes = Object.entries(rates)
      .filter(([, values]) => typeof values?.[pair.quote] === "number")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, values]) => ({
        time: Date.parse(`${date}T00:00:00Z`),
        close: Number(values[pair.quote]),
      }));

    pairMap.set(pair.id, createSyntheticCandles(closes));
  }

  return pairMap;
}
