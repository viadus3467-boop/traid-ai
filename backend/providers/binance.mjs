const BINANCE_API = "https://api.binance.com/api/v3/klines";

export async function fetchBinanceCandles(symbol, interval = "15m", limit = 260) {
  const endpoint = new URL(BINANCE_API);
  endpoint.searchParams.set("symbol", symbol);
  endpoint.searchParams.set("interval", interval);
  endpoint.searchParams.set("limit", String(limit));

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Binance request failed for ${symbol}: ${response.status}`);
  }

  const rows = await response.json();

  return rows.map((row) => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}
